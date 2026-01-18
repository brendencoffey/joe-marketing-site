/**
 * State Page - List of cities in a state with SEO content
 * URL: /locations/{state}/
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Curated hero images for states (Unsplash)
const STATE_HEROES = {
  'al': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'ak': 'https://images.unsplash.com/photo-1531176175280-33e89ea45049?w=1600&q=80',
  'az': 'https://images.unsplash.com/photo-1558645836-e44122a743ee?w=1600&q=80',
  'ar': 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=1600&q=80',
  'ca': 'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=1600&q=80',
  'co': 'https://images.unsplash.com/photo-1546156929-a4c0ac411f47?w=1600&q=80',
  'ct': 'https://images.unsplash.com/photo-1562696482-57907a67b0c8?w=1600&q=80',
  'de': 'https://images.unsplash.com/photo-1625438914698-c5674bc7f9d0?w=1600&q=80',
  'fl': 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=1600&q=80',
  'ga': 'https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=1600&q=80',
  'hi': 'https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=1600&q=80',
  'id': 'https://images.unsplash.com/photo-1543900694-133f37abadc5?w=1600&q=80',
  'il': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&q=80',
  'in': 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?w=1600&q=80',
  'ia': 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=1600&q=80',
  'ks': 'https://images.unsplash.com/photo-1508193638397-1c4234db14d9?w=1600&q=80',
  'ky': 'https://images.unsplash.com/photo-1581373449483-37449f962b6c?w=1600&q=80',
  'la': 'https://images.unsplash.com/photo-1568402102990-bc541580b59f?w=1600&q=80',
  'me': 'https://images.unsplash.com/photo-1534670007418-fbb7f6cf32c3?w=1600&q=80',
  'md': 'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=1600&q=80',
  'ma': 'https://images.unsplash.com/photo-1573053986170-8f9e9c5c9a9e?w=1600&q=80',
  'mi': 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1600&q=80',
  'mn': 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1600&q=80',
  'ms': 'https://images.unsplash.com/photo-1565214975484-3cfa9e56f914?w=1600&q=80',
  'mo': 'https://images.unsplash.com/photo-1572646662929-99971a1d5b3d?w=1600&q=80',
  'mt': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80',
  'ne': 'https://images.unsplash.com/photo-1508193638397-1c4234db14d9?w=1600&q=80',
  'nv': 'https://images.unsplash.com/photo-1581351721010-8cf859cb14a4?w=1600&q=80',
  'nh': 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=1600&q=80',
  'nj': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'nm': 'https://images.unsplash.com/photo-1518516278006-4aca8d5b4d3d?w=1600&q=80',
  'ny': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1600&q=80',
  'nc': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=1600&q=80',
  'nd': 'https://images.unsplash.com/photo-1508193638397-1c4234db14d9?w=1600&q=80',
  'oh': 'https://images.unsplash.com/photo-1567604130959-3c285e6b4b8e?w=1600&q=80',
  'ok': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'or': 'https://images.unsplash.com/photo-1531747056779-a4953a95e27a?w=1600&q=80',
  'pa': 'https://images.unsplash.com/photo-1569761316261-9a8696fa2ca3?w=1600&q=80',
  'ri': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'sc': 'https://images.unsplash.com/photo-1570629936525-0c8f5d5f9e62?w=1600&q=80',
  'sd': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'tn': 'https://images.unsplash.com/photo-1545419913-775e3e55b7db?w=1600&q=80',
  'tx': 'https://images.unsplash.com/photo-1531218150217-54595bc2b934?w=1600&q=80',
  'ut': 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=80',
  'vt': 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=1600&q=80',
  'va': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'wa': 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=1600&q=80',
  'wv': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'wi': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'wy': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80',
  'dc': 'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1600&q=80',
};

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
    const path = event.path || event.rawUrl || "";
    const parts = path.replace("/.netlify/functions/state-page", "").replace("/locations/", "").split("/").filter(Boolean);
    const stateCode = (parts[0] || event.queryStringParameters?.state || '').toLowerCase();
    
    if (!stateCode || !STATE_NAMES[stateCode]) {
      return redirect('/locations/');
    }

    const stateName = STATE_NAMES[stateCode];

    // Get cities with shop counts and photos for city cards
    const { data: shops, error } = await supabase
      .from('shops')
      .select('city, city_slug, photos')
      .eq('is_active', true)
      .eq('state_code', stateCode);

    if (error) throw error;

    // Aggregate cities with counts and grab a photo for each city card
    const cityMap = {};
    for (const shop of shops) {
      if (!shop.city || !shop.city_slug) continue;
      if (!cityMap[shop.city_slug]) {
        cityMap[shop.city_slug] = { 
          name: shop.city, 
          slug: shop.city_slug, 
          count: 0,
          photo: null
        };
      }
      cityMap[shop.city_slug].count++;
      // Grab first available photo for city card
      if (!cityMap[shop.city_slug].photo && shop.photos?.length > 0) {
        cityMap[shop.city_slug].photo = shop.photos[0];
      }
    }

    const cities = Object.values(cityMap).sort((a, b) => b.count - a.count);
    const totalShops = shops.length;

    // Get representative state hero image
    const heroImage = STATE_HEROES[stateCode] || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600&q=80';

    // Get SEO description from seo_content table
    let stateDescription = null;
    const { data: seoContent, error: seoError } = await supabase
      .from('seo_content')
      .select('description')
      .eq('type', 'state')
      .eq('state_code', stateCode)
      .maybeSingle();
    
    if (seoError) {
      console.error('SEO query error:', seoError);
    } else if (seoContent?.description) {
      stateDescription = seoContent.description;
    }

    const html = renderStatePage(stateCode, stateName, cities, totalShops, heroImage, stateDescription);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
      body: html
    };
  } catch (err) {
    console.error('State page error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};

function renderStatePage(stateCode, stateName, cities, totalShops, heroImage, stateDescription) {
  const canonicalUrl = `https://joe.coffee/locations/${stateCode}/`;
  const title = `Coffee Shops in ${stateName} | joe coffee`;
  const metaDesc = stateDescription || `Find ${totalShops.toLocaleString()} independent coffee shops across ${cities.length} cities in ${stateName}. Discover local roasters and cafes near you.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDesc)}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:image" content="${heroImage}">
  <meta property="og:url" content="${canonicalUrl}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(metaDesc)}">
  <meta name="twitter:image" content="${heroImage}">
  
  <!-- BreadcrumbList Schema -->
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://joe.coffee/" },
      { "@type": "ListItem", "position": 2, "name": "Find Coffee", "item": "https://joe.coffee/locations/" },
      { "@type": "ListItem", "position": 3, "name": stateName }
    ]
  })}</script>
  
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
    .logo{display:flex;align-items:center}.logo img{height:40px;width:auto}
    .nav{display:flex;gap:1.5rem;align-items:center}
    .nav a{font-weight:500;color:var(--gray-600)}
    .nav a:hover{color:var(--black)}
    .btn{padding:.75rem 1.5rem;border-radius:8px;font-weight:600;display:inline-block}
    .btn-primary{background:var(--black);color:var(--white) !important}
    
    .hero{position:relative;height:300px;background:var(--gray-800);overflow:hidden}
    .hero-image{width:100%;height:100%;object-fit:cover;opacity:0.7}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.3),rgba(0,0,0,0.6));display:flex;flex-direction:column;justify-content:flex-end;padding:2rem}
    .hero-content{max-width:1280px;margin:0 auto;width:100%;color:var(--white)}
    .hero h1{font-size:2.5rem;font-weight:700;margin-bottom:0.5rem}
    .hero-stats{font-size:1.1rem;opacity:0.9}
    
    .breadcrumb{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;font-size:0.875rem;color:var(--gray-500)}
    .breadcrumb a:hover{color:var(--black)}
    .breadcrumb span{margin:0 0.5rem;color:var(--gray-300)}
    
    .main{max-width:1280px;margin:0 auto;padding:0 1.5rem 3rem}
    
    .description{background:var(--white);border-radius:12px;padding:1.5rem;margin-bottom:2rem;border:1px solid var(--gray-200)}
    .description p{color:var(--gray-600);font-size:1.05rem;line-height:1.7;margin:0}
    
    .section-title{font-size:1.5rem;font-weight:700;margin-bottom:1.5rem}
    
    .cities-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:1.5rem}
    .city-card{background:var(--white);border-radius:12px;overflow:hidden;border:1px solid var(--gray-200);transition:all 0.2s}
    .city-card:hover{border-color:var(--gray-300);box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .city-card-image{height:140px;background:var(--gray-100);position:relative}
    .city-card-image img{width:100%;height:100%;object-fit:cover}
    .city-card-placeholder{height:140px;background:linear-gradient(135deg,var(--gray-100),var(--gray-200));display:flex;align-items:center;justify-content:center;font-size:2rem}
    .city-card-body{padding:1rem}
    .city-card-name{font-weight:600;font-size:1.1rem;margin-bottom:0.25rem}
    .city-card-count{color:var(--gray-500);font-size:0.9rem}
    
    @media(max-width:768px){
      .hero{height:220px}
      .hero h1{font-size:1.75rem}
      .cities-grid{grid-template-columns:repeat(2, 1fr);gap:1rem}
      .city-card-image,.city-card-placeholder{height:100px}
    }
  
    .mobile-menu-btn{display:none;background:none;border:none;cursor:pointer;padding:0.5rem}
    .mobile-menu-btn span{display:block;width:24px;height:2px;background:#1c1917;margin:5px 0}
    .mobile-menu{position:fixed;top:0;right:-100%;width:280px;height:100vh;background:#fff;z-index:1000;padding:2rem;transition:right 0.3s;box-shadow:-4px 0 20px rgba(0,0,0,0.1)}
    .mobile-menu.open{right:0}
    .mobile-menu-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:2rem;cursor:pointer;line-height:1}
    .mobile-menu a{display:block;padding:1rem 0;font-weight:500;color:#1c1917;border-bottom:1px solid #e7e5e3}
    .mobile-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:999}
    .mobile-overlay.open{display:block}
    @media(max-width:768px){.nav{display:none}.mobile-menu-btn{display:block}}
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Coffee Shops</a><a href="/about/">About</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
      <button class="mobile-menu-btn" onclick="document.getElementById('mobileMenu').classList.add('open');document.getElementById('mobileOverlay').classList.add('open')">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <div class="hero">
    <img src="${heroImage}" alt="${esc(stateName)}" class="hero-image">
    <div class="hero-overlay">
      <div class="hero-content">
        <h1>Coffee Shops in ${esc(stateName)}</h1>
        <div class="hero-stats">${totalShops.toLocaleString()} shops across ${cities.length} cities</div>
      </div>
    </div>
  </div>

  <nav class="breadcrumb">
    <a href="/">Home</a>
    <span>›</span>
    <a href="/locations/">Find Coffee</a>
    <span>›</span>
    ${esc(stateName)}
  </nav>

  <main class="main">
    ${stateDescription ? `
    <div class="description">
      <p>${esc(stateDescription)}</p>
    </div>
    ` : ''}

    <h2 class="section-title">Cities in ${esc(stateName)}</h2>
    
    <div class="cities-grid">
      ${cities.map(city => `
        <a href="/locations/${stateCode}/${city.slug}/" class="city-card">
          ${city.photo 
            ? `<div class="city-card-image"><img src="${city.photo}" alt="${esc(city.name)}" loading="lazy"></div>`
            : `<div class="city-card-placeholder">☕</div>`
          }
          <div class="city-card-body">
            <div class="city-card-name">${esc(city.name)}</div>
            <div class="city-card-count">${city.count} coffee shop${city.count !== 1 ? 's' : ''}</div>
          </div>
        </a>
      `).join('')}
    </div>
  </main>

  
  <div id="mobileOverlay" class="mobile-overlay" onclick="document.getElementById('mobileMenu').classList.remove('open');this.classList.remove('open')"></div>
  <div id="mobileMenu" class="mobile-menu">
    <button class="mobile-menu-close" onclick="document.getElementById('mobileMenu').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('open')">&times;</button>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee">Get the App</a>
  </div>
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

function redirect(url) {
  return { statusCode: 301, headers: { Location: url }, body: '' };
}