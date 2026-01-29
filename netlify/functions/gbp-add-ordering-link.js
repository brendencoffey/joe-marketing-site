/**
 * Add ordering link to GBP
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { owner_id, shop_id, gbp_location_id } = JSON.parse(event.body || '{}');
    if (!owner_id || !shop_id || !gbp_location_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    
    const { data: owner } = await supabase.from('shop_owners').select('gbp_access_token, gbp_refresh_token, gbp_token_expires_at').eq('id', owner_id).single();
    if (!owner?.gbp_access_token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'GBP not connected' }) };
    
    const { data: shop } = await supabase.from('shops').select('slug, state, city, name').eq('id', shop_id).single();
    if (!shop) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Shop not found' }) };
    
    let accessToken = owner.gbp_access_token;
    if (new Date(owner.gbp_token_expires_at) < new Date()) {
      accessToken = await refreshToken(owner_id, owner.gbp_refresh_token);
      if (!accessToken) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token refresh failed' }) };
    }
    
    const state = (shop.state || '').toLowerCase();
    const city = (shop.city || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const orderingUrl = `https://joe.coffee/locations/${state}/${city}/${shop.slug}/`;
    
    const existingRes = await fetch(`https://mybusinessplaceactions.googleapis.com/v1/${gbp_location_id}/placeActionLinks`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const existingData = await existingRes.json();
    const existingOrderLink = (existingData.placeActionLinks || []).find(l => l.placeActionType === 'ORDER_ONLINE');
    
    let method = 'POST', url = `https://mybusinessplaceactions.googleapis.com/v1/${gbp_location_id}/placeActionLinks`;
    if (existingOrderLink) { method = 'PATCH'; url = `https://mybusinessplaceactions.googleapis.com/v1/${existingOrderLink.name}?updateMask=uri`; }
    
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ placeActionType: 'ORDER_ONLINE', uri: orderingUrl, isPreferred: true }) });
    const result = await res.json();
    
    await supabase.from('gbp_sync_log').insert({ shop_id, owner_id, action: 'add_ordering_link', status: res.ok ? 'success' : 'failed', request_payload: { orderingUrl, gbp_location_id }, response_payload: result, error_message: result.error?.message });
    
    if (res.ok) {
      await supabase.from('shops').update({ gbp_location_id, gbp_last_synced_at: new Date().toISOString() }).eq('id', shop_id);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Ordering link added!', orderingUrl }) };
    }
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: result.error?.message || 'Failed' }) };
  } catch (err) {
    console.error('GBP ordering link error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function refreshToken(ownerId, refreshTok) {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: refreshTok, client_id: process.env.GOOGLE_GBP_CLIENT_ID, client_secret: process.env.GOOGLE_GBP_CLIENT_SECRET, grant_type: 'refresh_token' }) });
    const tokens = await res.json();
    if (tokens.error) return null;
    await supabase.from('shop_owners').update({ gbp_access_token: tokens.access_token, gbp_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }).eq('id', ownerId);
    return tokens.access_token;
  } catch (err) { return null; }
}
