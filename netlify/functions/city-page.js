/**
 * City Page - Server-Side Rendered
 * Lists all coffee shops in a city
 * Partners appear first, then non-partners sorted by rating
 * 
 * URL: /locations/:state/:city/
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const path = event.path || ""; const parts = path.replace("/.netlify/functions/city-page", "").replace("/locations/", "").split("/").filter(Boolean); const state = parts[0] || event.queryStringParameters?.state; const city = parts[1] || event.queryStringParameters?.city; const page = event.queryStringParameters?.page || "1"; const filter = event.queryStringParameters?.filter;
    
    if (!state || !city) {
      return redirect('/locations/');
    }

    const stateCode = state.toLowerCase();
    const citySlug = city.toLowerCase();
    const pageNum = parseInt(page) || 1;
    const perPage = 20;
    const offset = (pageNum - 1) * perPage;

    // Get all shops in this city
    // Partners first (is_joe_partner = true OR partner_id IS NOT NULL)
    // Then by rating
    const { data: allShops, error, count } = await supabase
      .from('shops')
      .select('*', { count: 'exact' })
      .ilike('state_code', stateCode)
      .ilike('city_slug', citySlug)
      .order('is_joe_partner', { ascending: false, nullsFirst: false })
      .order('partner_id', { ascending: false, nullsFirst: false })
      .order('google_rating', { ascending: false, nullsFirst: false })
      .range(offset, offset + perPage - 1);

    if (error) throw error;

    if (!allShops || allShops.length === 0) {
      return notFound(citySlug, stateCode);
    }

    // Get counts
    const { count: partnerCount } = await supabase
      .from('shops')
      .select('*', { count: 'exact', head: true })
      .ilike('state_code', stateCode)
      .ilike('city_slug', citySlug)
      .or('is_joe_partner.eq.true,partner_id.not.is.null');

    const cityName = allShops[0].city || formatCityName(citySlug);
    const stateName = getStateName(stateCode);
    const totalPages = Math.ceil(count / perPage);

    // Check which shops are currently open (simplified)
    const shops = allShops.map(shop => ({
      ...shop,
      is_open: checkIfOpen(shop.hours),
      is_joe_partner: shop.is_joe_partner || !!shop.partner_id
    }));

    // Count open shops
    const openCount = shops.filter(s => s.is_open).length;

    const html = renderCityPage({
      stateCode,
      stateName,
      citySlug,
      cityName,
      shops,
      totalCount: count,
      partnerCount: partnerCount || 0,
      openCount,
      pageNum,
      totalPages,
      filter
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      },
      body: html
    };

  } catch (err) {
    console.error('City page error:', err);
    return error500();
  }
};

function renderCityPage({ stateCode, stateName, citySlug, cityName, shops, totalCount, partnerCount, openCount, pageNum, totalPages, filter }) {
  const canonicalUrl = `https://joe.coffee/locations/${stateCode}/${citySlug}/`;
  
  // Schema
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Coffee Shops in ${cityName}, ${stateName}`,
    numberOfItems: totalCount,
    itemListElement: shops.slice(0, 10).map((shop, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'CafeOrCoffeeShop',
        name: shop.name,
        url: `https://joe.coffee/locations/${stateCode}/${citySlug}/${shop.slug}/`
      }
    }))
  };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://joe.coffee/' },
      { '@type': 'ListItem', position: 2, name: 'Locations', item: 'https://joe.coffee/locations/' },
      { '@type': 'ListItem', position: 3, name: stateName, item: `https://joe.coffee/locations/${stateCode}/` },
      { '@type': 'ListItem', position: 4, name: cityName }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shops in ${cityName}, ${stateName} | Order Ahead | joe coffee</title>
  <meta name="description" content="Order ahead at ${partnerCount}+ independent coffee shops in ${cityName}, ${stateName}. Skip the line, earn rewards, support local. Plus ${totalCount - partnerCount} more cafes to discover.">
  <link rel="canonical" href="${canonicalUrl}${pageNum > 1 ? `?page=${pageNum}` : ''}">
  ${pageNum > 1 ? `<link rel="prev" href="${canonicalUrl}${pageNum > 2 ? `?page=${pageNum-1}` : ''}">` : ''}
  ${pageNum < totalPages ? `<link rel="next" href="${canonicalUrl}?page=${pageNum+1}">` : ''}
  
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbs)}</script>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --black: #000000;
      --white: #FFFFFF;
      --gray-50: #F9FAFB;
      --gray-100: #F3F4F6;
      --gray-200: #E5E7EB;
      --gray-300: #D1D5DB;
      --gray-400: #9CA3AF;
      --gray-500: #6B7280;
      --gray-600: #4B5563;
      --gray-700: #374151;
      --gray-800: #1F2937;
      --gray-900: #111827;
      --green-500: #22C55E;
      --red-500: #EF4444;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--white);
      color: var(--gray-900);
      line-height: 1.6;
    }
    
    a { color: inherit; text-decoration: none; }
    
    /* Header */
    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--white);
      border-bottom: 1px solid var(--gray-200);
    }
    
    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .logo img { height: 32px; }
    
    .nav {
      display: flex;
      align-items: center;
      gap: 2rem;
    }
    
    .nav a {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--gray-700);
    }
    
    .nav a:hover { color: var(--black); }
    
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      border: none;
      cursor: pointer;
    }
    
    .btn-primary {
      background: var(--black);
      color: var(--white) !important;
    }
    
    /* Breadcrumb */
    .breadcrumb {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem 1.5rem;
      font-size: 0.875rem;
      color: var(--gray-500);
    }
    
    .breadcrumb a { color: var(--gray-500); }
    .breadcrumb a:hover { color: var(--gray-900); }
    .breadcrumb span { margin: 0 0.25rem; }
    
    /* Hero */
    .hero {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem 3rem;
    }
    
    .hero h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    
    .hero p {
      font-size: 1.1rem;
      color: var(--gray-600);
      margin-bottom: 1.5rem;
    }
    
    .stats {
      display: flex;
      gap: 2rem;
      font-size: 0.95rem;
    }
    
    .stat {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .stat strong {
      font-size: 1.25rem;
    }
    
    /* Filters */
    .filters {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem 1rem;
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    .filter-btn {
      padding: 0.5rem 1rem;
      border-radius: 100px;
      font-size: 0.875rem;
      font-weight: 500;
      border: 1px solid var(--gray-200);
      background: var(--white);
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .filter-btn:hover {
      border-color: var(--gray-300);
      background: var(--gray-50);
    }
    
    .filter-btn.active {
      background: var(--black);
      color: #171717;
      border-color: var(--black);
    }
    
    /* Shop List */
    .shop-list {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem 3rem;
    }
    
    .shop-card {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 1rem;
      padding: 1.25rem 0;
      border-bottom: 1px solid var(--gray-100);
      align-items: center;
    }
    
    .shop-card:last-child {
      border-bottom: none;
    }
    
    .shop-icon {
      font-size: 2rem;
    }
    
    .shop-info h3 {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    
    .shop-address {
      color: var(--gray-500);
      font-size: 0.95rem;
      margin-bottom: 0.5rem;
    }
    
    .shop-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.875rem;
    }
    
    .shop-status {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    
    .status-dot.open { background: var(--green-500); }
    .status-dot.closed { background: var(--red-500); }
    
    .shop-badges {
      display: flex;
      gap: 0.5rem;
    }
    
    .badge {
      padding: 0.25rem 0.5rem;
      background: var(--gray-100);
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    
    .badge-partner {
      background: #DCFCE7;
      color: #16A34A;
    }
    
    .shop-cta {
      text-align: right;
    }
    
    .shop-hours {
      font-size: 0.875rem;
      color: var(--gray-500);
      margin-bottom: 0.5rem;
    }
    
    .shop-wait {
      font-size: 0.875rem;
      color: var(--gray-600);
    }
    
    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      padding: 2rem 0;
    }
    
    .pagination a, .pagination span {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      height: 40px;
      padding: 0 0.75rem;
      border-radius: 8px;
      font-weight: 500;
      border: 1px solid var(--gray-200);
    }
    
    .pagination a:hover {
      background: var(--gray-50);
    }
    
    .pagination .current {
      background: var(--black);
      color: #171717;
      border-color: var(--black);
    }
    
    /* About Section */
    .about-section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      border-top: 1px solid var(--gray-200);
    }
    
    .about-section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }
    
    .about-section p {
      color: var(--gray-600);
      max-width: 800px;
    }
    
    /* CTA Section */
    .cta-section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
      text-align: center;
    }
    
    .cta-section h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
    
    .cta-section p {
      color: var(--gray-600);
      margin-bottom: 1.5rem;
    }
    
    .cta-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }
    
    .cta-buttons a {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
    }
    
    .cta-buttons .primary {
      background: var(--black);
      color: #171717;
    }
    
    .cta-buttons .secondary {
      border: 1px solid var(--gray-300);
    }
    
    /* Footer */
    .footer {
      background: #F5F1E8;
      color: #171717;
      padding: 4rem 1.5rem 2rem;
    }
    
    .footer-inner {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .footer-top {
      display: grid;
      grid-template-columns: 2fr repeat(4, 1fr);
      gap: 3rem;
      margin-bottom: 3rem;
    }
    
    .footer-brand img {
      height: 32px;
      margin-bottom: 1rem;
    }
    
    .footer-brand p {
      color: var(--gray-400);
      font-size: 0.95rem;
    }
    
    .footer-col h4 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--gray-300);
    }
    
    .footer-col ul { list-style: none; }
    .footer-col li { margin-bottom: 0.5rem; }
    .footer-col a { color: #525252; font-size: 0.875rem; }
    .footer-col a:hover { color: #171717; }
    
    .footer-bottom {
      padding-top: 2rem;
      border-top: 1px solid var(--gray-800);
      text-align: center;
      color: var(--gray-500);
      font-size: 0.875rem;
    }
    
    @media (max-width: 768px) {
      .nav { display: none; }
      .hero h1 { font-size: 1.75rem; }
      .stats { flex-wrap: wrap; gap: 1rem; }
      .shop-card { grid-template-columns: auto 1fr; }
      .shop-cta { display: none; }
      .footer-top { grid-template-columns: 1fr 1fr; gap: 2rem; }
    }
  </style>
<link rel="stylesheet" href="/includes/footer.css"></head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe">
        
      </a>
      <nav class="nav">
        <a href="/locations/">Locations</a>
        <a href="/#features">Features</a>
        <a href="/for-coffee-shops/">For Coffee Shops</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
    </div>
  </header>
  
  <nav class="breadcrumb">
    <a href="/">Home</a><span>›</span>
    <a href="/locations/">Locations</a><span>›</span>
    <a href="/locations/${stateCode}/">${stateName}</a><span>›</span>
    ${cityName}
  </nav>
  
  <section class="hero">
    <h1>Coffee Shops in ${cityName}</h1>
    <p>Order ahead at ${partnerCount} independent coffee shops in ${cityName}, ${stateName}. Skip the line, earn rewards, support local.</p>
    <div class="stats">
      <div class="stat"><strong>${totalCount}</strong> Shops</div>
      <div class="stat"><strong>${openCount}</strong> Open Now</div>
    </div>
  </section>
  
  <div class="filters">
    <button class="filter-btn ${!filter ? 'active' : ''}" onclick="location.href='${canonicalUrl}'">All Shops</button>
    <button class="filter-btn ${filter === 'open' ? 'active' : ''}" onclick="location.href='${canonicalUrl}?filter=open'">Open Now</button>
    <button class="filter-btn ${filter === 'partners' ? 'active' : ''}" onclick="location.href='${canonicalUrl}?filter=partners'">joe Partners</button>
  </div>
  
  <div class="shop-list">
    ${shops.map(shop => `
    <a href="/locations/${stateCode}/${citySlug}/${shop.slug}/" class="shop-card">
      <div class="shop-icon">☕</div>
      <div class="shop-info">
        <h3>${escapeHtml(shop.name)}</h3>
        <p class="shop-address">${escapeHtml(shop.address)}</p>
        <div class="shop-meta">
          <span class="shop-status">
            <span class="status-dot ${shop.is_open ? 'open' : 'closed'}"></span>
            ${shop.is_open ? 'Open' : 'Closed'}
          </span>
          <div class="shop-badges">
            ${shop.is_joe_partner ? '<span class="badge badge-partner">Order Ahead</span><span class="badge badge-partner">Rewards</span>' : ''}
            ${shop.google_rating ? `<span class="badge">★ ${shop.google_rating}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="shop-cta">
        ${shop.is_joe_partner ? `
        <div class="shop-hours">${getTodayHours(shop.hours) || ''}</div>
        <div class="shop-wait">~5 min</div>
        ` : `
        <div class="shop-hours">${shop.google_rating ? `★ ${shop.google_rating}` : ''}</div>
        `}
      </div>
    </a>
    `).join('')}
    
    ${totalPages > 1 ? `
    <nav class="pagination">
      ${pageNum > 1 ? `<a href="${canonicalUrl}${pageNum > 2 ? `?page=${pageNum-1}` : ''}">← Prev</a>` : ''}
      ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
        let p = pageNum <= 3 ? i + 1 : pageNum + i - 2;
        if (p < 1 || p > totalPages) return '';
        return p === pageNum 
          ? `<span class="current">${p}</span>`
          : `<a href="${canonicalUrl}?page=${p}">${p}</a>`;
      }).join('')}
      ${pageNum < totalPages ? `<a href="${canonicalUrl}?page=${pageNum+1}">Next →</a>` : ''}
    </nav>
    ` : ''}
  </div>
  
  <section class="about-section">
    <h2>About Coffee in ${cityName}</h2>
    <p>Discover the best independent coffee shops in ${cityName}, ${stateName}. With ${partnerCount} local cafes on joe, you can skip the line and earn rewards at your favorite spots. Order ahead through the joe app and support local roasters.</p>
  </section>
  
  <section class="cta-section">
    <h2>Ready to skip the line in ${cityName}?</h2>
    <p>Download joe and start earning rewards at your favorite coffee shops.</p>
    <div class="cta-buttons">
      <a href="https://get.joe.coffee" class="primary">Download for iOS</a>
      <a href="https://get.joe.coffee" class="secondary">Get on Android</a>
    </div>
  </section>
  
  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
</body>
</html>`;
}
function checkIfOpen(hours) {
  if (!hours) return false;
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  try {
    const h = typeof hours === 'string' ? JSON.parse(hours) : hours;
    const todayHours = h[today];
    if (!todayHours || todayHours.toLowerCase() === 'closed') return false;
    return true;
  } catch {
    return false;
  }
}

function getTodayHours(hours) {
  if (!hours) return null;
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  try {
    const h = typeof hours === 'string' ? JSON.parse(hours) : hours;
    return h[today] || null;
  } catch {
    return null;
  }
}

function formatCityName(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getStateName(code) {
  const states = {
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
    'dc': 'Washington D.C.'
  };
  return states[code?.toLowerCase()] || code?.toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function redirect(url) {
  return { statusCode: 301, headers: { Location: url }, body: '' };
}

function notFound(city, state) {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/html' },
    body: `<h1>No coffee shops found</h1><p><a href="/locations/${state}/">Back to ${getStateName(state)}</a></p>`
  };
}

function error500() {
  return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<h1>Server error</h1>' };
}
