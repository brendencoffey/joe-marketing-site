/**
 * Neighborhood Page - Enhanced SEO Version
 * URL: /locations/{state}/{city}/neighborhoods/{neighborhood}/
 * 
 * Includes: BreadcrumbList, FAQPage, Place schema, Open Graph, Twitter Cards
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

// Header HTML
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

// Footer HTML
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

// CSS
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

.page-header .description {
  margin-top: 1rem;
  color: var(--gray-600);
  line-height: 1.7;
  max-width: 800px;
}

/* Shops Grid */
.shops-grid {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.shop-card {
  background: var(--white);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--gray-200);
  transition: transform 0.2s, box-shadow 0.2s;
}

.shop-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.1);
}

.shop-photo {
  height: 200px;
  background-size: cover;
  background-position: center;
  background-color: var(--gray-100);
  position: relative;
}

.partner-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: #22c55e;
  color: var(--white);
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.shop-info {
  padding: 1.25rem;
}

.shop-info h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.shop-address {
  color: var(--gray-500);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.shop-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--gray-600);
}

.shop-meta .rating { color: #f59e0b; }

/* Other Neighborhoods */
.other-neighborhoods {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
}

.other-neighborhoods h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.neighborhoods-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.neighborhood-chip {
  background: var(--gray-100);
  padding: 0.5rem 1rem;
  border-radius: 100px;
  font-size: 0.875rem;
  color: var(--gray-700);
  transition: background 0.2s;
}

.neighborhood-chip:hover {
  background: var(--gray-200);
}

.neighborhood-chip .count {
  color: var(--gray-400);
  margin-left: 0.25rem;
}

/* FAQ Section */
.faq-section {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
}

.faq-section h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.faq-item {
  border-bottom: 1px solid var(--gray-200);
  padding: 1rem 0;
}

.faq-item:first-child {
  border-top: 1px solid var(--gray-200);
}

.faq-question {
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 0.5rem;
}

.faq-answer {
  color: var(--gray-600);
  font-size: 0.95rem;
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
  .shops-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .nav { display: none; }
  .mobile-menu-btn { display: flex; }
  
  .page-header h1 { font-size: 1.75rem; }
  
  .shops-grid { grid-template-columns: 1fr; }
  
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

// Generate all SEO schemas
function generateSchemas(neighborhoodName, cityName, stateCode, stateName, shops, description, pageUrl) {
  const schemas = [];
  
  // 1. BreadcrumbList Schema
  schemas.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://joe.coffee/" },
      { "@type": "ListItem", "position": 2, "name": "Locations", "item": "https://joe.coffee/locations/" },
      { "@type": "ListItem", "position": 3, "name": stateName, "item": `https://joe.coffee/locations/${stateCode}/` },
      { "@type": "ListItem", "position": 4, "name": cityName, "item": `https://joe.coffee/locations/${stateCode}/${slugify(cityName)}/` },
      { "@type": "ListItem", "position": 5, "name": "Neighborhoods", "item": `https://joe.coffee/locations/${stateCode}/${slugify(cityName)}/neighborhoods/` },
      { "@type": "ListItem", "position": 6, "name": neighborhoodName }
    ]
  });
  
  // 2. Place Schema (for local pack potential)
  schemas.push({
    "@context": "https://schema.org",
    "@type": "Place",
    "name": neighborhoodName,
    "description": description || `${neighborhoodName} is a neighborhood in ${cityName}, ${stateName} with ${shops.length} independent coffee shops.`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": cityName,
      "addressRegion": stateCode.toUpperCase(),
      "addressCountry": "US"
    },
    "containedInPlace": {
      "@type": "City",
      "name": cityName
    }
  });
  
  // 3. ItemList Schema (coffee shops)
  schemas.push({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Coffee Shops in ${neighborhoodName}`,
    "description": `${shops.length} independent coffee shops in ${neighborhoodName}`,
    "numberOfItems": shops.length,
    "itemListElement": shops.slice(0, 10).map((shop, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "CafeOrCoffeeShop",
        "name": shop.name,
        "address": { 
          "@type": "PostalAddress", 
          "streetAddress": shop.address, 
          "addressLocality": cityName, 
          "addressRegion": stateCode.toUpperCase() 
        },
        "aggregateRating": shop.google_rating ? { 
          "@type": "AggregateRating", 
          "ratingValue": shop.google_rating, 
          "reviewCount": shop.total_reviews || 1 
        } : undefined,
        "url": `https://joe.coffee/locations/${shop.state_code}/${shop.city_slug}/${shop.slug}/`
      }
    }))
  });
  
  // 4. FAQPage Schema
  const topShop = shops.find(s => s.google_rating) || shops[0];
  const partnerCount = shops.filter(s => s.is_joe_partner).length;
  
  schemas.push({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `How many coffee shops are in ${neighborhoodName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `There are ${shops.length} independent coffee shops in ${neighborhoodName}, ${cityName}.`
        }
      },
      {
        "@type": "Question",
        "name": `What is the best coffee shop in ${neighborhoodName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": topShop.google_rating 
            ? `${topShop.name} is highly rated with ${topShop.google_rating} stars from ${topShop.total_reviews || 'many'} reviews.`
            : `${topShop.name} is a popular local favorite in ${neighborhoodName}.`
        }
      },
      {
        "@type": "Question",
        "name": `Can I order ahead from coffee shops in ${neighborhoodName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": partnerCount > 0
            ? `Yes! ${partnerCount} coffee shop${partnerCount > 1 ? 's' : ''} in ${neighborhoodName} offer${partnerCount === 1 ? 's' : ''} mobile ordering through the joe app.`
            : `Some coffee shops in ${neighborhoodName} may offer mobile ordering. Download the joe app to discover which shops support order ahead.`
        }
      }
    ]
  });
  
  return schemas;
}

exports.handler = async (event) => {
  const path = event.path;
  const match = path.match(/\/locations\/([^\/]+)\/([^\/]+)\/neighborhoods\/([^\/]+)/);
  
  if (!match) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: '<h1>Not Found</h1>' };
  }
  
  const [, stateCode, citySlug, neighborhoodSlug] = match;
  const stateName = stateNames[stateCode.toLowerCase()] || stateCode.toUpperCase();
  
  try {
    // Get all shops in this city with neighborhoods
    const { data: shops, error } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, state_code, city_slug, neighborhood, google_rating, total_reviews, photos, is_joe_partner')
      .eq('state_code', stateCode.toLowerCase())
      .eq('city_slug', citySlug.toLowerCase())
      .eq('is_active', true)
      .not('neighborhood', 'is', null)
      .neq('neighborhood', '');
    
    if (error) throw error;
    
    // Filter by neighborhood slug
    const matchingShops = shops.filter(shop => slugify(shop.neighborhood) === neighborhoodSlug.toLowerCase());
    
    if (matchingShops.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: `<!DOCTYPE html><html><head><title>Not Found | joe</title>${getCSS()}</head><body>${getHeaderHTML()}<div class="page-content"><div class="page-header" style="text-align:center;padding-top:4rem"><h1>Neighborhood not found</h1><p>No coffee shops found in this neighborhood.</p><p style="margin-top:1rem"><a href="/locations/${stateCode}/${citySlug}/" style="color:var(--gray-900)">Browse all coffee shops →</a></p></div></div>${getFooterHTML()}${getScript()}</body></html>`
      };
    }
    
    const neighborhoodName = matchingShops[0].neighborhood;
    const cityName = matchingShops[0].city;
    const pageUrl = `https://joe.coffee/locations/${stateCode}/${citySlug}/neighborhoods/${neighborhoodSlug}/`;
    
    // Sort shops: partners first, then by rating
    matchingShops.sort((a, b) => {
      if (a.is_joe_partner && !b.is_joe_partner) return -1;
      if (!a.is_joe_partner && b.is_joe_partner) return 1;
      return (b.google_rating || 0) - (a.google_rating || 0);
    });
    
    // Get other neighborhoods
    const neighborhoodCounts = {};
    shops.forEach(shop => {
      const slug = slugify(shop.neighborhood);
      if (!neighborhoodCounts[slug]) neighborhoodCounts[slug] = { name: shop.neighborhood, count: 0 };
      neighborhoodCounts[slug].count++;
    });
    
    const otherNeighborhoods = Object.entries(neighborhoodCounts)
      .filter(([slug]) => slug !== neighborhoodSlug.toLowerCase())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    
    // Try to get neighborhood description
    let description = '';
    try {
      const { data: neighborhoodData } = await supabase
        .from('neighborhoods')
        .select('description')
        .eq('state_code', stateCode.toLowerCase())
        .eq('city_slug', citySlug.toLowerCase())
        .eq('neighborhood_slug', neighborhoodSlug.toLowerCase())
        .single();
      description = neighborhoodData?.description || '';
    } catch (e) {}
    
    // Generate all schemas
    const schemas = generateSchemas(neighborhoodName, cityName, stateCode, stateName, matchingShops, description, pageUrl);
    const schemasJSON = schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n  ');
    
    // Get hero image from top shop
    const heroImage = matchingShops.find(s => s.photos?.[0])?.photos?.[0] || 'https://joe.coffee/images/coffee-hero.jpg';
    
    // Build shop cards
    const shopCardsHtml = matchingShops.map(shop => {
      const photo = shop.photos?.[0] || '';
      const photoStyle = photo ? `background-image: url('${photo}')` : '';
      const rating = shop.google_rating ? `<span class="rating">★ ${shop.google_rating}</span>` : '';
      const reviews = shop.total_reviews ? `<span>(${shop.total_reviews})</span>` : '';
      const badge = shop.is_joe_partner ? '<span class="partner-badge">joe partner</span>' : '';
      
      return `
        <a href="/locations/${shop.state_code}/${shop.city_slug}/${shop.slug}/" class="shop-card">
          <div class="shop-photo" style="${photoStyle}">${badge}</div>
          <div class="shop-info">
            <h3>${shop.name}</h3>
            <p class="shop-address">${shop.address || ''}</p>
            <div class="shop-meta">${rating}${reviews}</div>
          </div>
        </a>
      `;
    }).join('');
    
    const otherNeighborhoodsHtml = otherNeighborhoods.length > 0 ? `
      <div class="other-neighborhoods">
        <h2>More Neighborhoods in ${cityName}</h2>
        <div class="neighborhoods-list">
          ${otherNeighborhoods.map(([slug, data]) => `
            <a href="/locations/${stateCode}/${citySlug}/neighborhoods/${slug}/" class="neighborhood-chip">
              ${data.name} <span class="count">(${data.count})</span>
            </a>
          `).join('')}
        </div>
      </div>
    ` : '';
    
    // FAQ Section HTML
    const topShop = matchingShops.find(s => s.google_rating) || matchingShops[0];
    const partnerCount = matchingShops.filter(s => s.is_joe_partner).length;
    
    const faqHtml = `
      <div class="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-item">
          <div class="faq-question">How many coffee shops are in ${neighborhoodName}?</div>
          <div class="faq-answer">There are ${matchingShops.length} independent coffee shops in ${neighborhoodName}, ${cityName}.</div>
        </div>
        <div class="faq-item">
          <div class="faq-question">What is the best coffee shop in ${neighborhoodName}?</div>
          <div class="faq-answer">${topShop.google_rating 
            ? `${topShop.name} is highly rated with ${topShop.google_rating} stars from ${topShop.total_reviews || 'many'} reviews.`
            : `${topShop.name} is a popular local favorite in ${neighborhoodName}.`}</div>
        </div>
        <div class="faq-item">
          <div class="faq-question">Can I order ahead from coffee shops in ${neighborhoodName}?</div>
          <div class="faq-answer">${partnerCount > 0
            ? `Yes! ${partnerCount} coffee shop${partnerCount > 1 ? 's' : ''} in ${neighborhoodName} offer${partnerCount === 1 ? 's' : ''} mobile ordering through the joe app.`
            : `Some coffee shops in ${neighborhoodName} may offer mobile ordering. Download the joe app to discover which shops support order ahead.`}</div>
        </div>
      </div>
    `;
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Shops in ${neighborhoodName} | joe coffee</title>
  <meta name="description" content="Discover ${matchingShops.length} independent coffee shops in ${neighborhoodName}. ${description ? description.substring(0, 120) : 'Find the best local coffee near you.'}">
  <link rel="canonical" href="${pageUrl}">
  <link rel="icon" href="/favicon.ico">
  
  <!-- Open Graph -->
  <meta property="og:title" content="Coffee Shops in ${neighborhoodName}">
  <meta property="og:description" content="${matchingShops.length} independent coffee shops to explore">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${heroImage}">
  <meta property="og:site_name" content="joe coffee">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Coffee Shops in ${neighborhoodName}">
  <meta name="twitter:description" content="${matchingShops.length} independent coffee shops to explore">
  <meta name="twitter:image" content="${heroImage}">
  
  <!-- Geo Tags -->
  <meta name="geo.region" content="US-${stateCode.toUpperCase()}">
  <meta name="geo.placename" content="${neighborhoodName}, ${cityName}">
  
  <!-- Structured Data -->
  ${schemasJSON}
  
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
      <a href="/locations/${stateCode}/${citySlug}/neighborhoods/">Neighborhoods</a> › 
      ${neighborhoodName}
    </div>
    <div class="page-header">
      <h1>Coffee Shops in ${neighborhoodName}</h1>
      <p>${matchingShops.length} independent coffee shop${matchingShops.length !== 1 ? 's' : ''} to explore</p>
      ${description ? `<p class="description">${description}</p>` : ''}
    </div>
    <div class="shops-grid">${shopCardsHtml}</div>
    ${otherNeighborhoodsHtml}
    ${faqHtml}
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
