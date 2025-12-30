const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { code, user_email, redirect_uri } = JSON.parse(event.body);

    if (!code || !user_email) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Code and user_email required' }) 
      };
    }

    // Exchange authorization code for tokens
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri || 'postmessage'
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Token exchange error:', data);
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: data.error_description || 'Token exchange failed' }) 
      };
    }

    // Store tokens in Supabase
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000)).toISOString();
    
    // Check if record exists
    const { data: existing } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_email', user_email)
      .eq('service', 'google')
      .single();

    if (existing) {
      await supabase
        .from('api_keys')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token || undefined, // Only update if we got a new one
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_email', user_email)
        .eq('service', 'google');
    } else {
      await supabase
        .from('api_keys')
        .insert({
          user_email,
          service: 'google',
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        token_type: data.token_type
      })
    };

  } catch (err) {
    console.error('Error:', err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Server error' }) 
    };
  }
};
