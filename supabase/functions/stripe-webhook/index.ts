import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const event = JSON.parse(body);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    console.log("Stripe webhook event:", event.type);

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const joeInvoiceId = invoice.metadata?.joe_invoice_id;
      
      if (joeInvoiceId) {
        const { data: existingInvoice } = await supabase
          .from("invoices")
          .select("*, deals(assigned_to, shop_id), shops(name)")
          .eq("id", joeInvoiceId)
          .single();

        if (existingInvoice) {
          const paidAt = new Date().toISOString();
          await supabase
            .from("invoices")
            .update({ 
              status: "paid", 
              paid_at: paidAt,
              stripe_payment_intent: invoice.payment_intent 
            })
            .eq("id", joeInvoiceId);

          await supabase.from("activities").insert({
            deal_id: existingInvoice.deal_id,
            contact_id: existingInvoice.contact_id,
            shop_id: existingInvoice.shop_id,
            activity_type: "invoice_paid",
            notes: `💳 Payment received via Stripe: $${(invoice.amount_paid / 100).toFixed(2)}`,
          });

          if (existingInvoice.rebate_eligible && existingInvoice.rebate_days > 0) {
            const rebateDate = new Date(paidAt);
            rebateDate.setDate(rebateDate.getDate() + existingInvoice.rebate_days);
            
            const day = rebateDate.getDay();
            if (day === 6) rebateDate.setDate(rebateDate.getDate() + 2);
            if (day === 0) rebateDate.setDate(rebateDate.getDate() + 1);

            await supabase
              .from("invoices")
              .update({ rebate_date: rebateDate.toISOString() })
              .eq("id", joeInvoiceId);

            const shopName = existingInvoice.shops?.name || "Partner";
            await supabase.from("tasks").insert({
              title: `💰 Rebate Due: ${shopName} - $${(invoice.amount_paid / 100).toFixed(2)}`,
              description: `Invoice paid on ${new Date(paidAt).toLocaleDateString()}.\n\nRebate of $${(invoice.amount_paid / 100).toFixed(2)} due on ${rebateDate.toLocaleDateString()} (${existingInvoice.rebate_days} days after payment).`,
              due_date: rebateDate.toISOString().split("T")[0],
              deal_id: existingInvoice.deal_id,
              contact_id: existingInvoice.contact_id,
              shop_id: existingInvoice.shop_id,
              assigned_to: existingInvoice.deals?.assigned_to,
              status: "pending",
              priority: "high",
              task_type: "rebate",
            });
          }

          console.log(`Invoice ${joeInvoiceId} marked as paid`);
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const joeInvoiceId = invoice.metadata?.joe_invoice_id;
      
      if (joeInvoiceId) {
        await supabase
          .from("invoices")
          .update({ status: "overdue" })
          .eq("id", joeInvoiceId);

        const { data: existingInvoice } = await supabase
          .from("invoices")
          .select("deal_id, contact_id, shop_id")
          .eq("id", joeInvoiceId)
          .single();

        if (existingInvoice) {
          await supabase.from("activities").insert({
            deal_id: existingInvoice.deal_id,
            contact_id: existingInvoice.contact_id,
            shop_id: existingInvoice.shop_id,
            activity_type: "invoice_failed",
            notes: `⚠️ Payment failed for invoice $${(invoice.amount_due / 100).toFixed(2)}`,
          });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});