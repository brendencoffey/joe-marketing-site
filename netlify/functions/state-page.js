/**
 * State Page - Coffee Shops by City
 * URL: /locations/:state/
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const path = event.path || "";
    const parts = path.replace("/.netlify/functions/state-page", "").replace("/locations/", "").split("/").filter(Boolean);
    const state = parts[0] || event.queryStringParameters?.state;
    
    if (!state) {
      return redirect('/locations/');
    }

    const stateCode = state.toLowerCase();
    const stateName = getStateName(stateCode);

    // Get all cities in this state with shop counts
    const { data: cities, error } = await supabase
      .from('shops')
      .select('city, city_slug')
      .ilike('state_code', stateCode)
      .not('city', 'is', null)
      .not('city_slug', 'is', null);

    if (error) throw error;

    if (!cities || cities.length === 0) {
      return notFound(stateCode);
    }

    // Aggregate cities with counts
    const cityMap = {};
    cities.forEach(shop => {
      const key = shop.city_slug;
      if (!cityMap[key]) {
        cityMap[key] = { name: shop.city, slug: shop.city_slug, count: 0 };
      }
      cityMap[key].count++;
    });

    const cityList = Object.values(cityMap)
      .sort((a, b) => b.count - a.count);

    const totalShops = cities.length;
    const totalCities = cityList.length;

    const html = renderStatePage(stateCode, stateName, cityList, totalShops, totalCities);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      },
      body: html
    };
  } catch (err) {
    console.error('State page error:', err);
    return error500();
  }
};

function renderStatePage(stateCode, stateName, cities, totalShops, totalCities) {
  const canonicalUrl = `https://joe.coffee/locations/${stateCode}/`;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shops in ${esc(stateName)} | joe coffee</title>
  <meta name="description" content="Find the best independent coffee shops in ${esc(stateName)}. Browse ${totalShops} coffee shops across ${totalCities} cities.">
  <link rel="canonical" href="${canonicalUrl}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#fafaf9;color:#1c1917;line-height:1.6}
    a{color:inherit;text-decoration:none}
    
    /* Header */
    .header{background:#fff;border-bottom:1px solid #e7e5e4;position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px}
    .nav{display:flex;align-items:center;gap:2rem}
    .nav a{font-size:.95rem;font-weight:500;color:#57534e}
    .nav a:hover{color:#1c1917}
    .btn{padding:.75rem 1.5rem;border-radius:100px;font-weight:600;font-size:.9rem;transition:all .2s}
    .btn-primary{background:#1c1917;color:#fff !important}
    .btn-primary:hover{background:#292524}
    
    /* Hero */
    .hero{background:linear-gradient(135deg,#1c1917 0%,#292524 100%);padding:4rem 1.5rem 5rem;position:relative;overflow:hidden}
    .hero::before{content:'☕';position:absolute;right:-50px;top:-50px;font-size:300px;opacity:.03}
    .hero-inner{max-width:800px;margin:0 auto;text-align:center;position:relative;z-index:1}
    .hero-badge{display:inline-flex;align-items:center;gap:.5rem;background:rgba(255,255,255,.1);backdrop-filter:blur(10px);padding:.5rem 1rem;border-radius:100px;font-size:.85rem;color:#fff;margin-bottom:1.5rem}
    .hero h1{font-size:3rem;font-weight:800;color:#fff;margin-bottom:.75rem;letter-spacing:-.02em}
    .hero p{font-size:1.2rem;color:#a8a29e;margin-bottom:2rem}
    
    /* Search */
    .search-container{max-width:600px;margin:0 auto}
    .search-box{display:flex;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,.2)}
    .search-box input{flex:1;padding:1.25rem 1.5rem;border:none;font-size:1.1rem;outline:none}
    .search-box input::placeholder{color:#a8a29e}
    .search-box button{background:#16a34a;color:#fff;border:none;padding:1rem 2rem;font-weight:600;font-size:1rem;cursor:pointer;display:flex;align-items:center;gap:.5rem;transition:background .2s}
    .search-box button:hover{background:#15803d}
    .search-box button svg{width:20px;height:20px}
    
    /* Stats */
    .stats{display:flex;justify-content:center;gap:4rem;margin-top:3rem}
    .stat{text-align:center;color:#fff}
    .stat-value{font-size:2.5rem;font-weight:800}
    .stat-label{font-size:.9rem;color:#a8a29e;margin-top:.25rem}
    
    /* Breadcrumb */
    .breadcrumb{max-width:1280px;margin:0 auto;padding:1.5rem 1.5rem .5rem;font-size:.875rem;color:#78716c}
    .breadcrumb a{color:#57534e;font-weight:500}.breadcrumb a:hover{color:#1c1917}
    .breadcrumb span{margin:0 .5rem;color:#d6d3d1}
    
    /* Main */
    .main{max-width:1280px;margin:0 auto;padding:1rem 1.5rem 4rem}
    
    .section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
    .section-title{font-size:1.5rem;font-weight:700;color:#1c1917}
    .section-count{color:#78716c;font-size:.95rem}
    
    /* Cities Grid */
    .cities-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
    .city-card{background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:1.5rem;display:flex;justify-content:space-between;align-items:center;transition:all .2s;cursor:pointer}
    .city-card:hover{border-color:#16a34a;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.06)}
    .city-info{display:flex;align-items:center;gap:1rem}
    .city-icon{width:48px;height:48px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.5rem}
    .city-name{font-weight:600;font-size:1.1rem;color:#1c1917}
    .city-state{font-size:.85rem;color:#78716c;margin-top:.125rem}
    .city-count{background:#f5f5f4;color:#57534e;padding:.5rem 1rem;border-radius:100px;font-size:.9rem;font-weight:600}
    .city-card:hover .city-count{background:#16a34a;color:#fff}
    
    /* Popular Section */
    .popular-section{margin-bottom:3rem}
    .popular-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem}
    .popular-card{background:linear-gradient(135deg,#16a34a,#15803d);border-radius:16px;padding:1.75rem;color:#fff;transition:all .2s}
    .popular-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(22,163,74,.3)}
    .popular-card .city-name{color:#fff;font-size:1.25rem}
    .popular-card .city-count{background:rgba(255,255,255,.2);color:#fff;margin-top:1rem;display:inline-block}
    
    /* No Results */
    .no-results{text-align:center;padding:3rem;color:#78716c}
    
    @media(max-width:768px){
      .nav{display:none}
      .hero{padding:3rem 1.5rem 4rem}
      .hero h1{font-size:2rem}
      .hero p{font-size:1rem}
      .stats{gap:2rem}
      .stat-value{font-size:1.75rem}
      .search-box{flex-direction:column}
      .search-box button{padding:1rem}
      .cities-grid{grid-template-columns:1fr}
      .popular-grid{grid-template-columns:1fr}
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
    <div class="hero-inner">
      <div class="hero-badge">☕ ${totalCities} cities to explore</div>
      <h1>Coffee in ${esc(stateName)}</h1>
      <p>Discover ${totalShops.toLocaleString()} independent coffee shops</p>
      
      <div class="search-container">
        <form class="search-box" action="/locations/search/" method="GET">
          <input type="text" name="q" placeholder="Search for a city or coffee shop..." autocomplete="off">
          <input type="hidden" name="state" value="${stateCode}">
          <button type="submit">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            Search
          </button>
        </form>
      </div>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${totalShops.toLocaleString()}</div>
          <div class="stat-label">Coffee Shops</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalCities}</div>
          <div class="stat-label">Cities</div>
        </div>
      </div>
    </div>
  </section>

  <nav class="breadcrumb">
    <a href="/">Home</a><span>›</span>
    <a href="/locations/">Locations</a><span>›</span>
    ${esc(stateName)}
  </nav>

  <main class="main">
    ${cities.slice(0, 6).length > 0 ? `
    <section class="popular-section">
      <div class="section-header">
        <h2 class="section-title">🔥 Popular Cities</h2>
      </div>
      <div class="popular-grid">
        ${cities.slice(0, 6).map(city => `
          <a href="/locations/${stateCode}/${city.slug}/" class="popular-card">
            <div class="city-name">${esc(city.name)}</div>
            <span class="city-count">${city.count} shops</span>
          </a>
        `).join('')}
      </div>
    </section>
    ` : ''}
    
    <section>
      <div class="section-header">
        <h2 class="section-title">All Cities</h2>
        <span class="section-count">${totalCities} cities</span>
      </div>
      <div class="cities-grid" id="citiesGrid">
        ${cities.map(city => `
          <a href="/locations/${stateCode}/${city.slug}/" class="city-card">
            <div class="city-info">
              <div class="city-icon">☕</div>
              <div>
                <div class="city-name">${esc(city.name)}</div>
                <div class="city-state">${esc(stateName)}</div>
              </div>
            </div>
            <span class="city-count">${city.count}</span>
          </a>
        `).join('')}
      </div>
    </section>
  </main>

  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
  
  <script>
    // Client-side search filter
    const searchInput = document.querySelector('.search-box input');
    const citiesGrid = document.getElementById('citiesGrid');
    const cards = citiesGrid.querySelectorAll('.city-card');
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      cards.forEach(card => {
        const name = card.querySelector('.city-name').textContent.toLowerCase();
        card.style.display = name.includes(query) ? '' : 'none';
      });
    });
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

function redirect(url) {
  return { statusCode: 301, headers: { Location: url }, body: '' };
}

function notFound(stateCode) {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/html' },
    body: `<h1>No coffee shops found in ${stateCode.toUpperCase()}</h1><p><a href="/locations/">Browse all locations</a></p>`
  };
}

function error500() {
  return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<h1>Server error</h1>' };
}