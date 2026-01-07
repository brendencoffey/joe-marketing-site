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

    console.log("Creating invoice for:", customer_email, "with", items.length, "items");

    // 1. Find or create customer
    const customerSearchRes = await fetch(
      `https://api.stripe.com/v1/customers/search?query=email:'${customer_email}'`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    );
    const customerSearch = await customerSearchRes.json();
    
    let customerId;
    if (customerSearch.data && customerSearch.data.length > 0) {
      customerId = customerSearch.data[0].id;
      console.log("Found existing customer:", customerId);
    } else {
      const createCustomerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: customer_email,
          name: customer_name || shop_name || customer_email,
        }),
      });
      const newCustomer = await createCustomerRes.json();
      if (newCustomer.error) {
        throw new Error(`Customer creation failed: ${newCustomer.error.message}`);
      }
      customerId = newCustomer.id;
      console.log("Created new customer:", customerId);
    }

    // 2. Add invoice items FIRST (as pending items for the customer)
    for (const item of items) {
      const amount = Math.round((item.custom_price || item.price) * 100);
      console.log("Adding item:", item.name, "amount:", amount, "qty:", item.quantity);
      
      const itemRes = await fetch("https://api.stripe.com/v1/invoiceitems", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: customerId,
          amount: (amount * (item.quantity || 1)).toString(),
          currency: "usd",
          description: item.name,
        }),
      });
      
      const itemResult = await itemRes.json();
      console.log("Item result:", JSON.stringify(itemResult));
      
      if (itemResult.error) {
        throw new Error(`Failed to add item: ${itemResult.error.message}`);
      }
    }

    // 3. Create invoice (will automatically include pending items)
    const invoiceRes = await fetch("https://api.stripe.com/v1/invoices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: days_until_due.toString(),
        "metadata[joe_invoice_id]": invoice_id || "",
      }),
    });
    const invoice = await invoiceRes.json();
    console.log("Invoice created:", JSON.stringify(invoice));
    
    if (invoice.error) {
      throw new Error(`Invoice creation failed: ${invoice.error.message}`);
    }

    // 4. Finalize invoice
    const finalizeRes = await fetch(`https://api.stripe.com/v1/invoices/${invoice.id}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const finalizedInvoice = await finalizeRes.json();
    console.log("Finalized invoice:", JSON.stringify(finalizedInvoice));
    
    if (finalizedInvoice.error) {
      throw new Error(`Finalize failed: ${finalizedInvoice.error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        stripe_invoice_id: finalizedInvoice.id,
        hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
        invoice_pdf: finalizedInvoice.invoice_pdf,
        amount_due: finalizedInvoice.amount_due,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Stripe invoice error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});