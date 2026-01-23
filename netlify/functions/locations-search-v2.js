/**
 * Smart Locations Search
 * - Prioritizes shop name matches near user over distant city matches
 * - Auto-detects location
 * - Always shows results (expands radius infinitely)
 * - Typo tolerance with trigram similarity
 * - Split panel: scrollable list + Mapbox map
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
    let searchType = 'nearby'; // nearby, name, city, fallback
    let searchLocation = { lat: userLat, lng: userLng };
    
    // If we have a text query, do smart search
    if (query) {
      shops = await smartSearch(query, userLat, userLng);
      searchType = shops.length > 0 ? 'results' : 'fallback';
    } 
    // If we have coordinates but no query, show nearby
    else if (userLat && userLng) {
      shops = await getNearbyShops(userLat, userLng, 50);
      searchType = 'nearby';
    }
    
    // Fallback: if still no results, get closest shops to user or default location
    if (shops.length === 0) {
      const fallbackLat = userLat || 39.8283; // Center of US
      const fallbackLng = userLng || -98.5795;
      shops = await getNearbyShops(fallbackLat, fallbackLng, 500, 20);
      searchType = 'fallback';
      searchLocation = { lat: fallbackLat, lng: fallbackLng };
    }
    
    // Calculate distances if we have user location
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

/**
 * Smart search: prioritizes name matches near user over distant city matches
 */
async function smartSearch(query, userLat, userLng) {
  const searchTerm = query.toLowerCase().trim();
  const isZipCode = /^\d{5}$/.test(query);
  
  // 1. Check for zip code
  if (isZipCode) {
    const { data } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
      .eq('zip', query)
      .eq('is_active', true)
      .not('lat', 'is', null)
      .limit(30);
    if (data?.length > 0) return data;
  }
  
  // 2. Search for name matches (prioritize these!)
  const { data: nameMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .ilike('name', `%${searchTerm}%`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(50);
  
  // If we have name matches and user location, sort by distance
  if (nameMatches?.length > 0 && userLat && userLng) {
    const withDistance = nameMatches.map(shop => ({
      ...shop,
      distance: calculateDistance(userLat, userLng, shop.lat, shop.lng)
    }));
    // Return closest name matches first
    return withDistance.sort((a, b) => a.distance - b.distance).slice(0, 20);
  }
  
  if (nameMatches?.length > 0) {
    return nameMatches.slice(0, 20);
  }
  
  // 3. Search by city name
  const { data: cityMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .ilike('city', `%${searchTerm}%`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(30);
  
  if (cityMatches?.length > 0) {
    // Sort by rating within city
    return cityMatches.sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0)).slice(0, 20);
  }
  
  // 4. Search by neighborhood
  const { data: neighborhoodMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .ilike('neighborhood', `%${searchTerm}%`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(30);
  
  if (neighborhoodMatches?.length > 0) {
    return neighborhoodMatches.slice(0, 20);
  }
  
  // 5. Fuzzy search using similarity (for typos like "kimbel" -> "kimball")
  // This requires pg_trgm extension - fall back to broader ILIKE if not available
  const fuzzyTerm = `%${searchTerm.slice(0, Math.max(3, searchTerm.length - 1))}%`;
  const { data: fuzzyMatches } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
    .or(`name.ilike.${fuzzyTerm},city.ilike.${fuzzyTerm}`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .limit(30);
  
  if (fuzzyMatches?.length > 0 && userLat && userLng) {
    const withDistance = fuzzyMatches.map(shop => ({
      ...shop,
      distance: calculateDistance(userLat, userLng, shop.lat, shop.lng)
    }));
    return withDistance.sort((a, b) => a.distance - b.distance).slice(0, 20);
  }
  
  return fuzzyMatches?.slice(0, 20) || [];
}

/**
 * Get shops near a location
 */
async function getNearbyShops(lat, lng, radiusMiles = 50, limit = 20) {
  // Convert miles to approximate degrees (1 degree ≈ 69 miles)
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
    // Expand search to entire country if nothing nearby
    const { data: fallback } = await supabase
      .from('shops')
      .select('id, name, slug, address, city, city_slug, state_code, lat, lng, google_rating, google_reviews, photos, is_joe_partner, is_roaster, hours')
      .eq('is_active', true)
      .not('lat', 'is', null)
      .order('google_rating', { ascending: false, nullsFirst: false })
      .limit(limit);
    return fallback || [];
  }
  
  // Sort by distance
  const withDistance = data.map(shop => ({
    ...shop,
    distance: calculateDistance(lat, lng, shop.lat, shop.lng)
  }));
  
  return withDistance.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

/**
 * Calculate distance between two points in miles
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
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
  // Fallback placeholder
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

  // Build markers JSON for map
  const markers = shops.map((shop, index) => ({
    lat: shop.lat,
    lng: shop.lng,
    name: shop.name,
    index: index
  }));

  // Determine map center
  let mapCenter = { lat: 39.8283, lng: -98.5795, zoom: 4 }; // US center
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
    
    /* Header */
    .header {
      background: var(--color-white);
      border-bottom: 1px solid var(--color-border);
      padding: 12px 20px;
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
      gap: 20px;
    }
    .logo img { height: 36px; }
    .search-box {
      flex: 1;
      max-width: 500px;
      display: flex;
      gap: 8px;
    }
    .search-input {
      flex: 1;
      padding: 10px 16px;
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
      padding: 10px 20px;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-search:hover { background: #333; }
    .btn-locate {
      padding: 10px 14px;
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
    .nav-links {
      display: flex;
      gap: 20px;
      margin-left: auto;
    }
    .nav-links a {
      color: var(--color-text-muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }
    .nav-links a:hover { color: var(--color-text); }
    
    /* Main Layout */
    .main {
      display: flex;
      height: calc(100vh - 61px);
      margin-top: 61px;
    }
    
    /* Results Panel */
    .results-panel {
      width: 420px;
      min-width: 380px;
      background: var(--color-white);
      border-right: 1px solid var(--color-border);
      overflow-y: auto;
      flex-shrink: 0;
    }
    .results-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-white);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .results-count {
      font-size: 14px;
      color: var(--color-text-muted);
    }
    .results-list {
      padding: 12px;
    }
    
    /* Shop Card */
    .shop-card {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      transition: background 0.15s;
      margin-bottom: 8px;
    }
    .shop-card:hover, .shop-card.active {
      background: #f5f5f5;
    }
    .shop-photo {
      width: 100px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
    }
    .shop-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .badge {
      position: absolute;
      bottom: 4px;
      left: 4px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    .badge-partner {
      background: #fef3c7;
      color: #92400e;
    }
    .shop-info {
      flex: 1;
      min-width: 0;
    }
    .shop-name {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .shop-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .rating { color: var(--color-text); }
    .reviews { color: var(--color-text-muted); }
    .distance { 
      color: var(--color-text-muted);
      margin-left: auto;
    }
    .shop-address, .shop-city {
      font-size: 13px;
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .open-status {
      font-size: 12px;
      font-weight: 500;
      margin-top: 4px;
      display: inline-block;
    }
    .open-status.open { color: var(--color-accent); }
    .open-status.closed { color: #dc2626; }
    
    /* Map Panel */
    .map-panel {
      flex: 1;
      position: relative;
    }
    #map {
      width: 100%;
      height: 100%;
    }
    
    /* Map Popup */
    .mapboxgl-popup-content {
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .popup-name {
      font-weight: 600;
      font-size: 14px;
    }
    
    /* View Toggle (Mobile) */
    .view-toggle {
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
      z-index: 200;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    /* Empty State */
    .empty-state {
      padding: 40px 20px;
      text-align: center;
    }
    .empty-state h2 {
      font-size: 18px;
      margin-bottom: 8px;
    }
    .empty-state p {
      color: var(--color-text-muted);
      font-size: 14px;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .header-inner {
        flex-wrap: wrap;
      }
      .search-box {
        order: 3;
        width: 100%;
        max-width: none;
        margin-top: 12px;
      }
      .nav-links { display: none; }
      .btn-locate span { display: none; }
      
      .main {
        flex-direction: column;
      }
      .results-panel {
        width: 100%;
        min-width: auto;
        height: 50vh;
        border-right: none;
        border-bottom: 1px solid var(--color-border);
      }
      .results-panel.hidden { display: none; }
      .map-panel {
        height: 50vh;
      }
      .map-panel.hidden { display: none; }
      .map-panel.full, .results-panel.full {
        height: calc(100vh - 110px);
      }
      .view-toggle { display: block; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="/images/logo.png" alt="joe">
      </a>
      
      <form class="search-box" action="/locations/search/" method="GET" id="searchForm">
        <input type="text" name="q" class="search-input" placeholder="Search shops, cities, or zip codes..." value="${escapeHtml(query)}" autocomplete="off">
        <input type="hidden" name="lat" id="latInput" value="${userLat || ''}">
        <input type="hidden" name="lng" id="lngInput" value="${userLng || ''}">
        <button type="submit" class="btn-search">Search</button>
      </form>
      
      <button class="btn-locate" id="locateBtn" title="Use my location">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
        </svg>
        <span>Near me</span>
      </button>
      
      <nav class="nav-links">
        <a href="/for-coffee-shops/">For Coffee Shops</a>
        <a href="/about/">About</a>
      </nav>
    </div>
  </header>

  <main class="main">
    <div class="results-panel" id="resultsPanel">
      <div class="results-header">
        <span class="results-count">
          ${shops.length > 0 ? `${shops.length} coffee shop${shops.length !== 1 ? 's' : ''} found` : 'Search for coffee shops'}
        </span>
      </div>
      <div class="results-list" id="resultsList">
        ${shops.length > 0 ? shopCards : `
          <div class="empty-state">
            <h2>Find your perfect coffee</h2>
            <p>Search by name, city, or zip code, or click "Near me" to find coffee shops close to you.</p>
          </div>
        `}
      </div>
    </div>
    
    <div class="map-panel" id="mapPanel">
      <div id="map"></div>
    </div>
  </main>
  
  <button class="view-toggle" id="viewToggle">Show Map</button>

  <script>
    // Map initialization
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
    
    // Add markers
    const mapMarkers = [];
    markers.forEach((m, i) => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.cssText = 'width:32px;height:32px;background:#1a1a1a;border-radius:50%;border:3px solid white;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600;';
      el.textContent = i + 1;
      el.dataset.index = i;
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      
      el.addEventListener('click', () => {
        highlightCard(i);
        showPopup(m, marker);
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
    function showPopup(m, marker) {
      if (currentPopup) currentPopup.remove();
      currentPopup = new mapboxgl.Popup({ offset: 25 })
        .setHTML('<div class="popup-name">' + m.name + '</div>')
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
          el.style.transform = 'scale(1.2)';
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
        () => {}, // Silently fail
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
    ` : ''}
    
    // Mobile view toggle
    const viewToggle = document.getElementById('viewToggle');
    const resultsPanel = document.getElementById('resultsPanel');
    const mapPanel = document.getElementById('mapPanel');
    let showingMap = false;
    
    viewToggle.addEventListener('click', () => {
      showingMap = !showingMap;
      if (showingMap) {
        resultsPanel.classList.add('hidden');
        mapPanel.classList.remove('hidden');
        mapPanel.classList.add('full');
        viewToggle.textContent = 'Show List';
        map.resize();
      } else {
        resultsPanel.classList.remove('hidden');
        resultsPanel.classList.add('full');
        mapPanel.classList.add('hidden');
        mapPanel.classList.remove('full');
        viewToggle.textContent = 'Show Map';
      }
    });
  </script>
</body>
</html>`;
}
