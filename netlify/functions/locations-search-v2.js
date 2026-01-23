/**
 * Smart Locations Search
 * - Full-width 3-column grid layout
 * - Map on top, list below
 * - Mobile: map on top, expandable list
 * - Plain pins (no numbers)
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAPBOX_TOKEN = process.env.MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1Ijoiam9lY29mZmVlIiwiYSI6ImNsb2F0OWFxYzA1ejQycW1qdGt5dXVhcXoifQ.NYmxbVXWOPV4cYLzPYvGKg';

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const query = params.q?.trim() || '';
    const userLat = parseFloat(params.lat) || null;
    const userLng = parseFloat(params.lng) || null;
    
    let shops = [];
    let searchType = 'nearby';
    let searchLocation = { lat: userLat, lng: userLng };
    
    if (query) {
      shops = await smartSearch(query, userLat, userLng);
      searchType = shops.length > 0 ? 'results' : 'fallback';
    } 
    else if (userLat && userLng) {
      shops = await getNearbyShops(userLat, userLng, 50);
      searchType = 'nearby';
    }
    
    if (shops.length === 0) {
      const fallbackLat = userLat || 39.8283;
      const fallbackLng = userLng || -98.5795;
      shops = await getNearbyShops(fallbackLat, fallbackLng, 500, 20);
      searchType = 'fallback';
      searchLocation = { lat: fallbackLat, lng: fallbackLng };
    }
    
    if (userLat && userLng) {
      shops = shops.map(shop => ({
        ...shop,
        distance: calculateDistance(userLat, userLng, shop.lat, shop.lng)
      })).sort((a, b) => a.distance - b.distance);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: renderSearchPage(query, shops, searchType, searchLocation, userLat, userLng)
    };

  } catch (err) {
    console.error('Search error:', err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: renderSearchPage('', [], 'error', null, null, null)
    };
  }
};

// Chain coffee shops to exclude
const CHAIN_NAMES = [
  "starbucks", "dunkin", "dunkin'", "peet's", "peets", "seattle's best", 
  "seattles best", "caribou coffee", "tim hortons", "dutch bros", 
  "coffee bean & tea leaf", "the coffee bean", "mcdonald's", "mcdonalds"
];

// Common US city names for detection
const COMMON_CITIES = [
  'seattle', 'portland', 'san francisco', 'los angeles', 'new york', 'chicago',
  'austin', 'denver', 'phoenix', 'dallas', 'houston', 'miami', 'atlanta',
  'boston', 'philadelphia', 'detroit', 'minneapolis', 'nashville', 'charlotte',
  'san diego', 'oakland', 'brooklyn', 'manhattan', 'queens', 'bronx',
  'tempe', 'scottsdale', 'mesa', 'tucson', 'boise', 'salt lake city',
  'raleigh', 'durham', 'chapel hill', 'savannah', 'charleston', 'asheville',
  'sacramento', 'fresno', 'long beach', 'anaheim', 'santa monica', 'pasadena',
  'boulder', 'fort collins', 'colorado springs', 'tampa', 'orlando', 'jacksonville'
];

function isChainCoffee(name) {
  const lowerName = name.toLowerCase();
  return CHAIN_NAMES.some(chain => lowerName.includes(chain));
}

function filterChains(shops) {
  return shops.filter(shop => !isChainCoffee(shop.name));
}

function isLikelyCity(query) {
  const lower = query.toLowerCase().trim();
  return COMMON_CITIES.includes(lower) || lower.length > 3 && COMMON_CITIES.some(c => c.startsWith(lower));
}

async function smartSearch(query, userLat, userLng) {
  const searchTerm = query.toLowerCase().trim();
  const isZipCode = /^\d{5}$/.test(query);
  const queryIsCity = isLikelyCity(searchTerm);
  
  // 1. Check for zip code
  if (isZipCode) {
    const { data } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
      .eq('zip', query)
      .eq('is_active', true)
      .not('lat', 'is', null)
      .limit(50);
    if (data?.length > 0) return filterChains(data).slice(0, 30);
  }
  
  // 2. If query looks like a city name, prioritize city search FIRST
  if (queryIsCity) {
    const { data: cityMatches } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
      .ilike('city', `${searchTerm}%`)
      .eq('is_active', true)
      .not('lat', 'is', null)
      .limit(50);
    
    if (cityMatches?.length > 0) {
      const filtered = filterChains(cityMatches);
      return filtered.sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0)).slice(0, 30);
    }
  }
  
  // 3. Search for name matches
  const { data: nameMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .ilike('name', `%${searchTerm}%`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(50);
  
  const filteredNames = nameMatches ? filterChains(nameMatches) : [];
  
  if (filteredNames.length > 0 && userLat && userLng) {
    const withDistance = filteredNames.map(shop => ({
      ...shop,
      distance: calculateDistance(userLat, userLng, shop.lat, shop.lng)
    }));
    return withDistance.sort((a, b) => a.distance - b.distance).slice(0, 30);
  }
  
  if (filteredNames.length > 0) {
    return filteredNames.slice(0, 30);
  }
  
  // 4. Search by city name (for non-common city names)
  const { data: cityMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .ilike('city', `%${searchTerm}%`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(50);
  
  if (cityMatches?.length > 0) {
    const filtered = filterChains(cityMatches);
    return filtered.sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0)).slice(0, 30);
  }
  
  // 5. Search by neighborhood
  const { data: neighborhoodMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .ilike('neighborhood', `%${searchTerm}%`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(50);
  
  if (neighborhoodMatches?.length > 0) {
    return filterChains(neighborhoodMatches).slice(0, 30);
  }
  
  // 6. Fuzzy search for typos
  const fuzzyTerm = `%${searchTerm.slice(0, Math.max(3, searchTerm.length - 1))}%`;
  const { data: fuzzyMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .or(`name.ilike.${fuzzyTerm},city.ilike.${fuzzyTerm}`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(50);
  
  const filteredFuzzy = fuzzyMatches ? filterChains(fuzzyMatches) : [];
  
  if (filteredFuzzy.length > 0 && userLat && userLng) {
    const withDistance = filteredFuzzy.map(shop => ({
      ...shop,
      distance: calculateDistance(userLat, userLng, shop.lat, shop.lng)
    }));
    return withDistance.sort((a, b) => a.distance - b.distance).slice(0, 30);
  }
  
  return filteredFuzzy.slice(0, 30);
}

async function getNearbyShops(lat, lng, radiusMiles = 50, limit = 30) {
  const radiusDeg = radiusMiles / 69;
  
  const { data } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .eq('is_active', true)
    .not('lat', 'is', null)
    .gte('lat', lat - radiusDeg)
    .lte('lat', lat + radiusDeg)
    .gte('lng', lng - radiusDeg)
    .lte('lng', lng + radiusDeg)
    .limit(100);
  
  if (!data || data.length === 0) {
    const { data: fallback } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
      .eq('is_active', true)
      .not('lat', 'is', null)
      .order('google_rating', { ascending: false, nullsFirst: false })
      .limit(limit * 2);
    const filtered = fallback ? filterChains(fallback) : [];
    return filtered.slice(0, limit);
  }
  
  const filtered = filterChains(data);
  const withDistance = filtered.map(shop => ({
    ...shop,
    distance: calculateDistance(lat, lng, shop.lat, shop.lng)
  }));
  
  return withDistance.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDistance(miles) {
  if (!miles && miles !== 0) return '';
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function getPhotoUrl(shop) {
  if (shop.photos && shop.photos.length > 0) {
    return shop.photos[0];
  }
  return 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop';
}

function isOpenNow(hours) {
  if (!hours) return null;
  try {
    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[now.getDay()];
    const todayHours = hours[today];
    if (!todayHours || todayHours.closed) return false;
    
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const openTime = parseInt(todayHours.open?.replace(':', '') || '0');
    const closeTime = parseInt(todayHours.close?.replace(':', '') || '2359');
    
    return currentTime >= openTime && currentTime <= closeTime;
  } catch {
    return null;
  }
}

function renderSearchPage(query, shops, searchType, searchLocation, userLat, userLng) {
  const shopCards = shops.map((shop, index) => {
    const photoUrl = getPhotoUrl(shop);
    const distance = shop.distance ? formatDistance(shop.distance) : '';
    const rating = shop.google_rating ? shop.google_rating.toFixed(1) : '';
    const reviewCount = shop.google_reviews || 0;
    const openStatus = isOpenNow(shop.hours);
    const shopUrl = `/locations/${shop.state_code?.toLowerCase()}/${shop.city_slug}/${shop.slug}/`;
    
    return `
      <a href="${shopUrl}" class="shop-card" data-lat="${shop.lat}" data-lng="${shop.lng}" data-index="${index}">
        <div class="shop-photo">
          <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(shop.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'">
          ${shop.is_joe_partner ? '<span class="badge badge-partner">☕ Order Ahead</span>' : ''}
        </div>
        <div class="shop-info">
          <h3 class="shop-name">${escapeHtml(shop.name)}</h3>
          <div class="shop-meta">
            ${rating ? `<span class="rating">⭐ ${rating}</span>` : ''}
            ${reviewCount ? `<span class="reviews">(${reviewCount})</span>` : ''}
            ${distance ? `<span class="distance">${distance}</span>` : ''}
          </div>
          <p class="shop-address">${escapeHtml(shop.address || '')}</p>
          <p class="shop-city">${escapeHtml(shop.city || '')}, ${shop.state_code || ''}</p>
          ${openStatus !== null ? `<span class="open-status ${openStatus ? 'open' : 'closed'}">${openStatus ? 'Open now' : 'Closed'}</span>` : ''}
        </div>
      </a>
    `;
  }).join('');

  const markers = shops.map((shop, index) => ({
    lat: shop.lat,
    lng: shop.lng,
    name: shop.name,
    address: shop.address || '',
    city: shop.city || '',
    state: shop.state_code || '',
    rating: shop.google_rating || null,
    reviews: shop.google_reviews || 0,
    photo: getPhotoUrl(shop),
    url: `/locations/${shop.state_code?.toLowerCase()}/${shop.city_slug}/${shop.slug}/`,
    isPartner: shop.is_joe_partner || false,
    index: index
  }));

  let mapCenter = { lat: 39.8283, lng: -98.5795, zoom: 4 };
  if (userLat && userLng) {
    mapCenter = { lat: userLat, lng: userLng, zoom: 11 };
  } else if (shops.length > 0) {
    mapCenter = { lat: shops[0].lat, lng: shops[0].lng, zoom: 11 };
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${query ? `Coffee near "${escapeHtml(query)}"` : 'Find Coffee Near You'} | joe</title>
  <meta name="description" content="Find the best coffee shops near you. Search by location, name, or zip code.">
  <link rel="icon" type="image/png" href="/images/logo.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --color-bg: #fafafa;
      --color-white: #ffffff;
      --color-text: #1a1a1a;
      --color-text-muted: #666;
      --color-border: #e5e5e5;
      --color-primary: #1a1a1a;
      --color-accent: #16a34a;
      --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    body {
      font-family: var(--font-family);
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.5;
    }
    
    /* Header - Matching joe.coffee */
    .header {
      background: var(--color-white);
      border-bottom: 1px solid var(--color-border);
      padding: 16px 24px;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
    }
    .header-inner {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo img { height: 32px; }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 32px;
    }
    .nav-links a {
      color: var(--color-text);
      text-decoration: none;
      font-size: 15px;
      font-weight: 500;
    }
    .nav-links a:hover { opacity: 0.7; }
    .nav-links .btn-app {
      background: var(--color-primary);
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
    }
    .nav-links .btn-app:hover { opacity: 0.9; }
    
    /* Mobile Menu Button */
    .menu-btn {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
    }
    .menu-btn svg {
      width: 24px;
      height: 24px;
    }
    
    /* Mobile Menu Overlay */
    .mobile-menu {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-white);
      z-index: 200;
      padding: 20px 24px;
      flex-direction: column;
    }
    .mobile-menu.open {
      display: flex;
    }
    .mobile-menu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
    }
    .mobile-menu-close {
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      padding: 8px;
    }
    .mobile-menu-links {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .mobile-menu-links a {
      color: var(--color-text);
      text-decoration: none;
      font-size: 18px;
      font-weight: 500;
    }
    
    /* Search Section */
    .search-section {
      background: var(--color-white);
      padding: 16px 24px;
      border-bottom: 1px solid var(--color-border);
      margin-top: 65px;
    }
    .search-section-inner {
      max-width: 600px;
      margin: 0 auto;
      display: flex;
      gap: 8px;
    }
    .search-input {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      font-size: 15px;
      font-family: inherit;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--color-primary);
    }
    .btn-search {
      padding: 12px 24px;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-search:hover { background: #333; }
    .btn-locate {
      padding: 12px 14px;
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      white-space: nowrap;
    }
    .btn-locate:hover { background: #f5f5f5; }
    
    /* Main Layout - Stacked */
    .main {
      margin-top: 130px;
    }
    
    /* Map Section - Top */
    .map-section {
      height: 350px;
      position: relative;
    }
    #map {
      width: 100%;
      height: 100%;
    }
    
    /* Results Section - Below */
    .results-section {
      background: var(--color-white);
      min-height: calc(100vh - 411px);
    }
    .results-header {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px 24px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .results-count {
      font-size: 15px;
      color: var(--color-text-muted);
    }
    
    /* 3-Column Grid */
    .results-grid {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px 24px 60px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    
    /* Shop Card - Vertical */
    .shop-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
    }
    .shop-card:hover, .shop-card.active {
      border-color: var(--color-primary);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transform: translateY(-2px);
    }
    .shop-photo {
      width: 100%;
      height: 160px;
      position: relative;
      overflow: hidden;
    }
    .shop-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .badge {
      position: absolute;
      top: 10px;
      left: 10px;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-partner {
      background: #fef3c7;
      color: #92400e;
    }
    .shop-info {
      padding: 14px;
    }
    .shop-name {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .shop-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .rating { color: var(--color-text); }
    .reviews { color: var(--color-text-muted); }
    .distance { 
      color: var(--color-text-muted);
      margin-left: auto;
    }
    .shop-address {
      font-size: 13px;
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .shop-city {
      font-size: 13px;
      color: var(--color-text-muted);
    }
    .open-status {
      font-size: 12px;
      font-weight: 500;
      margin-top: 8px;
      display: inline-block;
    }
    .open-status.open { color: var(--color-accent); }
    .open-status.closed { color: #dc2626; }
    
    /* Map Popup */
    .mapboxgl-popup {
      max-width: 280px !important;
    }
    .mapboxgl-popup-content {
      padding: 0;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      overflow: hidden;
    }
    .mapboxgl-popup-close-button {
      font-size: 20px;
      padding: 4px 8px;
      color: #666;
      right: 4px;
      top: 4px;
    }
    .popup-card {
      text-decoration: none;
      color: inherit;
      display: block;
    }
    .popup-photo {
      width: 100%;
      height: 120px;
      object-fit: cover;
    }
    .popup-content {
      padding: 12px;
    }
    .popup-name {
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 4px;
    }
    .popup-meta {
      font-size: 13px;
      color: #666;
      margin-bottom: 4px;
    }
    .popup-address {
      font-size: 12px;
      color: #888;
    }
    .popup-cta {
      display: block;
      text-align: center;
      padding: 10px;
      background: #1a1a1a;
      color: white;
      font-size: 13px;
      font-weight: 600;
      margin-top: 8px;
      border-radius: 6px;
    }
    .popup-cta:hover { background: #333; }
    .popup-badge {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    
    /* Empty State */
    .empty-state {
      grid-column: 1 / -1;
      padding: 60px 20px;
      text-align: center;
    }
    .empty-state h2 {
      font-size: 20px;
      margin-bottom: 8px;
    }
    .empty-state p {
      color: var(--color-text-muted);
      font-size: 15px;
    }
    
    /* Mobile Toggle Button */
    .mobile-toggle {
      display: none;
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--color-primary);
      color: white;
      padding: 12px 24px;
      border-radius: 50px;
      border: none;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      z-index: 200;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    /* Tablet - 2 columns */
    @media (max-width: 1024px) {
      .results-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        padding: 16px 20px 60px;
      }
    }
    
    /* Mobile */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .menu-btn { display: block; }
      
      .search-section {
        margin-top: 65px;
        padding: 12px 16px;
      }
      .search-section-inner {
        flex-wrap: wrap;
      }
      .search-input {
        flex: 1;
        min-width: 200px;
      }
      .btn-locate span { display: none; }
      
      .main {
        margin-top: 125px;
      }
      
      .map-section {
        height: 200px;
      }
      .map-section.expanded {
        height: 70vh;
      }
      .map-section.hidden {
        display: none;
      }
      
      .results-grid {
        grid-template-columns: 1fr;
        gap: 12px;
        padding: 16px 12px 80px;
      }
      
      /* Horizontal cards on mobile */
      .shop-card {
        display: flex;
        flex-direction: row;
      }
      .shop-photo {
        width: 110px;
        height: 100px;
        flex-shrink: 0;
      }
      .shop-info {
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .shop-name {
        font-size: 15px;
        -webkit-line-clamp: 1;
      }
      
      .mobile-toggle {
        display: block;
      }
      
      .results-section.fullscreen {
        position: fixed;
        top: 125px;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 50;
        overflow-y: auto;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe">
      </a>
      
      <nav class="nav-links">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="btn-app">Get the App</a>
      </nav>
      
      <button class="menu-btn" id="menuBtn" aria-label="Menu">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div>
  </header>
  
  <!-- Mobile Menu -->
  <div class="mobile-menu" id="mobileMenu">
    <div class="mobile-menu-header">
      <a href="/" class="logo">
        <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" style="height:32px">
      </a>
      <button class="mobile-menu-close" id="menuClose">✕</button>
    </div>
    <nav class="mobile-menu-links">
      <a href="/locations/">Find Coffee</a>
      <a href="/for-coffee-shops/">For Coffee Shops</a>
      <a href="/about/">About</a>
      <a href="https://get.joe.coffee">Get the App</a>
    </nav>
  </div>
  
  <!-- Search Section -->
  <div class="search-section">
    <form class="search-section-inner" action="/locations/search/" method="GET" id="searchForm">
      <input type="text" name="q" class="search-input" placeholder="Search shops, cities, or zip codes..." value="${escapeHtml(query)}" autocomplete="off">
      <input type="hidden" name="lat" id="latInput" value="${userLat || ''}">
      <input type="hidden" name="lng" id="lngInput" value="${userLng || ''}">
      <button type="submit" class="btn-search">Search</button>
      <button type="button" class="btn-locate" id="locateBtn" title="Use my location">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
        </svg>
        <span>Near me</span>
      </button>
    </form>
  </div>

  <main class="main">
    <!-- Map on Top -->
    <section class="map-section" id="mapSection">
      <div id="map"></div>
    </section>
    
    <!-- Results Below -->
    <section class="results-section" id="resultsSection">
      <div class="results-header">
        <span class="results-count">
          ${shops.length > 0 ? `${shops.length} coffee shop${shops.length !== 1 ? 's' : ''} found` : 'Search for coffee shops'}
        </span>
      </div>
      <div class="results-grid" id="resultsGrid">
        ${shops.length > 0 ? shopCards : `
          <div class="empty-state">
            <h2>Find your perfect coffee</h2>
            <p>Search by name, city, or zip code, or click "Near me" to find coffee shops close to you.</p>
          </div>
        `}
      </div>
    </section>
  </main>
  
  <button class="mobile-toggle" id="mobileToggle">Expand List</button>

  <script>
    mapboxgl.accessToken = '${MAPBOX_TOKEN}';
    
    const markers = ${JSON.stringify(markers)};
    const mapCenter = ${JSON.stringify(mapCenter)};
    
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/light-v11',
      center: [mapCenter.lng, mapCenter.lat],
      zoom: mapCenter.zoom
    });
    
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add plain pin markers (no numbers)
    const mapMarkers = [];
    markers.forEach((m, i) => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.cssText = 'width:14px;height:14px;background:#1a1a1a;border-radius:50%;border:2px solid white;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);transition:transform 0.15s,background 0.15s;';
      el.dataset.index = i;
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      
      el.addEventListener('click', () => {
        highlightCard(i);
        showPopup(m);
      });
      
      mapMarkers.push(marker);
    });
    
    // Fit bounds to markers
    if (markers.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      markers.forEach(m => bounds.extend([m.lng, m.lat]));
      map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
    
    // Popup
    let currentPopup = null;
    function showPopup(m) {
      if (currentPopup) currentPopup.remove();
      
      const ratingHtml = m.rating ? '<span>⭐ ' + m.rating.toFixed(1) + '</span>' + (m.reviews ? ' <span style="color:#999">(' + m.reviews + ')</span>' : '') : '';
      const badgeHtml = m.isPartner ? '<span class="popup-badge">☕ Order Ahead</span>' : '';
      
      const popupHtml = 
        '<a href="' + m.url + '" class="popup-card">' +
          '<img src="' + m.photo + '" class="popup-photo" onerror="this.src=\\'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop\\'">' +
          '<div class="popup-content">' +
            badgeHtml +
            '<div class="popup-name">' + m.name + '</div>' +
            '<div class="popup-meta">' + ratingHtml + '</div>' +
            '<div class="popup-address">' + m.address + '</div>' +
            '<div class="popup-address">' + m.city + ', ' + m.state + '</div>' +
            '<span class="popup-cta">View Shop →</span>' +
          '</div>' +
        '</a>';
      
      currentPopup = new mapboxgl.Popup({ offset: 25, closeButton: true })
        .setHTML(popupHtml)
        .setLngLat([m.lng, m.lat])
        .addTo(map);
    }
    
    // Card interaction
    function highlightCard(index) {
      document.querySelectorAll('.shop-card').forEach(c => c.classList.remove('active'));
      const card = document.querySelector('.shop-card[data-index="' + index + '"]');
      if (card) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    
    // Card hover -> highlight marker
    document.querySelectorAll('.shop-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        const index = parseInt(card.dataset.index);
        const marker = mapMarkers[index];
        if (marker) {
          const el = marker.getElement();
          el.style.background = '#16a34a';
          el.style.transform = 'scale(1.3)';
        }
      });
      card.addEventListener('mouseleave', () => {
        const index = parseInt(card.dataset.index);
        const marker = mapMarkers[index];
        if (marker) {
          const el = marker.getElement();
          el.style.background = '#1a1a1a';
          el.style.transform = 'scale(1)';
        }
      });
    });
    
    // Geolocation
    const locateBtn = document.getElementById('locateBtn');
    locateBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
      }
      
      locateBtn.disabled = true;
      locateBtn.innerHTML = '<span>Locating...</span>';
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          document.getElementById('latInput').value = lat;
          document.getElementById('lngInput').value = lng;
          document.getElementById('searchForm').submit();
        },
        (error) => {
          locateBtn.disabled = false;
          locateBtn.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg><span>Near me</span>';
          alert('Unable to get your location. Please try searching instead.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
    
    // Auto-detect location on first load if no query
    ${!query && !userLat ? `
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          document.getElementById('latInput').value = position.coords.latitude;
          document.getElementById('lngInput').value = position.coords.longitude;
          document.getElementById('searchForm').submit();
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
    ` : ''}
    
    // Mobile menu toggle
    const menuBtn = document.getElementById('menuBtn');
    const menuClose = document.getElementById('menuClose');
    const mobileMenu = document.getElementById('mobileMenu');
    
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    
    menuClose.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    });
    
    // Mobile toggle for map/list
    const mobileToggle = document.getElementById('mobileToggle');
    const mapSection = document.getElementById('mapSection');
    const resultsSection = document.getElementById('resultsSection');
    let isExpanded = false;
    
    mobileToggle.addEventListener('click', () => {
      isExpanded = !isExpanded;
      if (isExpanded) {
        mapSection.classList.add('hidden');
        resultsSection.classList.add('fullscreen');
        mobileToggle.textContent = 'Show Map';
      } else {
        mapSection.classList.remove('hidden');
        resultsSection.classList.remove('fullscreen');
        mobileToggle.textContent = 'Expand List';
        map.resize();
      }
    });
  </script>
</body>
</html>`;
}