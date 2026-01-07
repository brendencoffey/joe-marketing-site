import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { invoice_id } = await req.json();
    
    if (!invoice_id) {
      throw new Error("invoice_id is required");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get invoice details
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("*, deals(assigned_to, shop_id), shops(name)")
      .eq("id", invoice_id)
      .single();

    if (fetchError || !invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.rebate_status === "processed") {
      throw new Error("Rebate already processed");
    }

    if (!invoice.stripe_payment_intent && !invoice.stripe_invoice_id) {
      throw new Error("No Stripe payment found for this invoice");
    }

    console.log("Processing rebate for invoice:", invoice_id);

    // Get the payment intent from Stripe invoice
    let paymentIntentId = invoice.stripe_payment_intent;
    
    if (!paymentIntentId && invoice.stripe_invoice_id) {
      // Fetch the invoice from Stripe to get payment intent
      const stripeInvoiceRes = await fetch(
        `https://api.stripe.com/v1/invoices/${invoice.stripe_invoice_id}`,
        {
          headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
        }
      );
      const stripeInvoice = await stripeInvoiceRes.json();
      paymentIntentId = stripeInvoice.payment_intent;
    }

    if (!paymentIntentId) {
      throw new Error("Could not find payment intent for refund");
    }

    // Calculate refund amount (full amount for rebate)
    const refundAmount = invoice.total_amount || invoice.amount;
    if (!refundAmount) {
      throw new Error("Invoice has no amount to refund");
    }
    const refundAmountCents = Math.round(refundAmount * 100);

    console.log("Creating refund for payment intent:", paymentIntentId, "amount:", refundAmountCents);

    // Create refund in Stripe
    const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        payment_intent: paymentIntentId,
        amount: refundAmountCents.toString(),
        reason: "requested_by_customer",
        "metadata[type]": "rebate",
        "metadata[joe_invoice_id]": invoice_id,
      }),
    });

    const refund = await refundRes.json();
    console.log("Stripe refund response:", JSON.stringify(refund));

    if (refund.error) {
      throw new Error(`Stripe refund failed: ${refund.error.message}`);
    }

    // Update invoice with rebate status
    const processedAt = new Date().toISOString();
    await supabase
      .from("invoices")
      .update({
        rebate_status: "processed",
        rebate_processed_at: processedAt,
        stripe_refund_id: refund.id,
      })
      .eq("id", invoice_id);

    // Log activity
    await supabase.from("activities").insert({
      deal_id: invoice.deal_id,
      contact_id: invoice.contact_id,
      shop_id: invoice.shop_id,
      activity_type: "rebate_processed",
      notes: `💰 Rebate processed: $${refundAmount.toFixed(2)} refunded to customer via Stripe`,
    });

    // Mark the rebate task as complete
    await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: processedAt })
      .eq("deal_id", invoice.deal_id)
      .eq("task_type", "rebate")
      .eq("status", "pending");

    const shopName = invoice.shops?.name || "Partner";

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refund.id,
        amount: refundAmount,
        message: `Rebate of $${refundAmount.toFixed(2)} sent to ${shopName}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Rebate processing error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});