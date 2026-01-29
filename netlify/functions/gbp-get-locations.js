/**
 * Get GBP Locations
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { owner_id } = JSON.parse(event.body || '{}');
    if (!owner_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing owner_id' }) };
    
    const { data: owner } = await supabase.from('shop_owners')
      .select('gbp_access_token, gbp_refresh_token, gbp_token_expires_at, gbp_account_id')
      .eq('id', owner_id).single();
    
    if (!owner?.gbp_access_token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'GBP not connected', code: 'NOT_CONNECTED' }) };
    
    let accessToken = owner.gbp_access_token;
    if (new Date(owner.gbp_token_expires_at) < new Date()) {
      accessToken = await refreshToken(owner_id, owner.gbp_refresh_token);
      if (!accessToken) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' }) };
    }
    
    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const accountsData = await accountsRes.json();
    if (accountsData.error) return { statusCode: 400, headers, body: JSON.stringify({ error: accountsData.error.message }) };
    
    const accounts = accountsData.accounts || [];
    const allLocations = [];
    
    for (const account of accounts) {
      try {
        const locRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,regularHours,websiteUri,phoneNumbers`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const locData = await locRes.json();
        if (locData.locations) {
          locData.locations.forEach(loc => allLocations.push({ ...loc, accountName: account.name }));
        }
      } catch (err) { console.error(`Locations error for ${account.name}:`, err); }
    }
    
    return { statusCode: 200, headers, body: JSON.stringify({ accounts: accounts.length, locations: allLocations }) };
  } catch (err) {
    console.error('GBP get locations error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function refreshToken(ownerId, refreshTok) {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshTok, client_id: process.env.GOOGLE_GBP_CLIENT_ID, client_secret: process.env.GOOGLE_GBP_CLIENT_SECRET, grant_type: 'refresh_token' })
    });
    const tokens = await res.json();
    if (tokens.error) return null;
    await supabase.from('shop_owners').update({ gbp_access_token: tokens.access_token, gbp_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }).eq('id', ownerId);
    return tokens.access_token;
  } catch (err) { return null; }
}
