/**
 * Homepage Data API
 * Returns stats and photos for homepage hero
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const lat = event.queryStringParameters?.lat;
    const lng = event.queryStringParameters?.lng;

    // Get total counts
    const { count: totalShops } = await supabase
      .from('shops')
      .select('*', { count: 'exact', head: true });

    const { count: partnerCount } = await supabase
      .from('shops')
      .select('*', { count: 'exact', head: true })
      .or('is_joe_partner.eq.true,partner_id.not.is.null');

    // Get unique cities count
    const { data: citiesData } = await supabase
      .from('shops')
      .select('city')
      .not('city', 'is', null);
    
    const uniqueCities = new Set(citiesData?.map(s => s.city) || []);

    // Get photos - prioritize partners, then nearby if location provided
    let photosQuery = supabase
      .from('shops')
      .select('photos, name, city, is_joe_partner, partner_id')
      .not('photos', 'is', null)
      .limit(30);

    // If location provided, try to get nearby shops first
    if (lat && lng) {
      // Get shops ordered by partner status first
      const { data: nearbyShops } = await supabase
        .from('shops')
        .select('photos, name, city, is_joe_partner, partner_id, lat, lng')
        .not('photos', 'is', null)
        .not('lat', 'is', null)
        .gte('lat', parseFloat(lat) - 2)
        .lte('lat', parseFloat(lat) + 2)
        .gte('lng', parseFloat(lng) - 2)
        .lte('lng', parseFloat(lng) + 2)
        .limit(50);

      if (nearbyShops && nearbyShops.length > 0) {
        // Sort: partners first, then by distance
        const sorted = nearbyShops.sort((a, b) => {
          const aPartner = a.is_joe_partner || a.partner_id ? 1 : 0;
          const bPartner = b.is_joe_partner || b.partner_id ? 1 : 0;
          return bPartner - aPartner;
        });

        const photos = [];
        sorted.forEach(shop => {
          if (shop.photos && shop.photos.length > 0 && photos.length < 12) {
            photos.push({
              url: shop.photos[0],
              name: shop.name,
              city: shop.city,
              isPartner: !!(shop.is_joe_partner || shop.partner_id)
            });
          }
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            stats: {
              totalShops: totalShops || 0,
              partnerCount: partnerCount || 0,
              cityCount: uniqueCities.size
            },
            photos,
            location: 'nearby'
          })
        };
      }
    }

    // Fallback: get partner photos first, then fill with others
    const { data: partnerShops } = await supabase
      .from('shops')
      .select('photos, name, city')
      .not('photos', 'is', null)
      .or('is_joe_partner.eq.true,partner_id.not.is.null')
      .limit(20);

    const { data: otherShops } = await supabase
      .from('shops')
      .select('photos, name, city')
      .not('photos', 'is', null)
      .is('is_joe_partner', null)
      .is('partner_id', null)
      .limit(20);

    const photos = [];
    
    // Add partner photos first
    (partnerShops || []).forEach(shop => {
      if (shop.photos && shop.photos.length > 0 && photos.length < 8) {
        photos.push({
          url: shop.photos[0],
          name: shop.name,
          city: shop.city,
          isPartner: true
        });
      }
    });

    // Fill remaining with other shops
    (otherShops || []).forEach(shop => {
      if (shop.photos && shop.photos.length > 0 && photos.length < 12) {
        photos.push({
          url: shop.photos[0],
          name: shop.name,
          city: shop.city,
          isPartner: false
        });
      }
    });

    // Shuffle a bit but keep partners toward front
    const partnerPhotos = photos.filter(p => p.isPartner);
    const otherPhotos = photos.filter(p => !p.isPartner);
    const shuffledOther = otherPhotos.sort(() => Math.random() - 0.5);
    const finalPhotos = [...partnerPhotos, ...shuffledOther].slice(0, 12);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        stats: {
          totalShops: totalShops || 0,
          partnerCount: partnerCount || 0,
          cityCount: uniqueCities.size
        },
        photos: finalPhotos,
        location: 'default'
      })
    };

  } catch (error) {
    console.error('Homepage data error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to load data' })
    };
  }
};