/**
 * City Page - List of coffee shops in a city with SEO content
 * URL: /locations/{state}/{city}/
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
    const parts = path.replace("/.netlify/functions/city-page", "").replace("/locations/", "").split("/").filter(Boolean);
    const stateCode = (parts[0] || '').toLowerCase();
    const citySlug = (parts[1] || '').toLowerCase();
    
    if (!stateCode || !citySlug || !STATE_NAMES[stateCode]) {
      return redirect('/locations/');
    }

    const stateName = STATE_NAMES[stateCode];

    // Get shops in this city
    const { data: shops, error } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, google_rating, google_reviews, photos, is_joe_partner, partner_id')
      .eq('is_active', true)
      .ilike('state_code', stateCode)
      .ilike('city_slug', citySlug)
      .order('is_joe_partner', { ascending: false })
      .order('google_reviews', { ascending: false, nullsFirst: false });

    if (error) throw error;
    if (!shops || shops.length === 0) return notFound();

    const cityName = shops[0]?.city || citySlug;

    // Get hero image from top-rated shop with photo
    let heroImage = null;
    for (const shop of shops) {
      if (shop.photos?.length > 0) {
        heroImage = shop.photos[0];
        break;
      }
    }

    // Get SEO description from seo_content table
    let cityDescription = null;
    const { data: seoContent } = await supabase
      .from('seo_content')
      .select('description')
      .eq('type', 'city')
      .eq('state_code', stateCode)
      .eq('city', cityName)
      .single();
    
    if (seoContent?.description) {
      cityDescription = seoContent.description;
    }

    const html = renderCityPage(stateCode, stateName, citySlug, cityName, shops, heroImage, cityDescription);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=1800' },
      body: html
    };
  } catch (err) {
    console.error('City page error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};

function renderCityPage(stateCode, stateName, citySlug, cityName, shops, heroImage, cityDescription) {
  const canonicalUrl = `https://joe.coffee/locations/${stateCode}/${citySlug}/`;
  const title = `Coffee Shops in ${cityName}, ${stateName} | joe coffee`;
  const partnerCount = shops.filter(s => s.is_joe_partner || s.partner_id).length;
  const description = cityDescription || `Discover ${shops.length} independent coffee shops in ${cityName}, ${stateName}. ${partnerCount > 0 ? `${partnerCount} offer mobile ordering with joe.` : 'Find local roasters and cafes near you.'}`;
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
      { "@type": "ListItem", "position": 3, "name": stateName, "item": "https://joe.coffee/locations/" + stateCode + "/" },
      { "@type": "ListItem", "position": 4, "name": cityName }
    ]
  })}</script>
  
  <link rel="icon" type="image/png" href="/images/favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--black:#1c1917;--white:#fff;--gray-50:#fafaf9;--gray-100:#f5f5f4;--gray-200:#e7e5e3;--gray-300:#d6d3d1;--gray-400:#a8a29e;--gray-500:#78716c;--gray-600:#57534e;--gray-800:#292524;--amber-500:#f59e0b;--green-500:#22c55e}
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
    
    .hero{position:relative;height:280px;background:var(--gray-800);overflow:hidden}
    .hero-image{width:100%;height:100%;object-fit:cover;opacity:0.7}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.3),rgba(0,0,0,0.6));display:flex;flex-direction:column;justify-content:flex-end;padding:2rem}
    .hero-content{max-width:1280px;margin:0 auto;width:100%;color:var(--white)}
    .hero h1{font-size:2.25rem;font-weight:700;margin-bottom:0.5rem}
    .hero-stats{font-size:1rem;opacity:0.9}
    .hero-badge{display:inline-flex;align-items:center;gap:0.5rem;background:var(--green-500);color:var(--white);padding:0.25rem 0.75rem;border-radius:20px;font-size:0.8rem;font-weight:600;margin-top:0.75rem}
    
    .breadcrumb{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;font-size:0.875rem;color:var(--gray-500)}
    .breadcrumb a:hover{color:var(--black)}
    .breadcrumb span{margin:0 0.5rem;color:var(--gray-300)}
    
    .main{max-width:1280px;margin:0 auto;padding:0 1.5rem 3rem}
    
    .description{background:var(--white);border-radius:12px;padding:1.5rem;margin-bottom:2rem;border:1px solid var(--gray-200)}
    .description p{color:var(--gray-600);font-size:1.05rem;line-height:1.7}
    
    .section-title{font-size:1.25rem;font-weight:700;margin-bottom:1rem}
    
    .shops-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:1.5rem}
    .shop-card{background:var(--white);border-radius:12px;overflow:hidden;border:1px solid var(--gray-200);transition:all 0.2s}
    .shop-card:hover{border-color:var(--gray-300);box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .shop-card-image{height:160px;background:var(--gray-100);position:relative}
    .shop-card-image img{width:100%;height:100%;object-fit:cover}
    .shop-card-placeholder{height:160px;background:linear-gradient(135deg,var(--gray-100),var(--gray-200));display:flex;align-items:center;justify-content:center;font-size:3rem}
    .shop-card-partner{position:absolute;top:0.75rem;left:0.75rem;background:var(--green-500);color:var(--white);padding:0.25rem 0.5rem;border-radius:4px;font-size:0.7rem;font-weight:600}
    .shop-card-body{padding:1rem}
    .shop-card-name{font-weight:600;font-size:1.05rem;margin-bottom:0.25rem}
    .shop-card-address{color:var(--gray-500);font-size:0.85rem;margin-bottom:0.5rem}
    .shop-card-rating{display:flex;align-items:center;gap:0.5rem;font-size:0.85rem}
    .shop-card-stars{color:var(--amber-500)}
    .shop-card-reviews{color:var(--gray-400)}
    
    @media(max-width:768px){
      .hero{height:200px}
      .hero h1{font-size:1.5rem}
      .shops-grid{grid-template-columns:1fr}
      .shop-card-image,.shop-card-placeholder{height:140px}
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
    ${heroImage ? `<img src="${heroImage}" alt="Coffee in ${esc(cityName)}" class="hero-image">` : ''}
    <div class="hero-overlay">
      <div class="hero-content">
        <h1>Coffee Shops in ${esc(cityName)}, ${esc(stateName)}</h1>
        <div class="hero-stats">${shops.length} independent coffee shop${shops.length !== 1 ? 's' : ''}</div>
        ${partnerCount > 0 ? `<div class="hero-badge">☕ ${partnerCount} with mobile ordering</div>` : ''}
      </div>
    </div>
  </div>

  <nav class="breadcrumb">
    <a href="/">Home</a>
    <span>›</span>
    <a href="/locations/">Find Coffee</a>
    <span>›</span>
    <a href="/locations/${stateCode}/">${esc(stateName)}</a>
    <span>›</span>
    ${esc(cityName)}
  </nav>

  <main class="main">
    ${cityDescription ? `
    <div class="description">
      <p>${esc(cityDescription)}</p>
    </div>
    ` : ''}

    <h2 class="section-title">All Coffee Shops</h2>
    
    <div class="shops-grid">
      ${shops.map(shop => `
        <a href="/locations/${stateCode}/${citySlug}/${shop.slug}/" class="shop-card">
          ${shop.photos?.length > 0 
            ? `<div class="shop-card-image">
                ${shop.is_joe_partner || shop.partner_id ? '<div class="shop-card-partner">joe partner</div>' : ''}
                <img src="${shop.photos[0]}" alt="${esc(shop.name)}" loading="lazy">
              </div>`
            : `<div class="shop-card-placeholder">
                ${shop.is_joe_partner || shop.partner_id ? '<div class="shop-card-partner" style="position:absolute;top:0.75rem;left:0.75rem">joe partner</div>' : ''}
                ☕
              </div>`
          }
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(shop.name)}</div>
            <div class="shop-card-address">${esc(shop.address || '')}</div>
            ${shop.google_rating ? `
              <div class="shop-card-rating">
                <span class="shop-card-stars">${'★'.repeat(Math.round(shop.google_rating))}${'☆'.repeat(5 - Math.round(shop.google_rating))}</span>
                <span>${shop.google_rating}</span>
                ${shop.google_reviews ? `<span class="shop-card-reviews">(${shop.google_reviews.toLocaleString()})</span>` : ''}
              </div>
            ` : ''}
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

function notFound() {
  return { 
    statusCode: 404, 
    headers: { 'Content-Type': 'text/html' }, 
    body: `<!DOCTYPE html><html><head><title>City Not Found</title></head><body style="font-family:system-ui;padding:4rem;text-align:center"><h1>City not found</h1><p><a href="/locations/">Browse all locations →</a></p></body></html>` 
  };
}