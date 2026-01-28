/**
 * Shops Sitemap Generator
 * Handles 65k+ shop URLs with automatic pagination
 * 
 * URLs:
 *   /sitemaps/shops.xml - Sitemap index (lists all child sitemaps)
 *   /sitemaps/shops-1.xml - First 45,000 shops
 *   /sitemaps/shops-2.xml - Next 45,000 shops
 *   etc.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SHOPS_PER_SITEMAP = 45000; // Stay under 50k limit
const BASE_URL = 'https://joe.coffee';

exports.handler = async (event) => {
  try {
    const path = event.path || '';
    
    // Determine request type from path
    const indexMatch = path.match(/shops\.xml$/);
    const pageMatch = path.match(/shops-(\d+)\.xml$/);
    
    if (indexMatch) {
      return await generateSitemapIndex();
    } else if (pageMatch) {
      const page = parseInt(pageMatch[1], 10);
      return await generateShopsSitemap(page);
    } else {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Not found'
      };
    }
    
  } catch (error) {
    console.error('Sitemap error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Error: ' + error.message
    };
  }
};

/**
 * Generate sitemap index listing all shop sitemaps
 */
async function generateSitemapIndex() {
  // Get total count
  const { count, error } = await supabase
    .from('shops')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('state_code', 'is', null)
    .not('city_slug', 'is', null)
    .not('slug', 'is', null);
  
  if (error) throw error;
  
  const totalShops = count || 0;
  const numSitemaps = Math.ceil(totalShops / SHOPS_PER_SITEMAP);
  const today = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (let i = 1; i <= numSitemaps; i++) {
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
      'Cache-Control': 'public, max-age=3600'
    },
    body: xml
  };
}

/**
 * Generate a specific page of shops
 */
async function generateShopsSitemap(page) {
  const offset = (page - 1) * SHOPS_PER_SITEMAP;
  
  // Fetch shops ordered by priority: partners first, then rating
  const { data: shops, error } = await supabase
    .from('shops')
    .select('slug, state_code, city_slug, is_joe_partner, google_rating, total_reviews, updated_at')
    .eq('is_active', true)
    .not('state_code', 'is', null)
    .not('city_slug', 'is', null)
    .not('slug', 'is', null)
    .order('is_joe_partner', { ascending: false })
    .order('google_rating', { ascending: false, nullsFirst: false })
    .range(offset, offset + SHOPS_PER_SITEMAP - 1);
  
  if (error) throw error;
  
  if (!shops || shops.length === 0) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: `Sitemap page ${page} not found`
    };
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const shop of shops) {
    const url = `${BASE_URL}/locations/${shop.state_code.toLowerCase()}/${shop.city_slug}/${shop.slug}/`;
    const lastmod = shop.updated_at ? new Date(shop.updated_at).toISOString().split('T')[0] : today;
    
    // Priority: partners highest, then by rating
    let priority = '0.5';
    if (shop.is_joe_partner) {
      priority = '0.8';
    } else if (shop.google_rating >= 4.5 && shop.total_reviews >= 100) {
      priority = '0.7';
    } else if (shop.google_rating >= 4.0) {
      priority = '0.6';
    }
    
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
      'Cache-Control': 'public, max-age=3600'
    },
    body: xml
  };
}
