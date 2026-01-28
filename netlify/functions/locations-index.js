/**
 * Locations Index - Auto-detect location, show city, stats
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAPBOX_TOKEN = process.env.MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1Ijoiam9lY29mZmVlIiwiYSI6ImNsb2F0OWFxYzA1ejQycW1qdGt5dXVhcXoifQ.NYmxbVXWOPV4cYLzPYvGKg';

const STATE_INFO = {
  'ca': { name: 'California', photo: 'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800&q=80' },
  'ny': { name: 'New York', photo: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80' },
  'tx': { name: 'Texas', photo: 'https://images.unsplash.com/photo-1531218150217-54595bc2b934?w=800&q=80' },
  'fl': { name: 'Florida', photo: 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=800&q=80' },
  'wa': { name: 'Washington', photo: 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=800&q=80' },
  'il': { name: 'Illinois', photo: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80' },
  'co': { name: 'Colorado', photo: 'https://images.unsplash.com/photo-1546156929-a4c0ac411f47?w=800&q=80' },
  'pa': { name: 'Pennsylvania', photo: 'https://images.unsplash.com/photo-1569761316261-9a8696fa2ca3?w=800&q=80' },
  'oh': { name: 'Ohio', photo: 'https://images.unsplash.com/photo-1558522195-e1201b090344?w=800&q=80' },
  'nc': { name: 'North Carolina', photo: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&q=80' },
  'ma': { name: 'Massachusetts', photo: 'https://images.unsplash.com/photo-1573155993874-d5d48af862ba?w=800&q=80' },
  'ga': { name: 'Georgia', photo: 'https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=800&q=80' },
  'mi': { name: 'Michigan', photo: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80' },
  'az': { name: 'Arizona', photo: 'https://images.unsplash.com/photo-1558645836-e44122a743ee?w=800&q=80' },
  'nj': { name: 'New Jersey', photo: 'https://images.unsplash.com/photo-1567604740881-e2d4c2d829a7?w=800&q=80' },
  'tn': { name: 'Tennessee', photo: 'https://images.unsplash.com/photo-1590108233685-95e3b792c9de?w=800&q=80' },
  'or': { name: 'Oregon', photo: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80' },
  'mn': { name: 'Minnesota', photo: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80' },
  'mo': { name: 'Missouri', photo: 'https://images.unsplash.com/photo-1568515045052-f9a854d70bfd?w=800&q=80' },
  'va': { name: 'Virginia', photo: 'https://images.unsplash.com/photo-1569974507005-6dc61f97fb5c?w=800&q=80' },
  'wi': { name: 'Wisconsin', photo: 'https://images.unsplash.com/photo-1609945014505-867d02418c89?w=800&q=80' },
  'md': { name: 'Maryland', photo: 'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800&q=80' },
  'in': { name: 'Indiana', photo: 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?w=800&q=80' },
  'sc': { name: 'South Carolina', photo: 'https://images.unsplash.com/photo-1589289460634-aa41a7ded55f?w=800&q=80' },
  'la': { name: 'Louisiana', photo: 'https://images.unsplash.com/photo-1568402102990-bc541580b59f?w=800&q=80' },
  'nv': { name: 'Nevada', photo: 'https://images.unsplash.com/photo-1581351721010-8cf859cb14a4?w=800&q=80' },
  'ok': { name: 'Oklahoma', photo: 'https://images.unsplash.com/photo-1600293721443-28a1c79d0b7d?w=800&q=80' },
  'ky': { name: 'Kentucky', photo: 'https://images.unsplash.com/photo-1581373449483-37449f962b6c?w=800&q=80' },
  'ct': { name: 'Connecticut', photo: 'https://images.unsplash.com/photo-1600156778666-e26ba5975eeb?w=800&q=80' },
  'ut': { name: 'Utah', photo: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80' },
  'nm': { name: 'New Mexico', photo: 'https://images.unsplash.com/photo-1570789210967-2cac24eb6e85?w=800&q=80' },
  'ne': { name: 'Nebraska', photo: 'https://images.unsplash.com/photo-1600710298566-46c9d7a59c17?w=800&q=80' },
  'ia': { name: 'Iowa', photo: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=800&q=80' },
  'ks': { name: 'Kansas', photo: 'https://images.unsplash.com/photo-1600493572236-05ef4e48047d?w=800&q=80' },
  'al': { name: 'Alabama', photo: 'https://images.unsplash.com/photo-1621352152374-fe6fb2b4eaea?w=800&q=80' },
  'ri': { name: 'Rhode Island', photo: 'https://images.unsplash.com/photo-1606142584646-5f2217253f80?w=800&q=80' },
  'hi': { name: 'Hawaii', photo: 'https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=800&q=80' },
  'ar': { name: 'Arkansas', photo: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=800&q=80' },
  'dc': { name: 'District of Columbia', photo: 'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=800&q=80' },
  'id': { name: 'Idaho', photo: 'https://images.unsplash.com/photo-1600298882283-07f45cc1e057?w=800&q=80' },
  'nh': { name: 'New Hampshire', photo: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?w=800&q=80' },
  'me': { name: 'Maine', photo: 'https://images.unsplash.com/photo-1534670007418-fbb7f6cf32c3?w=800&q=80' },
  'vt': { name: 'Vermont', photo: 'https://images.unsplash.com/photo-1601920360747-312e0048066d?w=800&q=80' },
  'ak': { name: 'Alaska', photo: 'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=800&q=80' },
  'de': { name: 'Delaware', photo: 'https://images.unsplash.com/photo-1606142626029-2b4c26ad1779?w=800&q=80' },
  'mt': { name: 'Montana', photo: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' },
  'sd': { name: 'South Dakota', photo: 'https://images.unsplash.com/photo-1581009137042-c552e485697a?w=800&q=80' },
  'ms': { name: 'Mississippi', photo: 'https://images.unsplash.com/photo-1565214975484-3cfa9e56f914?w=800&q=80' },
  'nd': { name: 'North Dakota', photo: 'https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=800&q=80' },
  'wv': { name: 'West Virginia', photo: 'https://images.unsplash.com/photo-1600298881641-8d8c4be16c96?w=800&q=80' },
  'wy': { name: 'Wyoming', photo: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80' },
};

exports.handler = async (event) => {
  try {
    // Get state counts
    const { data: stateData, error: stateError } = await supabase.rpc('get_state_shop_counts');
    if (stateError) throw stateError;

    // Get order ahead partners count
    const { count: partnerCount } = await supabase
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_joe_partner', true);

    // Get unique cities count
    const { data: cityData } = await supabase
      .from('shops')
      .select('city, state')
      .eq('is_active', true)
      .not('city', 'is', null);
    
    const uniqueCities = new Set(cityData?.map(s => `${s.city}-${s.state}`) || []);

    const states = stateData
      .filter(d => d.state_code && STATE_INFO[d.state_code.toLowerCase()])
      .map(d => {
        const code = d.state_code.toLowerCase();
        return {
          code,
          name: STATE_INFO[code].name,
          photo: STATE_INFO[code].photo,
          count: parseInt(d.count)
        };
      })
      .sort((a, b) => b.count - a.count);
    
    const totalShops = states.reduce((a, b) => a + b.count, 0);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      body: renderPage(states, totalShops, partnerCount || 0, uniqueCities.size)
    };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: 'Error: ' + err.message };
  }
};

function renderPage(states, totalShops, partnerCount, cityCount) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Find Coffee Shops Near You | joe coffee</title>
  <meta name="description" content="Discover ${totalShops.toLocaleString()} independent coffee shops across ${states.length} states. Order ahead at ${partnerCount}+ joe partners.">
  <link rel="canonical" href="https://joe.coffee/locations/">
  <link rel="icon" type="image/png" href="/images/logo.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',-apple-system,sans-serif;background:#fafaf9;color:#1c1917;line-height:1.6}
    a{color:inherit;text-decoration:none}
    
    /* Header */
    .header{background:#fff;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px}
    .nav{display:flex;align-items:center;gap:2rem}
    .nav a{font-size:0.95rem;font-weight:500;color:#374151;transition:color 0.2s}
    .nav a:hover{color:#000}
    .btn{padding:0.75rem 1.5rem;border-radius:100px;font-weight:600;font-size:0.95rem;border:none;cursor:pointer;text-decoration:none}
    .btn-primary{background:#000;color:#fff !important}
    .btn-primary:hover{background:#1f2937}
    
    /* Mobile menu button */
    .mobile-menu-btn{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:10px}
    .mobile-menu-btn span{display:block;width:24px;height:2px;background:#111;transition:all 0.3s}
    
    /* Mobile menu panel */
    .mobile-menu{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:200;padding:2rem;flex-direction:column}
    .mobile-menu.open{display:flex}
    .mobile-menu-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem}
    .mobile-menu-header img{height:40px}
    .mobile-menu-close{font-size:28px;cursor:pointer;padding:10px;background:none;border:none}
    .mobile-menu a{font-size:1.25rem;color:#111;text-decoration:none;padding:1rem 0;border-bottom:1px solid #e5e7eb}
    .mobile-menu .btn{margin-top:1rem;text-align:center}
    
    @media(max-width:768px){
      .nav{display:none}
      .mobile-menu-btn{display:flex}
    }

    /* Hero */
    .hero{position:relative;overflow:hidden;padding:3rem 1.5rem 4rem;text-align:center;color:#fff}
    .hero-bg{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr)}
    .hero-bg img{width:100%;height:100%;object-fit:cover}
    .hero-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.65)}
    .hero-content{position:relative;z-index:1;max-width:700px;margin:0 auto}
    .hero h1{font-size:2.5rem;font-weight:700;margin-bottom:0.75rem}
    .hero p{font-size:1.15rem;opacity:0.9;margin-bottom:2rem}
    
    /* Search box */
    .search-container{background:#fff;border-radius:16px;padding:6px;box-shadow:0 4px 20px rgba(0,0,0,0.15);max-width:560px;margin:0 auto}
    .search-form{display:flex;align-items:center;gap:8px}
    .search-input-wrapper{flex:1;display:flex;align-items:center;gap:10px;padding:0 16px;min-height:52px}
    .location-icon{color:#6b7280;flex-shrink:0}
    .location-icon.active{color:#2563eb}
    .location-icon.loading{animation:pulse 1.5s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    .search-input{flex:1;border:none;outline:none;font-size:1rem;font-family:inherit;background:transparent;min-width:0}
    .search-input::placeholder{color:#9ca3af}
    .clear-btn{background:none;border:none;color:#9ca3af;cursor:pointer;padding:4px;display:none;font-size:18px}
    .clear-btn.visible{display:block}
    .clear-btn:hover{color:#374151}
    .search-btn{background:#000;color:#fff;border:none;border-radius:12px;padding:14px 24px;font-size:1rem;font-weight:600;cursor:pointer;white-space:nowrap}
    .search-btn:hover{background:#1f2937}
    
    @media(max-width:640px){
      .hero h1{font-size:1.75rem}
      .hero p{font-size:1rem}
      .search-form{flex-direction:column;gap:0}
      .search-input-wrapper{width:100%;border-bottom:1px solid #e5e7eb;padding:12px 16px}
      .search-btn{width:100%;margin:8px;border-radius:10px}
    }
    
    /* Stats */
    .stats{display:flex;justify-content:center;gap:3rem;padding:2rem 1.5rem;flex-wrap:wrap}
    .stat{text-align:center}
    .stat-value{font-size:2.5rem;font-weight:700;color:#111}
    .stat-label{font-size:0.9rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em}
    
    @media(max-width:640px){
      .stats{gap:2rem}
      .stat-value{font-size:1.75rem}
    }
    
    /* Main content */
    .main{max-width:1280px;margin:0 auto;padding:0 1.5rem 4rem}
    .section-title{font-size:1.5rem;font-weight:700;margin-bottom:1.5rem}
    
    /* States grid */
    .states-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
    .state-card{background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;transition:all 0.2s}
    .state-card:hover{border-color:#000;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
    .state-card-image{height:140px;overflow:hidden}
    .state-card-image img{width:100%;height:100%;object-fit:cover}
    .state-card-body{padding:1rem}
    .state-card-name{font-weight:600;font-size:1.1rem;margin-bottom:0.25rem}
    .state-card-count{color:#6b7280;font-size:0.9rem}
    
    /* Footer */
    .footer{background:#111;color:#fff;padding:3rem 1.5rem;margin-top:4rem}
    .footer-inner{max-width:1280px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}
    .footer-logo img{height:32px;filter:brightness(0) invert(1)}
    .footer-links{display:flex;gap:2rem}
    .footer-links a{color:#9ca3af;font-size:0.9rem}
    .footer-links a:hover{color:#fff}
    .footer-copy{color:#6b7280;font-size:0.85rem}
    
    @media(max-width:640px){
      .footer-inner{flex-direction:column;text-align:center}
      .footer-links{flex-wrap:wrap;justify-content:center;gap:1rem}
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Coffee Shops</a>
        <a href="/about/">About</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
      <div class="mobile-menu-btn" id="mobileMenuBtn">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </header>
  
  <!-- Mobile Menu -->
  <div class="mobile-menu" id="mobileMenu">
    <div class="mobile-menu-header">
      <img src="/images/logo.png" alt="joe">
      <button class="mobile-menu-close" id="mobileMenuClose">✕</button>
    </div>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
  </div>

  <!-- Hero -->
  <div class="hero">
    <div class="hero-bg">
      <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&h=300&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&h=300&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=400&h=300&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=300&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&h=300&fit=crop" alt="">
    </div>
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <h1>Find Coffee Shops Near You</h1>
      <p id="heroSubtitle">Discover ${totalShops.toLocaleString()} independent coffee shops across the US</p>
      
      <div class="search-container">
        <form class="search-form" action="/locations/search/" method="GET" id="searchForm">
          <div class="search-input-wrapper">
            <svg class="location-icon" id="locationIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4"></path>
            </svg>
            <input type="text" name="q" class="search-input" id="searchInput" placeholder="Detecting your location..." autocomplete="off">
            <input type="hidden" name="lat" id="latInput">
            <input type="hidden" name="lng" id="lngInput">
            <button type="button" class="clear-btn" id="clearBtn">✕</button>
          </div>
          <button type="submit" class="search-btn">Search</button>
        </form>
      </div>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats">
    <div class="stat">
      <div class="stat-value" id="statShops">${totalShops.toLocaleString()}</div>
      <div class="stat-label">Coffee Shops</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="statPartners">${partnerCount.toLocaleString()}</div>
      <div class="stat-label">Order Ahead</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="statCities">${cityCount.toLocaleString()}</div>
      <div class="stat-label">Cities</div>
    </div>
  </div>

  <!-- Browse by State -->
  <main class="main">
    <h2 class="section-title">Browse by State</h2>
    <div class="states-grid">
      ${states.map(s => `
        <a href="/locations/${s.code}/" class="state-card">
          <div class="state-card-image">
            <img src="${s.photo}" alt="${s.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80'">
          </div>
          <div class="state-card-body">
            <div class="state-card-name">${s.name}</div>
            <div class="state-card-count">${s.count.toLocaleString()} shops</div>
          </div>
        </a>
      `).join('')}
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-inner">
      <a href="/" class="footer-logo"><img src="/images/logo.png" alt="joe"></a>
      <div class="footer-links">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Coffee Shops</a>
        <a href="/about/">About</a>
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
      </div>
      <div class="footer-copy">© ${new Date().getFullYear()} joe coffee</div>
    </div>
  </footer>

  <script>
    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    
    mobileMenuBtn?.addEventListener('click', () => {
      mobileMenu.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    
    mobileMenuClose?.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    });

    // Fetch fresh stats on page load (like homepage)
    async function refreshStats() {
      try {
        const response = await fetch('/.netlify/functions/get-stats');
        if (response.ok) {
          const stats = await response.json();
          if (stats.totalShops) {
            document.getElementById('statShops').textContent = stats.totalShops.toLocaleString();
            document.getElementById('heroSubtitle').textContent = 
              'Discover ' + stats.totalShops.toLocaleString() + ' independent coffee shops across the US';
          }
          if (stats.partnerCount) {
            document.getElementById('statPartners').textContent = stats.partnerCount.toLocaleString();
          }
          if (stats.cityCount) {
            document.getElementById('statCities').textContent = stats.cityCount.toLocaleString();
          }
        }
      } catch (e) {
        console.log('Stats refresh skipped');
      }
    }
    refreshStats();

    // Auto-detect location
    const searchInput = document.getElementById('searchInput');
    const latInput = document.getElementById('latInput');
    const lngInput = document.getElementById('lngInput');
    const locationIcon = document.getElementById('locationIcon');
    const clearBtn = document.getElementById('clearBtn');
    const searchForm = document.getElementById('searchForm');
    
    let userLocation = null;
    let detectedCity = null;
    
    // Start detecting location on page load
    if (navigator.geolocation) {
      locationIcon.classList.add('loading');
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          latInput.value = userLocation.lat;
          lngInput.value = userLocation.lng;
          
          // Reverse geocode to get city name
          try {
            const response = await fetch(
              'https://api.mapbox.com/geocoding/v5/mapbox.places/' + 
              userLocation.lng + ',' + userLocation.lat + 
              '.json?types=place&access_token=${MAPBOX_TOKEN}'
            );
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
              const place = data.features[0];
              const city = place.text;
              const state = place.context?.find(c => c.id.startsWith('region'))?.short_code?.replace('US-', '') || '';
              
              detectedCity = city + (state ? ', ' + state : '');
              searchInput.value = detectedCity;
              searchInput.placeholder = 'Search city, zip, or shop name...';
              locationIcon.classList.remove('loading');
              locationIcon.classList.add('active');
              clearBtn.classList.add('visible');
            }
          } catch (e) {
            console.error('Geocoding error:', e);
            searchInput.value = '';
            searchInput.placeholder = 'Search city, zip, or shop name...';
            locationIcon.classList.remove('loading');
          }
        },
        (error) => {
          console.log('Geolocation denied or unavailable');
          searchInput.value = '';
          searchInput.placeholder = 'Search city, zip, or shop name...';
          locationIcon.classList.remove('loading');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      );
    } else {
      searchInput.placeholder = 'Search city, zip, or shop name...';
    }
    
    // Clear button
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      latInput.value = '';
      lngInput.value = '';
      locationIcon.classList.remove('active');
      clearBtn.classList.remove('visible');
      searchInput.focus();
      userLocation = null;
      detectedCity = null;
    });
    
    // Show/hide clear button based on input
    searchInput.addEventListener('input', () => {
      if (searchInput.value) {
        clearBtn.classList.add('visible');
        // If user types something different, clear the location
        if (searchInput.value !== detectedCity) {
          latInput.value = '';
          lngInput.value = '';
          locationIcon.classList.remove('active');
        }
      } else {
        clearBtn.classList.remove('visible');
      }
    });
    
    // Handle form submit
    searchForm.addEventListener('submit', (e) => {
      // If using detected location (input matches detected city), keep lat/lng
      // Otherwise, clear lat/lng and just use the query
      if (searchInput.value !== detectedCity) {
        latInput.value = '';
        lngInput.value = '';
      }
    });
  </script>
</body>
</html>`;
}
