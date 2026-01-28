/**
 * Master Sitemap Index
 * URL: /sitemap.xml
 * 
 * Lists all child sitemaps:
 *   - /sitemaps/shops.xml (index for 65k+ shops)
 *   - /sitemaps/neighborhoods.xml (475+ neighborhoods)
 *   - /sitemaps/static.xml (static pages)
 */

exports.handler = async (event) => {
  const today = new Date().toISOString().split('T')[0];
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://joe.coffee/sitemaps/static.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://joe.coffee/sitemaps/shops.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://joe.coffee/sitemaps/neighborhoods.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    },
    body: xml
  };
};
