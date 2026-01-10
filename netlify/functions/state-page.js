/**
 * State Page - List of cities in a state with SEO content
 * URL: /locations/{state}/
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
    const path = event.path || event.rawUrl || "";
    const parts = path.replace("/.netlify/functions/state-page", "").replace("/locations/", "").split("/").filter(Boolean);
    const stateCode = (parts[0] || event.queryStringParameters?.state || '').toLowerCase();
    
    if (!stateCode || !STATE_NAMES[stateCode]) {
      return redirect('/locations/');
    }

    const stateName = STATE_NAMES[stateCode];

    // Get cities with shop counts
    const { data: shops, error } = await supabase
      .from('shops')
      .select('city, city_slug, photos')
      .eq('is_active', true)
      .ilike('state_code', stateCode);

    if (error) throw error;

    // Aggregate cities with counts and grab a photo
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
      // Grab first available photo for this city
      if (!cityMap[shop.city_slug].photo && shop.photos?.length > 0) {
        cityMap[shop.city_slug].photo = shop.photos[0];
      }
    }

    const cities = Object.values(cityMap).sort((a, b) => b.count - a.count);
    const totalShops = shops.length;

    // Get hero image from top city's shops
    let heroImage = null;
    const { data: heroShops } = await supabase
      .from('shops')
      .select('photos')
      .eq('is_active', true)
      .ilike('state_code', stateCode)
      .not('photos', 'is', null)
      .limit(10);
    
    for (const s of heroShops || []) {
      if (s.photos?.length > 0) {
        heroImage = s.photos[0];
        break;
      }
    }

    // Get SEO description from seo_content table
    let stateDescription = null;
    const { data: seoContent } = await supabase
      .from('seo_content')
      .select('description')
      .eq('type', 'state')
      .eq('state_code', stateCode)
      .single();
    
    if (seoContent?.description) {
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
  const description = stateDescription || `Find ${totalShops.toLocaleString()} independent coffee shops across ${cities.length} cities in ${stateName}. Discover local roasters and cafes near you.`;
  const ogImage = heroImage || 'https://joe.coffee/images/og-locations.jpg';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:url" content="${canonicalUrl}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${ogImage}">
  
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
  
  <link rel="icon" type="image/png" href="/images/favicon.png">
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
    .description p{color:var(--gray-600);font-size:1.05rem;line-height:1.7}
    
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
    ${heroImage ? `<img src="${heroImage}" alt="Coffee in ${esc(stateName)}" class="hero-image">` : ''}
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