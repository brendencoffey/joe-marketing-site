/**
 * Disconnect GBP
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
    
    await supabase.from('shop_owners').update({
      gbp_access_token: null, gbp_refresh_token: null, gbp_token_expires_at: null, gbp_account_id: null
    }).eq('id', owner_id);
    
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
