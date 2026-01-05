/**
 * Dynamic Sitemap Generator
 * Generates sitemap.xml from database
 * URL: /sitemap.xml
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BASE_URL = 'https://joe.coffee';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/xml',
    'Cache-Control': 'public, max-age=3600'
  };

  try {
    // Check if requesting sitemap index or specific sitemap
    const path = event.path || '';
    
    if (path.includes('sitemap-shops-')) {
      // Individual shop sitemap (paginated)
      const match = path.match(/sitemap-shops-(\d+)\.xml/);
      const page = match ? parseInt(match[1]) : 1;
      return await generateShopSitemap(page, headers);
    }
    
    if (path.includes('sitemap-cities.xml')) {
      return await generateCitySitemap(headers);
    }
    
    if (path.includes('sitemap-states.xml')) {
      return await generateStateSitemap(headers);
    }
    
    // Default: return sitemap index
    return await generateSitemapIndex(headers);
    
  } catch (error) {
    console.error('Sitemap error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Error generating sitemap'
    };
  }
};

async function generateSitemapIndex(headers) {
  // Count total shops to determine number of shop sitemaps needed
  const { count } = await supabase
    .from('shops')
    .select('*', { count: 'exact', head: true })
    .not('slug', 'is', null);
  
  const shopsPerSitemap = 10000;
  const numShopSitemaps = Math.ceil((count || 0) / shopsPerSitemap);
  
  const today = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemap-static.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-states.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-cities.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  
  for (let i = 1; i <= numShopSitemaps; i++) {
    xml += `
  <sitemap>
    <loc>${BASE_URL}/sitemap-shops-${i}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  }
  
  xml += `
</sitemapindex>`;

  return { statusCode: 200, headers, body: xml };
}

async function generateStateSitemap(headers) {
  const { data: states } = await supabase
    .from('shops')
    .select('state_code')
    .not('state_code', 'is', null);
  
  const uniqueStates = [...new Set(states?.map(s => s.state_code?.toLowerCase()).filter(Boolean))];
  
  const today = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/locations/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
  
  for (const state of uniqueStates) {
    xml += `
  <url>
    <loc>${BASE_URL}/locations/${state}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }
  
  xml += `
</urlset>`;

  return { statusCode: 200, headers, body: xml };
}

async function generateCitySitemap(headers) {
  const { data: cities } = await supabase
    .from('shops')
    .select('state_code, city_slug')
    .not('state_code', 'is', null)
    .not('city_slug', 'is', null);
  
  // Dedupe cities
  const citySet = new Set();
  cities?.forEach(s => {
    if (s.state_code && s.city_slug) {
      citySet.add(`${s.state_code.toLowerCase()}/${s.city_slug.toLowerCase()}`);
    }
  });
  
  const uniqueCities = [...citySet];
  const today = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  
  for (const city of uniqueCities) {
    xml += `
  <url>
    <loc>${BASE_URL}/locations/${city}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }
  
  xml += `
</urlset>`;

  return { statusCode: 200, headers, body: xml };
}

async function generateShopSitemap(page, headers) {
  const limit = 10000;
  const offset = (page - 1) * limit;
  
  const { data: shops } = await supabase
    .from('shops')
    .select('slug, state_code, city_slug, updated_at')
    .not('slug', 'is', null)
    .not('state_code', 'is', null)
    .not('city_slug', 'is', null)
    .order('id')
    .range(offset, offset + limit - 1);
  
  const today = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  
  for (const shop of (shops || [])) {
    const lastmod = shop.updated_at ? shop.updated_at.split('T')[0] : today;
    xml += `
  <url>
    <loc>${BASE_URL}/locations/${shop.state_code.toLowerCase()}/${shop.city_slug.toLowerCase()}/${shop.slug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }
  
  xml += `
</urlset>`;

  return { statusCode: 200, headers, body: xml };
}