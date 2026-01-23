/**
 * Locations Index - Uses RPC for efficient state counts
 * REBRANDED with new color palette and fonts
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
const DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80';

exports.handler = async (event) => {
  try {
    const { data, error } = await supabase.rpc('get_state_shop_counts');
    
    if (error) throw error;

    const states = data
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
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
      body: renderPage(states, totalShops)
    };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: 'Error: ' + err.message };
  }
};

function renderPage(states, totalShops) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Find Coffee Shops Near You | joe coffee</title>
  <meta name="description" content="Discover ${totalShops.toLocaleString()} independent coffee shops across ${states.length} states.">
  <link rel="canonical" href="https://joe.coffee/locations/">
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    :root {
      --paper-cream: #fef8ec;
      --stone-gray: #7c7c7c;
      --soft-charcoal: #2e2e2e;
      --espresso-black: #000000;
      --caramel-clay: #b66a32;
      --cafe-grove: #252610;
      --milk-moss: #4d502c;
      --color-border: #e8e2d9;
      --font-display: 'Cormorant Garamond', Georgia, serif;
      --font-body: 'Inter', -apple-system, sans-serif;
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:var(--font-body);background:var(--paper-cream);color:var(--soft-charcoal);line-height:1.6}
    a{color:inherit;text-decoration:none}

    .main-nav{background:#fff;border-bottom:1px solid var(--color-border);padding:1rem 1.5rem;position:sticky;top:0;z-index:100}
    .nav-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px}
    .nav-links{display:flex;gap:1.5rem;align-items:center}
    .nav-links a{color:var(--soft-charcoal);text-decoration:none;font-size:0.9rem}
    .nav-cta{background:var(--espresso-black)!important;color:#fff!important;padding:0.5rem 1rem;border-radius:50px;font-weight:500}
    .mobile-menu-btn{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:10px;z-index:1001}
    .mobile-menu-btn span{display:block;width:24px;height:2px;background:var(--espresso-black);transition:all 0.3s ease}
    .mobile-menu{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:999;padding:24px;flex-direction:column}
    .mobile-menu.active{display:flex}
    .mobile-menu-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem}
    .mobile-close{background:none;border:none;font-size:1.5rem;cursor:pointer;padding:0.5rem}
    .mobile-menu a{display:block;font-size:1.1rem;color:var(--espresso-black);text-decoration:none;padding:1rem 0;border-bottom:1px solid var(--color-border)}
    .mobile-menu .mobile-cta{display:block;background:var(--espresso-black);color:#fff!important;padding:1rem;border-radius:50px;text-align:center;margin-top:1rem;border:none}
    @media(max-width:768px){.nav-links{display:none}.mobile-menu-btn{display:flex}}

    .hero{position:relative;overflow:hidden;background:var(--cafe-grove);padding:5rem 1.5rem;text-align:center;color:#fff}
    .hero-collage{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);opacity:0.2}
    .hero-collage img{width:100%;height:100%;object-fit:cover}
    .hero h1{position:relative;font-family:var(--font-display);font-size:clamp(2rem,5vw,3.5rem);font-weight:500;margin-bottom:1rem;letter-spacing:-0.01em}
    .hero p{position:relative;font-size:1.1rem;opacity:0.9;max-width:600px;margin:0 auto 2rem}
    
    .search-box{position:relative;max-width:600px;margin:0 auto;display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center}
    .search-input{flex:1;min-width:200px;padding:1rem;border:none;border-radius:8px;font-size:1rem;font-family:var(--font-body)}
    .search-btn{padding:1rem 2rem;background:var(--caramel-clay);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;transition:background 0.2s}
    .search-btn:hover{background:#a35d2a}
    .location-btn{display:flex;align-items:center;gap:0.5rem;padding:1rem 1.25rem;background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-weight:500;cursor:pointer;transition:all 0.2s}
    .location-btn:hover{background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5)}
    .location-btn svg{flex-shrink:0}
    
    .main{max-width:1280px;margin:0 auto;padding:3rem 1.5rem}
    .stats{display:flex;justify-content:center;gap:4rem;margin-bottom:3rem}
    .stat-value{font-family:var(--font-display);font-size:clamp(2rem,5vw,3rem);font-weight:500;color:var(--espresso-black)}
    .stat-label{color:var(--stone-gray);font-size:0.9rem}
    .section-title{font-family:var(--font-display);font-size:1.75rem;font-weight:500;margin-bottom:1.5rem;color:var(--espresso-black)}
    
    .states-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.25rem}
    .state-card{background:#fff;border-radius:12px;overflow:hidden;border:1px solid var(--color-border);transition:all 0.2s}
    .state-card:hover{border-color:var(--caramel-clay);box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .state-card-image{height:120px;background:#f5f0e8}
    .state-card-image img{width:100%;height:100%;object-fit:cover}
    .state-card-body{padding:1rem 1.25rem}
    .state-card-name{font-weight:600;color:var(--espresso-black)}
    .state-card-count{color:var(--stone-gray);font-size:0.85rem;margin-top:0.25rem}
    
    @media(max-width:768px){
      .hero h1{font-size:1.75rem}
      .search-box{flex-direction:column}
      .states-grid{grid-template-columns:repeat(2,1fr)}
      .stats{gap:2rem}
    }
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

  <div class="hero">
    <div class="hero-collage">
      <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=400&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&h=400&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&h=400&fit=crop" alt="">
      <img src="https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=400&h=400&fit=crop" alt="">
    </div>
    <h1>Find Coffee Shops Near You</h1>
    <p>Discover ${totalShops.toLocaleString()} independent coffee shops across the US</p>
    <div class="search-box">
      <form action="/locations/search/" method="get" style="display:flex;gap:0.5rem;flex:1">
        <input type="text" name="q" class="search-input" placeholder="Search city, zip, or shop name...">
        <button type="submit" class="search-btn">Search</button>
      </form>
      <button onclick="useMyLocation()" class="location-btn" id="locationBtn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4m0 12v4M2 12h4m12 0h4"></path></svg>
        <span>Near me</span>
      </button>
    </div>
  </div>
  
  <main class="main">
    <div class="stats">
      <div class="stat"><div class="stat-value">${totalShops.toLocaleString()}</div><div class="stat-label">Coffee Shops</div></div>
      <div class="stat"><div class="stat-value">${states.length}</div><div class="stat-label">States</div></div>
    </div>
    <h2 class="section-title">Browse by State</h2>
    <div class="states-grid">
      ${states.map(s => `
        <a href="/locations/${s.code}/" class="state-card">
          <div class="state-card-image"><img src="${s.photo}" alt="${s.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80'"></div>
          <div class="state-card-body">
            <div class="state-card-name">${s.name}</div>
            <div class="state-card-count">${s.count.toLocaleString()} shops</div>
          </div>
        </a>
      `).join('')}
    </div>
  </main>
  
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
    
    function useMyLocation() {
      const btn = document.getElementById('locationBtn');
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
      }
      
      btn.style.opacity = '0.6';
      btn.style.pointerEvents = 'none';
      btn.innerHTML = '<svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg><span>Finding...</span>';
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          window.location.href = '/locations/search/?lat=' + position.coords.latitude + '&lng=' + position.coords.longitude;
        },
        (error) => {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4m0 12v4M2 12h4m12 0h4"></path></svg><span>Near me</span>';
          alert('Unable to get your location. Please try searching by city or zip code.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  </script>
</body>
</html>`;
}