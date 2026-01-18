/**
 * Near Me - Location-based coffee shop search
 * Finds shops closest to user's coordinates
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const lat = parseFloat(params.lat);
    const lng = parseFloat(params.lng);
    const limit = Math.min(parseInt(params.limit) || 50, 100);

    if (isNaN(lat) || isNaN(lng)) {
      return redirect('/locations/');
    }

    // Get nearby shops using bounding box first (fast), then sort by distance
    const radiusMiles = 25;
    const latDelta = radiusMiles / 69; // ~69 miles per degree latitude
    const lngDelta = radiusMiles / (69 * Math.cos(lat * Math.PI / 180));

    const { data: shops, error } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, state, state_code, city_slug, lat, lng, is_joe_partner, partner_id, combined_rating, google_rating, photos')
      .gte('lat', lat - latDelta)
      .lte('lat', lat + latDelta)
      .gte('lng', lng - lngDelta)
      .lte('lng', lng + lngDelta)
      .limit(500);

    if (error) {
      console.error('Supabase error:', error);
      return error500();
    }

    // Calculate distances and sort
    const shopsWithDistance = (shops || []).map(shop => ({
      ...shop,
      distance: haversineDistance(lat, lng, shop.lat, shop.lng)
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

    const html = renderNearMePage(shopsWithDistance, lat, lng);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      },
      body: html
    };
  } catch (err) {
    console.error('Near-me error:', err);
    return error500();
  }
};

// Haversine formula for distance in miles
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatDistance(miles) {
  if (miles < 0.1) return 'Nearby';
  if (miles < 1) return `${(miles * 5280 / 1000).toFixed(1)}k ft`;
  return `${miles.toFixed(1)} mi`;
}

function renderNearMePage(shops, lat, lng) {
  const shopCount = shops.length;
  const partnerCount = shops.filter(s => s.is_joe_partner || s.partner_id).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shops Near You | joe coffee</title>
  <meta name="description" content="Find ${shopCount} independent coffee shops near your location. Order ahead with joe.">
  <meta name="robots" content="noindex">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--black:#000;--white:#fff;--gray-50:#F9FAFB;--gray-100:#F3F4F6;--gray-200:#E5E7EB;--gray-300:#D1D5DB;--gray-400:#9CA3AF;--gray-500:#6B7280;--gray-600:#4B5563;--gray-700:#374151;--gray-800:#1F2937;--gray-900:#111827;--green-600:#16A34A}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--gray-50);color:var(--gray-900);line-height:1.6}
    a{color:inherit;text-decoration:none}
    .header{background:var(--white);border-bottom:1px solid var(--gray-200);position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    
    .nav{display:flex;align-items:center;gap:2rem}
    .nav a{font-size:.95rem;font-weight:500;color:var(--gray-700)}
    .nav a:hover{color:var(--black)}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.75rem 1.5rem;border-radius:8px;font-weight:600;font-size:.95rem;cursor:pointer;border:none;transition:all .2s}
    .btn-primary{background:var(--black);color:var(--white) !important}
    .btn-primary:hover{background:var(--gray-800)}
    .main{max-width:1280px;margin:0 auto;padding:2rem 1.5rem}
    .page-header{margin-bottom:2rem}
    .page-header h1{font-size:2rem;font-weight:700;margin-bottom:.5rem}
    .page-header p{color:var(--gray-600);font-size:1.1rem}
    .results-meta{display:flex;gap:1.5rem;margin-top:1rem;font-size:.9rem;color:var(--gray-500)}
    .results-meta span{display:flex;align-items:center;gap:.35rem}
    .shops-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.25rem}
    .shop-card{background:var(--white);border-radius:12px;overflow:hidden;border:1px solid var(--gray-200);transition:all .2s}
    .shop-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .shop-photo{height:160px;background:linear-gradient(135deg,#374151 0%,#1F2937 100%);position:relative;overflow:hidden}
    .shop-photo img{width:100%;height:100%;object-fit:cover}
    .shop-distance{position:absolute;top:.75rem;right:.75rem;background:rgba(0,0,0,0.7);color:var(--white);padding:.35rem .75rem;border-radius:20px;font-size:.8rem;font-weight:500}
    .partner-tag{position:absolute;top:.75rem;left:.75rem;background:var(--green-600);color:var(--white);padding:.35rem .75rem;border-radius:20px;font-size:.75rem;font-weight:600}
    .shop-info{padding:1rem}
    .shop-name{font-weight:600;font-size:1.1rem;margin-bottom:.25rem;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
    .shop-location{color:var(--gray-500);font-size:.9rem;margin-bottom:.5rem}
    .shop-rating{display:flex;align-items:center;gap:.5rem;font-size:.85rem}
    .shop-rating .stars{color:#F59E0B}
    .shop-rating .score{color:var(--gray-700);font-weight:500}
    .no-results{text-align:center;padding:4rem 2rem;background:var(--white);border-radius:12px}
    .no-results h2{font-size:1.5rem;margin-bottom:1rem}
    .no-results p{color:var(--gray-600);margin-bottom:1.5rem}
    @media(max-width:640px){
      .page-header h1{font-size:1.5rem}
      .shops-grid{grid-template-columns:1fr}
      .results-meta{flex-wrap:wrap;gap:.75rem}
    }

    .mobile-menu-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:2rem;cursor:pointer;line-height:1}
    

    
    
    
    
    
    
    
    
    
    
    
    
    @media(max-width:768px){
      
      
    }

  
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    .mobile-menu 
    @media(max-width:768px){}

    .main-nav{background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 1.5rem;position:sticky;top:0;z-index:100}
    .nav-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px}
    .nav-links{display:flex;gap:1.5rem;align-items:center}
    .nav-links a{color:#374151;text-decoration:none;font-size:0.9rem}
    .nav-cta{background:#111!important;color:#fff!important;padding:0.5rem 1rem;border-radius:50px;font-weight:500}
    .mobile-menu-btn{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:10px;z-index:1001}
    .mobile-menu-btn span{display:block;width:24px;height:2px;background:#111;transition:all 0.3s ease}
    .mobile-menu{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:999;padding:24px;flex-direction:column}
    .mobile-menu.active{display:flex}
    .mobile-menu-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem}
    .mobile-close{background:none;border:none;font-size:1.5rem;cursor:pointer;padding:0.5rem}
    .mobile-menu a{display:block;font-size:1.1rem;color:#111;text-decoration:none;padding:1rem 0;border-bottom:1px solid #eee}
    .mobile-menu .mobile-cta{display:block;background:#111;color:#fff!important;padding:1rem;border-radius:50px;text-align:center;margin-top:1rem;border:none}
    @media(max-width:768px){.nav-links{display:none}.mobile-menu-btn{display:flex}}

</style>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-NLCJFKGXB5"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-NLCJFKGXB5');
</script>
</head>
<body>
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
    <div class="mobile-menu-header">
      <a href="/" class="logo"><img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" style="height:40px"></a>
      <button class="mobile-close" id="mobileClose">✕</button>
    </div>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee" class="mobile-cta">Get the App</a>
  </div>

<main class="main">
    <div class="page-header">
      <h1>☕ Coffee Shops Near You</h1>
      <p>Found ${shopCount} independent coffee shops within 25 miles</p>
      <div class="results-meta">
        ${partnerCount > 0 ? `<span>🟢 ${partnerCount} joe partner${partnerCount === 1 ? '' : 's'} (order ahead)</span>` : ''}
        <span>📍 Sorted by distance</span>
      </div>
    </div>

    ${shopCount > 0 ? `
    <div class="shops-grid">
      ${shops.map(shop => {
        const stateCode = (shop.state_code || 'us').toLowerCase();
        const citySlug = shop.city_slug || slugify(shop.city);
        const url = `/locations/${stateCode}/${citySlug}/${shop.slug}/`;
        const isPartner = shop.is_joe_partner || shop.partner_id;
        const photo = shop.photos?.[0];
        const rating = shop.combined_rating || shop.google_rating;
        
        return `
      <a href="${url}" class="shop-card">
        <div class="shop-photo">
          ${photo ? `<img src="${esc(photo)}" alt="${esc(shop.name)}" loading="lazy">` : ''}
          <span class="shop-distance">${formatDistance(shop.distance)}</span>
          ${isPartner ? `<span class="partner-tag">☕ joe Partner</span>` : ''}
        </div>
        <div class="shop-info">
          <div class="shop-name">${esc(shop.name)}</div>
          <div class="shop-location">${esc(shop.city)}, ${esc(shop.state)}</div>
          ${rating ? `<div class="shop-rating"><span class="stars">${'★'.repeat(Math.round(rating))}</span><span class="score">${rating}</span></div>` : ''}
        </div>
      </a>`;
      }).join('')}
    </div>
    ` : `
    <div class="no-results">
      <h2>No coffee shops found nearby</h2>
      <p>Try searching for a city or browsing all locations.</p>
      <a href="/locations/" class="btn btn-primary">Browse All Locations</a>
    </div>
    `}
  </main>

  <div id="mobileOverlay" class="mobile-overlay" onclick="document.getElementById('mobileMenu').classList.remove('open');this.classList.remove('open')"></div>
  <div id="mobileMenu" class="mobile-menu">
    <button class="mobile-menu-close" onclick="document.getElementById('mobileMenu').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('open')">&times;</button>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee">Get the App</a>
  </div>
  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>

  
  
  <script>
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileClose = document.getElementById('mobileClose');
    if(mobileMenuBtn && mobileMenu){
      mobileMenuBtn.addEventListener('click',()=>{
        mobileMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }
    if(mobileClose && mobileMenu){
      mobileClose.addEventListener('click',()=>{
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  </script>

</body>
</html>`;
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/['']/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function redirect(url) {
  return { statusCode: 302, headers: { Location: url }, body: '' };
}

function error500() {
  return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<h1>Server error</h1><p><a href="/locations/">Browse locations</a></p>' };
}