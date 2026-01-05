/**
 * Locations Index - Browse by State
 * URL: /locations/
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    // Get all states with shop counts
    const { data: shops, error } = await supabase
      .from('shops')
      .select('state, state_code')
      .not('state', 'is', null)
      .not('state_code', 'is', null);

    if (error) throw error;

    // Get photos for hero
    const { data: shopsWithPhotos } = await supabase
      .from('shops')
      .select('photos')
      .not('photos', 'is', null)
      .limit(20);

    const heroPhotos = [];
    if (shopsWithPhotos) {
      shopsWithPhotos.forEach(shop => {
        if (shop.photos && shop.photos.length > 0 && heroPhotos.length < 8) {
          heroPhotos.push(shop.photos[0]);
        }
      });
    }

    // Aggregate states
    const stateMap = {};
    shops.forEach(shop => {
      const code = (shop.state_code || '').toLowerCase();
      if (!code || code.length !== 2) return;
      if (!stateMap[code]) {
        stateMap[code] = { code, name: getStateName(code), count: 0 };
      }
      stateMap[code].count++;
    });

    const stateList = Object.values(stateMap)
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);

    const totalShops = shops.length;
    const totalStates = stateList.length;

    const html = renderLocationsIndex(stateList, totalShops, totalStates, heroPhotos);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      },
      body: html
    };
  } catch (err) {
    console.error('Locations index error:', err);
    return error500();
  }
};

function renderLocationsIndex(states, totalShops, totalStates, heroPhotos) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Find Coffee Shops Near You | joe coffee</title>
  <meta name="description" content="Discover ${totalShops.toLocaleString()} independent coffee shops across ${totalStates} states. Find local cafes with ratings, hours, and mobile ordering.">
  <link rel="canonical" href="https://joe.coffee/locations/">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#FAF9F6;color:#1c1917;line-height:1.6}
    a{color:inherit;text-decoration:none}
    
    .header{background:#fff;border-bottom:1px solid #e7e5e4;position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px}
    .nav{display:flex;align-items:center;gap:2rem}
    .nav a{font-size:.95rem;font-weight:500;color:#57534e}
    .nav a:hover{color:#1c1917}
    .btn{padding:.75rem 1.5rem;border-radius:100px;font-weight:600;font-size:.9rem;transition:all .2s}
    .btn-primary{background:#1c1917;color:#fff !important}
    .btn-primary:hover{background:#292524}
    
    .hero{position:relative;padding:5rem 1.5rem;overflow:hidden;min-height:450px;display:flex;align-items:center}
    .hero-bg{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:4px;opacity:.4}
    .hero-bg img{width:100%;height:100%;object-fit:cover}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(28,25,23,.7),rgba(28,25,23,.6))}
    .hero-inner{position:relative;z-index:1;max-width:800px;margin:0 auto;text-align:center}
    .hero-badge{display:inline-flex;align-items:center;gap:.5rem;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);padding:.5rem 1rem;border-radius:100px;font-size:.9rem;color:#fff;margin-bottom:1.5rem}
    .hero h1{font-size:3.5rem;font-weight:800;color:#fff;margin-bottom:.75rem;letter-spacing:-.02em}
    .hero p{font-size:1.25rem;color:rgba(255,255,255,.7);margin-bottom:2.5rem}
    
    .search-box{display:flex;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,.3)}
    .search-box input{flex:1;padding:1.5rem 1.75rem;border:none;font-size:1.15rem;outline:none}
    .search-box input::placeholder{color:#a8a29e}
    .search-box button{background:#1c1917;color:#fff;border:none;padding:1.25rem 2.5rem;font-weight:600;font-size:1.05rem;cursor:pointer;display:flex;align-items:center;gap:.5rem;transition:background .2s}
    .search-box button:hover{background:#292524}
    .search-box button svg{width:22px;height:22px}
    
    .quick-links{display:flex;justify-content:center;gap:1rem;margin-top:2rem;flex-wrap:wrap}
    .quick-link{background:rgba(255,255,255,.1);color:#fff;padding:.5rem 1rem;border-radius:100px;font-size:.9rem;transition:background .2s}
    .quick-link:hover{background:rgba(255,255,255,.2)}
    
    .main{max-width:1280px;margin:0 auto;padding:3rem 1.5rem 4rem}
    
    .section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
    .section-title{font-size:1.5rem;font-weight:700;color:#1c1917}
    .section-count{color:#78716c;font-size:.9rem}
    
    .states-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.75rem}
    .state-card{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:1.25rem 1.5rem;display:flex;justify-content:space-between;align-items:center;transition:all .15s}
    .state-card:hover{border-color:#1c1917;background:#fff}
    .state-name{font-weight:600;color:#1c1917}
    .state-count{color:#1c1917;font-weight:600;font-size:.9rem}
    
    .near-me-section{background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:2rem;margin-bottom:3rem;display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap}
    .near-me-content h3{font-size:1.25rem;font-weight:700;color:#1c1917;margin-bottom:.5rem}
    .near-me-content p{color:#57534e}
    .near-me-btn{background:#1c1917;color:#fff !important;padding:1rem 2rem;border-radius:100px;font-weight:600;display:inline-flex;align-items:center;gap:.5rem;transition:background .2s}
    .near-me-btn:hover{background:#292524}
    .near-me-btn svg{width:20px;height:20px}
    
    @media(max-width:768px){
      .nav{display:none}
      .hero{padding:3rem 1.5rem;min-height:380px}
      .hero h1{font-size:2.25rem}
      .hero p{font-size:1rem}
      .hero-bg{grid-template-columns:repeat(2,1fr)}
      .search-box{flex-direction:column;border-radius:12px}
      .search-box input{padding:1.25rem}
      .search-box button{justify-content:center}
      .quick-links{gap:.5rem}
      .near-me-section{flex-direction:column;text-align:center}
      .states-grid{grid-template-columns:1fr 1fr}
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
    </div>
  </header>

  <section class="hero">
    ${heroPhotos.length > 0 ? `
    <div class="hero-bg">
      ${heroPhotos.map(photo => `<img src="${esc(photo)}" alt="">`).join('')}
    </div>
    ` : ''}
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      <div class="hero-badge">☕ ${totalShops.toLocaleString()} coffee shops nationwide</div>
      <h1>Find Your Next Favorite Coffee Shop</h1>
      <p>Discover independent cafes, roasters, and coffee shops in your city</p>
      <div class="search-box">
        <input type="text" id="stateSearch" placeholder="Search by state or city..." autocomplete="off">
        <button type="button" onclick="searchLocation()">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          Search
        </button>
      </div>
      <div class="quick-links">
        <a href="/locations/ca/" class="quick-link">California</a>
        <a href="/locations/ny/" class="quick-link">New York</a>
        <a href="/locations/tx/" class="quick-link">Texas</a>
        <a href="/locations/wa/" class="quick-link">Washington</a>
        <a href="/locations/fl/" class="quick-link">Florida</a>
      </div>
    </div>
  </section>

  <main class="main">
    <div class="near-me-section">
      <div class="near-me-content">
        <h3>📍 Find Coffee Near You</h3>
        <p>Use your location to discover nearby coffee shops</p>
      </div>
      <a href="/locations/near-me/" class="near-me-btn" onclick="findNearMe(event)">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        Use My Location
      </a>
    </div>
    
    <div class="section-header">
      <h2 class="section-title">Browse by State</h2>
      <span class="section-count">${totalStates} states</span>
    </div>
    <div class="states-grid" id="statesGrid">
      ${states.map(state => `
        <a href="/locations/${state.code}/" class="state-card" data-name="${esc(state.name.toLowerCase())}">
          <span class="state-name">${esc(state.name)}</span>
          <span class="state-count">${state.count.toLocaleString()}</span>
        </a>
      `).join('')}
    </div>
  </main>

  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
  
  <script>
    // Filter states
    document.getElementById('stateSearch').addEventListener('input', function(e) {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.state-card').forEach(card => {
        const name = card.getAttribute('data-name');
        card.style.display = name.includes(query) ? '' : 'none';
      });
    });
    
    // Search on enter
    document.getElementById('stateSearch').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') searchLocation();
    });
    
    function searchLocation() {
      const query = document.getElementById('stateSearch').value.trim();
      if (query) {
        window.location.href = '/locations/search/?q=' + encodeURIComponent(query);
      }
    }
    
    function findNearMe(e) {
      e.preventDefault();
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
          window.location.href = '/locations/near-me/?lat=' + pos.coords.latitude + '&lng=' + pos.coords.longitude;
        }, function() {
          window.location.href = '/locations/near-me/';
        });
      } else {
        window.location.href = '/locations/near-me/';
      }
    }
  </script>
</body>
</html>`;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getStateName(code) {
  const states = {
    'al':'Alabama','ak':'Alaska','az':'Arizona','ar':'Arkansas','ca':'California',
    'co':'Colorado','ct':'Connecticut','de':'Delaware','fl':'Florida','ga':'Georgia',
    'hi':'Hawaii','id':'Idaho','il':'Illinois','in':'Indiana','ia':'Iowa','ks':'Kansas',
    'ky':'Kentucky','la':'Louisiana','me':'Maine','md':'Maryland','ma':'Massachusetts',
    'mi':'Michigan','mn':'Minnesota','ms':'Mississippi','mo':'Missouri','mt':'Montana',
    'ne':'Nebraska','nv':'Nevada','nh':'New Hampshire','nj':'New Jersey','nm':'New Mexico',
    'ny':'New York','nc':'North Carolina','nd':'North Dakota','oh':'Ohio','ok':'Oklahoma',
    'or':'Oregon','pa':'Pennsylvania','ri':'Rhode Island','sc':'South Carolina',
    'sd':'South Dakota','tn':'Tennessee','tx':'Texas','ut':'Utah','vt':'Vermont',
    'va':'Virginia','wa':'Washington','wv':'West Virginia','wi':'Wisconsin','wy':'Wyoming',
    'dc':'Washington D.C.'
  };
  return states[code] || code.toUpperCase();
}

function error500() {
  return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<h1>Server error</h1>' };
}