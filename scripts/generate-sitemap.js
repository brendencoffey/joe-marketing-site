/**
 * Generate Sitemaps from Supabase
 * 
 * Creates:
 * - sitemap-products.xml (all active products)
 * - sitemap-locations.xml (all shops by state/city chunks)
 * - sitemap.xml (index pointing to all sitemaps)
 * 
 * Usage: 
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node generate-sitemap.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpnoaxpmhuknyaxcyxsu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const OUTPUT_DIR = path.join(__dirname, '..');
const TODAY = new Date().toISOString().split('T')[0];

// Max URLs per sitemap file (Google limit is 50,000)
const MAX_URLS_PER_SITEMAP = 45000;

async function generateProductsSitemap() {
  console.log('Fetching products...');
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, slug, updated_at')
    .eq('is_active', true)
    .not('product_url', 'is', null);
  
  if (error) {
    console.error('Error fetching products:', error);
    return null;
  }
  
  console.log(`Found ${products.length} active products with URLs`);
  
  const urls = products.map(p => {
    const slug = p.slug || p.id;
    const lastmod = p.updated_at ? p.updated_at.split('T')[0] : TODAY;
    return `  <url>
    <loc>https://joe.coffee/marketplace/product/${slug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://joe.coffee/marketplace/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${urls.join('\n')}
</urlset>`;
  
  const filepath = path.join(OUTPUT_DIR, 'sitemap-products.xml');
  fs.writeFileSync(filepath, xml);
  console.log(`Wrote ${filepath} with ${products.length + 1} URLs`);
  
  return 'sitemap-products.xml';
}

async function generateLocationsSitemaps() {
  console.log('Fetching shops...');
  
  // Fetch all shops with location data
  const allShops = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: shops, error } = await supabase
      .from('shops')
      .select('slug, state_code, city_slug, updated_at')
      .not('slug', 'is', null)
      .not('state_code', 'is', null)
      .not('city_slug', 'is', null)
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error fetching shops:', error);
      break;
    }
    
    if (!shops || shops.length === 0) break;
    
    allShops.push(...shops);
    offset += limit;
    
    if (shops.length < limit) break;
  }
  
  console.log(`Found ${allShops.length} shops with location data`);
  
  // Group by state for multiple sitemaps if needed
  const byState = {};
  allShops.forEach(shop => {
    const state = shop.state_code.toLowerCase();
    if (!byState[state]) byState[state] = [];
    byState[state].push(shop);
  });
  
  // Get unique cities for city pages
  const cities = new Set();
  allShops.forEach(shop => {
    const key = `${shop.state_code.toLowerCase()}/${shop.city_slug}`;
    cities.add(key);
  });
  
  // Generate URLs
  const shopUrls = allShops.map(s => {
    const lastmod = s.updated_at ? s.updated_at.split('T')[0] : TODAY;
    return `  <url>
    <loc>https://joe.coffee/locations/${s.state_code.toLowerCase()}/${s.city_slug}/${s.slug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
  });
  
  const cityUrls = [...cities].map(c => `  <url>
    <loc>https://joe.coffee/locations/${c}/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  
  const stateUrls = Object.keys(byState).map(s => `  <url>
    <loc>https://joe.coffee/locations/${s}/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
  
  // Combine all location URLs
  const allUrls = [
    `  <url>
    <loc>https://joe.coffee/locations/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`,
    ...stateUrls,
    ...cityUrls,
    ...shopUrls
  ];
  
  // Split into multiple sitemaps if needed
  const sitemapFiles = [];
  
  if (allUrls.length <= MAX_URLS_PER_SITEMAP) {
    // Single sitemap
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.join('\n')}
</urlset>`;
    
    const filepath = path.join(OUTPUT_DIR, 'sitemap-locations.xml');
    fs.writeFileSync(filepath, xml);
    console.log(`Wrote ${filepath} with ${allUrls.length} URLs`);
    sitemapFiles.push('sitemap-locations.xml');
  } else {
    // Split into multiple sitemaps
    const chunks = [];
    for (let i = 0; i < allUrls.length; i += MAX_URLS_PER_SITEMAP) {
      chunks.push(allUrls.slice(i, i + MAX_URLS_PER_SITEMAP));
    }
    
    chunks.forEach((chunk, i) => {
      const filename = `sitemap-locations-${i + 1}.xml`;
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunk.join('\n')}
</urlset>`;
      
      const filepath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filepath, xml);
      console.log(`Wrote ${filepath} with ${chunk.length} URLs`);
      sitemapFiles.push(filename);
    });
  }
  
  return sitemapFiles;
}

async function generateSitemapIndex(sitemapFiles) {
  console.log('Generating sitemap index...');
  
  // Include static sitemap if it exists
  const staticSitemapPath = path.join(OUTPUT_DIR, 'sitemap-static.xml');
  if (fs.existsSync(staticSitemapPath)) {
    sitemapFiles.unshift('sitemap-static.xml');
  }
  
  const sitemaps = sitemapFiles.map(f => `  <sitemap>
    <loc>https://joe.coffee/${f}</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>`);
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.join('\n')}
</sitemapindex>`;
  
  const filepath = path.join(OUTPUT_DIR, 'sitemap.xml');
  fs.writeFileSync(filepath, xml);
  console.log(`Wrote sitemap index: ${filepath}`);
  console.log(`Contains ${sitemapFiles.length} sitemaps`);
}

async function main() {
  console.log('=== Sitemap Generator ===\n');
  
  const sitemapFiles = [];
  
  // Generate products sitemap
  const productsSitemap = await generateProductsSitemap();
  if (productsSitemap) sitemapFiles.push(productsSitemap);
  
  console.log('');
  
  // Generate locations sitemaps
  const locationsSitemaps = await generateLocationsSitemaps();
  if (locationsSitemaps) sitemapFiles.push(...locationsSitemaps);
  
  console.log('');
  
  // Generate index
  await generateSitemapIndex(sitemapFiles);
  
  console.log('\n=== Done ===');
  console.log('Next steps:');
  console.log('1. Commit and deploy the sitemap files');
  console.log('2. Submit https://joe.coffee/sitemap.xml to Google Search Console');
}

main().catch(console.error);
