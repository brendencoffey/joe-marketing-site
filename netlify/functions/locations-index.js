/**
 * Locations Index - All States with hero images
 * URL: /locations/
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const STATE_NAMES = {
  'al': 'Alabama', 'ak': 'Alaska', 'az': 'Arizona', 'ar': 'Arkansas', 'ca': 'California',
  'co': 'Colorado', 'ct': 'Connecticut', 'de': 'Delaware', 'fl': 'Florida', 'ga': 'Georgia',
  'hi': 'Hawaii', 'id': 'Idaho', 'il': 'Illinois', 'in': 'Indiana', 'ia': 'Iowa',
  'ks': 'Kansas', 'ky': 'Kentucky', 'la': 'Louisiana', 'me': 'Maine', 'md': 'Maryland',
  'ma': 'Massachusetts', 'mi': 'Michigan', 'mn': 'Minnesota', 'ms': 'Mississippi', 'mo': 'Missouri',
  'mt': 'Montana', 'ne': 'Nebraska', 'nv': 'Nevada', 'nh': 'New Hampshire', 'nj': 'New Jersey',
  'nm': 'New Mexico', 'ny': 'New York', 'nc': 'North Carolina', 'nd': 'North Dakota', 'oh': 'Ohio',
  'ok': 'Oklahoma', 'or': 'Oregon', 'pa': 'Pennsylvania', 'ri': 'Rhode Island', 'sc': 'South Carolina',
  'sd': 'South Dakota', 'tn': 'Tennessee', 'tx': 'Texas', 'ut': 'Utah', 'vt': 'Vermont',
  'va': 'Virginia', 'wa': 'Washington', 'wv': 'West Virginia', 'wi': 'Wisconsin', 'wy': 'Wyoming',
  'dc': 'District of Columbia'
};

exports.handler = async (event) => {
  try {
    // Get all shops grouped by state with photos
    const { data: shops, error } = await supabase
      .from('shops')
      .select('state_code')
      .eq('is_active', true)
      .not('state_code', 'is', null);

    if (error) throw error;

    // Aggregate states with counts and photos
    const stateMap = {};
    for (const shop of shops) {
      const code = shop.state_code?.toLowerCase();
      if (!code || code.length !== 2 || !STATE_NAMES[code]) continue;
      
      if (!stateMap[code]) {
        stateMap[code] = { 
          code, 
          name: STATE_NAMES[code], 
          count: 0,
          photo: null
        };
      }
      stateMap[code].count++;
      
      // Grab first available photo
      if (!stateMap[code].photo && shop.photos?.length > 0) {
        stateMap[code].photo = shop.photos[0];
      }
    }

    const states = Object.values(stateMap).sort((a, b) => b.count - a.count);
    const totalShops = shops.length;

    const html = renderLocationsIndex(states, totalShops);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
      body: html
    };
  } catch (err) {
    console.error('Locations index error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};

function renderLocationsIndex(states, totalShops) {
  const canonicalUrl = 'https://joe.coffee/locations/';
  const title = 'Find Coffee Shops Near You | joe coffee';
  const description = `Discover ${totalShops.toLocaleString()} independent coffee shops across ${states.length} states. Find local roasters, cafes, and espresso bars near you.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="https://joe.coffee/images/og-locations.jpg">
  <meta property="og:url" content="${canonicalUrl}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="https://joe.coffee/images/og-locations.jpg">
  
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--black:#1c1917;--white:#fff;--gray-50:#fafaf9;--gray-100:#f5f5f4;--gray-200:#e7e5e3;--gray-300:#d6d3d1;--gray-400:#a8a29e;--gray-500:#78716c;--gray-600:#57534e;--gray-800:#292524;--amber-500:#f59e0b}
    body{font-family:'Inter',-apple-system,sans-serif;background:var(--gray-50);color:var(--black);line-height:1.6}
    a{color:inherit;text-decoration:none}
    
    .header{background:var(--white);border-bottom:1px solid var(--gray-200);padding:1rem 1.5rem;position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
    .logo{font-size:1.5rem;font-weight:700}
    .nav{display:flex;gap:1.5rem;align-items:center}
    .nav a{font-weight:500;color:var(--gray-600)}
    .nav a:hover{color:var(--black)}
    .btn{padding:.75rem 1.5rem;border-radius:8px;font-weight:600;display:inline-block}
    .btn-primary{background:var(--black);color:var(--white)}
    
    .hero{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:4rem 1.5rem;text-align:center;color:var(--white)}
    .hero h1{font-size:2.5rem;font-weight:700;margin-bottom:1rem}
    .hero p{font-size:1.2rem;opacity:0.9;max-width:600px;margin:0 auto 2rem}
    
    .search-container{max-width:600px;margin:0 auto}
    .search-box{display:flex;gap:0.5rem}
    .search-input{flex:1;padding:1rem 1.25rem;border:none;border-radius:8px;font-size:1rem;outline:none}
    .search-input:focus{box-shadow:0 0 0 3px rgba(245,158,11,0.3)}
    .search-btn{padding:1rem 2rem;background:var(--amber-500);color:var(--black);border:none;border-radius:8px;font-weight:600;cursor:pointer}
    .search-btn:hover{background:#e09000}
    
    .main{max-width:1280px;margin:0 auto;padding:2rem 1.5rem 3rem}
    
    .stats{display:flex;justify-content:center;gap:3rem;margin-bottom:2rem;flex-wrap:wrap}
    .stat{text-align:center}
    .stat-value{font-size:2rem;font-weight:700;color:var(--black)}
    .stat-label{color:var(--gray-500);font-size:0.9rem}
    
    .section-title{font-size:1.5rem;font-weight:700;margin-bottom:1.5rem}
    
    .states-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:1rem}
    .state-card{background:var(--white);border-radius:12px;overflow:hidden;border:1px solid var(--gray-200);transition:all 0.2s}
    .state-card:hover{border-color:var(--gray-300);box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .state-card-image{height:100px;background:var(--gray-100);position:relative}
    .state-card-image img{width:100%;height:100%;object-fit:cover}
    .state-card-placeholder{height:100px;background:linear-gradient(135deg,var(--gray-100),var(--gray-200));display:flex;align-items:center;justify-content:center;font-size:1.5rem}
    .state-card-body{padding:0.75rem 1rem}
    .state-card-name{font-weight:600;font-size:0.95rem}
    .state-card-count{color:var(--gray-500);font-size:0.8rem}
    
    @media(max-width:768px){
      .hero h1{font-size:1.75rem}
      .hero p{font-size:1rem}
      .search-box{flex-direction:column}
      .stats{gap:1.5rem}
      .states-grid{grid-template-columns:repeat(2, 1fr)}
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">joe</a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/marketplace/">Shop</a>
        <a href="/for-coffee-shops/">For Business</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
    </div>
  </header>

  <div class="hero">
    <h1>Find Coffee Shops Near You</h1>
    <p>Discover ${totalShops.toLocaleString()} independent coffee shops across the United States</p>
    <div class="search-container">
      <form class="search-box" action="/locations/search/" method="get">
        <input type="text" name="q" class="search-input" placeholder="Search by city, zip code, or shop name..." autocomplete="off">
        <button type="submit" class="search-btn">Search</button>
      </form>
    </div>
  </div>

  <main class="main">
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${totalShops.toLocaleString()}</div>
        <div class="stat-label">Coffee Shops</div>
      </div>
      <div class="stat">
        <div class="stat-value">${states.length}</div>
        <div class="stat-label">States</div>
      </div>
    </div>

    <h2 class="section-title">Browse by State</h2>
    
    <div class="states-grid">
      ${states.map(state => `
        <a href="/locations/${state.code}/" class="state-card">
          ${state.photo 
            ? `<div class="state-card-image"><img src="${state.photo}" alt="${esc(state.name)}" loading="lazy"></div>`
            : `<div class="state-card-placeholder">☕</div>`
          }
          <div class="state-card-body">
            <div class="state-card-name">${esc(state.name)}</div>
            <div class="state-card-count">${state.count.toLocaleString()} shops</div>
          </div>
        </a>
      `).join('')}
    </div>
  </main>

  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
  <script src="/includes/tracking.js"></script>
</body>
</html>`;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}