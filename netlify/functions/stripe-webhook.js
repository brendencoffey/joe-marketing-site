/**
 * Stripe Webhook Handler
 * 
 * Handles checkout.session.completed event to:
 * - Update order with customer info
 * - Update order with shipping address
 * - Mark order as paid
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    // If webhook secret is set, verify signature
    if (webhookSecret) {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        sig,
        webhookSecret
      );
    } else {
      // For testing without webhook secret
      stripeEvent = JSON.parse(event.body);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`
    };
  }

  // Handle the event
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    
    console.log('Checkout session completed:', session.id);

    try {
      // Data is already in the event - no need to re-fetch
      const customerDetails = session.customer_details || {};
      const shipping = session.shipping || {};
      const shippingAddress = shipping.address || {};

      console.log('Customer:', customerDetails);
      console.log('Shipping:', shipping);

      // Update ALL orders with this session ID (could be multiple shops)
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          customer_name: shipping.name || customerDetails.name || 'Unknown',
          customer_email: customerDetails.email || 'unknown@email.com',
          customer_phone: customerDetails.phone || null,
          shipping_address: {
            name: shipping.name,
            line1: shippingAddress.line1,
            line2: shippingAddress.line2,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postal_code: shippingAddress.postal_code,
            country: shippingAddress.country
          },
          stripe_payment_intent: session.payment_intent,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_session_id', session.id)
        .select();

      if (error) {
        console.error('Database update error:', error);
      } else {
        console.log(`Updated ${data.length} order(s) for session ${session.id}`);
      }

      // TODO: Send confirmation email to customer
      // await sendOrderConfirmationEmail(customerDetails.email, data[0]);

    } catch (err) {
      console.error('Error processing checkout:', err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true })
  };
};