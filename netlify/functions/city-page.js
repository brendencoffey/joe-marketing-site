/**
 * City Page - Coffee Shops in a City
 * URL: /locations/:state/:city/
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const path = event.path || "";
    const parts = path.replace("/.netlify/functions/city-page", "").replace("/locations/", "").split("/").filter(Boolean);
    const state = parts[0] || event.queryStringParameters?.state;
    const city = parts[1] || event.queryStringParameters?.city;
    
    if (!state || !city) {
      return redirect('/locations/');
    }

    const stateCode = state.toLowerCase();
    const citySlug = city.toLowerCase();
    const stateName = getStateName(stateCode);

    // Get all shops in this city
    const { data: shops, error } = await supabase
      .from('shops')
      .select('*')
      .ilike('state_code', stateCode)
      .ilike('city_slug', citySlug)
      .order('is_joe_partner', { ascending: false, nullsFirst: false })
      .order('combined_rating', { ascending: false, nullsFirst: false })
      .order('google_rating', { ascending: false, nullsFirst: false });

    if (error) throw error;

    if (!shops || shops.length === 0) {
      return notFound(citySlug, stateCode);
    }

    const cityName = shops[0].city || citySlug;
    const totalShops = shops.length;
    const partnerCount = shops.filter(s => s.is_joe_partner || s.partner_id).length;

    // Get photos for hero
    const heroPhotos = [];
    shops.forEach(shop => {
      if (shop.photos && shop.photos.length > 0 && heroPhotos.length < 8) {
        heroPhotos.push(shop.photos[0]);
      }
    });

    const html = renderCityPage(stateCode, stateName, citySlug, cityName, shops, totalShops, partnerCount, heroPhotos);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      },
      body: html
    };
  } catch (err) {
    console.error('City page error:', err);
    return error500();
  }
};

function renderCityPage(stateCode, stateName, citySlug, cityName, shops, totalShops, partnerCount, heroPhotos) {
  const canonicalUrl = `https://joe.coffee/locations/${stateCode}/${citySlug}/`;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shops in ${esc(cityName)}, ${esc(stateName)} | joe coffee</title>
  <meta name="description" content="Find the best independent coffee shops in ${esc(cityName)}, ${esc(stateName)}. Browse ${totalShops} local coffee shops with ratings, hours, and directions.">
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
    
    .hero{position:relative;padding:4rem 1.5rem;overflow:hidden;min-height:380px;display:flex;align-items:center}
    .hero-bg{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:4px;opacity:.4}
    .hero-bg img{width:100%;height:100%;object-fit:cover}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(28,25,23,.7),rgba(28,25,23,.6))}
    .hero-inner{position:relative;z-index:1;max-width:800px;margin:0 auto;text-align:center}
    .breadcrumb{font-size:.875rem;color:rgba(255,255,255,.6);margin-bottom:1.5rem}
    .breadcrumb a{color:rgba(255,255,255,.8);font-weight:500}.breadcrumb a:hover{color:#fff}
    .breadcrumb span{margin:0 .5rem;color:rgba(255,255,255,.4)}
    .hero h1{font-size:2.75rem;font-weight:800;color:#fff;margin-bottom:.75rem}
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
    
    .shops-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem}
    .shop-card{background:#fff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;transition:all .2s}
    .shop-card:hover{border-color:#16a34a;box-shadow:0 8px 24px rgba(0,0,0,.08)}
    .shop-image{height:160px;background:#f5f5f4;position:relative}
    .shop-image img{width:100%;height:100%;object-fit:cover}
    .shop-image-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;background:linear-gradient(135deg,#f5f5f4,#e7e5e4)}
    .partner-badge{position:absolute;top:.75rem;left:.75rem;background:#16a34a;color:#fff;padding:.35rem .75rem;border-radius:100px;font-size:.75rem;font-weight:600}
    .shop-content{padding:1.25rem}
    .shop-name{font-weight:700;font-size:1.1rem;color:#1c1917;margin-bottom:.25rem}
    .shop-address{color:#78716c;font-size:.9rem;margin-bottom:.75rem}
    .shop-meta{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
    .shop-rating{display:flex;align-items:center;gap:.35rem;color:#f59e0b;font-weight:600;font-size:.9rem}
    .shop-rating svg{width:16px;height:16px;fill:#f59e0b}
    .shop-hours{font-size:.85rem;padding:.35rem .75rem;border-radius:100px}
    .shop-hours.open{background:#dcfce7;color:#16a34a}
    .shop-hours.closed{background:#f5f5f4;color:#78716c}
    .shop-price{color:#78716c;font-size:.9rem}
    
    .no-results{text-align:center;padding:4rem 2rem;color:#78716c}
    .no-results h3{color:#1c1917;margin-bottom:.5rem}
    
    @media(max-width:768px){
      .nav{display:none}
      .hero{padding:3rem 1.5rem;min-height:320px}
      .hero h1{font-size:2rem}
      .hero-meta{flex-wrap:wrap;gap:1rem}
      .hero-bg{grid-template-columns:repeat(2,1fr)}
      .search-box{flex-direction:column;border-radius:12px}
      .search-box button{justify-content:center}
      .shops-grid{grid-template-columns:1fr}
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
        <a href="/locations/${stateCode}/">${esc(stateName)}</a><span>›</span>
        ${esc(cityName)}
      </nav>
      <h1>Coffee in ${esc(cityName)}</h1>
      <div class="hero-meta">
        <span>☕ ${totalShops} coffee shops</span>
        ${partnerCount > 0 ? `<span>📱 ${partnerCount} with mobile ordering</span>` : ''}
      </div>
      <div class="search-box">
        <input type="text" id="shopSearch" placeholder="Search coffee shops..." autocomplete="off">
        <button type="button">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          Search
        </button>
      </div>
    </div>
  </section>

  <main class="main">
    <div class="section-header">
      <h2 class="section-title">All Coffee Shops</h2>
      <span class="section-count">${totalShops} shops</span>
    </div>
    <div class="shops-grid" id="shopsGrid">
      ${shops.map(shop => {
        const isPartner = shop.is_joe_partner || shop.partner_id;
        const rating = shop.combined_rating || shop.google_rating;
        const isOpen = checkIfOpen(shop.hours);
        const photo = shop.photos && shop.photos.length > 0 ? shop.photos[0] : null;
        
        return `
        <a href="/locations/${stateCode}/${citySlug}/${shop.slug}/" class="shop-card" data-name="${esc((shop.name || '').toLowerCase())}">
          <div class="shop-image">
            ${photo ? `<img src="${esc(photo)}" alt="${esc(shop.name)}">` : '<div class="shop-image-placeholder">☕</div>'}
            ${isPartner ? '<span class="partner-badge">☕ joe Partner</span>' : ''}
          </div>
          <div class="shop-content">
            <h3 class="shop-name">${esc(shop.name)}</h3>
            <p class="shop-address">${esc(shop.address || '')}</p>
            <div class="shop-meta">
              ${rating ? `
              <span class="shop-rating">
                <svg viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                ${rating}
              </span>
              ` : ''}
              <span class="shop-hours ${isOpen ? 'open' : 'closed'}">${isOpen ? 'Open' : 'Closed'}</span>
              ${shop.price_range ? `<span class="shop-price">${esc(shop.price_range)}</span>` : ''}
            </div>
          </div>
        </a>
        `;
      }).join('')}
    </div>
    
    <div class="no-results" id="noResults" style="display:none">
      <h3>No shops found</h3>
      <p>Try a different search term</p>
    </div>
  </main>

  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
  
  <script>
    document.getElementById('shopSearch').addEventListener('input', function(e) {
      const query = e.target.value.toLowerCase();
      const cards = document.querySelectorAll('.shop-card');
      let visible = 0;
      
      cards.forEach(card => {
        const name = card.getAttribute('data-name');
        const show = name.includes(query);
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      
      document.getElementById('noResults').style.display = visible === 0 ? '' : 'none';
    });
  </script>
</body>
</html>`;
}

function checkIfOpen(hours) {
  if (!hours) return false;
  try {
    const h = typeof hours === 'string' ? JSON.parse(hours) : hours;
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    const t = h[today];
    return t && t.toLowerCase() !== 'closed';
  } catch {
    return false;
  }
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

function notFound(city, state) {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/html' },
    body: `<h1>No coffee shops found</h1><p><a href="/locations/${state}/">Back to ${state.toUpperCase()}</a></p>`
  };
}

function error500() {
  return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<h1>Server error</h1>' };
}