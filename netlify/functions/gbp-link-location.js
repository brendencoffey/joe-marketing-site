/**
 * Link GBP location to shop
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { owner_id, shop_id, gbp_location_id, gbp_account_id } = JSON.parse(event.body || '{}');
    if (!owner_id || !shop_id || !gbp_location_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    
    const { data: access } = await supabase.from('shop_owner_access').select('id').eq('owner_id', owner_id).eq('shop_id', shop_id).single();
    if (!access) return { statusCode: 403, headers, body: JSON.stringify({ error: 'No access to this shop' }) };
    
    await supabase.from('shops').update({ gbp_location_id, gbp_account_id: gbp_account_id || null }).eq('id', shop_id);
    await supabase.from('gbp_sync_log').insert({ shop_id, owner_id, action: 'link_location', status: 'success', request_payload: { gbp_location_id } });
    
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Location linked' }) };
  } catch (err) {
    console.error('GBP link error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
