/**
 * State Page - Server-Side Rendered
 * Lists all cities with coffee shops in a state
 * 
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
      .sort((a, b) => b.count - a.count); // Most shops first

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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#f9fafb;color:#111827;line-height:1.6}
    a{color:inherit;text-decoration:none}
    
    .header{background:#fff;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px}
    .nav{display:flex;align-items:center;gap:2rem}
    .nav a{font-size:.95rem;font-weight:500;color:#374151}
    .nav a:hover{color:#000}
    .btn{padding:.75rem 1.5rem;border-radius:8px;font-weight:600;font-size:.95rem}
    a.btn-primary{background:#000;color:#fff}
    
    .breadcrumb{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;font-size:.875rem;color:#6b7280}
    .breadcrumb a{color:#374151;font-weight:500}.breadcrumb a:hover{color:#000}
    .breadcrumb span{margin:0 .5rem;color:#9ca3af}
    
    .hero{background:linear-gradient(135deg,#065f46,#047857);color:#fff;padding:3rem 1.5rem}
    .hero-inner{max-width:1280px;margin:0 auto}
    .hero h1{font-size:2.5rem;font-weight:700;margin-bottom:.5rem}
    .hero p{font-size:1.1rem;opacity:.9}
    .hero-stats{display:flex;gap:2rem;margin-top:1.5rem}
    .hero-stat{text-align:center}
    .hero-stat-value{font-size:2rem;font-weight:700}
    .hero-stat-label{font-size:.875rem;opacity:.8}
    
    .main{max-width:1280px;margin:0 auto;padding:2rem 1.5rem}
    
    .cities-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
    .city-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.25rem;display:flex;justify-content:space-between;align-items:center;transition:all .2s}
    .city-card:hover{border-color:#10b981;box-shadow:0 4px 12px rgba(0,0,0,.05)}
    .city-name{font-weight:600;color:#111827}
    .city-count{background:#ecfdf5;color:#065f46;padding:.35rem .75rem;border-radius:20px;font-size:.85rem;font-weight:500}
    
    .section-title{font-size:1.25rem;font-weight:600;margin-bottom:1.5rem;color:#111827}
    
    @media(max-width:640px){
      .nav{display:none}
      .hero h1{font-size:1.75rem}
      .hero-stats{flex-direction:column;gap:1rem}
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

  <nav class="breadcrumb">
    <a href="/">Home</a><span>›</span>
    <a href="/locations/">Locations</a><span>›</span>
    ${esc(stateName)}
  </nav>

  <section class="hero">
    <div class="hero-inner">
      <h1>Coffee Shops in ${esc(stateName)}</h1>
      <p>Discover independent coffee shops across ${esc(stateName)}</p>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-value">${totalShops.toLocaleString()}</div>
          <div class="hero-stat-label">Coffee Shops</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value">${totalCities.toLocaleString()}</div>
          <div class="hero-stat-label">Cities</div>
        </div>
      </div>
    </div>
  </section>

  <main class="main">
    <h2 class="section-title">Browse by City</h2>
    <div class="cities-grid">
      ${cities.map(city => `
        <a href="/locations/${stateCode}/${city.slug}/" class="city-card">
          <span class="city-name">${esc(city.name)}</span>
          <span class="city-count">${city.count} shops</span>
        </a>
      `).join('')}
    </div>
  </main>

  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
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