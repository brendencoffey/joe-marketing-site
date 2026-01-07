import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Simple signature verification (for production, use Stripe's library)
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";
    
    // Verify webhook signature (optional but recommended)
    // const isValid = await verifySignature(body, signature, STRIPE_WEBHOOK_SECRET);
    // if (!isValid) {
    //   return new Response("Invalid signature", { status: 401 });
    // }

    const event = JSON.parse(body);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    console.log("Stripe webhook event:", event.type);

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const joeInvoiceId = invoice.metadata?.joe_invoice_id;
      
      if (joeInvoiceId) {
        // Update invoice status in Supabase
        const { data: existingInvoice, error: fetchError } = await supabase
          .from("invoices")
          .select("*, deals(assigned_to, shop_id), shops(name)")
          .eq("id", joeInvoiceId)
          .single();

        if (existingInvoice) {
          // Mark invoice as paid
          const paidAt = new Date().toISOString();
          await supabase
            .from("invoices")
            .update({ 
              status: "paid", 
              paid_at: paidAt,
              stripe_payment_intent: invoice.payment_intent 
            })
            .eq("id", joeInvoiceId);

          // Log activity
          await supabase.from("activities").insert({
            deal_id: existingInvoice.deal_id,
            contact_id: existingInvoice.contact_id,
            shop_id: existingInvoice.shop_id,
            activity_type: "invoice_paid",
            notes: `💳 Payment received via Stripe: $${(invoice.amount_paid / 100).toFixed(2)}`,
          });

          // Handle rebate if eligible
          if (existingInvoice.rebate_eligible && existingInvoice.rebate_days > 0) {
            const rebateDate = new Date(paidAt);
            rebateDate.setDate(rebateDate.getDate() + existingInvoice.rebate_days);
            
            // Adjust for weekends
            const day = rebateDate.getDay();
            if (day === 6) rebateDate.setDate(rebateDate.getDate() + 2);
            if (day === 0) rebateDate.setDate(rebateDate.getDate() + 1);

            // Update invoice with rebate date
            await supabase
              .from("invoices")
              .update({ rebate_date: rebateDate.toISOString() })
              .eq("id", joeInvoiceId);

            // Create rebate task
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