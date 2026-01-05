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

    // Get cities
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

    // Get photos for hero collage
    const { data: shopsWithPhotos } = await supabase
      .from('shops')
      .select('photos')
      .ilike('state_code', stateCode)
      .not('photos', 'is', null)
      .limit(20);

    const heroPhotos = [];
    if (shopsWithPhotos) {
      shopsWithPhotos.forEach(shop => {
        if (shop.photos && shop.photos.length > 0) {
          heroPhotos.push(shop.photos[0]);
        }
      });
    }

    const cityMap = {};
    cities.forEach(shop => {
      const key = shop.city_slug;
      if (!cityMap[key]) {
        cityMap[key] = { name: shop.city, slug: shop.city_slug, count: 0 };
      }
      cityMap[key].count++;
    });

    const cityList = Object.values(cityMap).sort((a, b) => b.count - a.count);
    const totalShops = cities.length;
    const totalCities = cityList.length;

    const html = renderStatePage(stateCode, stateName, cityList, totalShops, totalCities, heroPhotos.slice(0, 8));

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

function renderStatePage(stateCode, stateName, cities, totalShops, totalCities, heroPhotos) {
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
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#1c1917;line-height:1.6}
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
    
    .hero{position:relative;padding:4rem 1.5rem;overflow:hidden;min-height:400px;display:flex;align-items:center}
    .hero-bg{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:4px;opacity:.4}
    .hero-bg img{width:100%;height:100%;object-fit:cover}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(28,25,23,.7),rgba(28,25,23,.6))}
    .hero-inner{position:relative;z-index:1;max-width:800px;margin:0 auto;text-align:center}
    .breadcrumb{font-size:.875rem;color:rgba(255,255,255,.6);margin-bottom:1.5rem}
    .breadcrumb a{color:rgba(255,255,255,.8);font-weight:500}.breadcrumb a:hover{color:#fff}
    .breadcrumb span{margin:0 .5rem;color:rgba(255,255,255,.4)}
    .hero h1{font-size:3rem;font-weight:800;color:#fff;margin-bottom:.75rem}
    .hero-meta{display:flex;justify-content:center;gap:2rem;color:rgba(255,255,255,.7);font-size:1rem;margin-bottom:2rem}
    .hero-meta span{display:flex;align-items:center;gap:.5rem}
    
    .search-box{display:flex;max-width:550px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3)}
    .search-box input{flex:1;padding:1.25rem 1.5rem;border:none;font-size:1.1rem;outline:none}
    .search-box input::placeholder{color:#a8a29e}
    .search-box button{background:#16a34a;color:#fff;border:none;padding:1rem 2rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:.5rem;transition:background .2s}
    .search-box button:hover{background:#15803d}
    .search-box button svg{width:20px;height:20px}
    
    .main{max-width:1280px;margin:0 auto;padding:2.5rem 1.5rem 4rem}
    
    .section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem}
    .section-title{font-size:1.25rem;font-weight:700;color:#1c1917}
    .section-count{color:#78716c;font-size:.9rem}
    
    .cities-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.75rem}
    .city-card{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:1.25rem 1.5rem;display:flex;justify-content:space-between;align-items:center;transition:all .15s}
    .city-card:hover{border-color:#16a34a;background:#f0fdf4}
    .city-name{font-weight:600;color:#1c1917}
    .city-count{color:#16a34a;font-weight:600;font-size:.9rem}
    
    @media(max-width:768px){
      .nav{display:none}
      .hero{padding:3rem 1.5rem;min-height:350px}
      .hero h1{font-size:2rem}
      .hero-meta{flex-wrap:wrap;gap:1rem}
      .hero-bg{grid-template-columns:repeat(2,1fr)}
      .search-box{flex-direction:column;border-radius:12px}
      .search-box button{justify-content:center}
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
      <nav class="breadcrumb">
        <a href="/">Home</a><span>›</span>
        <a href="/locations/">Locations</a><span>›</span>
        ${esc(stateName)}
      </nav>
      <h1>Coffee Shops in ${esc(stateName)}</h1>
      <div class="hero-meta">
        <span>☕ ${totalShops.toLocaleString()} coffee shops</span>
        <span>📍 ${totalCities} cities</span>
      </div>
      <div class="search-box">
        <input type="text" id="citySearch" placeholder="Search cities in ${esc(stateName)}..." autocomplete="off">
        <button type="button">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          Search
        </button>
      </div>
    </div>
  </section>

  <main class="main">
    <div class="section-header">
      <h2 class="section-title">Browse by City</h2>
      <span class="section-count">${totalCities} cities</span>
    </div>
    <div class="cities-grid" id="citiesGrid">
      ${cities.map(city => `
        <a href="/locations/${stateCode}/${city.slug}/" class="city-card" data-name="${esc(city.name.toLowerCase())}">
          <span class="city-name">${esc(city.name)}</span>
          <span class="city-count">${city.count} shops</span>
        </a>
      `).join('')}
    </div>
  </main>

  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
  
  <script>
    document.getElementById('citySearch').addEventListener('input', function(e) {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.city-card').forEach(card => {
        const name = card.getAttribute('data-name');
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
    body: `<h1>No coffee shops found</h1><p><a href="/locations/">Browse all locations</a></p>`
  };
}

function error500() {
  return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<h1>Server error</h1>' };
}