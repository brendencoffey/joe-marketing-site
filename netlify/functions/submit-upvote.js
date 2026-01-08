/**
 * Submit Upvote - Store consumer demand signals
 * POST: { shop_id, name, email }
 */

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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid email address' })
      };
    }

    // Get client info
    const ip_address = event.headers['x-forwarded-for']?.split(',')[0] || 
                       event.headers['client-ip'] || 
                       'unknown';
    const user_agent = event.headers['user-agent'] || 'unknown';

    // Check if shop exists
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Shop not found' })
      };
    }

    // Insert upvote (upsert to handle duplicates gracefully)
    const { data: upvote, error: insertError } = await supabase
      .from('shop_upvotes')
      .upsert({
        shop_id,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        ip_address,
        user_agent
      }, {
        onConflict: 'shop_id,email',
        ignoreDuplicates: true
      })
      .select()
      .single();

    if (insertError && !insertError.message.includes('duplicate')) {
      console.error('Insert error:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save upvote' })
      };
    }

    // Track the upvote activity
    await supabase.from('website_activity').insert({
      shop_id,
      activity_type: 'form_submit',
      activity_subtype: 'upvote',
      metadata: { email: email.toLowerCase().trim() }
    });

    // Get total upvote count for this shop
    const { count } = await supabase
      .from('shop_upvotes')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shop_id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Thanks ${name.trim()}! We'll let ${shop.name} know you want to order.`,
        upvote_count: count || 1
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