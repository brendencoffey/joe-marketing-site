/**
 * Locations Index - All States
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

const STATE_HEROES = {
  'ca': 'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800&q=80',
  'ny': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80',
  'wa': 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=800&q=80',
  'tx': 'https://images.unsplash.com/photo-1531218150217-54595bc2b934?w=800&q=80',
  'fl': 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=800&q=80',
  'il': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
  'co': 'https://images.unsplash.com/photo-1546156929-a4c0ac411f47?w=800&q=80',
  'or': 'https://images.unsplash.com/photo-1531747056779-a4953a95e27a?w=800&q=80',
  'az': 'https://images.unsplash.com/photo-1558645836-e44122a743ee?w=800&q=80',
  'ga': 'https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=800&q=80',
  'ma': 'https://images.unsplash.com/photo-1573053986170-8f9e9c5c9a9e?w=800&q=80',
  'pa': 'https://images.unsplash.com/photo-1569761316261-9a8696fa2ca3?w=800&q=80',
  'oh': 'https://images.unsplash.com/photo-1567604130959-3c285e6b4b8e?w=800&q=80',
  'mi': 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80',
  'nc': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&q=80',
  'tn': 'https://images.unsplash.com/photo-1545419913-775e3e55b7db?w=800&q=80',
};

exports.handler = async (event) => {
  try {
    // Use raw SQL for efficient GROUP BY
    const { data, error } = await supabase.rpc('get_state_shop_counts');
    
    let states = [];
    let totalShops = 0;
    
    if (error || !data) {
      // Fallback: query state_code only with limit
      const { data: shops } = await supabase
        .from('shops')
        .select('state_code')
        .eq('is_active', true)
        .not('state_code', 'is', null)
        .limit(60000);
      
      const stateMap = {};
      for (const shop of shops || []) {
        const code = shop.state_code?.toLowerCase();
        if (!code || code.length !== 2 || !STATE_NAMES[code]) continue;
        stateMap[code] = (stateMap[code] || 0) + 1;
      }
      
      states = Object.entries(stateMap)
        .map(([code, count]) => ({ code, name: STATE_NAMES[code], count, photo: STATE_HEROES[code] }))
        .sort((a, b) => b.count - a.count);
      totalShops = Object.values(stateMap).reduce((a, b) => a + b, 0);
    } else {
      states = data
        .filter(d => d.state_code && STATE_NAMES[d.state_code.toLowerCase()])
        .map(d => ({
          code: d.state_code.toLowerCase(),
          name: STATE_NAMES[d.state_code.toLowerCase()],
          count: parseInt(d.count),
          photo: STATE_HEROES[d.state_code.toLowerCase()]
        }))
        .sort((a, b) => b.count - a.count);
      totalShops = states.reduce((a, b) => a + b.count, 0);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
      body: renderPage(states, totalShops)
    };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: 'Server error: ' + err.message };
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
  <meta property="og:title" content="Find Coffee Shops Near You | joe coffee">
  <meta property="og:description" content="Discover ${totalShops.toLocaleString()} independent coffee shops across the US.">
  <meta property="og:image" content="https://joe.coffee/img/joe-og.png">
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--black:#1c1917;--white:#fff;--gray-50:#fafaf9;--gray-100:#f5f5f4;--gray-200:#e7e5e3;--gray-500:#78716c;--gray-600:#57534e;--amber-500:#f59e0b}
    body{font-family:'Inter',-apple-system,sans-serif;background:var(--gray-50);color:var(--black);line-height:1.6}
    a{color:inherit;text-decoration:none}
    .header{background:var(--white);border-bottom:1px solid var(--gray-200);padding:1rem 1.5rem;position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
    .logo{font-size:1.5rem;font-weight:700}
    .nav{display:flex;gap:1.5rem;align-items:center}
    .nav a{font-weight:500;color:var(--gray-600)}.nav a:hover{color:var(--black)}
    .btn{padding:.75rem 1.5rem;border-radius:8px;font-weight:600}
    .btn-primary{background:var(--black);color:var(--white) !important}
    .hero{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:4rem 1.5rem;text-align:center;color:var(--white)}
    .hero h1{font-size:2.5rem;font-weight:700;margin-bottom:1rem}
    .hero p{font-size:1.2rem;opacity:0.9;max-width:600px;margin:0 auto 2rem}
    .search-box{max-width:500px;margin:0 auto;display:flex;gap:0.5rem}
    .search-input{flex:1;padding:1rem;border:none;border-radius:8px;font-size:1rem}
    .search-btn{padding:1rem 2rem;background:var(--amber-500);border:none;border-radius:8px;font-weight:600;cursor:pointer}
    .main{max-width:1280px;margin:0 auto;padding:2rem 1.5rem}
    .stats{display:flex;justify-content:center;gap:3rem;margin-bottom:2rem}
    .stat-value{font-size:2rem;font-weight:700}
    .stat-label{color:var(--gray-500);font-size:0.9rem}
    .section-title{font-size:1.5rem;font-weight:700;margin-bottom:1.5rem}
    .states-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
    .state-card{background:var(--white);border-radius:12px;overflow:hidden;border:1px solid var(--gray-200);transition:all 0.2s}
    .state-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .state-card-image{height:100px;background:var(--gray-100)}
    .state-card-image img{width:100%;height:100%;object-fit:cover}
    .state-card-placeholder{height:100px;background:linear-gradient(135deg,var(--gray-100),var(--gray-200));display:flex;align-items:center;justify-content:center;font-size:1.5rem}
    .state-card-body{padding:0.75rem 1rem}
    .state-card-name{font-weight:600}
    .state-card-count{color:var(--gray-500);font-size:0.85rem}
    @media(max-width:768px){.hero h1{font-size:1.75rem}.states-grid{grid-template-columns:repeat(2,1fr)}}
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
    <p>Discover ${totalShops.toLocaleString()} independent coffee shops across the US</p>
    <form class="search-box" action="/locations/search/" method="get">
      <input type="text" name="q" class="search-input" placeholder="Search city, zip, or shop name...">
      <button type="submit" class="search-btn">Search</button>
    </form>
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
          ${s.photo ? `<div class="state-card-image"><img src="${s.photo}" alt="${s.name}" loading="lazy"></div>` : `<div class="state-card-placeholder">☕</div>`}
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
</body>
</html>`;
}
