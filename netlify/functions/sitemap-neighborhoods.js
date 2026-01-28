/**
 * Neighborhood Sitemap Generator
 * URL: /sitemap-neighborhoods.xml
 * 
 * Generates XML sitemap for all neighborhood pages to help Google discover them.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    // Get all neighborhoods with shops
    const { data: neighborhoods, error } = await supabase
      .from('neighborhoods')
      .select('state_code, city_slug, city_name, neighborhood_slug, neighborhood_name, shop_count, updated_at')
      .gt('shop_count', 0)
      .order('shop_count', { ascending: false });

    if (error) throw error;

    // Get unique cities for index pages
    const cities = {};
    neighborhoods.forEach(n => {
      const key = `${n.state_code}/${n.city_slug}`;
      if (!cities[key]) {
        cities[key] = {
          state_code: n.state_code,
          city_slug: n.city_slug,
          city_name: n.city_name,
          count: 0
        };
      }
      cities[key].count++;
    });

    const today = new Date().toISOString().split('T')[0];

    // Build sitemap XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Add neighborhood index pages (one per city)
    Object.values(cities).forEach(city => {
      xml += `  <url>
    <loc>https://joe.coffee/locations/${city.state_code}/${city.city_slug}/neighborhoods/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    });

    // Add individual neighborhood pages
    neighborhoods.forEach(n => {
      // Higher priority for neighborhoods with more shops
      const priority = n.shop_count >= 20 ? '0.8' : n.shop_count >= 10 ? '0.7' : '0.6';
      const changefreq = n.shop_count >= 20 ? 'weekly' : 'monthly';
      const lastmod = n.updated_at ? new Date(n.updated_at).toISOString().split('T')[0] : today;

      xml += `  <url>
    <loc>https://joe.coffee/locations/${n.state_code}/${n.city_slug}/neighborhoods/${n.neighborhood_slug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>
`;
    });

    xml += `</urlset>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // 1 hour cache
      },
      body: xml
    };

  } catch (error) {
    console.error('Sitemap error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Error generating sitemap: ' + error.message
    };
  }
};
