// Stripe Webhook Handler with Slack Notifications
// Deploy: supabase functions deploy stripe-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Send Slack notification
async function sendSlackNotification(message: {
  text: string;
  blocks?: any[];
}) {
  try {
    await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error("Slack notification failed:", err);
  }
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature!, stripeWebhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
    });
  }

  console.log(`Processing Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      // Add other event handlers as needed
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err);
    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});

async function handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
  console.log(`Invoice paid: ${stripeInvoice.id}`);

  // Find our invoice in the database by Stripe invoice ID
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*, deals(*), shops(*), contacts(*)")
    .eq("stripe_invoice_id", stripeInvoice.id)
    .maybeSingle();

  if (invoiceError || !invoice) {
    console.error("Invoice not found in database:", stripeInvoice.id);
    
    // Still send Slack notification for unknown invoice
    await sendSlackNotification({
      text: `💳 Payment received but invoice not found in CRM`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `⚠️ *Payment Received - Invoice Not Found*\n\nStripe Invoice: \`${stripeInvoice.id}\`\nAmount: ${formatCurrency(stripeInvoice.amount_paid)}\nCustomer: ${stripeInvoice.customer_email || "Unknown"}\n\n_Please check Stripe dashboard and manually create fulfillment order if needed._`,
          },
        },
      ],
    });
    return;
  }

  // Update invoice status to paid
  const paidAt = new Date().toISOString();
  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", invoice.id);

  // Get related data
  const deal = invoice.deals;
  const shop = invoice.shops;
  const contact = invoice.contacts;
  const shopName = shop?.name || deal?.name || "Unknown Shop";
  const contactName = contact ? `${contact.first_name} ${contact.last_name}` : shop?.contact_name || "";
  const contactEmail = contact?.email || shop?.email || stripeInvoice.customer_email || "";

  // Calculate rebate date if eligible
  let rebateDate = null;
  if (invoice.rebate_eligible && invoice.rebate_days > 0) {
    const rebateDateObj = new Date();
    rebateDateObj.setDate(rebateDateObj.getDate() + invoice.rebate_days);
    // Skip weekends
    while (rebateDateObj.getDay() === 0 || rebateDateObj.getDay() === 6) {
      rebateDateObj.setDate(rebateDateObj.getDate() + 1);
    }
    rebateDate = rebateDateObj.toISOString();
    
    await supabase
      .from("invoices")
      .update({ rebate_date: rebateDate })
      .eq("id", invoice.id);
  }

  // Create fulfillment order
  const fulfillmentPipeline = await getFulfillmentPipeline();
  
  if (fulfillmentPipeline) {
    const fulfillmentOrderData = {
      deal_id: invoice.deal_id,
      invoice_id: invoice.id,
      shop_name: shopName,
      shop_id: shop?.id,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contact?.phone || shop?.phone || "",
      items: invoice.items || [],
      total_amount: invoice.amount,
      equipment_type: (invoice.items || []).map((i: any) => i.name).join(", ").substring(0, 100),
      stage: "new_order",
      target_launch_date: deal?.target_launch || null,
      is_paid: true,
      notes: invoice.notes || "",
      email_new_order_sent: false,
    };

    const { data: fulfillmentOrder, error: foError } = await supabase
      .from("fulfillment_orders")
      .insert(fulfillmentOrderData)
      .select()
      .single();

    if (!foError && fulfillmentOrder) {
      // Create deal in fulfillment pipeline
      const newOrderStage = await getNewOrderStage(fulfillmentPipeline.id);
      
      const fulfillmentDealData = {
        name: `${shopName} - Fulfillment`,
        shop_id: shop?.id,
        contact_id: contact?.id,
        pipeline_id: fulfillmentPipeline.id,
        stage: newOrderStage?.stage_key || "new_order",
        amount: invoice.amount,
        assigned_to: deal?.assigned_to,
        fulfillment_order_id: fulfillmentOrder.id,
      };

      const { data: fulfillmentDeal } = await supabase
        .from("deals")
        .insert(fulfillmentDealData)
        .select()
        .single();

      if (fulfillmentDeal) {
        await supabase
          .from("fulfillment_orders")
          .update({ deal_id: fulfillmentDeal.id })
          .eq("id", fulfillmentOrder.id);
      }

      console.log(`Fulfillment order created: ${fulfillmentOrder.id}`);
    }
  }

  // Log activity
  await supabase.from("activities").insert({
    deal_id: invoice.deal_id,
    shop_id: shop?.id,
    contact_id: contact?.id,
    activity_type: "invoice_paid",
    notes: `Invoice paid via Stripe: $${invoice.amount?.toFixed(2)}${invoice.rebate_eligible ? ` (rebate in ${invoice.rebate_days} days)` : ""}`,
    team_member_email: "system",
    team_member_name: "Stripe Webhook",
  });

  // Create rebate task if eligible
  if (invoice.rebate_eligible && rebateDate) {
    await supabase.from("tasks").insert({
      title: `💰 Rebate Due: ${shopName} - $${invoice.amount?.toFixed(2)}`,
      description: `Invoice paid on ${new Date().toLocaleDateString()}.\n\nRebate of $${invoice.amount?.toFixed(2)} due on ${new Date(rebateDate).toLocaleDateString()} (${invoice.rebate_days} days after payment).`,
      due_date: rebateDate.split("T")[0],
      deal_id: invoice.deal_id,
      contact_id: contact?.id,
      shop_id: shop?.id,
      assigned_to: deal?.assigned_to,
      status: "pending",
      priority: "high",
      task_type: "rebate",
    });
  }

  // Send Slack notification
  const itemsList = (invoice.items || [])
    .map((i: any) => `• ${i.name}${i.quantity > 1 ? ` (x${i.quantity})` : ""} - $${(i.custom_price || i.price)?.toFixed(2)}`)
    .join("\n");

  await sendSlackNotification({
    text: `💰 Invoice Paid: ${shopName} - $${invoice.amount?.toFixed(2)}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "💰 Invoice Paid!",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Shop*\n${shopName}`,
          },
          {
            type: "mrkdwn",
            text: `*Amount*\n$${invoice.amount?.toFixed(2)}`,
          },
          {
            type: "mrkdwn",
            text: `*Contact*\n${contactName || "N/A"}`,
          },
          {
            type: "mrkdwn",
            text: `*Email*\n${contactEmail || "N/A"}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Items:*\n${itemsList || "No items listed"}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `📦 Fulfillment order created in *New Order* stage${invoice.rebate_eligible ? ` | 💰 Rebate in ${invoice.rebate_days} days` : ""}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View in CRM",
              emoji: true,
            },
            url: `https://joe.coffee/crm/#deals`,
          },
        ],
      },
    ],
  });

  console.log(`Invoice ${invoice.id} processed successfully`);
}

async function handlePaymentFailed(stripeInvoice: Stripe.Invoice) {
  console.log(`Payment failed for invoice: ${stripeInvoice.id}`);

  // Find our invoice
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, shops(*)")
    .eq("stripe_invoice_id", stripeInvoice.id)
    .maybeSingle();

  const shopName = invoice?.shops?.name || "Unknown Shop";

  // Send Slack alert
  await sendSlackNotification({
    text: `⚠️ Payment Failed: ${shopName}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⚠️ Payment Failed",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Shop:* ${shopName}\n*Amount:* ${formatCurrency(stripeInvoice.amount_due)}\n*Customer:* ${stripeInvoice.customer_email || "Unknown"}\n\n_Customer will receive automatic retry emails from Stripe._`,
        },
      },
    ],
  });
}

async function getFulfillmentPipeline() {
  const { data } = await supabase
    .from("pipelines")
    .select("*")
    .or("name.ilike.%shipping%,name.ilike.%fulfillment%")
    .maybeSingle();
  return data;
}

async function getNewOrderStage(pipelineId: string) {
  const { data } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .or("stage_key.eq.new_order,name.ilike.%new order%")
    .maybeSingle();
  return data;
}
