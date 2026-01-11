/**
 * Locations Index - Uses RPC for efficient state counts
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
  'ma': { name: 'Massachusetts', photo: 'https://images.unsplash.com/photo-1501979376754-1d09c48877d6?w=800&q=80' },
  'ga': { name: 'Georgia', photo: 'https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=800&q=80' },
  'mi': { name: 'Michigan', photo: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80' },
  'az': { name: 'Arizona', photo: 'https://images.unsplash.com/photo-1558645836-e44122a743ee?w=800&q=80' },
  'nj': { name: 'New Jersey', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
  'tn': { name: 'Tennessee', photo: 'https://images.unsplash.com/photo-1545419913-775e3e55b7db?w=800&q=80' },
  'or': { name: 'Oregon', photo: 'https://images.unsplash.com/photo-1531747056779-a4953a95e27a?w=800&q=80' },
  'mn': { name: 'Minnesota', photo: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800&q=80' },
  'mo': { name: 'Missouri', photo: 'https://images.unsplash.com/photo-1572646662929-99971a1d5b3d?w=800&q=80' },
  'va': { name: 'Virginia', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
  'wi': { name: 'Wisconsin', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
  'md': { name: 'Maryland', photo: 'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800&q=80' },
  'in': { name: 'Indiana', photo: 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?w=800&q=80' },
  'sc': { name: 'South Carolina', photo: 'https://images.unsplash.com/photo-1570629936525-0c8f5d5f9e62?w=800&q=80' },
  'la': { name: 'Louisiana', photo: 'https://images.unsplash.com/photo-1568402102990-bc541580b59f?w=800&q=80' },
  'nv': { name: 'Nevada', photo: 'https://images.unsplash.com/photo-1581351721010-8cf859cb14a4?w=800&q=80' },
  'ok': { name: 'Oklahoma', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
  'ky': { name: 'Kentucky', photo: 'https://images.unsplash.com/photo-1581373449483-37449f962b6c?w=800&q=80' },
  'ct': { name: 'Connecticut', photo: 'https://images.unsplash.com/photo-1562696482-57907a67b0c8?w=800&q=80' },
  'ut': { name: 'Utah', photo: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80' },
  'nm': { name: 'New Mexico', photo: 'https://images.unsplash.com/photo-1518516278006-4aca8d5b4d3d?w=800&q=80' },
  'ne': { name: 'Nebraska', photo: 'https://images.unsplash.com/photo-1508193638397-1c4234db14d9?w=800&q=80' },
  'ia': { name: 'Iowa', photo: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=800&q=80' },
  'ks': { name: 'Kansas', photo: 'https://images.unsplash.com/photo-1508193638397-1c4234db14d9?w=800&q=80' },
  'al': { name: 'Alabama', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
  'ri': { name: 'Rhode Island', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
  'hi': { name: 'Hawaii', photo: 'https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=800&q=80' },
  'ar': { name: 'Arkansas', photo: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=800&q=80' },
  'dc': { name: 'District of Columbia', photo: 'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=800&q=80' },
  'id': { name: 'Idaho', photo: 'https://images.unsplash.com/photo-1543900694-133f37abadc5?w=800&q=80' },
  'nh': { name: 'New Hampshire', photo: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=80' },
  'me': { name: 'Maine', photo: 'https://images.unsplash.com/photo-1534670007418-fbb7f6cf32c3?w=800&q=80' },
  'vt': { name: 'Vermont', photo: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=80' },
  'ak': { name: 'Alaska', photo: 'https://images.unsplash.com/photo-1531176175280-33e89ea45049?w=800&q=80' },
  'de': { name: 'Delaware', photo: 'https://images.unsplash.com/photo-1625438914698-c5674bc7f9d0?w=800&q=80' },
  'mt': { name: 'Montana', photo: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' },
  'sd': { name: 'South Dakota', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
  'ms': { name: 'Mississippi', photo: 'https://images.unsplash.com/photo-1565214975484-3cfa9e56f914?w=800&q=80' },
  'nd': { name: 'North Dakota', photo: 'https://images.unsplash.com/photo-1508193638397-1c4234db14d9?w=800&q=80' },
  'wv': { name: 'West Virginia', photo: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
  'wy': { name: 'Wyoming', photo: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80' },
};

exports.handler = async (event) => {
  try {
    // Single efficient RPC call - returns ~51 rows
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',-apple-system,sans-serif;background:#fafaf9;color:#1c1917;line-height:1.6}
    a{color:inherit;text-decoration:none}
    .header{background:#fff;border-bottom:1px solid #e7e5e3;padding:1rem 1.5rem;position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
    .logo{display:flex;align-items:center}.logo img{height:40px;width:auto}
    .nav{display:flex;gap:1.5rem;align-items:center}
    .nav a{font-weight:500;color:#57534e}.nav a:hover{color:#1c1917}
    .btn{padding:.75rem 1.5rem;border-radius:8px;font-weight:600}
    .btn-primary{background:#1c1917;color:#fff !important}
    .hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#1a1a2e,#16213e);padding:4rem 1.5rem;text-align:center;color:#fff}
    .hero-collage{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);opacity:0.15}.hero-collage img{width:100%;height:100%;object-fit:cover}.hero h1{position:relative;font-size:2.5rem;font-weight:700;margin-bottom:1rem}
    .hero p{position:relative;font-size:1.2rem;opacity:0.9;max-width:600px;margin:0 auto 2rem}
    .search-box{position:relative;max-width:500px;margin:0 auto;display:flex;gap:0.5rem}
    .search-input{flex:1;padding:1rem;border:none;border-radius:8px;font-size:1rem}
    .search-btn{padding:1rem 2rem;background:#1c1917;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
    .main{max-width:1280px;margin:0 auto;padding:2rem 1.5rem}
    .stats{display:flex;justify-content:center;gap:3rem;margin-bottom:2rem}
    .stat-value{font-size:2rem;font-weight:700}
    .stat-label{color:#78716c;font-size:0.9rem}
    .section-title{font-size:1.5rem;font-weight:700;margin-bottom:1.5rem}
    .states-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
    .state-card{background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e3;transition:all 0.2s}
    .state-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .state-card-image{height:100px;background:#f5f5f4}
    .state-card-image img{width:100%;height:100%;object-fit:cover}
    .state-card-body{padding:0.75rem 1rem}
    .state-card-name{font-weight:600}
    .state-card-count{color:#78716c;font-size:0.85rem}
    @media(max-width:768px){.hero-collage{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);opacity:0.15}.hero-collage img{width:100%;height:100%;object-fit:cover}.hero h1{position:relative;font-size:1.75rem}.search-box{position:relative;flex-direction:column}.states-grid{grid-template-columns:repeat(2,1fr)}}
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/marketplace/">Shop</a>
        <a href="/for-coffee-shops/">For Coffee Shops</a><a href="/about/">About</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
    </div>
  </header>
  <div class="hero"><div class="hero-collage"><img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop" alt=""><img src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=400&fit=crop" alt=""><img src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop" alt=""><img src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&h=400&fit=crop" alt=""><img src="https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&h=400&fit=crop" alt=""><img src="https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=400&h=400&fit=crop" alt=""></div>
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
          <div class="state-card-image"><img src="${s.photo}" alt="${s.name}" loading="lazy"></div>
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
