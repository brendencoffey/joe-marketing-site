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
    const { refresh_token, user_email } = JSON.parse(event.body);

    if (!refresh_token) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Refresh token required' }) 
      };
    }

    // Exchange refresh token for new access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Token refresh error:', data);
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: data.error_description || 'Token refresh failed' }) 
      };
    }

    // Optionally update stored token in Supabase
    if (user_email && data.access_token) {
      await supabase
        .from('api_keys')
        .upsert({
          user_email,
          service: 'google',
          access_token: data.access_token,
          expires_at: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_email,service' });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: data.access_token,
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
