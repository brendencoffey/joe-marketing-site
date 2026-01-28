/**
 * Shops Sitemap Generator
 * Handles 65k+ shop URLs with automatic pagination
 * 
 * URLs:
 *   /sitemaps/shops.xml - Sitemap index (hardcoded for speed)
 *   /sitemaps/shops-1.xml - First 45,000 shops
 *   /sitemaps/shops-2.xml - Next 45,000 shops
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SHOPS_PER_SITEMAP = 40000; // Reduced for safety
const BASE_URL = 'https://joe.coffee';

// Hardcode the number of sitemaps to avoid slow COUNT query
// With ~65k shops and 40k per sitemap, we need 2 sitemaps
const NUM_SITEMAPS = 2;

exports.handler = async (event) => {
  try {
    const path = event.path || event.rawUrl || '';
    
    // Check if this is a paginated request (shops-1.xml, shops-2.xml, etc.)
    const pageMatch = path.match(/shops-(\d+)\.xml/);
    
    if (pageMatch) {
      const page = parseInt(pageMatch[1], 10);
      return await generateShopsSitemap(page);
    } else {
      // Return index (no DB call needed)
      return generateSitemapIndex();
    }
    
  } catch (error) {
    console.error('Sitemap error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Error: ' + (error.message || JSON.stringify(error))
    };
  }
};

/**
 * Generate sitemap index - no DB call, just static XML
 */
function generateSitemapIndex() {
  const today = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (let i = 1; i <= NUM_SITEMAPS; i++) {
    xml += `  <sitemap>
    <loc>${BASE_URL}/sitemaps/shops-${i}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
`;
  }

  xml += `</sitemapindex>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400' // 24 hour cache
    },
    body: xml
  };
}

/**
 * Generate a specific page of shops
 */
async function generateShopsSitemap(page) {
  const offset = (page - 1) * SHOPS_PER_SITEMAP;
  
  console.log(`Fetching shops for page ${page}, offset ${offset}, limit ${SHOPS_PER_SITEMAP}`);
  
  // Simple query - just get what we need
  const { data: shops, error } = await supabase
    .from('shops')
    .select('slug, state_code, city_slug, is_joe_partner, google_rating, updated_at')
    .eq('is_active', true)
    .not('state_code', 'is', null)
    .not('city_slug', 'is', null)
    .not('slug', 'is', null)
    .range(offset, offset + SHOPS_PER_SITEMAP - 1);
  
  if (error) {
    console.error('Supabase error:', JSON.stringify(error, null, 2));
    throw new Error(error.message || 'Database query failed');
  }
  
  console.log(`Fetched ${shops?.length || 0} shops`);
  
  if (!shops || shops.length === 0) {
    // Return empty sitemap instead of 404
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400'
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`
    };
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const shop of shops) {
    if (!shop.state_code || !shop.city_slug || !shop.slug) continue;
    
    const url = `${BASE_URL}/locations/${shop.state_code.toLowerCase()}/${shop.city_slug}/${shop.slug}/`;
    const lastmod = shop.updated_at ? new Date(shop.updated_at).toISOString().split('T')[0] : today;
    const priority = shop.is_joe_partner ? '0.8' : (shop.google_rating >= 4.0 ? '0.6' : '0.5');
    const changefreq = shop.is_joe_partner ? 'weekly' : 'monthly';
    
    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>
`;
  }

  xml += `</urlset>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400' // 24 hour cache
    },
    body: xml
  };
}
