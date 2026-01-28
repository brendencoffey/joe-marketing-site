/**
 * Get Stats API - Returns current shop/partner/city counts
 * Used by homepage and /locations/ for dynamic updates
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    // Get total active shops
    const { count: totalShops } = await supabase
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get joe partners count
    const { count: partnerCount } = await supabase
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_joe_partner', true);

    // Get unique cities count
    const { data: cityData } = await supabase
      .from('shops')
      .select('city, state')
      .eq('is_active', true)
      .not('city', 'is', null);
    
    const uniqueCities = new Set(cityData?.map(s => `${s.city}-${s.state}`) || []);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // 5 min cache
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        totalShops: totalShops || 0,
        partnerCount: partnerCount || 0,
        cityCount: uniqueCities.size
      })
    };
  } catch (err) {
    console.error('Stats error:', err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: err.message })
    };
  }
};
