// Stripe Webhook Handler with Slack Notifications
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Simple signature verification (same as old working code)
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const parts = signature.split(",");
    const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1];
    const sig = parts.find(p => p.startsWith("v1="))?.split("=")[1];
    
    if (!timestamp || !sig) return false;
    
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature_bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const computed = Array.from(new Uint8Array(signature_bytes))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    return computed === sig;
  } catch {
    return false;
  }
}

// Send Slack notification
async function sendSlackNotification(message: any) {
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error("Slack notification failed:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";
    
    // Verify webhook signature
    const isValid = await verifySignature(body, signature, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error("Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);
    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case "invoice.paid": {
        await handleInvoicePaid(event.data.object);
        break;
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(event.data.object);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleInvoicePaid(stripeInvoice: any) {
  console.log(`Invoice paid: ${stripeInvoice.id}`);

  // Find our invoice in the database by Stripe invoice ID
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
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
            text: `⚠️ *Payment Received - Invoice Not Found*\n\nStripe Invoice: \`${stripeInvoice.id}\`\nAmount: $${(stripeInvoice.amount_paid / 100).toFixed(2)}\nCustomer: ${stripeInvoice.customer_email || "Unknown"}\n\n_Please check Stripe dashboard and manually create fulfillment order if needed._`,
          },
        },
      ],
    });
    return;
  }

  // Get related data
  const { data: deal } = await supabase.from("deals").select("*").eq("id", invoice.deal_id).maybeSingle();
  const { data: shop } = await supabase.from("shops").select("*").eq("id", invoice.shop_id).maybeSingle();
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", invoice.contact_id).maybeSingle();

  const shopName = shop?.name || deal?.name || "Unknown Shop";
  const contactName = contact ? `${contact.first_name} ${contact.last_name}` : shop?.contact_name || "";
  const contactEmail = contact?.email || shop?.email || stripeInvoice.customer_email || "";

  // Update invoice status to paid
  const paidAt = new Date().toISOString();
  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", invoice.id);

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

  // Get fulfillment pipeline
  const { data: fulfillmentPipeline } = await supabase
    .from("pipelines")
    .select("*")
    .or("name.ilike.%shipping%,name.ilike.%fulfillment%")
    .maybeSingle();

  console.log("Fulfillment pipeline lookup:", fulfillmentPipeline ? fulfillmentPipeline.name : "NOT FOUND");

  if (fulfillmentPipeline) {
    // Get the "New Order" stage
    const { data: newOrderStage } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("pipeline_id", fulfillmentPipeline.id)
      .or("stage_key.eq.new_order,name.ilike.%new order%")
      .maybeSingle();

    console.log("New order stage lookup:", newOrderStage ? newOrderStage.name : "NOT FOUND - using 'new_order'");

    // If no specific stage found, get the first stage for this pipeline
    let stageToUse = newOrderStage?.stage_key || "new_order";
    if (!newOrderStage) {
      const { data: firstStage } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", fulfillmentPipeline.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (firstStage) {
        stageToUse = firstStage.stage_key;
        console.log("Using first stage instead:", firstStage.name);
      }
    }

    // Create fulfillment order
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
      assigned_to: deal?.assigned_to || null,
    };

    const { data: fulfillmentOrder, error: foError } = await supabase
      .from("fulfillment_orders")
      .insert(fulfillmentOrderData)
      .select()
      .single();

    if (!foError && fulfillmentOrder) {
      // Create deal in fulfillment pipeline
      const fulfillmentDealData = {
        name: `${shopName} - Fulfillment`,
        shop_id: shop?.id,
        contact_id: contact?.id,
        pipeline_id: fulfillmentPipeline.id,
        stage: stageToUse,
        amount: invoice.amount,
        assigned_to: deal?.assigned_to,
      };

      const { data: fulfillmentDeal, error: dealError } = await supabase
        .from("deals")
        .insert(fulfillmentDealData)
        .select()
        .single();

      if (dealError) {
        console.error("Failed to create fulfillment deal:", dealError);
      } else if (fulfillmentDeal) {
        await supabase
          .from("fulfillment_orders")
          .update({ deal_id: fulfillmentDeal.id })
          .eq("id", fulfillmentOrder.id);
        console.log(`Fulfillment deal created: ${fulfillmentDeal.id}`);
      }

      console.log(`Fulfillment order created: ${fulfillmentOrder.id}`);
    } else {
      console.error("Failed to create fulfillment order:", foError);
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
          { type: "mrkdwn", text: `*Shop*\n${shopName}` },
          { type: "mrkdwn", text: `*Amount*\n$${invoice.amount?.toFixed(2)}` },
          { type: "mrkdwn", text: `*Contact*\n${contactName || "N/A"}` },
          { type: "mrkdwn", text: `*Email*\n${contactEmail || "N/A"}` },
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
            text: { type: "plain_text", text: "View in CRM", emoji: true },
            url: `https://joe.coffee/crm/#deals`,
          },
        ],
      },
    ],
  });

  console.log(`Invoice ${invoice.id} processed successfully`);
}

async function handlePaymentFailed(stripeInvoice: any) {
  console.log(`Payment failed for invoice: ${stripeInvoice.id}`);

  // Find our invoice
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("stripe_invoice_id", stripeInvoice.id)
    .maybeSingle();

  const { data: shop } = invoice?.shop_id 
    ? await supabase.from("shops").select("name").eq("id", invoice.shop_id).maybeSingle()
    : { data: null };

  const shopName = shop?.name || "Unknown Shop";

  // Send Slack alert
  await sendSlackNotification({
    text: `⚠️ Payment Failed: ${shopName}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "⚠️ Payment Failed", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Shop:* ${shopName}\n*Amount:* $${(stripeInvoice.amount_due / 100).toFixed(2)}\n*Customer:* ${stripeInvoice.customer_email || "Unknown"}\n\n_Customer will receive automatic retry emails from Stripe._`,
        },
      },
    ],
  });
}
