/**
 * Google GBP OAuth Callback
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  const code = event.queryStringParameters?.code;
  const error = event.queryStringParameters?.error;
  
  if (error) return redirect('/owner/?gbp_error=' + encodeURIComponent(error));
  if (!code) return redirect('/owner/?gbp_error=no_code');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_GBP_CLIENT_ID,
        client_secret: process.env.GOOGLE_GBP_CLIENT_SECRET,
        redirect_uri: 'https://joe.coffee/.netlify/functions/google-gbp-callback',
        grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenRes.json();
    if (tokens.error) return redirect('/owner/?gbp_error=' + encodeURIComponent(tokens.error_description || tokens.error));
    
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const profile = await profileRes.json();
    
    let accounts = [];
    try {
      const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      accounts = (await accountsRes.json()).accounts || [];
    } catch (err) { console.error('GBP accounts error:', err); }
    
    const { data: owner } = await supabase.from('shop_owners').select('*').eq('email', profile.email.toLowerCase()).single();
    if (!owner) return redirect('/owner/?gbp_error=owner_not_found');
    
    await supabase.from('shop_owners').update({
      gbp_access_token: tokens.access_token,
      gbp_refresh_token: tokens.refresh_token,
      gbp_token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
      gbp_account_id: accounts[0]?.name || null
    }).eq('id', owner.id);
    
    return redirect('/owner/?gbp=connected&accounts=' + accounts.length);
  } catch (err) {
    console.error('GBP callback error:', err);
    return redirect('/owner/?gbp_error=' + encodeURIComponent(err.message));
  }
};

function redirect(url) { return { statusCode: 302, headers: { Location: url }, body: '' }; }
