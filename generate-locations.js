const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const OUTPUT_DIR = './locations';

// Supabase config (public/anon key - safe for client-side)
const SUPABASE_URL = 'https://vpnoaxpmhuknyaxcyxsu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbm9heHBtaHVrbnlheGN5eHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NjkzNTMsImV4cCI6MjA4MjQ0NTM1M30.0JVwCaY-3nUHuJk49ibifQviT0LxBSdYXMslw9WIr9M';

// State abbreviation to full name mapping
const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois',
  'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
  'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
  'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
  'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
  'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
  'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

// Gradient colors for shop icons
const GRADIENTS = [
  'from-amber-600 to-orange-700',
  'from-blue-600 to-indigo-700',
  'from-purple-600 to-pink-600',
  'from-emerald-600 to-teal-700',
  'from-red-600 to-rose-700',
  'from-gray-700 to-gray-900',
  'from-cyan-600 to-blue-700',
  'from-fuchsia-600 to-purple-700',
  'from-lime-600 to-green-700',
  'from-orange-600 to-red-700'
];

// Popular cities for the index page
const POPULAR_CITIES = [
  { city: 'Seattle', state: 'WA', gradient: 'from-emerald-800 to-teal-900' },
  { city: 'Los Angeles', state: 'CA', gradient: 'from-amber-800 to-orange-900' },
  { city: 'Chicago', state: 'IL', gradient: 'from-blue-800 to-indigo-900' },
  { city: 'Portland', state: 'OR', gradient: 'from-purple-800 to-pink-900' },
  { city: 'New York', state: 'NY', gradient: 'from-gray-800 to-gray-950' },
  { city: 'San Francisco', state: 'CA', gradient: 'from-red-800 to-rose-900' },
  { city: 'Denver', state: 'CO', gradient: 'from-cyan-800 to-blue-900' },
  { city: 'Austin', state: 'TX', gradient: 'from-orange-800 to-red-900' },
  { city: 'Boston', state: 'MA', gradient: 'from-emerald-600 to-teal-700' },
  { city: 'Miami', state: 'FL', gradient: 'from-pink-600 to-rose-700' }
];

// ============================================
// SUPABASE FETCH
// ============================================

async function fetchAllShops() {
  const PAGE_SIZE = 1000;
  let allShops = [];
  let offset = 0;
  let hasMore = true;

  console.log('📡 Fetching shops from Supabase...');

  while (hasMore) {
    const url = `${SUPABASE_URL}/rest/v1/shops?select=id,name,slug,address,city,city_slug,state,state_code,zip,lat,lng,phone,website,email,google_rating,yelp_rating,combined_rating,google_reviews,yelp_reviews,total_reviews,is_joe_partner,ordering_url,description,hours,photos,yelp_photos,amenities,neighborhood,categories,price_range,claim_status,banner_image,is_roaster,has_ecommerce,about_business,review_highlights,facebook_url,instagram_url,twitter_url,tiktok_url,menu_url&order=name.asc&limit=${PAGE_SIZE}&offset=${offset}`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase fetch failed: ${response.status} ${response.statusText}`);
    }

    const shops = await response.json();
    allShops = allShops.concat(shops);
    
    console.log(`   Fetched ${allShops.length} shops...`);
    
    if (shops.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  return allShops;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function getGradient(index) {
  return GRADIENTS[index % GRADIENTS.length];
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatHours(hoursJson) {
  if (!hoursJson) return null;
  
  // Handle various hour formats from enrichment
  if (typeof hoursJson === 'string') {
    try {
      hoursJson = JSON.parse(hoursJson);
    } catch (e) {
      return null;
    }
  }
  
  return hoursJson;
}

function getTodayHours(hoursJson) {
  const hours = formatHours(hoursJson);
  if (!hours) return 'Hours not available';
  
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  
  if (hours[today]) {
    const h = hours[today];
    if (h.is_closed) return 'Closed today';
    if (h.open && h.close) return `${h.open} – ${h.close}`;
    if (typeof h === 'string') return h;
  }
  
  return 'Hours vary';
}

function isOpenNow(hoursJson) {
  // Simplified check - in production would use actual time comparison
  const hours = formatHours(hoursJson);
  if (!hours) return false;
  
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  
  if (hours[today]?.is_closed) return false;
  if (hours[today]?.open) return true;
  
  return false;
}

function getRatingDisplay(shop) {
  const rating = shop.combined_rating || shop.google_rating || shop.yelp_rating;
  if (!rating) return null;
  
  const reviews = shop.total_reviews || shop.google_reviews || shop.yelp_reviews || 0;
  return { rating: parseFloat(rating).toFixed(1), reviews };
}

function getPriceDisplay(priceRange) {
  if (!priceRange) return null;
  const count = (priceRange.match(/\$/g) || []).length;
  return count > 0 ? '$'.repeat(count) : priceRange;
}

function getPhotoUrl(shop) {
  // Priority: banner_image > photos[0] > yelp_photos[0] > placeholder
  if (shop.banner_image) return shop.banner_image;
  if (shop.photos && shop.photos.length > 0) return shop.photos[0];
  if (shop.yelp_photos && shop.yelp_photos.length > 0) return shop.yelp_photos[0];
  return null;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanWebsiteUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// ============================================
// TEMPLATE FUNCTIONS
// ============================================

function getNavHTML() {
  return `
  <nav class="fixed top-0 left-0 right-0 z-50 bg-white/95 nav-blur border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/" class="flex items-center">
        <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe coffee" class="h-10">
      </a>
      <div class="hidden md:flex items-center gap-8 text-sm text-gray-600">
        <a href="/locations/" class="hover:text-black">Locations</a>
        <a href="/marketplace/" class="hover:text-black">Marketplace</a>
        <a href="/for-coffee-shops/" class="hover:text-black">For Coffee Shops</a>
      </div>
      <a href="https://get.joe.coffee" class="bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800">
        Get the App
      </a>
    </div>
  </nav>`;
}

function getFooterHTML(currentCity = '') {
  return `
  <footer class="site-footer">
    <div class="max-w-6xl mx-auto px-6 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" class="h-8 mb-4">
          <p class="text-gray-600 text-sm">The #1 app for indie coffee lovers. Skip the line, earn rewards, support local.</p>
        </div>
        <div>
          <h4 class="font-bold text-sm text-black mb-4">For Shops</h4>
          <ul class="space-y-2">
            <li><a href="/for-coffee-shops/#platform" class="footer-link">Platform</a></li>
            <li><a href="/for-coffee-shops/#loyalty" class="footer-link">Loyalty Program</a></li>
            <li><a href="/for-coffee-shops/#pricing" class="footer-link">Pricing</a></li>
            <li><a href="/for-coffee-shops/#join" class="footer-link">Join the Movement</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-sm text-black mb-4">Resources</h4>
          <ul class="space-y-2">
            <li><a href="/blog/" class="footer-link">Industry Blog</a></li>
            <li><a href="https://support.joe.coffee" class="footer-link">Support & FAQs</a></li>
            <li><a href="https://manage.joe.coffee/login" class="footer-link">Owner Login</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-sm text-black mb-4">Company</h4>
          <ul class="space-y-2">
            <li><a href="/for-coffee-shops/#about" class="footer-link">Mission & Values</a></li>
            <li><a href="/terms/" class="footer-link">Terms and Conditions</a></li>
            <li><a href="/privacy/" class="footer-link">Privacy Policy</a></li>
            <li><a href="/marketplace/" class="footer-link">Shop Coffee</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="border-t border-gray-200">
      <div class="max-w-6xl mx-auto px-6 py-8">
        <h4 class="font-bold text-sm text-black mb-4 uppercase tracking-wide">Coffee Shops by City</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
          <a href="/locations/wa/seattle/" class="footer-link ${currentCity === 'Seattle' ? 'font-medium text-black' : ''}">Seattle</a>
          <a href="/locations/ca/los-angeles/" class="footer-link ${currentCity === 'Los Angeles' ? 'font-medium text-black' : ''}">Los Angeles</a>
          <a href="/locations/il/chicago/" class="footer-link ${currentCity === 'Chicago' ? 'font-medium text-black' : ''}">Chicago</a>
          <a href="/locations/or/portland/" class="footer-link ${currentCity === 'Portland' ? 'font-medium text-black' : ''}">Portland</a>
          <a href="/locations/ny/new-york/" class="footer-link ${currentCity === 'New York' ? 'font-medium text-black' : ''}">New York</a>
          <a href="/locations/ca/san-francisco/" class="footer-link ${currentCity === 'San Francisco' ? 'font-medium text-black' : ''}">San Francisco</a>
          <a href="/locations/co/denver/" class="footer-link ${currentCity === 'Denver' ? 'font-medium text-black' : ''}">Denver</a>
          <a href="/locations/tx/austin/" class="footer-link ${currentCity === 'Austin' ? 'font-medium text-black' : ''}">Austin</a>
          <a href="/locations/ma/boston/" class="footer-link ${currentCity === 'Boston' ? 'font-medium text-black' : ''}">Boston</a>
          <a href="/locations/fl/miami/" class="footer-link ${currentCity === 'Miami' ? 'font-medium text-black' : ''}">Miami</a>
          <a href="/locations/az/phoenix/" class="footer-link ${currentCity === 'Phoenix' ? 'font-medium text-black' : ''}">Phoenix</a>
          <a href="/locations/ga/atlanta/" class="footer-link ${currentCity === 'Atlanta' ? 'font-medium text-black' : ''}">Atlanta</a>
        </div>
        <a href="/locations/" class="text-black font-semibold text-sm hover:underline">View All Locations →</a>
      </div>
    </div>
    <div class="border-t border-gray-200">
      <div class="max-w-6xl mx-auto px-6 py-4 text-center text-gray-500 text-sm">
        © ${new Date().getFullYear()} joe Coffee. All rights reserved. | Crafted with ❤️ for indie coffee
      </div>
    </div>
  </footer>`;
}

function getHeadHTML(title, description, canonicalUrl, extraMeta = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  
  <link rel="canonical" href="${canonicalUrl}">
  ${extraMeta}
  
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
  
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .nav-blur { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .shop-card { background: white; border: 1px solid #e5e5e5; border-radius: 16px; overflow: hidden; transition: all 0.2s ease; }
    .shop-card:hover { border-color: #d4d4d4; box-shadow: 0 8px 30px rgba(0,0,0,0.08); transform: translateY(-2px); }
    .status-open { background: #dcfce7; color: #166534; }
    .status-closed { background: #f3f4f6; color: #6b7280; }
    .tag { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #f5f5f5; border-radius: 100px; font-size: 12px; color: #525252; }
    .tag-partner { background: #fef3c7; color: #92400e; }
    .filter-btn { padding: 8px 16px; border-radius: 100px; font-size: 14px; font-weight: 500; transition: all 0.15s; cursor: pointer; white-space: nowrap; }
    .filter-btn.active { background: #171717; color: white; }
    .filter-btn:not(.active) { background: #f5f5f5; color: #525252; }
    .filter-btn:not(.active):hover { background: #e5e5e5; }
    .site-footer { background: #F5F1E8; }
    .footer-link { color: #525252; text-decoration: none; font-size: 14px; }
    .footer-link:hover { color: #171717; }
    .state-card { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px; transition: all 0.2s ease; display: block; text-decoration: none; color: inherit; }
    .state-card:hover { border-color: #d4d4d4; box-shadow: 0 4px 20px rgba(0,0,0,0.06); transform: translateY(-2px); }
    .city-link { color: #525252; text-decoration: none; font-size: 14px; transition: color 0.15s; }
    .city-link:hover { color: #000; }
    .nearby-city { background: #f9fafb; border-radius: 12px; padding: 16px; text-align: center; transition: background 0.15s; }
    .nearby-city:hover { background: #f3f4f6; }
    .info-card { background: white; border: 1px solid #e5e5e5; border-radius: 16px; padding: 24px; }
    .order-btn { display: block; width: 100%; padding: 16px 24px; background: #000; color: #fff; text-align: center; border-radius: 12px; font-weight: 600; font-size: 16px; transition: background 0.15s; text-decoration: none; }
    .order-btn:hover { background: #333; }
    .claim-btn { display: block; width: 100%; padding: 16px 24px; background: #f5f5f5; color: #171717; text-align: center; border-radius: 12px; font-weight: 600; font-size: 16px; transition: all 0.15s; text-decoration: none; border: 2px solid #e5e5e5; }
    .claim-btn:hover { background: #e5e5e5; border-color: #d4d4d4; }
    .other-shop { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; transition: all 0.15s; }
    .other-shop:hover { border-color: #d4d4d4; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    
    /* Products Section */
    .products-scroll { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
    .products-scroll::-webkit-scrollbar { height: 6px; }
    .products-scroll::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
    .products-scroll::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
    .products-scroll::-webkit-scrollbar-thumb:hover { background: #aaa; }
    .product-card { flex: 0 0 200px; scroll-snap-align: start; background: white; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; transition: all 0.2s; text-decoration: none; color: inherit; }
    .product-card:hover { border-color: #d4d4d4; box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-2px); }
    .product-card img { width: 100%; height: 150px; object-fit: cover; }
    .product-info { padding: 12px; }
    .product-name { font-weight: 600; font-size: 14px; color: #171717; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .product-tag { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .product-price { font-weight: 700; font-size: 16px; color: #171717; }
    #products-section { display: none; }
    #products-section.loaded { display: block; }
    
    /* Photo gallery */
    .photo-gallery { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; }
    .photo-gallery img { height: 200px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
    
    /* Star rating */
    .star-rating { color: #f59e0b; }
    
    /* Hours table */
    .hours-table { font-size: 14px; }
    .hours-table td { padding: 4px 0; }
    .hours-table td:first-child { font-weight: 500; padding-right: 16px; }
    
    /* Amenities */
    .amenity-tag { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; background: #f0fdf4; color: #166534; border-radius: 100px; font-size: 12px; font-weight: 500; }
    
    /* Hero image */
    .hero-image { height: 300px; background-size: cover; background-position: center; border-radius: 16px; position: relative; overflow: hidden; }
    .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6), transparent); }
  </style>
</head>`;
}

// ============================================
// PAGE GENERATORS
// ============================================

function generateIndexPage(stateData, totalShops, totalCities) {
  const title = 'Find Coffee Shops Near You | joe coffee';
  const description = `Discover ${totalShops.toLocaleString()}+ independent coffee shops across the US. Order ahead, skip the line, and earn rewards at local favorites.`;
  const canonicalUrl = 'https://joe.coffee/locations/';

  // Build state cards
  let stateCardsHTML = '';
  const sortedStates = Object.keys(stateData).sort((a, b) => stateData[b].shops.length - stateData[a].shops.length);
  const validStates = sortedStates.filter(s => s && STATE_NAMES[s.toUpperCase()]);

  for (const stateCode of validStates.slice(0, 12)) {
    const state = stateData[stateCode];
    const stateName = STATE_NAMES[stateCode.toUpperCase()] || stateCode;
    const cities = Object.keys(state.cities).slice(0, 5);
    const moreCities = Object.keys(state.cities).length - 5;
    const partnerCount = state.shops.filter(s => s.is_joe_partner).length;

    stateCardsHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/" class="state-card block">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-lg">${stateName}</h3>
            <span class="text-sm text-gray-500">${state.shops.length.toLocaleString()} shops</span>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-2">
            ${cities.join(', ')}${moreCities > 0 ? `, +${moreCities} more` : ''}
          </div>
          ${partnerCount > 0 ? `<div class="text-xs text-amber-700">${partnerCount} with Order Ahead</div>` : ''}
        </a>`;
  }

  // Build popular cities
  let popularCitiesHTML = '';
  for (const pc of POPULAR_CITIES) {
    const stateCode = pc.state.toLowerCase();
    const citySlug = slugify(pc.city);
    
    let shopCount = 0;
    if (stateData[stateCode]?.cities) {
      const cityKey = Object.keys(stateData[stateCode].cities).find(
        c => c.toLowerCase() === pc.city.toLowerCase()
      );
      if (cityKey) {
        shopCount = stateData[stateCode].cities[cityKey].length;
      }
    }
    
    if (shopCount > 0) {
      popularCitiesHTML += `
        <a href="/locations/${stateCode}/${citySlug}/" class="bg-black text-white rounded-2xl p-5 hover:bg-gray-800 transition-colors">
          <p class="font-bold text-lg">${pc.city}</p>
          <p class="text-gray-400 text-sm">${shopCount.toLocaleString()} shops</p>
        </a>`;
    }
  }

  const totalPartners = Object.values(stateData).reduce((sum, state) => 
    sum + state.shops.filter(s => s.is_joe_partner).length, 0
  );

  const html = `${getHeadHTML(title, description, canonicalUrl)}
<body class="min-h-screen bg-white text-gray-900">
  ${getNavHTML()}

  <div class="pt-24 pb-4 border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <nav class="text-sm text-gray-500" aria-label="Breadcrumb">
        <a href="/" class="hover:text-black">Home</a>
        <span class="mx-2">›</span>
        <span class="text-gray-900 font-medium">Locations</span>
      </nav>
    </div>
  </div>

  <section class="py-12 bg-gradient-to-b from-gray-50 to-white">
    <div class="max-w-6xl mx-auto px-6">
      <div class="max-w-2xl">
        <h1 class="text-4xl md:text-5xl font-bold text-black mb-4">Find Coffee Shops Near You</h1>
        <p class="text-lg text-gray-600 mb-6">Discover ${totalShops.toLocaleString()}+ independent coffee shops across the US. Order ahead, skip the line, and earn rewards at local favorites.</p>
        <div class="flex flex-wrap gap-3">
          <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
            <span class="font-medium">${totalShops.toLocaleString()}+ Shops</span>
          </div>
          <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
            <span class="font-medium">${totalCities.toLocaleString()}+ Cities</span>
          </div>
          <div class="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-full border border-amber-200 text-sm text-amber-800">
            <span class="font-medium">${totalPartners.toLocaleString()} Order Ahead</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="py-12 border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-2xl font-bold text-black mb-6">Popular Cities</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">${popularCitiesHTML}
      </div>
    </div>
  </section>

  <section class="py-12">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-2xl font-bold text-black mb-6">Browse by State</h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">${stateCardsHTML}
      </div>
      ${validStates.length > 12 ? `
      <div class="mt-8 text-center">
        <p class="text-gray-500 mb-4">Plus ${validStates.length - 12} more states</p>
        <div class="flex flex-wrap justify-center gap-2">
          ${validStates.slice(12).map(s => `<a href="/locations/${s.toLowerCase()}/" class="text-sm text-gray-600 hover:text-black">${STATE_NAMES[s.toUpperCase()]}</a>`).join(' · ')}
        </div>
      </div>` : ''}
    </div>
  </section>

  <section class="py-16 bg-black text-white">
    <div class="max-w-2xl mx-auto px-6 text-center">
      <h2 class="text-3xl font-bold mb-4">Own a coffee shop?</h2>
      <p class="text-gray-400 mb-8">Join ${totalPartners.toLocaleString()}+ shops on joe and start accepting mobile orders today.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/for-coffee-shops/" class="bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-100">Learn More</a>
        <a href="/get-started/" class="border border-white/30 text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10">Get Started Free</a>
      </div>
    </div>
  </section>

  ${getFooterHTML()}
</body>
</html>`;

  return html;
}

function generateStatePage(stateCode, stateData) {
  const stateName = STATE_NAMES[stateCode.toUpperCase()] || stateCode;
  const shops = stateData.shops;
  const cities = stateData.cities;
  const cityCount = Object.keys(cities).length;
  const partnerCount = shops.filter(s => s.is_joe_partner).length;

  const title = `Coffee Shops in ${stateName} | joe coffee`;
  const description = `Find ${shops.length.toLocaleString()} independent coffee shops in ${stateName}. ${partnerCount > 0 ? `${partnerCount} with Order Ahead. ` : ''}Skip the line, earn rewards at local cafes in ${cityCount} cities.`;
  const canonicalUrl = `https://joe.coffee/locations/${stateCode.toLowerCase()}/`;

  // Build city cards
  let cityCardsHTML = '';
  const sortedCities = Object.keys(cities).sort((a, b) => cities[b].length - cities[a].length);

  for (const city of sortedCities) {
    const cityShops = cities[city];
    const citySlug = cityShops[0]?.city_slug || slugify(city);
    const cityPartners = cityShops.filter(s => s.is_joe_partner).length;

    cityCardsHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/" class="state-card block">
          <div class="flex items-center justify-between mb-1">
            <h3 class="font-bold text-lg">${city}</h3>
            <span class="text-sm text-gray-500">${cityShops.length} shops</span>
          </div>
          ${cityPartners > 0 ? `<div class="text-xs text-amber-700">${cityPartners} with Order Ahead</div>` : ''}
        </a>`;
  }

  const html = `${getHeadHTML(title, description, canonicalUrl, `<meta name="geo.region" content="US-${stateCode.toUpperCase()}">`)}
<body class="min-h-screen bg-white text-gray-900">
  ${getNavHTML()}

  <div class="pt-24 pb-4 border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <nav class="text-sm text-gray-500" aria-label="Breadcrumb">
        <a href="/" class="hover:text-black">Home</a>
        <span class="mx-2">›</span>
        <a href="/locations/" class="hover:text-black">Locations</a>
        <span class="mx-2">›</span>
        <span class="text-gray-900 font-medium">${stateName}</span>
      </nav>
    </div>
  </div>

  <section class="py-12 bg-gradient-to-b from-gray-50 to-white">
    <div class="max-w-6xl mx-auto px-6">
      <h1 class="text-4xl md:text-5xl font-bold text-black mb-4">Coffee Shops in ${stateName}</h1>
      <p class="text-lg text-gray-600 mb-6">Discover ${shops.length.toLocaleString()} independent coffee shops across ${cityCount} cities in ${stateName}.</p>
      <div class="flex flex-wrap gap-3">
        <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
          <span class="font-medium">${shops.length.toLocaleString()} Shops</span>
        </div>
        <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
          <span class="font-medium">${cityCount} Cities</span>
        </div>
        ${partnerCount > 0 ? `
        <div class="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-full border border-amber-200 text-sm text-amber-800">
          <span class="font-medium">${partnerCount} Order Ahead</span>
        </div>` : ''}
      </div>
    </div>
  </section>

  <main class="py-10">
    <div class="max-w-6xl mx-auto px-6">
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">${cityCardsHTML}
      </div>
    </div>
  </main>

  <section class="py-16 bg-black text-white">
    <div class="max-w-2xl mx-auto px-6 text-center">
      <h2 class="text-3xl font-bold mb-4">Own a shop in ${stateName}?</h2>
      <p class="text-gray-400 mb-8">Join joe and start accepting mobile orders. It's free to get started.</p>
      <a href="/get-started/" class="inline-block bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-100">Get Started Free</a>
    </div>
  </section>

  ${getFooterHTML()}
</body>
</html>`;

  return html;
}

function generateCityPage(stateCode, city, shops, allCities) {
  const stateName = STATE_NAMES[stateCode.toUpperCase()] || stateCode;
  const citySlug = shops[0]?.city_slug || slugify(city);
  const partnerCount = shops.filter(s => s.is_joe_partner).length;

  const title = `Coffee Shops in ${city}, ${stateCode.toUpperCase()} | joe coffee`;
  const description = `Find ${shops.length} independent coffee shops in ${city}, ${stateName}. ${partnerCount > 0 ? `${partnerCount} with mobile ordering. ` : ''}Earn rewards, support local.`;
  const canonicalUrl = `https://joe.coffee/locations/${stateCode.toLowerCase()}/${citySlug}/`;

  // Build shop cards
  let shopCardsHTML = '';
  const sortedShops = [...shops].sort((a, b) => {
    // Joe partners first, then by rating
    if (a.is_joe_partner && !b.is_joe_partner) return -1;
    if (!a.is_joe_partner && b.is_joe_partner) return 1;
    const ratingA = a.combined_rating || a.google_rating || 0;
    const ratingB = b.combined_rating || b.google_rating || 0;
    return ratingB - ratingA;
  });

  for (let i = 0; i < sortedShops.length; i++) {
    const shop = sortedShops[i];
    const shopSlug = shop.slug || slugify(shop.name);
    const gradient = getGradient(i);
    const photoUrl = getPhotoUrl(shop);
    const rating = getRatingDisplay(shop);
    const price = getPriceDisplay(shop.price_range);
    const isOpen = isOpenNow(shop.hours);

    shopCardsHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/${shopSlug}/" class="shop-card" data-partner="${shop.is_joe_partner || false}" data-rating="${rating?.rating || 0}">
          ${photoUrl ? `
          <div class="h-40 bg-gray-100 relative">
            <img src="${photoUrl}" alt="${escapeHtml(shop.name)}" class="w-full h-full object-cover" loading="lazy">
            ${shop.is_joe_partner ? '<div class="absolute top-3 left-3 bg-amber-500 text-white text-xs font-semibold px-2 py-1 rounded-full">Order Ahead</div>' : ''}
          </div>` : `
          <div class="h-40 bg-gradient-to-br ${gradient} flex items-center justify-center relative">
            <span class="text-white text-4xl">☕</span>
            ${shop.is_joe_partner ? '<div class="absolute top-3 left-3 bg-amber-500 text-white text-xs font-semibold px-2 py-1 rounded-full">Order Ahead</div>' : ''}
          </div>`}
          <div class="p-4">
            <h3 class="font-bold text-lg mb-1">${escapeHtml(shop.name)}</h3>
            <p class="text-gray-500 text-sm mb-2">${escapeHtml(shop.address || '')}</p>
            <div class="flex items-center gap-3 flex-wrap">
              ${rating ? `<span class="star-rating text-sm">★ ${rating.rating}</span>` : ''}
              ${price ? `<span class="text-gray-500 text-sm">${price}</span>` : ''}
              ${shop.neighborhood ? `<span class="text-gray-400 text-sm">${escapeHtml(shop.neighborhood)}</span>` : ''}
            </div>
          </div>
        </a>`;
  }

  // Nearby cities
  const otherCities = Object.keys(allCities).filter(c => c !== city).slice(0, 6);
  let nearbyCitiesHTML = '';
  for (const otherCity of otherCities) {
    const otherSlug = allCities[otherCity][0]?.city_slug || slugify(otherCity);
    nearbyCitiesHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/${otherSlug}/" class="nearby-city">
          <p class="font-semibold">${otherCity}</p>
          <p class="text-gray-500 text-sm">${allCities[otherCity].length} shops</p>
        </a>`;
  }

  const html = `${getHeadHTML(title, description, canonicalUrl, `<meta name="geo.region" content="US-${stateCode.toUpperCase()}">\n  <meta name="geo.placename" content="${city}">`)}
<body class="min-h-screen bg-white text-gray-900">
  ${getNavHTML()}

  <div class="pt-24 pb-4 border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <nav class="text-sm text-gray-500" aria-label="Breadcrumb">
        <a href="/" class="hover:text-black">Home</a>
        <span class="mx-2">›</span>
        <a href="/locations/" class="hover:text-black">Locations</a>
        <span class="mx-2">›</span>
        <a href="/locations/${stateCode.toLowerCase()}/" class="hover:text-black">${stateName}</a>
        <span class="mx-2">›</span>
        <span class="text-gray-900 font-medium">${city}</span>
      </nav>
    </div>
  </div>

  <section class="py-12 bg-gradient-to-b from-gray-50 to-white">
    <div class="max-w-6xl mx-auto px-6">
      <h1 class="text-4xl md:text-5xl font-bold text-black mb-4">Coffee Shops in ${city}</h1>
      <p class="text-lg text-gray-600 mb-6">Discover ${shops.length} independent coffee shops in ${city}, ${stateName}. Support local cafes and earn rewards.</p>
      <div class="flex flex-wrap gap-3">
        <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
          <span class="font-medium">${shops.length} Shops</span>
        </div>
        ${partnerCount > 0 ? `
        <div class="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-full border border-amber-200 text-sm text-amber-800">
          <span class="font-medium">${partnerCount} Order Ahead</span>
        </div>` : ''}
      </div>
    </div>
  </section>

  <section class="sticky top-16 z-40 bg-white border-b border-gray-100 py-4">
    <div class="max-w-6xl mx-auto px-6">
      <div class="flex gap-2 overflow-x-auto pb-1">
        <button class="filter-btn active" data-filter="all">All Shops</button>
        ${partnerCount > 0 ? '<button class="filter-btn" data-filter="partner">Order Ahead</button>' : ''}
        <button class="filter-btn" data-filter="rated">Top Rated</button>
      </div>
    </div>
  </section>

  <main class="py-10">
    <div class="max-w-6xl mx-auto px-6">
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-5" id="shop-grid">${shopCardsHTML}
      </div>
    </div>
  </main>

  <section class="py-16 bg-gray-50 border-t border-gray-100">
    <div class="max-w-3xl mx-auto px-6">
      <h2 class="text-2xl font-bold text-black mb-4">About Coffee in ${city}</h2>
      <p class="text-gray-600">Discover the best independent coffee shops in ${city}, ${stateName}. With ${shops.length} local cafes on joe, you can find your new favorite spot, support local roasters, and earn rewards. ${partnerCount > 0 ? `${partnerCount} shops offer mobile ordering through the joe app - skip the line and get your coffee faster.` : ''}</p>
    </div>
  </section>

  ${nearbyCitiesHTML ? `
  <section class="py-12 border-t border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-xl font-bold text-black mb-6">Nearby Cities</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">${nearbyCitiesHTML}
      </div>
    </div>
  </section>` : ''}

  <section class="py-16 bg-black text-white">
    <div class="max-w-2xl mx-auto px-6 text-center">
      <h2 class="text-3xl font-bold mb-4">Own a shop in ${city}?</h2>
      <p class="text-gray-400 mb-8">Claim your free listing or join joe to start accepting mobile orders.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/get-started/" class="bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-100">Get Started Free</a>
      </div>
    </div>
  </section>

  ${getFooterHTML(city)}

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const filterBtns = document.querySelectorAll('.filter-btn');
      const shopCards = document.querySelectorAll('.shop-card');
      
      filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          const filter = this.dataset.filter;
          filterBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          
          shopCards.forEach(card => {
            const isPartner = card.dataset.partner === 'true';
            const rating = parseFloat(card.dataset.rating);
            let show = true;
            
            if (filter === 'partner') show = isPartner;
            else if (filter === 'rated') show = rating >= 4.0;
            
            card.style.display = show ? 'block' : 'none';
          });
        });
      });
    });
  </script>
</body>
</html>`;

  return html;
}

function generateShopPage(stateCode, city, shop, otherShops) {
  const stateName = STATE_NAMES[stateCode.toUpperCase()] || stateCode;
  const citySlug = shop.city_slug || slugify(city);
  const shopSlug = shop.slug || slugify(shop.name);
  const isPartner = shop.is_joe_partner;
  const photoUrl = getPhotoUrl(shop);
  const rating = getRatingDisplay(shop);
  const price = getPriceDisplay(shop.price_range);
  const hours = formatHours(shop.hours);

  const title = isPartner 
    ? `${shop.name} - ${city}, ${stateCode.toUpperCase()} | Order Ahead | joe coffee`
    : `${shop.name} - ${city}, ${stateCode.toUpperCase()} | joe coffee`;
  
  const description = isPartner
    ? `Order ahead at ${shop.name} in ${city}, ${stateCode.toUpperCase()}. Skip the line, earn rewards. ${shop.address ? `Located at ${shop.address}.` : ''}`
    : `${shop.name} is an independent coffee shop in ${city}, ${stateCode.toUpperCase()}. ${shop.address ? `Located at ${shop.address}.` : ''} ${rating ? `Rated ${rating.rating}/5.` : ''}`;
  
  const canonicalUrl = `https://joe.coffee/locations/${stateCode.toLowerCase()}/${citySlug}/${shopSlug}/`;

  // Build tags
  const tags = [];
  if (isPartner) tags.push({ text: 'Order Ahead', class: 'tag-partner' });
  if (shop.is_roaster) tags.push({ text: 'Roaster', class: '' });
  if (shop.has_ecommerce) tags.push({ text: 'Ships Coffee', class: '' });
  if (shop.amenities?.includes('wifi')) tags.push({ text: 'WiFi', class: '' });
  if (shop.amenities?.includes('outdoor seating')) tags.push({ text: 'Outdoor Seating', class: '' });

  // Build hours table
  let hoursHTML = '<p class="text-gray-500">Hours not available</p>';
  if (hours) {
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
    
    hoursHTML = '<table class="hours-table w-full">';
    for (const day of dayOrder) {
      if (hours[day]) {
        const h = hours[day];
        const timeStr = h.is_closed ? 'Closed' : (h.open && h.close ? `${h.open} – ${h.close}` : (typeof h === 'string' ? h : 'Hours vary'));
        const today = dayOrder[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
        const isToday = day === today;
        hoursHTML += `<tr${isToday ? ' class="font-semibold"' : ''}>
          <td>${dayNames[day]}${isToday ? ' (Today)' : ''}</td>
          <td class="text-right">${timeStr}</td>
        </tr>`;
      }
    }
    hoursHTML += '</table>';
  }

  // Build photo gallery
  let photosHTML = '';
  const allPhotos = [...(shop.photos || []), ...(shop.yelp_photos || [])].slice(0, 5);
  if (allPhotos.length > 0) {
    photosHTML = `
          <div class="info-card">
            <h2 class="font-bold text-lg mb-4">Photos</h2>
            <div class="photo-gallery">
              ${allPhotos.map(p => `<img src="${p}" alt="${escapeHtml(shop.name)}" loading="lazy">`).join('\n              ')}
            </div>
          </div>`;
  }

  // Build other shops in city
  let otherShopsHTML = '';
  const nearbyShops = otherShops.filter(s => s.id !== shop.id).slice(0, 4);
  for (const other of nearbyShops) {
    const otherSlug = other.slug || slugify(other.name);
    const otherRating = getRatingDisplay(other);
    
    otherShopsHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/${otherSlug}/" class="other-shop">
          <h3 class="font-semibold text-black mb-1">${escapeHtml(other.name)}</h3>
          <p class="text-gray-500 text-sm mb-2">${escapeHtml(other.address || '')}</p>
          <div class="flex items-center gap-2">
            ${other.is_joe_partner ? '<span class="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">Order Ahead</span>' : ''}
            ${otherRating ? `<span class="star-rating text-xs">★ ${otherRating.rating}</span>` : ''}
          </div>
        </a>`;
  }

  // Schema.org structured data
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    "name": shop.name,
    "description": shop.description || `Independent coffee shop in ${city}, ${stateName}.`,
    "url": canonicalUrl,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": shop.address,
      "addressLocality": city,
      "addressRegion": stateCode.toUpperCase(),
      "postalCode": shop.zip,
      "addressCountry": "US"
    }
  };

  if (shop.lat && shop.lng) {
    schemaData.geo = {
      "@type": "GeoCoordinates",
      "latitude": parseFloat(shop.lat),
      "longitude": parseFloat(shop.lng)
    };
  }

  if (rating) {
    schemaData.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": rating.rating,
      "reviewCount": rating.reviews
    };
  }

  if (shop.phone) schemaData.telephone = shop.phone;
  if (shop.website) schemaData.sameAs = [shop.website];
  if (photoUrl) schemaData.image = photoUrl;

  if (isPartner && shop.ordering_url) {
    schemaData.potentialAction = {
      "@type": "OrderAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": shop.ordering_url,
        "actionPlatform": ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"]
      }
    };
  }

  const schemaJSON = JSON.stringify(schemaData);

  const extraMeta = `
  <meta name="geo.region" content="US-${stateCode.toUpperCase()}">
  <meta name="geo.placename" content="${city}">
  ${shop.lat && shop.lng ? `<meta name="geo.position" content="${shop.lat};${shop.lng}">` : ''}
  <script type="application/ld+json">${schemaJSON}</script>`;

  const html = `${getHeadHTML(title, description, canonicalUrl, extraMeta)}
<body class="min-h-screen bg-white text-gray-900">
  ${getNavHTML()}

  <div class="pt-24 pb-4 border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <nav class="text-sm text-gray-500 flex flex-wrap items-center gap-1" aria-label="Breadcrumb">
        <a href="/" class="hover:text-black">Home</a><span class="text-gray-300">›</span>
        <a href="/locations/" class="hover:text-black">Locations</a><span class="text-gray-300">›</span>
        <a href="/locations/${stateCode.toLowerCase()}/" class="hover:text-black">${stateName}</a><span class="text-gray-300">›</span>
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/" class="hover:text-black">${city}</a><span class="text-gray-300">›</span>
        <span class="text-gray-900 font-medium">${escapeHtml(shop.name)}</span>
      </nav>
    </div>
  </div>

  <main class="py-8">
    <div class="max-w-6xl mx-auto px-6">
      <div class="grid lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-6">
          ${photoUrl ? `
          <div class="hero-image" style="background-image: url('${photoUrl}')">
            <div class="hero-overlay"></div>
          </div>` : ''}
          
          <div class="info-card">
            <div class="flex items-start gap-5">
              <div class="w-20 h-20 bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span class="text-white text-3xl">☕</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 class="text-2xl md:text-3xl font-bold text-black">${escapeHtml(shop.name)}</h1>
                </div>
                ${shop.neighborhood ? `<p class="text-gray-500 mb-2">${escapeHtml(shop.neighborhood)}</p>` : ''}
                <div class="flex items-center gap-4 mb-4">
                  ${rating ? `<span class="star-rating font-medium">★ ${rating.rating} <span class="text-gray-400 font-normal">(${rating.reviews} reviews)</span></span>` : ''}
                  ${price ? `<span class="text-gray-600">${price}</span>` : ''}
                </div>
                <div class="flex flex-wrap gap-2">
                  ${tags.map(tag => `<span class="tag ${tag.class}">${tag.text}</span>`).join('\n                  ')}
                </div>
              </div>
            </div>
          </div>

          ${shop.description || shop.about_business ? `
          <div class="info-card">
            <h2 class="font-bold text-lg mb-3">About</h2>
            <p class="text-gray-600">${escapeHtml(shop.description || shop.about_business)}</p>
          </div>` : ''}

          <div class="info-card">
            <h2 class="font-bold text-lg mb-4">Hours</h2>
            ${hoursHTML}
          </div>

          <div class="info-card">
            <h2 class="font-bold text-lg mb-4">Location</h2>
            <div class="flex items-start gap-3 mb-4">
              <div class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                </svg>
              </div>
              <div>
                <p class="font-medium text-black">${escapeHtml(shop.address || '')}</p>
                <p class="text-gray-600">${city}, ${stateCode.toUpperCase()} ${shop.zip || ''}</p>
                ${shop.lat && shop.lng ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}" target="_blank" rel="noopener" class="text-black font-medium text-sm hover:underline mt-1 inline-block">Get Directions →</a>` : ''}
              </div>
            </div>
            ${shop.phone ? `
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
              </div>
              <a href="tel:${shop.phone}" class="text-black hover:underline">${shop.phone}</a>
            </div>` : ''}
            ${shop.website ? `
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
              </div>
              <a href="${shop.website}" target="_blank" rel="noopener" class="text-black hover:underline">${cleanWebsiteUrl(shop.website)}</a>
            </div>` : ''}
          </div>

          ${photosHTML}

          ${shop.review_highlights ? `
          <div class="info-card">
            <h2 class="font-bold text-lg mb-4">What People Say</h2>
            <div class="space-y-3">
              ${(Array.isArray(shop.review_highlights) ? shop.review_highlights : [shop.review_highlights]).slice(0, 3).map(r => `
              <blockquote class="text-gray-600 italic border-l-2 border-gray-200 pl-4">"${escapeHtml(typeof r === 'string' ? r : r.text || '')}"</blockquote>
              `).join('')}
            </div>
          </div>` : ''}

          <!-- Products Section (loaded dynamically) -->
          <div id="products-section" class="info-card" data-shop-id="${shop.id}">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-bold text-lg">Shop Products</h2>
              <a href="/marketplace/?shop=${shop.id}" id="view-all-products" class="text-sm font-medium text-black hover:underline" style="display:none;">View All →</a>
            </div>
            <div id="products-container" class="products-scroll">
              <!-- Products loaded via JS -->
            </div>
          </div>
        </div>

        <div class="lg:col-span-1">
          <div class="info-card sticky top-24">
            ${isPartner ? `
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </div>
              <h3 class="font-bold text-xl mb-2">Order Ahead</h3>
              <p class="text-gray-600 text-sm mb-6">Skip the line and earn rewards on every order</p>
            </div>
            <a href="${shop.ordering_url || `https://shop.joe.coffee/explore/stores/${shop.id}`}" class="order-btn mb-4">Order Now</a>
            <div class="text-center">
              <p class="text-gray-500 text-sm mb-3">Or download the app</p>
              <div class="flex gap-3 justify-center">
                <a href="https://get.joe.coffee" class="text-sm text-gray-600 hover:text-black">iOS</a>
                <span class="text-gray-300">|</span>
                <a href="https://get.joe.coffee" class="text-sm text-gray-600 hover:text-black">Android</a>
              </div>
            </div>
            ` : `
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
              </div>
              <h3 class="font-bold text-xl mb-2">Is this your shop?</h3>
              <p class="text-gray-600 text-sm mb-6">Claim your listing to update info and enable mobile ordering</p>
            </div>
            <a href="/get-started/?shop=${shop.id}" class="claim-btn mb-4">Claim This Listing</a>
            <p class="text-center text-gray-400 text-xs">Free to claim • Takes 2 minutes</p>
            `}
          </div>

          ${(shop.facebook_url || shop.instagram_url || shop.twitter_url || shop.tiktok_url) ? `
          <div class="info-card mt-6">
            <h3 class="font-bold text-sm mb-4">Follow ${escapeHtml(shop.name)}</h3>
            <div class="flex gap-3">
              ${shop.instagram_url ? `<a href="${shop.instagram_url}" target="_blank" rel="noopener" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200" title="Instagram">📷</a>` : ''}
              ${shop.facebook_url ? `<a href="${shop.facebook_url}" target="_blank" rel="noopener" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200" title="Facebook">👤</a>` : ''}
              ${shop.twitter_url ? `<a href="${shop.twitter_url}" target="_blank" rel="noopener" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200" title="Twitter">🐦</a>` : ''}
              ${shop.tiktok_url ? `<a href="${shop.tiktok_url}" target="_blank" rel="noopener" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200" title="TikTok">🎵</a>` : ''}
            </div>
          </div>` : ''}
        </div>
      </div>
    </div>
  </main>

  ${otherShopsHTML ? `
  <section class="py-12 bg-white border-t border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-xl font-bold text-black mb-6">More Coffee Shops in ${city}</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">${otherShopsHTML}
      </div>
      <div class="text-center mt-6">
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/" class="text-black font-semibold hover:underline">View All ${otherShops.length} ${city} Shops →</a>
      </div>
    </div>
  </section>` : ''}

  ${getFooterHTML(city)}

  <script>
  (async function loadProducts() {
    const SUPABASE_URL = '${SUPABASE_URL}';
    const SUPABASE_KEY = '${SUPABASE_KEY}';
    
    const section = document.getElementById('products-section');
    if (!section) return;
    
    const shopId = section.dataset.shopId;
    if (!shopId) return;
    
    try {
      // Fetch products for this shop
      const prodRes = await fetch(
        SUPABASE_URL + '/rest/v1/products?shop_id=eq.' + shopId + '&is_active=eq.true&in_stock=eq.true&limit=10&select=id,name,price,image_url,size,grind_type',
        { headers: { 'apikey': SUPABASE_KEY } }
      );
      const products = await prodRes.json();
      
      if (!products || products.length === 0) return;
      
      // Render products
      const container = document.getElementById('products-container');
      container.innerHTML = products.map(p => \`
        <a href="/marketplace/product/?id=\${p.id}" class="product-card">
          <img src="\${p.image_url || '/images/coffee-placeholder.jpg'}" alt="\${p.name}" loading="lazy">
          <div class="product-info">
            <div class="product-name">\${p.name}</div>
            <div class="product-tag">\${[p.size, p.grind_type].filter(Boolean).join(' • ') || 'Coffee'}</div>
            <div class="product-price">$\${parseFloat(p.price).toFixed(2)}</div>
          </div>
        </a>
      \`).join('');
      
      // Show section and view all link
      section.classList.add('loaded');
      const viewAllLink = document.getElementById('view-all-products');
      if (viewAllLink) {
        viewAllLink.style.display = 'inline';
      }
    } catch (err) {
      console.error('Error loading products:', err);
    }
  })();
  </script>
</body>
</html>`;

  return html;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('🚀 Starting location page generation...\n');

  try {
    // Fetch all shops from Supabase
    const shops = await fetchAllShops();
    console.log(`\n📦 Loaded ${shops.length.toLocaleString()} shops from Supabase`);

    // Filter shops with valid data
    const validShops = shops.filter(s => s.name && (s.state_code || s.state) && (s.city_slug || s.city));
    console.log(`✅ ${validShops.length.toLocaleString()} shops with valid data\n`);

    // Organize by state -> city
    const stateData = {};

    for (const shop of validShops) {
      const stateCode = (shop.state_code || shop.state || '').toLowerCase();
      const city = shop.city || 'Unknown';

      if (!stateCode) continue;

      if (!stateData[stateCode]) {
        stateData[stateCode] = { shops: [], cities: {} };
      }

      stateData[stateCode].shops.push(shop);

      if (!stateData[stateCode].cities[city]) {
        stateData[stateCode].cities[city] = [];
      }
      stateData[stateCode].cities[city].push(shop);
    }

    // Count totals
    const totalShops = validShops.length;
    let totalCities = 0;
    for (const state of Object.values(stateData)) {
      totalCities += Object.keys(state.cities).length;
    }

    const totalPartners = validShops.filter(s => s.is_joe_partner).length;
    console.log(`📍 Organized into ${Object.keys(stateData).length} states, ${totalCities.toLocaleString()} cities`);
    console.log(`⭐ ${totalPartners} joe partners with Order Ahead\n`);

    // Clean output directory
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true });
    }
    ensureDir(OUTPUT_DIR);

    let pagesGenerated = 0;

    // Generate index page
    console.log('📄 Generating locations index...');
    const indexHTML = generateIndexPage(stateData, totalShops, totalCities);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexHTML);
    pagesGenerated++;

    // Generate state and city pages
    for (const [stateCode, state] of Object.entries(stateData)) {
      const stateDir = path.join(OUTPUT_DIR, stateCode.toLowerCase());
      ensureDir(stateDir);

      // State page
      console.log(`📄 Generating ${stateCode.toUpperCase()} state page (${state.shops.length} shops)...`);
      const stateHTML = generateStatePage(stateCode, state);
      fs.writeFileSync(path.join(stateDir, 'index.html'), stateHTML);
      pagesGenerated++;

      // City pages
      for (const [city, cityShops] of Object.entries(state.cities)) {
        const citySlug = cityShops[0]?.city_slug || slugify(city);
        const cityDir = path.join(stateDir, citySlug);
        ensureDir(cityDir);

        // City page
        const cityHTML = generateCityPage(stateCode, city, cityShops, state.cities);
        fs.writeFileSync(path.join(cityDir, 'index.html'), cityHTML);
        pagesGenerated++;

        // Shop pages
        for (const shop of cityShops) {
          const shopSlug = shop.slug || slugify(shop.name);
          const shopDir = path.join(cityDir, shopSlug);
          ensureDir(shopDir);

          const shopHTML = generateShopPage(stateCode, city, shop, cityShops);
          fs.writeFileSync(path.join(shopDir, 'index.html'), shopHTML);
          pagesGenerated++;
        }
      }
    }

    console.log(`\n✨ Done! Generated ${pagesGenerated.toLocaleString()} pages.`);
    console.log(`   - 1 index page`);
    console.log(`   - ${Object.keys(stateData).length} state pages`);
    console.log(`   - ${totalCities.toLocaleString()} city pages`);
    console.log(`   - ${totalShops.toLocaleString()} shop pages`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();