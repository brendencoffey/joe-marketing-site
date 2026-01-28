/**
 * Neighborhoods Index - List of neighborhoods in a city
 * URL: /locations/{state}/{city}/neighborhoods/
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Slugify helper
const slugify = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
};

// State names
const stateNames = {
  al: 'Alabama', ak: 'Alaska', az: 'Arizona', ar: 'Arkansas', ca: 'California',
  co: 'Colorado', ct: 'Connecticut', de: 'Delaware', dc: 'Washington DC', fl: 'Florida',
  ga: 'Georgia', hi: 'Hawaii', id: 'Idaho', il: 'Illinois', in: 'Indiana',
  ia: 'Iowa', ks: 'Kansas', ky: 'Kentucky', la: 'Louisiana', me: 'Maine',
  md: 'Maryland', ma: 'Massachusetts', mi: 'Michigan', mn: 'Minnesota', ms: 'Mississippi',
  mo: 'Missouri', mt: 'Montana', ne: 'Nebraska', nv: 'Nevada', nh: 'New Hampshire',
  nj: 'New Jersey', nm: 'New Mexico', ny: 'New York', nc: 'North Carolina', nd: 'North Dakota',
  oh: 'Ohio', ok: 'Oklahoma', or: 'Oregon', pa: 'Pennsylvania', ri: 'Rhode Island',
  sc: 'South Carolina', sd: 'South Dakota', tn: 'Tennessee', tx: 'Texas', ut: 'Utah',
  vt: 'Vermont', va: 'Virginia', wa: 'Washington', wv: 'West Virginia', wi: 'Wisconsin', wy: 'Wyoming'
};

// Header HTML (from homepage)
const getHeaderHTML = () => `
<header class="header scrolled" id="header">
  <div class="header-inner">
    <a href="/" class="logo">
      <img src="/images/logo.png" alt="joe">
    </a>
    <nav class="nav">
      <a href="/locations/">Find Coffee</a>
      <a href="/for-coffee-shops/">For Coffee Shops</a>
      <a href="/about/">About</a>
      <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
    </nav>
    <div class="mobile-menu-btn" id="mobileMenuBtn">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
</header>
<div class="mobile-menu" id="mobileMenu">
  <div class="mobile-menu-header">
    <img src="/images/logo.png" alt="joe">
    <div class="mobile-menu-close" id="mobileMenuClose">✕</div>
  </div>
  <a href="/locations/">Find Coffee</a>
  <a href="/for-coffee-shops/">For Coffee Shops</a>
  <a href="/about/">About</a>
  <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
</div>
`;

// Footer HTML (from footer.njk)
const getFooterHTML = () => `
<footer class="footer">
  <div class="footer-inner">
    <div class="footer-top">
      <div class="footer-brand">
        <div class="footer-logo">
          <img src="/images/logo.png" alt="joe">
        </div>
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
`;

// CSS from footer.njk + page-specific styles
const getCSS = () => `
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
}

html { scroll-behavior: smooth; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--white);
  color: var(--gray-900);
  line-height: 1.6;
}

a { color: inherit; text-decoration: none; }

/* Header */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: transparent;
  transition: background 0.3s, box-shadow 0.3s;
}

.header.scrolled {
  background: var(--white);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo { display: flex; align-items: center; }
.logo img { height: 40px; width: auto; }

.nav {
  display: flex;
  align-items: center;
  gap: 2.5rem;
}

.nav a {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--gray-700);
  transition: color 0.3s;
}

.nav a:hover { color: var(--black); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 100px;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.btn-primary { background: var(--black); color: var(--white) !important; }
.btn-primary:hover { background: var(--gray-800); }

/* Mobile Menu */
.mobile-menu-btn {
  display: none;
  flex-direction: column;
  gap: 5px;
  cursor: pointer;
  padding: 5px;
}

.mobile-menu-btn span {
  width: 24px;
  height: 2px;
  background: var(--gray-900);
  transition: all 0.3s;
}

.mobile-menu {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--white);
  z-index: 200;
  flex-direction: column;
  padding: 1.5rem;
}

.mobile-menu.active { display: flex; }

.mobile-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.mobile-menu-header img { height: 40px; }

.mobile-menu-close {
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
}

.mobile-menu > a {
  padding: 1rem 0;
  font-size: 1.1rem;
  font-weight: 500;
  border-bottom: 1px solid var(--gray-200);
}

.mobile-menu .btn {
  margin-top: 1rem;
  text-align: center;
}

/* Page Content */
.page-content {
  padding-top: 80px;
}

.breadcrumb {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 0;
  font-size: 0.875rem;
  color: var(--gray-500);
}

.breadcrumb a { color: var(--gray-500); }
.breadcrumb a:hover { color: var(--gray-900); text-decoration: underline; }

.page-header {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.page-header p {
  color: var(--gray-600);
  font-size: 1.1rem;
}

/* Neighborhoods Grid */
.neighborhoods-grid {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.neighborhood-card {
  background: var(--white);
  border-radius: 16px;
  padding: 1.75rem;
  border: 1px solid var(--gray-200);
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.neighborhood-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.08);
  border-color: var(--gray-300);
}

.neighborhood-card h3 {
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--gray-900);
}

.neighborhood-card p {
  color: var(--gray-500);
  font-size: 0.9rem;
}

/* Back Link */
.back-link {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
}

.back-link a {
  color: var(--gray-600);
  font-size: 0.95rem;
}

.back-link a:hover {
  color: var(--gray-900);
  text-decoration: underline;
}

/* Footer */
.footer {
  background: var(--gray-50);
  border-top: 1px solid var(--gray-200);
  padding: 4rem 1.5rem 2rem;
}

.footer-inner {
  max-width: 1280px;
  margin: 0 auto;
}

.footer-top {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

.footer-brand p {
  color: var(--gray-600);
  margin: 1rem 0;
  font-size: 0.95rem;
}

.footer-logo img { height: 40px; }

.footer-social {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--gray-600);
  font-size: 0.9rem;
}

.footer-social svg { width: 20px; height: 20px; }

.footer-col h4 {
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--gray-900);
}

.footer-col ul { list-style: none; }

.footer-col li { margin-bottom: 0.75rem; }

.footer-col a {
  color: var(--gray-600);
  font-size: 0.95rem;
  transition: color 0.2s;
}

.footer-col a:hover { color: var(--gray-900); }

.footer-cities {
  padding: 2rem 0;
  border-top: 1px solid var(--gray-200);
  border-bottom: 1px solid var(--gray-200);
  margin-bottom: 2rem;
}

.footer-cities h4 {
  font-weight: 600;
  margin-bottom: 1rem;
}

.footer-cities-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}

.footer-cities-grid a {
  color: var(--gray-600);
  font-size: 0.9rem;
}

.footer-cities .view-all {
  display: inline-block;
  margin-top: 1rem;
  color: var(--gray-900);
  font-weight: 500;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--gray-500);
  font-size: 0.875rem;
}

.footer-bottom svg {
  width: 14px;
  height: 14px;
  color: #ef4444;
  vertical-align: middle;
}

/* Mobile */
@media (max-width: 1024px) {
  .neighborhoods-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .nav { display: none; }
  .mobile-menu-btn { display: flex; }
  
  .page-header h1 { font-size: 1.75rem; }
  
  .neighborhoods-grid { grid-template-columns: 1fr; }
  
  .footer-top {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  
  .footer-bottom {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
}
</style>
`;

// Mobile menu script
const getScript = () => `
<script>
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenuClose = document.getElementById('mobileMenuClose');
  const mobileMenu = document.getElementById('mobileMenu');
  
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.add('active'));
  }
  if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', () => mobileMenu.classList.remove('active'));
  }
</script>
`;

exports.handler = async (event) => {
  const path = event.path;
  const match = path.match(/\/locations\/([^\/]+)\/([^\/]+)\/neighborhoods\/?$/);
  
  if (!match) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: '<h1>Not Found</h1>' };
  }
  
  const [, stateCode, citySlug] = match;
  const stateName = stateNames[stateCode.toLowerCase()] || stateCode.toUpperCase();
  
  try {
    const { data: shops, error } = await supabase
      .from('shops')
      .select('id, name, city, neighborhood')
      .eq('state_code', stateCode.toLowerCase())
      .eq('city_slug', citySlug.toLowerCase())
      .eq('is_active', true)
      .not('neighborhood', 'is', null)
      .neq('neighborhood', '');
    
    if (error) throw error;
    
    if (shops.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: `<!DOCTYPE html><html><head><title>No neighborhoods | joe</title>${getCSS()}</head><body>${getHeaderHTML()}<div class="page-content"><div class="page-header" style="text-align:center;padding-top:4rem"><h1>No neighborhoods found</h1><p>No neighborhoods with coffee shops in this city yet.</p><p style="margin-top:1rem"><a href="/locations/${stateCode}/${citySlug}/" style="color:var(--gray-900)">Browse all coffee shops →</a></p></div></div>${getFooterHTML()}${getScript()}</body></html>`
      };
    }
    
    const cityName = shops[0].city;
    
    // Count shops per neighborhood
    const neighborhoodCounts = {};
    shops.forEach(shop => {
      const slug = slugify(shop.neighborhood);
      if (!neighborhoodCounts[slug]) neighborhoodCounts[slug] = { name: shop.neighborhood, count: 0 };
      neighborhoodCounts[slug].count++;
    });
    
    const sortedNeighborhoods = Object.entries(neighborhoodCounts).sort((a, b) => b[1].count - a[1].count);
    
    const neighborhoodCardsHtml = sortedNeighborhoods.map(([slug, data]) => `
      <a href="/locations/${stateCode}/${citySlug}/neighborhoods/${slug}/" class="neighborhood-card">
        <h3>${data.name}</h3>
        <p>${data.count} coffee shop${data.count !== 1 ? 's' : ''}</p>
      </a>
    `).join('');
    
    // SEO Schema
    const schemaJSON = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": `Coffee Shop Neighborhoods in ${cityName}, ${stateName}`,
      "numberOfItems": sortedNeighborhoods.length,
      "itemListElement": sortedNeighborhoods.slice(0, 20).map(([slug, data], i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Place",
          "name": data.name,
          "url": `https://joe.coffee/locations/${stateCode}/${citySlug}/neighborhoods/${slug}/`
        }
      }))
    });
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shop Neighborhoods in ${cityName}, ${stateName} | joe coffee</title>
  <meta name="description" content="Explore ${sortedNeighborhoods.length} neighborhoods with independent coffee shops in ${cityName}, ${stateName}.">
  <link rel="canonical" href="https://joe.coffee/locations/${stateCode}/${citySlug}/neighborhoods/">
  <link rel="icon" href="/favicon.ico">
  <script type="application/ld+json">${schemaJSON}</script>
  ${getCSS()}
</head>
<body>
  ${getHeaderHTML()}
  <div class="page-content">
    <div class="breadcrumb">
      <a href="/">Home</a> › 
      <a href="/locations/">Locations</a> › 
      <a href="/locations/${stateCode}/">${stateName}</a> › 
      <a href="/locations/${stateCode}/${citySlug}/">${cityName}</a> › 
      Neighborhoods
    </div>
    <div class="page-header">
      <h1>Coffee Shop Neighborhoods in ${cityName}</h1>
      <p>Explore ${sortedNeighborhoods.length} neighborhoods with ${shops.length} independent coffee shops</p>
    </div>
    <div class="neighborhoods-grid">${neighborhoodCardsHtml}</div>
    <div class="back-link"><a href="/locations/${stateCode}/${citySlug}/">← Back to all ${cityName} coffee shops</a></div>
  </div>
  ${getFooterHTML()}
  ${getScript()}
</body>
</html>`;
    
    return { statusCode: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' }, body: html };
    
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: `<h1>Error</h1><p>${error.message}</p>` };
  }
};
