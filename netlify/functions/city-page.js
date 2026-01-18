/**
 * City Page - List of coffee shops in a city with SEO content
 * URL: /locations/{state}/{city}/
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Major cities with curated hero images
const CITY_HEROES = {
  'new-york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1600&q=80',
  'los-angeles': 'https://images.unsplash.com/photo-1515896769750-31548aa180ed?w=1600&q=80',
  'chicago': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&q=80',
  'houston': 'https://images.unsplash.com/photo-1530089711124-9ca31fb9e863?w=1600&q=80',
  'phoenix': 'https://images.unsplash.com/photo-1558645836-e44122a743ee?w=1600&q=80',
  'philadelphia': 'https://images.unsplash.com/photo-1569761316261-9a8696fa2ca3?w=1600&q=80',
  'san-antonio': 'https://images.unsplash.com/photo-1531218150217-54595bc2b934?w=1600&q=80',
  'san-diego': 'https://images.unsplash.com/photo-1538097304804-2a1b932466a9?w=1600&q=80',
  'dallas': 'https://images.unsplash.com/photo-1545194445-dddb8f4487c6?w=1600&q=80',
  'san-jose': 'https://images.unsplash.com/photo-1535090467336-9501f96e89d0?w=1600&q=80',
  'austin': 'https://images.unsplash.com/photo-1531218150217-54595bc2b934?w=1600&q=80',
  'san-francisco': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1600&q=80',
  'seattle': 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=1600&q=80',
  'denver': 'https://images.unsplash.com/photo-1546156929-a4c0ac411f47?w=1600&q=80',
  'boston': 'https://images.unsplash.com/photo-1573053986170-8f9e9c5c9a9e?w=1600&q=80',
  'nashville': 'https://images.unsplash.com/photo-1545419913-775e3e55b7db?w=1600&q=80',
  'portland': 'https://images.unsplash.com/photo-1531747056779-a4953a95e27a?w=1600&q=80',
  'miami': 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=1600&q=80',
  'atlanta': 'https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=1600&q=80',
  'minneapolis': 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1600&q=80',
  'new-orleans': 'https://images.unsplash.com/photo-1568402102990-bc541580b59f?w=1600&q=80',
  'brooklyn': 'https://images.unsplash.com/photo-1555424681-b0ecf4fe19a5?w=1600&q=80',
  'washington': 'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1600&q=80',
  'pittsburgh': 'https://images.unsplash.com/photo-1569761316261-9a8696fa2ca3?w=1600&q=80',
  'detroit': 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1600&q=80',
  'salt-lake-city': 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=80',
  'las-vegas': 'https://images.unsplash.com/photo-1581351721010-8cf859cb14a4?w=1600&q=80',
  'honolulu': 'https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=1600&q=80',
  'charlotte': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=1600&q=80',
  'columbus': 'https://images.unsplash.com/photo-1567604130959-3c285e6b4b8e?w=1600&q=80',
  'cincinnati': 'https://images.unsplash.com/photo-1567604130959-3c285e6b4b8e?w=1600&q=80',
  'cleveland': 'https://images.unsplash.com/photo-1567604130959-3c285e6b4b8e?w=1600&q=80',
  'raleigh': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=1600&q=80',
  'tampa': 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=1600&q=80',
  'orlando': 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=1600&q=80',
  'asheville': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=1600&q=80',
  'savannah': 'https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=1600&q=80',
  'charleston': 'https://images.unsplash.com/photo-1570629936525-0c8f5d5f9e62?w=1600&q=80',
  'madison': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'milwaukee': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'ann-arbor': 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1600&q=80',
  'st-louis': 'https://images.unsplash.com/photo-1572646662929-99971a1d5b3d?w=1600&q=80',
  'kansas-city': 'https://images.unsplash.com/photo-1572646662929-99971a1d5b3d?w=1600&q=80',
  'memphis': 'https://images.unsplash.com/photo-1545419913-775e3e55b7db?w=1600&q=80',
  'providence': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'albuquerque': 'https://images.unsplash.com/photo-1518516278006-4aca8d5b4d3d?w=1600&q=80',
  'santa-fe': 'https://images.unsplash.com/photo-1518516278006-4aca8d5b4d3d?w=1600&q=80',
  'tulsa': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'oklahoma-city': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'richmond': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'birmingham': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
  'cambridge': 'https://images.unsplash.com/photo-1573053986170-8f9e9c5c9a9e?w=1600&q=80',
  'oakland': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1600&q=80',
  'omaha': 'https://images.unsplash.com/photo-1508193638397-1c4234db14d9?w=1600&q=80',
  'lincoln': 'https://images.unsplash.com/photo-1508193638397-1c4234db14d9?w=1600&q=80',
  'reno': 'https://images.unsplash.com/photo-1581351721010-8cf859cb14a4?w=1600&q=80',
  'baltimore': 'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=1600&q=80',
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
      .select('id, name, slug, address, city, google_rating, google_reviews, photos, is_joe_partner, partner_id, is_roaster, shop_format, has_ecommerce')
      .eq('is_active', true)
      .eq('state_code', stateCode)
      .eq('city_slug', citySlug)
      .order('is_joe_partner', { ascending: false })
      .order('google_reviews', { ascending: false, nullsFirst: false });

    if (error) throw error;
    if (!shops || shops.length === 0) return notFound();

    const cityName = shops[0]?.city || citySlug;
    const partnerCount = shops.filter(s => s.is_joe_partner || s.partner_id).length;

    // Get representative city hero image (curated or dynamic)
    const heroImage = CITY_HEROES[citySlug] || 
      `https://source.unsplash.com/1600x900/?${encodeURIComponent(cityName + ' city skyline')}`;

    // Get SEO description from seo_content table
    let cityDescription = null;
    const { data: seoContent, error: seoError } = await supabase
      .from('seo_content')
      .select('description')
      .eq('type', 'city')
      .eq('state_code', stateCode)
      .eq('city', cityName)
      .maybeSingle();
    
    if (seoError) {
      console.error('SEO query error:', seoError);
    } else if (seoContent?.description) {
      cityDescription = seoContent.description;
    }

    const html = renderCityPage(stateCode, stateName, citySlug, cityName, shops, heroImage, cityDescription, partnerCount);

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

function renderCityPage(stateCode, stateName, citySlug, cityName, shops, heroImage, cityDescription, partnerCount) {
  const canonicalUrl = `https://joe.coffee/locations/${stateCode}/${citySlug}/`;
  const title = `Coffee Shops in ${cityName}, ${stateName} | joe coffee`;
  const metaDesc = cityDescription || `Discover ${shops.length} independent coffee shops in ${cityName}, ${stateName}. ${partnerCount > 0 ? `${partnerCount} offer mobile ordering with joe.` : 'Find local roasters and cafes near you.'}`;

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
      { "@type": "ListItem", "position": 3, "name": stateName, "item": "https://joe.coffee/locations/" + stateCode + "/" },
      { "@type": "ListItem", "position": 4, "name": cityName }
    ]
  })}</script>
  
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--black:#1c1917;--white:#fff;--gray-50:#fafaf9;--gray-100:#f5f5f4;--gray-200:#e7e5e3;--gray-300:#d6d3d1;--gray-400:#a8a29e;--gray-500:#78716c;--gray-600:#57534e;--gray-800:#292524;--amber-500:#f59e0b;--green-500:#22c55e}
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
    .description p{color:var(--gray-600);font-size:1.05rem;line-height:1.7;margin:0}
    
    .section-title{font-size:1.25rem;font-weight:700;margin-bottom:1rem}
    
    .shops-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:1.5rem}
    .shop-card{background:var(--white);border-radius:12px;overflow:hidden;border:1px solid var(--gray-200);transition:all 0.2s}
    .shop-card:hover{border-color:var(--gray-300);box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .shop-card-image{height:160px;background:var(--gray-100);position:relative}
    .shop-card-image img{width:100%;height:100%;object-fit:cover}
    .shop-card-placeholder{height:160px;background:linear-gradient(135deg,var(--gray-100),var(--gray-200));display:flex;align-items:center;justify-content:center;font-size:3rem}
    .shop-card-partner{position:absolute;top:0.75rem;left:0.75rem;background:var(--green-500);color:var(--white);padding:0.25rem 0.5rem;border-radius:4px;font-size:0.7rem;font-weight:600}
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

    .mobile-menu-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:2rem;cursor:pointer;line-height:1}
    .mobile-menu a{display:block;padding:1rem 0;font-weight:500;color:#1c1917;border-bottom:1px solid #e7e5e3}

    .main-nav{background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 1.5rem;position:sticky;top:0;z-index:100}
    .nav-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px}
    .nav-links{display:flex;gap:1.5rem;align-items:center}
    .nav-links a{color:#374151;text-decoration:none;font-size:0.9rem}
    .nav-links a:hover{color:#111}
    .nav-cta{background:#111;color:#fff!important;padding:0.5rem 1rem;border-radius:50px;font-weight:500}
    .mobile-menu-btn{display:none;flex-direction:column;justify-content:center;align-items:center;gap:5px;cursor:pointer;padding:10px;width:44px;height:44px;z-index:1001}
    .mobile-menu-btn span{width:24px;height:2px;background:#111;transition:all 0.3s}
    .mobile-menu{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;z-index:1000;padding:80px 2rem 2rem;flex-direction:column}
    .mobile-menu.active{display:flex}.mobile-menu a{font-size:1.1rem;color:#111;text-decoration:none;padding:1rem 0;border-bottom:1px solid #eee}.mobile-menu a:last-child{border:none}
    .mobile-menu a{font-size:1.25rem;color:#111;text-decoration:none;padding:0.5rem 0;border-bottom:1px solid #e5e7eb}
    @media(max-width:768px){
      .nav-links{display:none}
      .mobile-menu-btn{display:flex}
    }

  </style>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-NLCJFKGXB5"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-NLCJFKGXB5');
</script>
</head>
<body>
  <nav class="main-nav">
    <div class="nav-inner">
      <a href="/" class="logo"><img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" style="height:40px"></a>
      <div class="nav-links">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="nav-cta">Get the App</a>
      </div>
      <div class="mobile-menu-btn" id="mobileMenuBtn"><span></span><span></span><span></span></div>
    </div>
  </nav>
  <div class="mobile-menu" id="mobileMenu">
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee" class="nav-cta">Get the App</a>
  </div>

  <div class="hero">
    <img src="${heroImage}" alt="${esc(cityName)}, ${esc(stateName)}" class="hero-image">
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
            <div class="shop-card-tags">
              ${shop.is_roaster ? '<span class="shop-tag roaster">🔥 Roaster</span>' : ''}
              ${shop.shop_format === 'drive_thru' ? '<span class="shop-tag drive-thru">🚗 Drive-Thru</span>' : ''}
              ${shop.google_rating >= 4.5 && shop.google_reviews >= 50 ? '<span class="shop-tag highly-rated">⭐ Top Rated</span>' : ''}
              ${shop.has_ecommerce ? '<span class="shop-tag online">🛒 Shop Online</span>' : ''}
            </div>
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

  <script>
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if(mobileMenuBtn && mobileMenu){
      mobileMenuBtn.addEventListener('click',()=>{
        mobileMenuBtn.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
      });
    }
  </script>
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