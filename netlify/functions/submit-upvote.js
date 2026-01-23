/**
 * Submit Upvote - Store consumer demand signals
 * POST: { shop_id, name, email }
 */
const { isRateLimited, getClientIP } = require('./rate-limiter');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Rate limit: 5 requests per minute per IP
  const ip = getClientIP(event);
  if (isRateLimited(ip, 5, 60000)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please wait.' }) };
  }

  try {
    const { shop_id, name, email } = JSON.parse(event.body || '{}');

    // Validation
    if (!shop_id || !name || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: shop_id, name, email' })
      };
    }

    // Get shop name for response
    const { data: shop } = await supabase
      .from('shops')
      .select('name')
      .eq('id', shop_id)
      .single();

    // Check if already upvoted
    const { data: existing } = await supabase
      .from('upvotes')
      .select('id')
      .eq('shop_id', shop_id)
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: `You've already requested ${shop?.name || 'this shop'}!`,
          already_voted: true
        })
      };
    }

    // Insert upvote
    const { error: insertError } = await supabase
      .from('upvotes')
      .insert({
        shop_id,
        name: name.trim(),
        email: email.toLowerCase().trim()
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    // Get updated count
    const { count } = await supabase
      .from('upvotes')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shop_id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: `Thanks ${name}! We'll let ${shop?.name || 'them'} know you want to order.`,
        upvote_count: count
      })
    };

  } catch (err) {
    console.error('Upvote error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};