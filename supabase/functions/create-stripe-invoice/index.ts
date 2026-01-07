import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { customer_email, customer_name, shop_name, items, invoice_id, notes, days_until_due = 7 } = await req.json();

    // Find or create customer
    const searchRes = await fetch(`https://api.stripe.com/v1/customers/search?query=email:'${customer_email}'`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const searchData = await searchRes.json();
    
    let customerId;
    if (searchData.data?.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      const createRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: customer_email, name: customer_name || shop_name || customer_email }),
      });
      const newCustomer = await createRes.json();
      customerId = newCustomer.id;
    }

    // Create invoice
    const invoiceRes = await fetch("https://api.stripe.com/v1/invoices", {
      method: "POST",
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: days_until_due.toString(),
        "metadata[joe_invoice_id]": invoice_id || "",
      }),
    });
    const invoice = await invoiceRes.json();
    if (invoice.error) throw new Error(invoice.error.message);

    // Add line items
    for (const item of items) {
      await fetch("https://api.stripe.com/v1/invoiceitems", {
        method: "POST",
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          invoice: invoice.id,
          quantity: (item.quantity || 1).toString(),
          currency: "usd",
          unit_amount: Math.round((item.custom_price || item.price) * 100).toString(),
          description: item.name,
        }),
      });
    }

    // Finalize invoice
    const finalizeRes = await fetch(`https://api.stripe.com/v1/invoices/${invoice.id}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const finalizedInvoice = await finalizeRes.json();
    if (finalizedInvoice.error) throw new Error(finalizedInvoice.error.message);

    return new Response(JSON.stringify({
      success: true,
      stripe_invoice_id: finalizedInvoice.id,
      hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
      invoice_pdf: finalizedInvoice.invoice_pdf,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});