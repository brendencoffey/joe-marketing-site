// Netlify function for neighborhoods index
// URL pattern: /locations/:state/:city/neighborhoods/

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://vpnoaxpmhuknyaxcyxsu.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbm9heHBtaHVrbnlheGN5eHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NjkzNTMsImV4cCI6MjA4MjQ0NTM1M30.0JVwCaY-3nUHuJk49ibifQviT0LxBSdYXMslw9WIr9M'
);

// Slugify helper
const slugify = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// State code to full name mapping
const stateNames = {
  al: 'Alabama', ak: 'Alaska', az: 'Arizona', ar: 'Arkansas', ca: 'California',
  co: 'Colorado', ct: 'Connecticut', de: 'Delaware', dc: 'Washington DC', fl: 'Florida',
  ga: 'Georgia', hi: 'Hawaii', id: 'Idaho', il: 'Illinois', in: 'Indiana',
  ia: 'Iowa', ks: 'Kansas', ky: 'Kentucky', la: 'Louisiana', me: 'Maine',
  md: 'Maryland', ma: 'Massachusetts', mi: 'Michigan', mn: 'Minnesota', ms: 'Mississippi',
  mo: 'Missouri', mt: 'Montana', ne: 'Nebraska', nv: 'Nevada', nh: 'New Hampshire',
  nj: 'New Jersey', nm: 'New Mexico', ny: 'New York', nc: 'North Carolina', nd: 'North Dakota',
  oh: 'Ohio', ok: 'Oklahoma', or: 'Oregon', pa: 'Pennsylvania', ri: 'Rhode Island',
  sc: 'South Carolina', sd: 'South Dakota', tn: 'Tennessee', tx: 'Texas', ut: 'Utah',
  vt: 'Vermont', va: 'Virginia', wa: 'Washington', wv: 'West Virginia', wi: 'Wisconsin', wy: 'Wyoming'
};

exports.handler = async (event) => {
  const path = event.path;
  
  // Parse URL: /locations/:state/:city/neighborhoods/
  const match = path.match(/\/locations\/([^\/]+)\/([^\/]+)\/neighborhoods\/?$/);
  
  if (!match) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/html' },
      body: '<h1>Not Found</h1><p><a href="/locations/">Browse all locations</a></p>'
    };
  }
  
  const [, stateCode, citySlug] = match;
  const stateName = stateNames[stateCode.toLowerCase()] || stateCode.toUpperCase();
  
  try {
    // Get all shops in this city with neighborhoods
    const { data: shops, error } = await supabase
      .from('shops')
      .select('id, name, city, neighborhood')
      .eq('state_code', stateCode.toLowerCase())
      .eq('city_slug', citySlug.toLowerCase())
      .eq('is_active', true)
      .not('neighborhood', 'is', null)
      .neq('neighborhood', '');
    
    if (error) throw error;
    
    if (shops.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <h1>No neighborhoods found</h1>
          <p>No neighborhoods with coffee shops in this city yet.</p>
          <p><a href="/locations/${stateCode}/${citySlug}/">Browse all ${citySlug} coffee shops</a></p>
        `
      };
    }
    
    const cityName = shops[0].city;
    
    // Count shops per neighborhood
    const neighborhoodCounts = {};
    shops.forEach(shop => {
      const slug = slugify(shop.neighborhood);
      if (!neighborhoodCounts[slug]) {
        neighborhoodCounts[slug] = { name: shop.neighborhood, count: 0 };
      }
      neighborhoodCounts[slug].count++;
    });
    
    // Sort by count descending
    const sortedNeighborhoods = Object.entries(neighborhoodCounts)
      .sort((a, b) => b[1].count - a[1].count);
    
    // Build neighborhood cards HTML
    const neighborhoodCardsHtml = sortedNeighborhoods.map(([slug, data]) => `
      <a href="/locations/${stateCode}/${citySlug}/neighborhoods/${slug}/" class="neighborhood-card">
        <h3>${data.name}</h3>
        <p>${data.count} coffee shop${data.count !== 1 ? 's' : ''}</p>
      </a>
    `).join('');
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shop Neighborhoods in ${cityName}, ${stateName} | joe coffee</title>
  <meta name="description" content="Explore ${sortedNeighborhoods.length} neighborhoods with independent coffee shops in ${cityName}, ${stateName}.">
  <link rel="canonical" href="https://joe.coffee/locations/${stateCode}/${citySlug}/neighborhoods/">
  <link rel="icon" href="/favicon.ico">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #faf9f7; color: #1a1a1a; }
    
    /* Header */
    header { background: #fff; padding: 16px 24px; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 100; }
    header nav { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .logo { font-size: 24px; font-weight: 700; color: #1a1a1a; text-decoration: none; }
    .nav-links { display: flex; gap: 24px; }
    .nav-links a { color: #666; text-decoration: none; }
    .nav-links a:hover { color: #1a1a1a; }
    .get-app { background: #1a1a1a; color: #fff; padding: 10px 20px; border-radius: 24px; text-decoration: none; }
    
    /* Breadcrumb */
    .breadcrumb { max-width: 1200px; margin: 24px auto; padding: 0 24px; font-size: 14px; color: #666; }
    .breadcrumb a { color: #666; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    
    /* Hero */
    .hero { max-width: 1200px; margin: 0 auto 32px; padding: 0 24px; }
    .hero h1 { font-size: 36px; margin-bottom: 8px; }
    .hero p { color: #666; font-size: 18px; }
    
    /* Neighborhoods Grid */
    .neighborhoods-grid { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
    
    .neighborhood-card { background: #fff; border-radius: 12px; padding: 24px; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; border: 1px solid #eee; }
    .neighborhood-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #ddd; }
    .neighborhood-card h3 { font-size: 18px; margin-bottom: 4px; }
    .neighborhood-card p { color: #666; font-size: 14px; }
    
    /* Back link */
    .back-link { max-width: 1200px; margin: 48px auto 0; padding: 0 24px; }
    .back-link a { color: #666; text-decoration: none; }
    .back-link a:hover { text-decoration: underline; }
    
    /* Footer */
    footer { background: #1a1a1a; color: #fff; padding: 48px 24px; margin-top: 64px; }
    .footer-content { max-width: 1200px; margin: 0 auto; text-align: center; }
    footer a { color: #fff; text-decoration: none; }
    
    @media (max-width: 768px) {
      .hero h1 { font-size: 28px; }
      .nav-links { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <nav>
      <a href="/" class="logo">joe</a>
      <div class="nav-links">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Coffee Shops</a>
        <a href="/about/">About</a>
      </div>
      <a href="/get-started/" class="get-app">Get the App</a>
    </nav>
  </header>
  
  <div class="breadcrumb">
    <a href="/">Home</a> › 
    <a href="/locations/">Locations</a> › 
    <a href="/locations/${stateCode}/">${stateName}</a> › 
    <a href="/locations/${stateCode}/${citySlug}/">${cityName}</a> › 
    Neighborhoods
  </div>
  
  <div class="hero">
    <h1>Coffee Shop Neighborhoods in ${cityName}</h1>
    <p>Explore ${sortedNeighborhoods.length} neighborhoods with ${shops.length} independent coffee shops</p>
  </div>
  
  <div class="neighborhoods-grid">
    ${neighborhoodCardsHtml}
  </div>
  
  <div class="back-link">
    <a href="/locations/${stateCode}/${citySlug}/">← Back to all ${cityName} coffee shops</a>
  </div>
  
  <footer>
    <div class="footer-content">
      <p>© ${new Date().getFullYear()} joe coffee. Supporting independent coffee shops.</p>
    </div>
  </footer>
</body>
</html>
    `;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600'
      },
      body: html
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `<h1>Error</h1><p>${error.message}</p>`
    };
  }
};
