/**
 * Create Stripe Checkout Session
 * 
 * Receives cart items, creates Stripe session,
 * and saves order to database
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { items } = JSON.parse(event.body);

    if (!items || items.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Cart is empty' })
      };
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const joeFee = Math.round(subtotal * 0.1 * 100) / 100; // 10% fee
    const total = subtotal + joeFee;

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.roaster ? `From ${item.roaster}` : undefined,
          images: item.image ? [item.image] : undefined
        },
        unit_amount: Math.round(item.price * 100) // Stripe uses cents
      },
      quantity: item.qty
    }));

    // Add joe fee as line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'joe Service Fee',
          description: 'Order handling and fulfillment'
        },
        unit_amount: Math.round(joeFee * 100)
      },
      quantity: 1
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.URL || 'https://joe.coffee'}/marketplace/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://joe.coffee'}/marketplace/`,
      shipping_address_collection: {
        allowed_countries: ['US']
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'Standard Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 10 }
            }
          }
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 999, currency: 'usd' },
            display_name: 'Express Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 2 },
              maximum: { unit: 'business_day', value: 4 }
            }
          }
        }
      ],
      metadata: {
        shop_id: items[0]?.shop_id || null,
        item_count: items.length
      }
    });

    // Create pending order in database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        items: items,
        shop_id: items[0]?.shop_id || null,
        subtotal: subtotal,
        joe_fee: joeFee,
        total: total,
        stripe_session_id: session.id,
        status: 'pending',
        customer_name: 'Pending', // Will update after payment
        customer_email: 'pending@checkout.com'
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      // Continue anyway - we can reconcile later
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId: session.id })
    };

  } catch (err) {
    console.error('Checkout error:', err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: err.message })
    };
  }
};