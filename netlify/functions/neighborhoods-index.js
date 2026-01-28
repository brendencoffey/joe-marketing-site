// Netlify function for neighborhoods index
// URL pattern: /locations/:state/:city/neighborhoods/

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Slugify helper
const slugify = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
};

// State names
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

// Shared header
const getHeaderHTML = () => `
  <nav class="main-nav">
    <div class="nav-inner">
      <a href="/" class="logo"><img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" style="height:40px"></a>
      <div class="nav-links">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="nav-cta">Get the App</a>
      </div>
      <div class="mobile-menu-btn" id="mobileMenuBtn"><span></span><span></span><span></span></div>
    </div>
  </nav>
  <div class="mobile-menu" id="mobileMenu">
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Shops</a>
    <a href="https://get.joe.coffee" class="nav-cta">Get the App</a>
  </div>
`;

// Shared footer
const getFooterHTML = () => `
  <footer>
    <div class="footer-main">
      <div class="footer-brand">
        <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" class="footer-logo">
        <p>The #1 app for indie coffee lovers. Skip the line, earn rewards, support local.</p>
        <a href="https://instagram.com/joe_is_community" class="social-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          @joe_is_community
        </a>
      </div>
      <div class="footer-links">
        <div class="footer-col">
          <h4>For Coffee Lovers</h4>
          <a href="https://get.joe.coffee">Download App</a>
          <a href="/locations/">Find Shops</a>
          <a href="/rewards/">Rewards</a>
          <a href="/gift-cards/">Gift Cards</a>
        </div>
        <div class="footer-col">
          <h4>For Coffee Shops</h4>
          <a href="/for-coffee-shops/">Join the Collective</a>
          <a href="/for-coffee-shops/">Platform</a>
          <a href="/pricing/">Pricing</a>
          <a href="/support/">Support</a>
        </div>
        <div class="footer-col">
          <h4>Company</h4>
          <a href="/about/">About</a>
          <a href="/blog/">Blog</a>
          <a href="/media/">Media</a>
          <a href="/contact/">Contact</a>
          <a href="/terms/">Terms</a>
          <a href="/privacy/">Privacy</a>
        </div>
      </div>
    </div>
    <div class="footer-cities">
      <h4>Coffee Shops by City</h4>
      <div class="city-links">
        <a href="/locations/ny/new-york/">New York</a>
        <a href="/locations/ca/los-angeles/">Los Angeles</a>
        <a href="/locations/il/chicago/">Chicago</a>
        <a href="/locations/ca/san-francisco/">San Francisco</a>
        <a href="/locations/pa/philadelphia/">Philadelphia</a>
        <a href="/locations/ca/san-diego/">San Diego</a>
        <a href="/locations/ma/boston/">Boston</a>
        <a href="/locations/wa/seattle/">Seattle</a>
        <a href="/locations/co/denver/">Denver</a>
        <a href="/locations/dc/washington/">Washington DC</a>
        <a href="/locations/tn/nashville/">Nashville</a>
        <a href="/locations/or/portland/">Portland</a>
      </div>
      <a href="/locations/" class="view-all">View All Locations →</a>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} joe Coffee. All rights reserved.</p>
      <p>Crafted with ❤️ for indie coffee</p>
    </div>
  </footer>
`;

// Shared CSS
const getSharedCSS = () => `
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #faf9f7; color: #1a1a1a; }
    
    .main-nav { background: #fff; padding: 16px 24px; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 100; }
    .nav-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .logo img { height: 40px; }
    .nav-links { display: flex; gap: 24px; align-items: center; }
    .nav-links a { color: #666; text-decoration: none; font-size: 15px; }
    .nav-links a:hover { color: #1a1a1a; }
    .nav-cta { background: #1a1a1a; color: #fff !important; padding: 10px 20px; border-radius: 24px; }
    .mobile-menu-btn { display: none; flex-direction: column; gap: 5px; cursor: pointer; }
    .mobile-menu-btn span { width: 24px; height: 2px; background: #1a1a1a; }
    .mobile-menu { display: none; flex-direction: column; background: #fff; padding: 16px 24px; border-bottom: 1px solid #eee; }
    .mobile-menu a { padding: 12px 0; color: #1a1a1a; text-decoration: none; border-bottom: 1px solid #eee; }
    .mobile-menu.active { display: flex; }
    @media (max-width: 768px) { .nav-links { display: none; } .mobile-menu-btn { display: flex; } }
    
    .breadcrumb { max-width: 1200px; margin: 24px auto; padding: 0 24px; font-size: 14px; color: #666; }
    .breadcrumb a { color: #666; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    
    .hero { max-width: 1200px; margin: 0 auto 32px; padding: 0 24px; }
    .hero h1 { font-size: 36px; margin-bottom: 8px; }
    .hero p { color: #666; font-size: 18px; }
    
    .neighborhoods-grid { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .neighborhood-card { background: #fff; border-radius: 12px; padding: 24px; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; border: 1px solid #eee; }
    .neighborhood-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #ddd; }
    .neighborhood-card h3 { font-size: 18px; margin-bottom: 4px; }
    .neighborhood-card p { color: #666; font-size: 14px; }
    
    .back-link { max-width: 1200px; margin: 48px auto 0; padding: 0 24px; }
    .back-link a { color: #666; text-decoration: none; }
    .back-link a:hover { text-decoration: underline; }
    
    @media (max-width: 768px) { .hero h1 { font-size: 28px; } }
  </style>
`;

const getMobileMenuScript = () => `
  <script>
    document.getElementById('mobileMenuBtn')?.addEventListener('click', function() {
      document.getElementById('mobileMenu').classList.toggle('active');
    });
  </script>
`;

exports.handler = async (event) => {
  const path = event.path;
  const match = path.match(/\/locations\/([^\/]+)\/([^\/]+)\/neighborhoods\/?$/);
  
  if (!match) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: '<h1>Not Found</h1>' };
  }
  
  const [, stateCode, citySlug] = match;
  const stateName = stateNames[stateCode.toLowerCase()] || stateCode.toUpperCase();
  
  try {
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
        body: `<!DOCTYPE html><html><head><title>No neighborhoods | joe</title>${getSharedCSS()}</head><body>${getHeaderHTML()}<div class="hero" style="text-align:center;padding-top:60px"><h1>No neighborhoods found</h1><p>No neighborhoods with coffee shops in this city yet.</p><p style="margin-top:24px"><a href="/locations/${stateCode}/${citySlug}/">Browse all coffee shops →</a></p></div>${getFooterHTML()}${getMobileMenuScript()}</body></html>`
      };
    }
    
    const cityName = shops[0].city;
    
    const neighborhoodCounts = {};
    shops.forEach(shop => {
      const slug = slugify(shop.neighborhood);
      if (!neighborhoodCounts[slug]) neighborhoodCounts[slug] = { name: shop.neighborhood, count: 0 };
      neighborhoodCounts[slug].count++;
    });
    
    const sortedNeighborhoods = Object.entries(neighborhoodCounts).sort((a, b) => b[1].count - a[1].count);
    
    const neighborhoodCardsHtml = sortedNeighborhoods.map(([slug, data]) => `
      <a href="/locations/${stateCode}/${citySlug}/neighborhoods/${slug}/" class="neighborhood-card">
        <h3>${data.name}</h3>
        <p>${data.count} coffee shop${data.count !== 1 ? 's' : ''}</p>
      </a>
    `).join('');
    
    // SEO Schema
    const schemaJSON = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": `Coffee Shop Neighborhoods in ${cityName}, ${stateName}`,
      "numberOfItems": sortedNeighborhoods.length,
      "itemListElement": sortedNeighborhoods.slice(0, 20).map(([slug, data], i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Place",
          "name": data.name,
          "url": `https://joe.coffee/locations/${stateCode}/${citySlug}/neighborhoods/${slug}/`
        }
      }))
    });
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shop Neighborhoods in ${cityName}, ${stateName} | joe coffee</title>
  <meta name="description" content="Explore ${sortedNeighborhoods.length} neighborhoods with independent coffee shops in ${cityName}, ${stateName}.">
  <link rel="canonical" href="https://joe.coffee/locations/${stateCode}/${citySlug}/neighborhoods/">
  <link rel="icon" href="/favicon.ico">
  <script type="application/ld+json">${schemaJSON}</script>
  ${getSharedCSS()}
</head>
<body>
  ${getHeaderHTML()}
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
  <div class="neighborhoods-grid">${neighborhoodCardsHtml}</div>
  <div class="back-link"><a href="/locations/${stateCode}/${citySlug}/">← Back to all ${cityName} coffee shops</a></div>
  ${getFooterHTML()}
  ${getMobileMenuScript()}
</body>
</html>`;
    
    return { statusCode: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' }, body: html };
    
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: `<h1>Error</h1><p>${error.message}</p>` };
  }
};
