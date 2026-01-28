/**
 * Enhanced City Page - Coffee shops with neighborhoods and filters
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
  'san-diego': 'https://images.unsplash.com/photo-1538097304804-2a1b932466a9?w=1600&q=80',
  'dallas': 'https://images.unsplash.com/photo-1545194445-dddb8f4487c6?w=1600&q=80',
  'austin': 'https://images.unsplash.com/photo-1531218150217-54595bc2b934?w=1600&q=80',
  'san-francisco': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1600&q=80',
  'seattle': 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=1600&q=80',
  'denver': 'https://images.unsplash.com/photo-1546156929-a4c0ac411f47?w=1600&q=80',
  'boston': 'https://images.unsplash.com/photo-1573053986170-8f9e9c5c9a9e?w=1600&q=80',
  'nashville': 'https://images.unsplash.com/photo-1545419913-775e3e55b7db?w=1600&q=80',
  'portland': 'https://images.unsplash.com/photo-1531747056779-a4953a95e27a?w=1600&q=80',
  'miami': 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=1600&q=80',
  'atlanta': 'https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=1600&q=80',
  'brooklyn': 'https://images.unsplash.com/photo-1555424681-b0ecf4fe19a5?w=1600&q=80',
  'washington': 'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1600&q=80',
  'tampa': 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=1600&q=80',
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

const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slugify = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
};

const redirect = (url) => ({ statusCode: 301, headers: { Location: url }, body: '' });

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

    // Fetch shops
    const { data: shops, error } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, neighborhood, photos, google_rating, total_reviews, is_joe_partner, partner_id, is_roaster, shop_format, has_ecommerce, business_type')
      .eq('state_code', stateCode)
      .eq('city_slug', citySlug)
      .eq('is_active', true)
      .order('is_joe_partner', { ascending: false })
      .order('google_rating', { ascending: false, nullsFirst: false });

    if (error) throw error;
    if (!shops || shops.length === 0) return redirect('/locations/' + stateCode + '/');

    const cityName = shops[0].city;
    const partnerCount = shops.filter(s => s.is_joe_partner || s.partner_id).length;
    const heroImage = CITY_HEROES[citySlug] || `https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600&q=80`;

    // Fetch city description
    let cityDescription = '';
    try {
      const { data: cityData } = await supabase
        .from('city_seo_content')
        .select('description')
        .eq('state_code', stateCode)
        .eq('city_slug', citySlug)
        .single();
      cityDescription = cityData?.description || '';
    } catch (e) {}

    // Get neighborhoods for this city
    const neighborhoodCounts = {};
    shops.forEach(shop => {
      if (shop.neighborhood) {
        const slug = slugify(shop.neighborhood);
        if (!neighborhoodCounts[slug]) {
          neighborhoodCounts[slug] = { name: shop.neighborhood, count: 0 };
        }
        neighborhoodCounts[slug].count++;
      }
    });
    const neighborhoods = Object.entries(neighborhoodCounts)
      .map(([slug, data]) => ({ slug, ...data }))
      .sort((a, b) => b.count - a.count);

    // Count shop types for filter badges
    const roasterCount = shops.filter(s => s.is_roaster).length;
    const driveThruCount = shops.filter(s => s.shop_format === 'drive_thru').length;
    const topRatedCount = shops.filter(s => s.google_rating >= 4.5 && s.total_reviews >= 50).length;
    const partnerShopCount = shops.filter(s => s.is_joe_partner || s.partner_id).length;
    const bakeryCount = shops.filter(s => s.business_type === 'bakery' || (s.name && s.name.toLowerCase().includes('bakery'))).length;

    // Build shops JSON for client-side filtering
    const shopsJSON = JSON.stringify(shops.map(s => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      address: s.address,
      neighborhood: s.neighborhood,
      neighborhoodSlug: slugify(s.neighborhood),
      photo: s.photos?.[0] || '',
      rating: s.google_rating,
      reviews: s.total_reviews,
      isPartner: !!(s.is_joe_partner || s.partner_id),
      isRoaster: !!s.is_roaster,
      isDriveThru: s.shop_format === 'drive_thru',
      isTopRated: s.google_rating >= 4.5 && s.total_reviews >= 50,
      isBakery: s.business_type === 'bakery' || (s.name && s.name.toLowerCase().includes('bakery')),
      hasEcommerce: !!s.has_ecommerce
    })));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shops in ${esc(cityName)}, ${esc(stateName)} | joe coffee</title>
  <meta name="description" content="Find ${shops.length} independent coffee shops in ${esc(cityName)}, ${esc(stateName)}. Discover local roasters, cafes, and drive-thrus.">
  <link rel="canonical" href="https://joe.coffee/locations/${stateCode}/${citySlug}/">
  <link rel="icon" href="/favicon.ico">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&display=swap" rel="stylesheet">
  <meta property="og:title" content="Coffee Shops in ${esc(cityName)}, ${esc(stateName)}">
  <meta property="og:description" content="${shops.length} independent coffee shops to explore">
  <meta property="og:image" content="${heroImage}">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --black: #000; --white: #fff;
      --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb; --gray-300: #d1d5db;
      --gray-400: #9ca3af; --gray-500: #6b7280; --gray-600: #4b5563; --gray-700: #374151;
      --gray-800: #1f2937; --gray-900: #111827;
      --font-display: 'Newsreader', Georgia, serif;
      --font-body: 'Inter', -apple-system, sans-serif;
      --green-500: #22c55e; --amber-500: #f59e0b;
    }
    body { font-family: var(--font-body); background: var(--gray-50); color: var(--gray-900); line-height: 1.5; }
    a { color: inherit; text-decoration: none; }

    /* Header */
    .main-nav { background: var(--white); border-bottom: 1px solid var(--gray-200); padding: 1rem 1.5rem; position: sticky; top: 0; z-index: 100; }
    .nav-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .logo img { height: 40px; }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a { color: var(--gray-700); font-size: 0.9rem; font-weight: 500; }
    .nav-cta { background: var(--black) !important; color: var(--white) !important; padding: 0.5rem 1rem; border-radius: 50px; }
    .mobile-menu-btn { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 10px; }
    .mobile-menu-btn span { display: block; width: 24px; height: 2px; background: var(--black); }
    .mobile-menu { display: none; position: fixed; inset: 0; background: var(--white); z-index: 200; padding: 1.5rem; flex-direction: column; }
    .mobile-menu.active { display: flex; }
    .mobile-menu-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .mobile-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
    .mobile-menu > a { display: block; font-size: 1.1rem; padding: 1rem 0; border-bottom: 1px solid var(--gray-200); }
    .mobile-menu .mobile-cta { display: block; background: var(--black); color: var(--white) !important; padding: 1rem; border-radius: 50px; text-align: center; margin-top: 1rem; }
    @media(max-width: 768px) { .nav-links { display: none; } .mobile-menu-btn { display: flex; } }

    /* Hero */
    .hero { position: relative; height: 280px; background: var(--gray-800); overflow: hidden; }
    .hero-image { width: 100%; height: 100%; object-fit: cover; opacity: 0.7; }
    .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6)); display: flex; flex-direction: column; justify-content: flex-end; padding: 2rem; }
    .hero-content { max-width: 1280px; margin: 0 auto; width: 100%; color: var(--white); }
    .hero h1 { font-size: 2.25rem; font-weight: 700; margin-bottom: 0.5rem; }
    .hero-stats { font-size: 1rem; opacity: 0.9; }
    .hero-badge { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--green-500); color: var(--white); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin-top: 0.75rem; }

    /* Breadcrumb */
    .breadcrumb { max-width: 1280px; margin: 0 auto; padding: 1rem 1.5rem; font-size: 0.875rem; color: var(--gray-500); }
    .breadcrumb a:hover { color: var(--black); }
    .breadcrumb span { margin: 0 0.5rem; color: var(--gray-300); }

    /* Main */
    .main { max-width: 1280px; margin: 0 auto; padding: 0 1.5rem 3rem; }

    /* Description */
    .description { background: var(--white); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid var(--gray-200); }
    .description p { color: var(--gray-600); font-size: 1.05rem; line-height: 1.7; margin: 0; }

    /* Neighborhoods Section */
    .neighborhoods-section { background: var(--white); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid var(--gray-200); }
    .neighborhoods-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .neighborhoods-header h2 { font-size: 1.1rem; font-weight: 600; }
    .neighborhoods-header a { font-size: 0.875rem; color: var(--gray-500); }
    .neighborhoods-header a:hover { color: var(--black); }
    .neighborhood-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .neighborhood-chip { background: var(--gray-100); padding: 0.5rem 1rem; border-radius: 100px; font-size: 0.875rem; color: var(--gray-700); transition: all 0.2s; border: 1px solid transparent; }
    .neighborhood-chip:hover { background: var(--gray-200); border-color: var(--gray-300); }
    .neighborhood-chip .count { color: var(--gray-400); margin-left: 0.25rem; }

    /* Filter Bar */
    .filter-bar { background: var(--white); border-radius: 12px; padding: 1rem 1.5rem; margin-bottom: 1.5rem; border: 1px solid var(--gray-200); }
    .filter-bar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .filter-bar-header h3 { font-size: 0.9rem; font-weight: 600; color: var(--gray-700); }
    .filter-clear { font-size: 0.8rem; color: var(--gray-500); cursor: pointer; display: none; }
    .filter-clear:hover { color: var(--black); }
    .filter-clear.visible { display: inline; }
    .filter-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .filter-chip { background: var(--gray-100); padding: 0.5rem 1rem; border-radius: 100px; font-size: 0.8rem; color: var(--gray-600); cursor: pointer; transition: all 0.2s; border: 1px solid transparent; user-select: none; }
    .filter-chip:hover { background: var(--gray-200); }
    .filter-chip.active { background: var(--black); color: var(--white); border-color: var(--black); }
    .filter-chip .badge { background: var(--gray-300); color: var(--gray-600); padding: 0.1rem 0.4rem; border-radius: 10px; font-size: 0.7rem; margin-left: 0.4rem; }
    .filter-chip.active .badge { background: rgba(255,255,255,0.2); color: var(--white); }

    /* Shops Grid */
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .section-title { font-size: 1.25rem; font-weight: 700; }
    .shop-count { color: var(--gray-500); font-size: 0.9rem; }
    .shops-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .shop-card { background: var(--white); border-radius: 12px; overflow: hidden; border: 1px solid var(--gray-200); transition: all 0.2s; }
    .shop-card:hover { border-color: var(--gray-300); box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-2px); }
    .shop-card.hidden { display: none; }
    .shop-card-image { height: 160px; background: var(--gray-100); position: relative; }
    .shop-card-image img { width: 100%; height: 100%; object-fit: cover; }
    .shop-card-placeholder { height: 160px; background: linear-gradient(135deg, var(--gray-100), var(--gray-200)); display: flex; align-items: center; justify-content: center; font-size: 3rem; }
    .shop-card-partner { position: absolute; top: 0.75rem; left: 0.75rem; background: var(--green-500); color: var(--white); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
    .shop-card-body { padding: 1rem; }
    .shop-card-name { font-weight: 600; font-size: 1.05rem; margin-bottom: 0.25rem; }
    .shop-card-address { color: var(--gray-500); font-size: 0.85rem; margin-bottom: 0.5rem; }
    .shop-card-meta { display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; flex-wrap: wrap; }
    .shop-card-rating { color: var(--amber-500); }
    .shop-card-reviews { color: var(--gray-400); }
    .shop-tag { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 500; }
    .shop-tag.roaster { background: #fef3c7; color: #92400e; }
    .shop-tag.drive-thru { background: #dbeafe; color: #1e40af; }
    .shop-tag.top-rated { background: #fef3c7; color: #92400e; }
    .shop-tag.online { background: #d1fae5; color: #065f46; }

    /* No Results */
    .no-results { text-align: center; padding: 3rem 1rem; color: var(--gray-500); display: none; }
    .no-results.visible { display: block; }

    /* Footer */
    .footer { background: var(--gray-50); border-top: 1px solid var(--gray-200); padding: 4rem 1.5rem 2rem; margin-top: 2rem; }
    .footer-inner { max-width: 1280px; margin: 0 auto; }
    .footer-top { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem; margin-bottom: 3rem; }
    .footer-brand p { color: var(--gray-600); margin: 1rem 0; font-size: 0.95rem; }
    .footer-logo img { height: 40px; }
    .footer-social { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--gray-600); font-size: 0.9rem; }
    .footer-social svg { width: 20px; height: 20px; }
    .footer-col h4 { font-weight: 600; margin-bottom: 1rem; color: var(--gray-900); }
    .footer-col ul { list-style: none; }
    .footer-col li { margin-bottom: 0.75rem; }
    .footer-col a { color: var(--gray-600); font-size: 0.95rem; transition: color 0.2s; }
    .footer-col a:hover { color: var(--gray-900); }
    .footer-cities { padding: 2rem 0; border-top: 1px solid var(--gray-200); border-bottom: 1px solid var(--gray-200); margin-bottom: 2rem; }
    .footer-cities h4 { font-weight: 600; margin-bottom: 1rem; }
    .footer-cities-grid { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; }
    .footer-cities-grid a { color: var(--gray-600); font-size: 0.9rem; }
    .footer-cities .view-all { display: inline-block; margin-top: 1rem; color: var(--gray-900); font-weight: 500; }
    .footer-bottom { display: flex; justify-content: space-between; align-items: center; color: var(--gray-500); font-size: 0.875rem; }
    .footer-bottom svg { width: 14px; height: 14px; color: #ef4444; vertical-align: middle; }
    @media(max-width: 768px) {
      .hero { height: 200px; } .hero h1 { font-size: 1.5rem; }
      .shops-grid { grid-template-columns: 1fr; }
      .footer-top { grid-template-columns: 1fr; gap: 2rem; }
      .footer-bottom { flex-direction: column; gap: 1rem; text-align: center; }
      .filter-chips { gap: 0.4rem; }
      .filter-chip { padding: 0.4rem 0.75rem; font-size: 0.75rem; }
    }
  </style>
</head>
<body>
  <nav class="main-nav">
    <div class="nav-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <div class="nav-links">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="nav-cta">Get the App</a>
      </div>
      <div class="mobile-menu-btn" id="mobileMenuBtn"><span></span><span></span><span></span></div>
    </div>
  </nav>
  
  <div class="mobile-menu" id="mobileMenu">
    <div class="mobile-menu-header">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <button class="mobile-close" id="mobileClose">✕</button>
    </div>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee" class="mobile-cta">Get the App</a>
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
    <a href="/">Home</a><span>›</span>
    <a href="/locations/">Find Coffee</a><span>›</span>
    <a href="/locations/${stateCode}/">${esc(stateName)}</a><span>›</span>
    ${esc(cityName)}
  </nav>

  <main class="main">
    ${cityDescription ? `<div class="description"><p>${esc(cityDescription)}</p></div>` : ''}

    ${neighborhoods.length > 0 ? `
    <div class="neighborhoods-section">
      <div class="neighborhoods-header">
        <h2>Explore by Neighborhood</h2>
        <a href="/locations/${stateCode}/${citySlug}/neighborhoods/">View all ${neighborhoods.length} →</a>
      </div>
      <div class="neighborhood-chips">
        ${neighborhoods.slice(0, 12).map(n => `
          <a href="/locations/${stateCode}/${citySlug}/neighborhoods/${n.slug}/" class="neighborhood-chip">
            ${esc(n.name)} <span class="count">(${n.count})</span>
          </a>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="filter-bar">
      <div class="filter-bar-header">
        <h3>Filter by</h3>
        <span class="filter-clear" id="filterClear" onclick="clearFilters()">Clear all</span>
      </div>
      <div class="filter-chips">
        ${partnerShopCount > 0 ? `<div class="filter-chip" data-filter="partner" onclick="toggleFilter(this)">☕ joe Partner <span class="badge">${partnerShopCount}</span></div>` : ''}
        ${roasterCount > 0 ? `<div class="filter-chip" data-filter="roaster" onclick="toggleFilter(this)">🔥 Roaster <span class="badge">${roasterCount}</span></div>` : ''}
        ${driveThruCount > 0 ? `<div class="filter-chip" data-filter="driveThru" onclick="toggleFilter(this)">🚗 Drive-Thru <span class="badge">${driveThruCount}</span></div>` : ''}
        ${topRatedCount > 0 ? `<div class="filter-chip" data-filter="topRated" onclick="toggleFilter(this)">⭐ Top Rated <span class="badge">${topRatedCount}</span></div>` : ''}
        ${bakeryCount > 0 ? `<div class="filter-chip" data-filter="bakery" onclick="toggleFilter(this)">🥐 Bakery <span class="badge">${bakeryCount}</span></div>` : ''}
      </div>
    </div>

    <div class="section-header">
      <h2 class="section-title">All Coffee Shops</h2>
      <span class="shop-count" id="shopCount">${shops.length} shops</span>
    </div>
    
    <div class="shops-grid" id="shopsGrid">
      ${shops.map(shop => `
        <a href="/locations/${stateCode}/${citySlug}/${shop.slug}/" class="shop-card" 
           data-partner="${!!(shop.is_joe_partner || shop.partner_id)}"
           data-roaster="${!!shop.is_roaster}"
           data-drive-thru="${shop.shop_format === 'drive_thru'}"
           data-top-rated="${shop.google_rating >= 4.5 && shop.total_reviews >= 50}"
           data-bakery="${shop.business_type === 'bakery' || (shop.name && shop.name.toLowerCase().includes('bakery'))}">
          ${shop.photos?.length > 0 
            ? `<div class="shop-card-image">
                ${shop.is_joe_partner || shop.partner_id ? '<div class="shop-card-partner">joe partner</div>' : ''}
                <img src="${shop.photos[0]}" alt="${esc(shop.name)}" loading="lazy">
              </div>`
            : `<div class="shop-card-placeholder">
                ${shop.is_joe_partner || shop.partner_id ? '<div class="shop-card-partner">joe partner</div>' : ''}☕
              </div>`
          }
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(shop.name)}</div>
            <div class="shop-card-address">${esc(shop.address || '')}</div>
            <div class="shop-card-meta">
              ${shop.google_rating ? `<span class="shop-card-rating">★ ${shop.google_rating}</span>` : ''}
              ${shop.total_reviews ? `<span class="shop-card-reviews">(${shop.total_reviews})</span>` : ''}
              ${shop.is_roaster ? '<span class="shop-tag roaster">Roaster</span>' : ''}
              ${shop.shop_format === 'drive_thru' ? '<span class="shop-tag drive-thru">Drive-Thru</span>' : ''}
            </div>
          </div>
        </a>
      `).join('')}
    </div>

    <div class="no-results" id="noResults">
      <p>No shops match your filters. <a href="#" onclick="clearFilters(); return false;">Clear filters</a></p>
    </div>
  </main>

  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-top">
        <div class="footer-brand">
          <div class="footer-logo"><img src="/images/logo.png" alt="joe"></div>
          <p>The #1 app for indie coffee lovers. Skip the line, earn rewards, support local.</p>
          <a href="https://instagram.com/joe_is_community" class="footer-social">
            <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            @joe_is_community
          </a>
        </div>
        <div class="footer-col">
          <h4>For Coffee Lovers</h4>
          <ul>
            <li><a href="https://get.joe.coffee">Download App</a></li>
            <li><a href="/locations/">Find Shops</a></li>
            <li><a href="/rewards/">Rewards</a></li>
            <li><a href="/gift-cards/">Gift Cards</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>For Coffee Shops</h4>
          <ul>
            <li><a href="/for-coffee-shops/">Join the Collective</a></li>
            <li><a href="/for-coffee-shops/#platform">Platform</a></li>
            <li><a href="/for-coffee-shops/#pricing">Pricing</a></li>
            <li><a href="https://support.joe.coffee">Support</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Company</h4>
          <ul>
            <li><a href="/about/">About</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/media/">Media</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/terms/">Terms</a></li>
            <li><a href="/privacy/">Privacy</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-cities">
        <h4>Coffee Shops by City</h4>
        <div class="footer-cities-grid">
          <a href="/locations/ny/new-york/">New York</a>
          <a href="/locations/ca/los-angeles/">Los Angeles</a>
          <a href="/locations/il/chicago/">Chicago</a>
          <a href="/locations/ca/san-francisco/">San Francisco</a>
          <a href="/locations/pa/philadelphia/">Philadelphia</a>
          <a href="/locations/ca/san-diego/">San Diego</a>
          <a href="/locations/ma/boston/">Boston</a>
          <a href="/locations/wa/seattle/">Seattle</a>
          <a href="/locations/co/denver/">Denver</a>
          <a href="/locations/dc/washington/">Washington DC</a>
          <a href="/locations/tn/nashville/">Nashville</a>
          <a href="/locations/or/portland/">Portland</a>
        </div>
        <a href="/locations/" class="view-all">View All Locations →</a>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Joe Coffee. All rights reserved.</span>
        <span>Crafted with <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> for indie coffee</span>
      </div>
    </div>
  </footer>

  <script>
    // Mobile menu
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => document.getElementById('mobileMenu').classList.add('active'));
    document.getElementById('mobileClose')?.addEventListener('click', () => document.getElementById('mobileMenu').classList.remove('active'));

    // Filtering
    const activeFilters = new Set();
    
    function toggleFilter(el) {
      const filter = el.dataset.filter;
      el.classList.toggle('active');
      
      if (activeFilters.has(filter)) {
        activeFilters.delete(filter);
      } else {
        activeFilters.add(filter);
      }
      
      applyFilters();
    }
    
    function clearFilters() {
      activeFilters.clear();
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      applyFilters();
    }
    
    function applyFilters() {
      const cards = document.querySelectorAll('.shop-card');
      let visibleCount = 0;
      
      cards.forEach(card => {
        if (activeFilters.size === 0) {
          card.classList.remove('hidden');
          visibleCount++;
          return;
        }
        
        let matches = false;
        if (activeFilters.has('partner') && card.dataset.partner === 'true') matches = true;
        if (activeFilters.has('roaster') && card.dataset.roaster === 'true') matches = true;
        if (activeFilters.has('driveThru') && card.dataset.driveThru === 'true') matches = true;
        if (activeFilters.has('topRated') && card.dataset.topRated === 'true') matches = true;
        if (activeFilters.has('bakery') && card.dataset.bakery === 'true') matches = true;
        
        if (matches) {
          card.classList.remove('hidden');
          visibleCount++;
        } else {
          card.classList.add('hidden');
        }
      });
      
      document.getElementById('shopCount').textContent = visibleCount + ' shop' + (visibleCount !== 1 ? 's' : '');
      document.getElementById('filterClear').classList.toggle('visible', activeFilters.size > 0);
      document.getElementById('noResults').classList.toggle('visible', visibleCount === 0);
    }
  </script>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' },
      body: html
    };

  } catch (error) {
    console.error('City page error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `<h1>Error</h1><p>${error.message}</p>`
    };
  }
};
