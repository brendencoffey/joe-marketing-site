// Netlify function for neighborhood pages
// URL pattern: /locations/:state/:city/neighborhoods/:neighborhood/

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
  
  // Parse URL: /locations/:state/:city/neighborhoods/:neighborhood/
  const match = path.match(/\/locations\/([^\/]+)\/([^\/]+)\/neighborhoods\/([^\/]+)/);
  
  if (!match) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/html' },
      body: '<h1>Not Found</h1><p><a href="/locations/">Browse all locations</a></p>'
    };
  }
  
  const [, stateCode, citySlug, neighborhoodSlug] = match;
  const stateName = stateNames[stateCode.toLowerCase()] || stateCode.toUpperCase();
  
  try {
    // Get all shops in this city with neighborhoods
    const { data: shops, error } = await supabase
      .from('shops')
      .select(`
        id, name, slug, address, city, state, state_code, city_slug,
        neighborhood, phone, website, google_rating, total_reviews,
        photos, is_joe_partner, ordering_url
      `)
      .eq('state_code', stateCode.toLowerCase())
      .eq('city_slug', citySlug.toLowerCase())
      .eq('is_active', true)
      .not('neighborhood', 'is', null)
      .neq('neighborhood', '');
    
    if (error) throw error;
    
    // Filter shops by neighborhood slug match
    const matchingShops = shops.filter(shop => {
      const shopNeighborhoodSlug = slugify(shop.neighborhood);
      return shopNeighborhoodSlug === neighborhoodSlug.toLowerCase();
    });
    
    if (matchingShops.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <h1>Neighborhood not found</h1>
          <p>No coffee shops found in this neighborhood.</p>
          <p><a href="/locations/${stateCode}/${citySlug}/">Browse ${citySlug} coffee shops</a></p>
        `
      };
    }
    
    // Get neighborhood info from first shop
    const neighborhoodName = matchingShops[0].neighborhood;
    const cityName = matchingShops[0].city;
    
    // Get other neighborhoods in this city for navigation
    const neighborhoodCounts = {};
    shops.forEach(shop => {
      const slug = slugify(shop.neighborhood);
      if (!neighborhoodCounts[slug]) {
        neighborhoodCounts[slug] = { name: shop.neighborhood, count: 0 };
      }
      neighborhoodCounts[slug].count++;
    });
    
    const otherNeighborhoods = Object.entries(neighborhoodCounts)
      .filter(([slug]) => slug !== neighborhoodSlug.toLowerCase())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    
    // Build shop cards HTML
    const shopCardsHtml = matchingShops.map(shop => {
      const photo = shop.photos?.[0] || null;
      const rating = shop.google_rating ? `★ ${shop.google_rating}` : '';
      const reviews = shop.total_reviews ? `(${shop.total_reviews} reviews)` : '';
      const partnerBadge = shop.is_joe_partner ? '<span class="partner-badge">☕ Order Ahead</span>' : '';
      
      return `
        <a href="/locations/${shop.state_code}/${shop.city_slug}/${shop.slug}/" class="shop-card">
          <div class="shop-photo" style="background-image: url('${photo || '/images/coffee-placeholder.jpg'}')">
            ${partnerBadge}
          </div>
          <div class="shop-info">
            <h3>${shop.name}</h3>
            <p class="shop-address">${shop.address || ''}</p>
            <p class="shop-rating">${rating} ${reviews}</p>
          </div>
        </a>
      `;
    }).join('');
    
    // Build other neighborhoods HTML
    const otherNeighborhoodsHtml = otherNeighborhoods.map(([slug, data]) => `
      <a href="/locations/${stateCode}/${citySlug}/neighborhoods/${slug}/" class="neighborhood-link">
        ${data.name} <span class="count">(${data.count})</span>
      </a>
    `).join('');
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shops in ${neighborhoodName} | joe coffee</title>
  <meta name="description" content="Discover ${matchingShops.length} independent coffee shops in ${neighborhoodName}. Find the best local coffee near you.">
  <link rel="canonical" href="https://joe.coffee/locations/${stateCode}/${citySlug}/neighborhoods/${neighborhoodSlug}/">
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
    
    /* Shops Grid */
    .shops-grid { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
    
    .shop-card { background: #fff; border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; }
    .shop-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
    
    .shop-photo { height: 180px; background-size: cover; background-position: center; background-color: #e5e5e5; position: relative; display: flex; align-items: center; justify-content: center; }
    .shop-photo::before { content: '☕'; font-size: 48px; opacity: 0.3; position: absolute; }
    
    .partner-badge { position: absolute; top: 12px; right: 12px; background: #f59e0b; color: #fff; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; }
    
    .shop-info { padding: 16px; }
    .shop-info h3 { font-size: 18px; margin-bottom: 4px; }
    .shop-address { color: #666; font-size: 14px; margin-bottom: 4px; }
    .shop-rating { color: #f59e0b; font-size: 14px; }
    
    /* Other Neighborhoods */
    .other-neighborhoods { max-width: 1200px; margin: 48px auto; padding: 0 24px; }
    .other-neighborhoods h2 { font-size: 24px; margin-bottom: 16px; }
    .neighborhoods-list { display: flex; flex-wrap: wrap; gap: 12px; }
    .neighborhood-link { background: #fff; padding: 8px 16px; border-radius: 20px; text-decoration: none; color: #1a1a1a; font-size: 14px; border: 1px solid #eee; }
    .neighborhood-link:hover { background: #f5f5f5; }
    .neighborhood-link .count { color: #999; }
    
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
    ${neighborhoodName}
  </div>
  
  <div class="hero">
    <h1>Coffee Shops in ${neighborhoodName}</h1>
    <p>${matchingShops.length} independent coffee shop${matchingShops.length !== 1 ? 's' : ''} to explore</p>
  </div>
  
  <div class="shops-grid">
    ${shopCardsHtml}
  </div>
  
  ${otherNeighborhoods.length > 0 ? `
  <div class="other-neighborhoods">
    <h2>More Neighborhoods in ${cityName}</h2>
    <div class="neighborhoods-list">
      ${otherNeighborhoodsHtml}
    </div>
  </div>
  ` : ''}
  
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
