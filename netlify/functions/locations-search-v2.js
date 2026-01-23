/**
 * Smart Locations Search v2
 * - Map on top (desktop & mobile)
 * - Desktop: toggle to hide map / show full list
 * - Mobile: toggle to expand list fullscreen
 * - Plain pins (no numbers)
 * - Joe partners boosted to top
 * - Chain filtering
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
    
    // Add distance but keep partners at top
    if (userLat && userLng) {
      const withDistance = shops.map(shop => ({
        ...shop,
        distance: shop.distance || calculateDistance(userLat, userLng, shop.lat, shop.lng)
      }));
      const partners = withDistance.filter(s => s.is_joe_partner).sort((a, b) => a.distance - b.distance);
      const nonPartners = withDistance.filter(s => !s.is_joe_partner).sort((a, b) => a.distance - b.distance);
      shops = [...partners, ...nonPartners];
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

const COMMON_CITIES = [
  'seattle', 'portland', 'san francisco', 'los angeles', 'new york', 'chicago',
  'austin', 'denver', 'phoenix', 'dallas', 'houston', 'miami', 'atlanta',
  'boston', 'philadelphia', 'detroit', 'minneapolis', 'nashville', 'charlotte',
  'san diego', 'oakland', 'brooklyn', 'manhattan', 'queens', 'bronx',
  'tempe', 'scottsdale', 'mesa', 'tucson', 'boise', 'salt lake city',
  'tacoma', 'gig harbor', 'bellevue', 'kirkland', 'redmond', 'spokane'
];

function isChainCoffee(name) {
  const lowerName = name.toLowerCase();
  return CHAIN_NAMES.some(chain => lowerName.includes(chain));
}

function filterChains(shops) {
  return shops.filter(shop => !isChainCoffee(shop.name));
}

function boostPartners(shops) {
  const partners = shops.filter(s => s.is_joe_partner);
  const nonPartners = shops.filter(s => !s.is_joe_partner);
  return [...partners, ...nonPartners];
}

function isLikelyCity(query) {
  const lower = query.toLowerCase().trim();
  return COMMON_CITIES.includes(lower) || (lower.length > 3 && COMMON_CITIES.some(c => c.startsWith(lower)));
}

async function smartSearch(query, userLat, userLng) {
  const searchTerm = query.toLowerCase().trim();
  const isZipCode = /^\d{5}$/.test(query);
  const queryIsCity = isLikelyCity(searchTerm);
  
  if (isZipCode) {
    const { data } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
      .eq('zip', query)
      .eq('is_active', true)
      .not('lat', 'is', null)
      .limit(50);
    if (data?.length > 0) return boostPartners(filterChains(data)).slice(0, 30);
  }
  
  if (queryIsCity) {
    const { data: cityMatches } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
      .ilike('city', `${searchTerm}%`)
      .eq('is_active', true)
      .not('lat', 'is', null)
      .limit(50);
    
    if (cityMatches?.length > 0) {
      return boostPartners(filterChains(cityMatches)).slice(0, 30);
    }
  }
  
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
    const partners = withDistance.filter(s => s.is_joe_partner).sort((a, b) => a.distance - b.distance);
    const nonPartners = withDistance.filter(s => !s.is_joe_partner).sort((a, b) => a.distance - b.distance);
    return [...partners, ...nonPartners].slice(0, 30);
  }
  
  if (filteredNames.length > 0) {
    return boostPartners(filteredNames).slice(0, 30);
  }
  
  const { data: cityMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .ilike('city', `%${searchTerm}%`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(50);
  
  if (cityMatches?.length > 0) {
    return boostPartners(filterChains(cityMatches)).slice(0, 30);
  }
  
  const { data: neighborhoodMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .ilike('neighborhood', `%${searchTerm}%`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(50);
  
  if (neighborhoodMatches?.length > 0) {
    return boostPartners(filterChains(neighborhoodMatches)).slice(0, 30);
  }
  
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
    const partners = withDistance.filter(s => s.is_joe_partner).sort((a, b) => a.distance - b.distance);
    const nonPartners = withDistance.filter(s => !s.is_joe_partner).sort((a, b) => a.distance - b.distance);
    return [...partners, ...nonPartners].slice(0, 30);
  }
  
  return boostPartners(filteredFuzzy).slice(0, 30);
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
    return boostPartners(filtered).slice(0, limit);
  }
  
  const filtered = filterChains(data);
  const withDistance = filtered.map(shop => ({
    ...shop,
    distance: calculateDistance(lat, lng, shop.lat, shop.lng)
  }));
  
  const partners = withDistance.filter(s => s.is_joe_partner).sort((a, b) => a.distance - b.distance);
  const nonPartners = withDistance.filter(s => !s.is_joe_partner).sort((a, b) => a.distance - b.distance);
  return [...partners, ...nonPartners].slice(0, limit);
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
  if (miles < 10) return miles.toFixed(1) + ' mi';
  return Math.round(miles) + ' mi';
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
    const rating = shop.google_rating ? parseFloat(shop.google_rating).toFixed(1) : '';
    const reviewCount = shop.google_reviews || 0;
    const openStatus = isOpenNow(shop.hours);
    const shopUrl = '/locations/' + (shop.state_code?.toLowerCase() || '') + '/' + (shop.city_slug || '') + '/' + (shop.slug || '') + '/';
    
    return `
      <a href="${shopUrl}" class="shop-card" data-lat="${shop.lat}" data-lng="${shop.lng}" data-index="${index}">
        <div class="shop-photo">
          <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(shop.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'">
          ${shop.is_joe_partner ? '<span class="badge badge-partner">☕ Order Ahead</span>' : ''}
        </div>
        <div class="shop-info">
          <h3 class="shop-name">${escapeHtml(shop.name)}</h3>
          <div class="shop-meta">
            ${rating ? '<span class="rating">⭐ ' + rating + '</span>' : ''}
            ${reviewCount ? '<span class="reviews">(' + reviewCount + ')</span>' : ''}
            ${distance ? '<span class="distance">' + distance + '</span>' : ''}
          </div>
          <p class="shop-address">${escapeHtml(shop.address || '')}</p>
          <p class="shop-city">${escapeHtml(shop.city || '')}, ${shop.state_code || ''}</p>
          ${openStatus !== null ? '<span class="open-status ' + (openStatus ? 'open' : 'closed') + '">' + (openStatus ? 'Open now' : 'Closed') + '</span>' : ''}
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
    url: '/locations/' + (shop.state_code?.toLowerCase() || '') + '/' + (shop.city_slug || '') + '/' + (shop.slug || '') + '/',
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
  <title>${query ? 'Coffee near "' + escapeHtml(query) + '"' : 'Find Coffee Near You'} | joe</title>
  <meta name="description" content="Find the best coffee shops near you. Search by location, name, or zip code.">
  <link rel="icon" type="image/png" href="/images/logo.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"><\/script>
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
    
    /* Header */
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
    .menu-btn {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
    }
    .menu-btn svg { width: 24px; height: 24px; }
    
    /* Mobile Menu */
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
    .mobile-menu.open { display: flex; }
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
    .search-inner {
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
    }
    .btn-locate:hover { background: #f5f5f5; }
    
    /* View Toggle */
    .view-controls {
      max-width: 1400px;
      margin: 0 auto;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--color-white);
    }
    .results-count {
      font-size: 15px;
      color: var(--color-text-muted);
    }
    .view-toggle {
      display: flex;
      gap: 4px;
      background: #f0f0f0;
      padding: 4px;
      border-radius: 8px;
    }
    .view-btn {
      padding: 8px 16px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .view-btn.active {
      background: var(--color-white);
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .view-btn svg { width: 16px; height: 16px; }
    
    /* Main Content */
    .main { margin-top: 130px; }
    
    /* Map Section */
    .map-section {
      height: 350px;
      position: relative;
      display: block;
    }
    .map-section.hidden { display: none; }
    #map { width: 100%; height: 100%; }
    
    /* Results Section */
    .results-section {
      background: var(--color-white);
      min-height: 400px;
    }
    .results-grid {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px 24px 60px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    .results-grid.full-width {
      max-width: 1600px;
      grid-template-columns: repeat(4, 1fr);
    }
    
    /* Shop Card */
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
    .shop-info { padding: 14px; }
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
    .distance { color: var(--color-text-muted); margin-left: auto; }
    .shop-address, .shop-city {
      font-size: 13px;
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .shop-address { margin-bottom: 2px; }
    .open-status {
      font-size: 12px;
      font-weight: 500;
      margin-top: 8px;
      display: inline-block;
    }
    .open-status.open { color: var(--color-accent); }
    .open-status.closed { color: #dc2626; }
    
    /* Map Popup */
    .mapboxgl-popup { max-width: 280px !important; }
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
    .popup-content { padding: 12px; }
    .popup-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
    .popup-meta { font-size: 13px; color: #666; margin-bottom: 4px; }
    .popup-address { font-size: 12px; color: #888; }
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
    .empty-state h2 { font-size: 20px; margin-bottom: 8px; }
    .empty-state p { color: var(--color-text-muted); }
    
    /* Mobile Toggle */
    .mobile-view-toggle {
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
      cursor: pointer;
      z-index: 50;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    /* Tablet */
    @media (max-width: 1024px) {
      .results-grid { grid-template-columns: repeat(2, 1fr); }
      .results-grid.full-width { grid-template-columns: repeat(3, 1fr); }
    }
    
    /* Mobile */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .menu-btn { display: block; }
      .view-toggle { display: none; }
      
      .search-section { margin-top: 65px; padding: 12px 16px; }
      .search-inner { flex-wrap: wrap; }
      .btn-locate span { display: none; }
      
      .main { margin-top: 125px; }
      
      .map-section { height: 200px; }
      
      .results-grid, .results-grid.full-width {
        grid-template-columns: 1fr;
        padding: 16px 12px 80px;
        gap: 12px;
      }
      
      .shop-card { display: flex; flex-direction: row; }
      .shop-photo { width: 110px; height: 100px; flex-shrink: 0; }
      .shop-info {
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .shop-name { font-size: 15px; -webkit-line-clamp: 1; }
      
      .mobile-view-toggle { display: block; }
      
      .results-section.fullscreen {
        position: fixed;
        top: 125px;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 40;
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
      <button class="menu-btn" id="menuBtn">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div>
  </header>
  
  <div class="mobile-menu" id="mobileMenu">
    <div class="mobile-menu-header">
      <a href="/" class="logo"><img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" style="height:32px"></a>
      <button class="mobile-menu-close" id="menuClose">✕</button>
    </div>
    <nav class="mobile-menu-links">
      <a href="/locations/">Find Coffee</a>
      <a href="/for-coffee-shops/">For Coffee Shops</a>
      <a href="/about/">About</a>
      <a href="https://get.joe.coffee">Get the App</a>
    </nav>
  </div>
  
  <div class="search-section">
    <form class="search-inner" action="/locations/search/" method="GET" id="searchForm">
      <input type="text" name="q" class="search-input" placeholder="Search shops, cities, or zip codes..." value="${escapeHtml(query)}" autocomplete="off">
      <input type="hidden" name="lat" id="latInput" value="${userLat || ''}">
      <input type="hidden" name="lng" id="lngInput" value="${userLng || ''}">
      <button type="submit" class="btn-search">Search</button>
      <button type="button" class="btn-locate" id="locateBtn">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
        </svg>
        <span>Near me</span>
      </button>
    </form>
  </div>

  <main class="main">
    <div class="view-controls">
      <span class="results-count">${shops.length > 0 ? shops.length + ' coffee shop' + (shops.length !== 1 ? 's' : '') + ' found' : 'Search for coffee shops'}</span>
      <div class="view-toggle">
        <button class="view-btn active" id="viewMap">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
          Map
        </button>
        <button class="view-btn" id="viewList">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          List
        </button>
      </div>
    </div>
    
    <section class="map-section" id="mapSection">
      <div id="map"></div>
    </section>
    
    <section class="results-section" id="resultsSection">
      <div class="results-grid" id="resultsGrid">
        ${shops.length > 0 ? shopCards : '<div class="empty-state"><h2>Find your perfect coffee</h2><p>Search by name, city, or zip code, or click "Near me" to find coffee shops.</p></div>'}
      </div>
    </section>
  </main>
  
  <button class="mobile-view-toggle" id="mobileToggle">Expand List</button>

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
    
    // Plain dot markers - NO NUMBERS
    const mapMarkers = [];
    markers.forEach((m, i) => {
      const el = document.createElement('div');
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.background = '#1a1a1a';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.transition = 'transform 0.15s, background 0.15s';
      
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      
      el.addEventListener('click', () => {
        highlightCard(i);
        showPopup(m);
      });
      
      mapMarkers.push({ marker, el });
    });
    
    if (markers.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      markers.forEach(m => bounds.extend([m.lng, m.lat]));
      map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
    
    let currentPopup = null;
    function showPopup(m) {
      if (currentPopup) currentPopup.remove();
      const ratingHtml = m.rating ? '<span>⭐ ' + parseFloat(m.rating).toFixed(1) + '</span>' + (m.reviews ? ' <span style="color:#999">(' + m.reviews + ')</span>' : '') : '';
      const badgeHtml = m.isPartner ? '<span class="popup-badge">☕ Order Ahead</span>' : '';
      currentPopup = new mapboxgl.Popup({ offset: 25 })
        .setHTML('<a href="' + m.url + '" class="popup-card"><img src="' + m.photo + '" class="popup-photo" onerror="this.src=\\'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop\\'"><div class="popup-content">' + badgeHtml + '<div class="popup-name">' + m.name + '</div><div class="popup-meta">' + ratingHtml + '</div><div class="popup-address">' + m.address + '</div><div class="popup-address">' + m.city + ', ' + m.state + '</div><span class="popup-cta">View Shop →</span></div></a>')
        .setLngLat([m.lng, m.lat])
        .addTo(map);
    }
    
    function highlightCard(index) {
      document.querySelectorAll('.shop-card').forEach(c => c.classList.remove('active'));
      const card = document.querySelector('.shop-card[data-index="' + index + '"]');
      if (card) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    
    document.querySelectorAll('.shop-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        const index = parseInt(card.dataset.index);
        const m = mapMarkers[index];
        if (m) {
          m.el.style.background = '#16a34a';
          m.el.style.transform = 'scale(1.4)';
        }
      });
      card.addEventListener('mouseleave', () => {
        const index = parseInt(card.dataset.index);
        const m = mapMarkers[index];
        if (m) {
          m.el.style.background = '#1a1a1a';
          m.el.style.transform = 'scale(1)';
        }
      });
    });
    
    // Desktop view toggle
    const viewMapBtn = document.getElementById('viewMap');
    const viewListBtn = document.getElementById('viewList');
    const mapSection = document.getElementById('mapSection');
    const resultsGrid = document.getElementById('resultsGrid');
    
    viewMapBtn.addEventListener('click', () => {
      viewMapBtn.classList.add('active');
      viewListBtn.classList.remove('active');
      mapSection.classList.remove('hidden');
      resultsGrid.classList.remove('full-width');
      map.resize();
    });
    
    viewListBtn.addEventListener('click', () => {
      viewListBtn.classList.add('active');
      viewMapBtn.classList.remove('active');
      mapSection.classList.add('hidden');
      resultsGrid.classList.add('full-width');
    });
    
    // Mobile menu
    document.getElementById('menuBtn').addEventListener('click', () => {
      document.getElementById('mobileMenu').classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    document.getElementById('menuClose').addEventListener('click', () => {
      document.getElementById('mobileMenu').classList.remove('open');
      document.body.style.overflow = '';
    });
    
    // Mobile view toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const resultsSection = document.getElementById('resultsSection');
    let mobileExpanded = false;
    
    mobileToggle.addEventListener('click', () => {
      mobileExpanded = !mobileExpanded;
      if (mobileExpanded) {
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
    
    // Geolocation
    document.getElementById('locateBtn').addEventListener('click', function() {
      if (!navigator.geolocation) return alert('Geolocation not supported');
      this.disabled = true;
      this.innerHTML = '<span>Locating...</span>';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById('latInput').value = pos.coords.latitude;
          document.getElementById('lngInput').value = pos.coords.longitude;
          document.getElementById('searchForm').submit();
        },
        () => {
          this.disabled = false;
          this.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg><span>Near me</span>';
          alert('Unable to get location');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
    
    ${!query && !userLat ? `
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById('latInput').value = pos.coords.latitude;
          document.getElementById('lngInput').value = pos.coords.longitude;
          document.getElementById('searchForm').submit();
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }` : ''}
  <\/script>
</body>
</html>`;
}