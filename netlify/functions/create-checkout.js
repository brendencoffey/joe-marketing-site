/**
 * Create Stripe Checkout Session
 * 
 * Receives cart items, creates Stripe session,
 * and saves orders to database (one per shop)
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

    // Group items by shop_id
    const itemsByShop = {};
    for (const item of items) {
      const shopId = item.shop_id || 'unknown';
      if (!itemsByShop[shopId]) {
        itemsByShop[shopId] = {
          shop_id: shopId,
          roaster: item.roaster,
          items: []
        };
      }
      itemsByShop[shopId].items.push(item);
    }

    const shopGroups = Object.values(itemsByShop);
    const numShops = shopGroups.length;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const joeFee = Math.round(subtotal * 0.1 * 100) / 100; // 10% fee
    const total = subtotal + joeFee;

    // Create line items for Stripe - group by shop
    const lineItems = [];
    
    for (const group of shopGroups) {
      for (const item of group.items) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
              description: item.roaster ? `From ${item.roaster}` : undefined,
              images: item.image ? [item.image] : undefined
            },
            unit_amount: Math.round(item.price * 100)
          },
          quantity: item.qty
        });
      }
    }

    // Add joe fee as line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'joe Service Fee',
          description: `Order handling and fulfillment (${numShops} ${numShops === 1 ? 'shop' : 'shops'})`
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
        num_shops: numShops,
        item_count: items.length
      }
    });

    // Create separate order for each shop
    const orderIds = [];
    
    for (const group of shopGroups) {
      const shopSubtotal = group.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const shopFee = Math.round((shopSubtotal / subtotal) * joeFee * 100) / 100; // Proportional fee
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          items: group.items,
          shop_id: group.shop_id !== 'unknown' ? group.shop_id : null,
          subtotal: shopSubtotal,
          joe_fee: shopFee,
          total: shopSubtotal + shopFee,
          stripe_session_id: session.id,
          status: 'pending',
          customer_name: 'Pending',
          customer_email: 'pending@checkout.com',
          internal_notes: numShops > 1 ? `Part of multi-shop order (${numShops} shops total)` : null
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
      } else {
        orderIds.push(order.id);
      }
    }

    console.log(`Created ${orderIds.length} orders for session ${session.id}`);

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