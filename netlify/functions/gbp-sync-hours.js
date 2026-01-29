/**
 * Sync hours to GBP
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const DAY_MAP = { sunday: 'SUNDAY', monday: 'MONDAY', tuesday: 'TUESDAY', wednesday: 'WEDNESDAY', thursday: 'THURSDAY', friday: 'FRIDAY', saturday: 'SATURDAY' };

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { owner_id, shop_id, gbp_location_id } = JSON.parse(event.body || '{}');
    if (!owner_id || !shop_id || !gbp_location_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    
    const { data: owner } = await supabase.from('shop_owners').select('gbp_access_token, gbp_refresh_token, gbp_token_expires_at').eq('id', owner_id).single();
    if (!owner?.gbp_access_token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'GBP not connected' }) };
    
    const { data: shop } = await supabase.from('shops').select('hours, name').eq('id', shop_id).single();
    if (!shop) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Shop not found' }) };
    
    let accessToken = owner.gbp_access_token;
    if (new Date(owner.gbp_token_expires_at) < new Date()) {
      accessToken = await refreshToken(owner_id, owner.gbp_refresh_token);
      if (!accessToken) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token refresh failed' }) };
    }
    
    const periods = [];
    if (shop.hours) {
      const hoursData = typeof shop.hours === 'string' ? JSON.parse(shop.hours) : shop.hours;
      for (const [day, timeStr] of Object.entries(hoursData)) {
        const gbpDay = DAY_MAP[day.toLowerCase()];
        if (!gbpDay || !timeStr || timeStr.toLowerCase() === 'closed') continue;
        const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?\s*[-–to]+\s*(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
        if (match) {
          const openTime = parseTime(match[1], match[2], match[3]);
          const closeTime = parseTime(match[4], match[5], match[6]);
          if (openTime && closeTime) periods.push({ openDay: gbpDay, openTime, closeDay: gbpDay, closeTime });
        }
      }
    }
    
    if (!periods.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid hours found' }) };
    
    const res = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${gbp_location_id}?updateMask=regularHours`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ regularHours: { periods } })
    });
    const result = await res.json();
    
    await supabase.from('gbp_sync_log').insert({ shop_id, owner_id, action: 'sync_hours', status: res.ok ? 'success' : 'failed', request_payload: { periods }, response_payload: result, error_message: result.error?.message });
    
    if (res.ok) {
      await supabase.from('shops').update({ gbp_location_id, gbp_last_synced_at: new Date().toISOString() }).eq('id', shop_id);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Hours synced!', periods: periods.length }) };
    }
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: result.error?.message || 'Failed' }) };
  } catch (err) {
    console.error('GBP sync hours error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function parseTime(h, m, ampm) {
  let hours = parseInt(h) || 0;
  const minutes = parseInt(m) || 0;
  if (ampm) { if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12; if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0; }
  return { hours, minutes };
}

async function refreshToken(ownerId, refreshTok) {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: refreshTok, client_id: process.env.GOOGLE_GBP_CLIENT_ID, client_secret: process.env.GOOGLE_GBP_CLIENT_SECRET, grant_type: 'refresh_token' }) });
    const tokens = await res.json();
    if (tokens.error) return null;
    await supabase.from('shop_owners').update({ gbp_access_token: tokens.access_token, gbp_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }).eq('id', ownerId);
    return tokens.access_token;
  } catch (err) { return null; }
}
