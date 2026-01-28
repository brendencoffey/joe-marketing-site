// Netlify function for neighborhood pages
// URL pattern: /locations/:state/:city/neighborhoods/:neighborhood/

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
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

// Shared header HTML (matches site nav)
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

// Shared footer HTML (matches site footer)
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
    
    /* Nav */
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
    
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .mobile-menu-btn { display: flex; }
    }
    
    /* Breadcrumb */
    .breadcrumb { max-width: 1200px; margin: 24px auto; padding: 0 24px; font-size: 14px; color: #666; }
    .breadcrumb a { color: #666; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    
    /* Hero */
    .hero { max-width: 1200px; margin: 0 auto 32px; padding: 0 24px; }
    .hero h1 { font-size: 36px; margin-bottom: 8px; }
    .hero p { color: #666; font-size: 18px; }
    
    /* Shops Grid */
    .shops-grid { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
    
    .shop-card { background: #fff; border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; }
    .shop-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
    
    .shop-photo { height: 200px; background-size: cover; background-position: center; background-color: #e5e5e5; position: relative; }
    
    .partner-badge { position: absolute; top: 12px; left: 12px; background: #22c55e; color: #fff; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    
    .shop-info { padding: 16px; }
    .shop-info h3 { font-size: 18px; margin-bottom: 4px; }
    .shop-address { color: #666; font-size: 14px; margin-bottom: 8px; }
    .shop-meta { display: flex; gap: 12px; font-size: 14px; color: #666; flex-wrap: wrap; }
    .shop-meta span { display: flex; align-items: center; gap: 4px; }
    .rating { color: #f59e0b; }
    
    /* Other Neighborhoods */
    .other-neighborhoods { max-width: 1200px; margin: 48px auto; padding: 0 24px; }
    .other-neighborhoods h2 { font-size: 24px; margin-bottom: 16px; }
    .neighborhoods-list { display: flex; flex-wrap: wrap; gap: 12px; }
    .neighborhood-link { background: #fff; padding: 8px 16px; border-radius: 20px; text-decoration: none; color: #1a1a1a; font-size: 14px; border: 1px solid #eee; transition: all 0.2s; }
    .neighborhood-link:hover { background: #f5f5f5; border-color: #ddd; }
    .neighborhood-link .count { color: #999; }
    
    @media (max-width: 768px) {
      .hero h1 { font-size: 28px; }
      .shops-grid { grid-template-columns: 1fr; }
    }
  </style>
`;

// Mobile menu script
const getMobileMenuScript = () => `
  <script>
    document.getElementById('mobileMenuBtn')?.addEventListener('click', function() {
      document.getElementById('mobileMenu').classList.toggle('active');
    });
  </script>
`;

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
        photos, is_joe_partner, ordering_url, coffee_shop_type
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
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Neighborhood not found | joe coffee</title>
            ${getSharedCSS()}
          </head>
          <body>
            ${getHeaderHTML()}
            <div class="hero" style="text-align:center; padding-top: 60px;">
              <h1>Neighborhood not found</h1>
              <p>No coffee shops found in this neighborhood.</p>
              <p style="margin-top: 24px;"><a href="/locations/${stateCode}/${citySlug}/" style="color: #1a1a1a;">Browse all ${citySlug} coffee shops →</a></p>
            </div>
            ${getFooterHTML()}
            ${getMobileMenuScript()}
          </body>
          </html>
        `
      };
    }
    
    const neighborhoodName = matchingShops[0].neighborhood;
    const cityName = matchingShops[0].city;
    
    // Get other neighborhoods
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
    
    // Build shop cards
    const shopCardsHtml = matchingShops.map(shop => {
      const photo = shop.photos?.[0] || null;
      const photoStyle = photo ? `background-image: url('${photo}')` : '';
      const rating = shop.google_rating ? `<span class="rating">★ ${shop.google_rating}</span>` : '';
      const reviews = shop.total_reviews ? `<span>(${shop.total_reviews})</span>` : '';
      const partnerBadge = shop.is_joe_partner ? '<span class="partner-badge">joe partner</span>' : '';
      
      return `
        <a href="/locations/${shop.state_code}/${shop.city_slug}/${shop.slug}/" class="shop-card">
          <div class="shop-photo" style="${photoStyle}">${partnerBadge}</div>
          <div class="shop-info">
            <h3>${shop.name}</h3>
            <p class="shop-address">${shop.address || ''}</p>
            <div class="shop-meta">${rating}${reviews}</div>
          </div>
        </a>
      `;
    }).join('');
    
    const otherNeighborhoodsHtml = otherNeighborhoods.length > 0 ? `
      <div class="other-neighborhoods">
        <h2>More Neighborhoods in ${cityName}</h2>
        <div class="neighborhoods-list">
          ${otherNeighborhoods.map(([slug, data]) => `
            <a href="/locations/${stateCode}/${citySlug}/neighborhoods/${slug}/" class="neighborhood-link">
              ${data.name} <span class="count">(${data.count})</span>
            </a>
          `).join('')}
        </div>
      </div>
    ` : '';
    
    // SEO Schema
    const schemaJSON = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": `Coffee Shops in ${neighborhoodName}`,
      "description": `${matchingShops.length} independent coffee shops in ${neighborhoodName}`,
      "numberOfItems": matchingShops.length,
      "itemListElement": matchingShops.slice(0, 10).map((shop, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "CafeOrCoffeeShop",
          "name": shop.name,
          "address": { "@type": "PostalAddress", "streetAddress": shop.address, "addressLocality": shop.city, "addressRegion": shop.state_code?.toUpperCase() },
          "aggregateRating": shop.google_rating ? { "@type": "AggregateRating", "ratingValue": shop.google_rating, "reviewCount": shop.total_reviews || 1 } : undefined,
          "url": `https://joe.coffee/locations/${shop.state_code}/${shop.city_slug}/${shop.slug}/`
        }
      }))
    });
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shops in ${neighborhoodName} | joe coffee</title>
  <meta name="description" content="Discover ${matchingShops.length} independent coffee shops in ${neighborhoodName}. Find the best local coffee near you.">
  <link rel="canonical" href="https://joe.coffee/locations/${stateCode}/${citySlug}/neighborhoods/${neighborhoodSlug}/">
  <link rel="icon" href="/favicon.ico">
  <meta property="og:title" content="Coffee Shops in ${neighborhoodName}">
  <meta property="og:description" content="${matchingShops.length} independent coffee shops to explore">
  <meta property="og:type" content="website">
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
    <a href="/locations/${stateCode}/${citySlug}/neighborhoods/">Neighborhoods</a> › 
    ${neighborhoodName}
  </div>
  <div class="hero">
    <h1>Coffee Shops in ${neighborhoodName}</h1>
    <p>${matchingShops.length} independent coffee shop${matchingShops.length !== 1 ? 's' : ''} to explore</p>
  </div>
  <div class="shops-grid">${shopCardsHtml}</div>
  ${otherNeighborhoodsHtml}
  ${getFooterHTML()}
  ${getMobileMenuScript()}
</body>
</html>`;
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' },
      body: html
    };
    
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: `<h1>Error</h1><p>${error.message}</p>` };
  }
};
