/**
 * Locations Search - Mobile Fixed Version
 * Issues fixed:
 * 1. Map shows properly on mobile (on top)
 * 2. Toggle button works correctly (Show Map / Show List)
 * 3. Cards always visible
 * 4. Pins click navigates to shop page
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYnJlbmRlbm1hcnRpbjA1IiwiYSI6ImNtanAwZWZidjJodjEya3E2NDR4b242bW8ifQ.CjDrXl01VxVoEg6jh81c5Q';

async function smartSearch(query, userLat, userLng) {
  const normalized = query.toLowerCase().trim();
  
  // Check if it's a zip code
  if (/^\d{5}$/.test(normalized)) {
    return await searchByZip(normalized);
  }
  
  // Search by shop name first
  const { data: nameMatches } = await supabase
    .from('shops')
    .select('*')
    .ilike('name', `%${normalized}%`)
    .limit(50);
  
  if (nameMatches && nameMatches.length > 0) {
    return nameMatches;
  }
  
  // Search by city
  const { data: cityMatches } = await supabase
    .from('shops')
    .select('*')
    .ilike('city', `%${normalized}%`)
    .limit(100);
  
  if (cityMatches && cityMatches.length > 0) {
    return cityMatches;
  }
  
  // Geocode the query
  return await searchByGeocode(query);
}

async function searchByZip(zip) {
  const geoRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${zip}.json?access_token=${MAPBOX_TOKEN}&country=US&types=postcode`);
  const geoData = await geoRes.json();
  
  if (geoData.features && geoData.features.length > 0) {
    const [lng, lat] = geoData.features[0].center;
    return await getNearbyShops(lat, lng, 50);
  }
  return [];
}

async function searchByGeocode(query) {
  const geoRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=US&types=place,locality,neighborhood,address`);
  const geoData = await geoRes.json();
  
  if (geoData.features && geoData.features.length > 0) {
    const [lng, lat] = geoData.features[0].center;
    return await getNearbyShops(lat, lng, 50);
  }
  return [];
}

async function getNearbyShops(lat, lng, radiusMiles = 25, limit = 100) {
  const { data, error } = await supabase.rpc('nearby_shops', {
    user_lat: lat,
    user_lng: lng,
    radius_miles: radiusMiles,
    max_results: limit
  });
  
  if (error) {
    console.error('Nearby shops error:', error);
    return [];
  }
  
  return data || [];
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function renderSearchPage(query, shops, userLat, userLng, partnerStoreIds = {}) {
  // Sort shops: Joe partners first, then by distance
  const sortedShops = [...shops].sort((a, b) => {
    if (a.is_joe_partner && !b.is_joe_partner) return -1;
    if (!a.is_joe_partner && b.is_joe_partner) return 1;
    return (a.distance || 999) - (b.distance || 999);
  });

  const cards = sortedShops.map((s, i) => {
    const url = '/locations/' + (s.url_slug || `${s.state?.toLowerCase() || 'unknown'}/${s.city?.toLowerCase()?.replace(/\s+/g, '-') || 'unknown'}/${s.name?.toLowerCase()?.replace(/[^a-z0-9]+/g, '-')}-${s.id?.slice(0, 8)}`);
    const imgUrl = s.hero_image || s.photo_url || 'https://placehold.co/400x300/f3f4f6/999?text=Coffee';
    
    // Check if this shop has a joe ordering URL
    const storeId = partnerStoreIds[s.id];
    const hasJoeOrder = s.is_joe_partner && storeId;
    const orderUrl = hasJoeOrder ? `https://shop.joe.coffee/explore/stores/${storeId}` : null;
    
    return `
      <div class="card" data-index="${i}" data-lat="${s.lat}" data-lng="${s.lng}" data-url="${url}">
        <div class="card-img">
          <img src="${imgUrl}" alt="${s.name || 'Coffee shop'}" loading="lazy" onerror="this.src='https://placehold.co/400x300/f3f4f6/999?text=Coffee'">
          ${hasJoeOrder ? '<span class="partner-badge">☕ Order Ahead</span>' : ''}
        </div>
        <div class="card-body">
          <h3 class="card-title">${s.name || 'Unknown'}</h3>
          <div class="card-rating">⭐ ${s.rating || '4.5'} (${s.review_count || '0'})</div>
          <div class="card-address">${s.address || ''}</div>
          <div class="card-city">${s.city || ''}, ${s.state || ''}</div>
          <div class="card-actions">
            <a href="${url}" class="btn-view">View</a>
            ${orderUrl ? `<a href="${orderUrl}" class="btn-order">☕ Order</a>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const shopsJson = JSON.stringify(sortedShops.map(s => ({
    lat: s.lat,
    lng: s.lng,
    name: s.name,
    is_joe_partner: s.is_joe_partner,
    url: '/locations/' + (s.url_slug || `${s.state?.toLowerCase() || 'unknown'}/${s.city?.toLowerCase()?.replace(/\s+/g, '-') || 'unknown'}/${s.name?.toLowerCase()?.replace(/[^a-z0-9]+/g, '-')}-${s.id?.slice(0, 8)}`)
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Coffee near "${query || 'you'}" | joe</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --white: #fff;
      --black: #000;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-500: #6b7280;
      --gray-700: #374151;
      --green-600: #16a34a;
    }
    html, body { height: 100%; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #fafafa;
      color: #111;
    }
    
    /* Header */
    .header {
      background: var(--white);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      border-bottom: 1px solid var(--gray-200);
    }
    .header-inner {
      max-width: 1280px;
      margin: 0 auto;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo img { height: 40px; width: auto; }
    .nav { display: flex; align-items: center; gap: 2.5rem; }
    .nav a {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--gray-700);
      text-decoration: none;
    }
    .nav a:hover { color: var(--black); }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      border-radius: 100px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      border: none;
      text-decoration: none;
    }
    .btn-primary { background: var(--black); color: var(--white); }
    .btn-primary:hover { background: #333; }
    
    /* Mobile Menu */
    .mobile-menu-btn {
      display: none;
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
    }
    .mobile-menu-btn svg { width: 24px; height: 24px; }
    .mobile-nav {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--white);
      z-index: 200;
      padding: 1.5rem;
    }
    .mobile-nav.open { display: flex; flex-direction: column; }
    .mobile-nav-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    .mobile-nav-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
    }
    .mobile-nav a {
      display: block;
      padding: 1rem 0;
      font-size: 1.25rem;
      font-weight: 500;
      color: var(--black);
      text-decoration: none;
      border-bottom: 1px solid var(--gray-200);
    }
    
    /* Search */
    .search-wrap {
      background: var(--white);
      position: fixed;
      top: 72px;
      left: 0;
      right: 0;
      z-index: 90;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--gray-200);
    }
    .search-inner {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }
    .search-input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid var(--gray-200);
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--black);
    }
    .btn-search {
      padding: 0.75rem 1.5rem;
      background: var(--black);
      color: var(--white);
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-locate {
      padding: 0.75rem;
      background: var(--white);
      border: 1px solid var(--gray-200);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .btn-locate:hover { background: var(--gray-100); }
    .result-count {
      font-size: 0.9rem;
      color: var(--gray-500);
      white-space: nowrap;
    }
    
    /* Main Layout */
    .main {
      position: fixed;
      top: 140px;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
    }
    
    /* List Panel */
    .list-panel {
      width: 420px;
      display: flex;
      flex-direction: column;
      background: var(--white);
      border-right: 1px solid var(--gray-200);
    }
    .list-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }
    
    /* Map Panel */
    .map-panel {
      flex: 1;
      position: relative;
    }
    #map { width: 100%; height: 100%; }
    
    /* Cards */
    .card {
      background: var(--white);
      border: 1px solid var(--gray-200);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1rem;
      transition: all 0.2s;
      cursor: pointer;
    }
    .card.active {
      border-color: var(--black);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .card:hover {
      border-color: var(--black);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .card-img {
      position: relative;
      height: 160px;
      overflow: hidden;
    }
    .card-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .partner-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background: var(--green-600);
      color: var(--white);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .card-body { padding: 1rem; }
    .card-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .card-rating {
      font-size: 0.85rem;
      color: var(--gray-500);
      margin-bottom: 8px;
    }
    .card-address, .card-city {
      font-size: 0.85rem;
      color: var(--gray-500);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .btn-view {
      flex: 1;
      padding: 8px 16px;
      background: var(--gray-100);
      color: var(--black);
      text-decoration: none;
      text-align: center;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .btn-view:hover { background: var(--gray-200); }
    .btn-order {
      flex: 1;
      padding: 8px 16px;
      background: var(--green-600);
      color: var(--white);
      text-decoration: none;
      text-align: center;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .btn-order:hover { background: #15803d; }
    
    /* Map Markers */
    .marker-dot {
      width: 14px;
      height: 14px;
      background: var(--black);
      border: 2px solid var(--white);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transition: transform 0.15s ease;
    }
    .marker-dot:hover,
    .marker-dot.active {
      transform: scale(1.3);
      background: var(--green-600);
    }
    .marker-partner {
      background: var(--green-600);
    }
    
    /* User location */
    .user-marker {
      width: 16px;
      height: 16px;
      background: #3b82f6;
      border: 3px solid var(--white);
      border-radius: 50%;
      box-shadow: 0 0 0 2px #3b82f6, 0 2px 6px rgba(0,0,0,0.3);
    }
    
    /* Mobile Toggle Button */
    .mobile-toggle {
      display: none;
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--black);
      color: var(--white);
      padding: 12px 28px;
      border-radius: 100px;
      border: none;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      z-index: 200;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .mobile-toggle:hover { background: #333; }
    
    /* Empty State */
    .empty-state {
      padding: 40px 20px;
      text-align: center;
    }
    .empty-state h2 {
      font-size: 1.25rem;
      margin-bottom: 8px;
    }
    .empty-state p {
      color: var(--gray-500);
      font-size: 0.95rem;
    }
    
    /* MOBILE STYLES - CRITICAL FIXES */
    @media (max-width: 900px) {
      .nav { display: none; }
      .mobile-menu-btn { display: block; }
      
      .search-wrap { top: 72px; }
      .search-inner { flex-wrap: wrap; }
      .search-input { width: 100%; order: 1; }
      .btn-search { order: 2; }
      .btn-locate { order: 3; }
      .btn-locate span { display: none; }
      .result-count { width: 100%; order: 4; margin-top: 8px; }
      
      /* KEY FIX: Mobile layout - Map on TOP, List below */
      .main {
        flex-direction: column;
        top: 160px;
      }
      
      /* Map panel - on top, fixed height */
      .map-panel {
        height: 40vh;
        min-height: 200px;
        flex: none;
        order: 1;
      }
      
      /* List panel - below, takes remaining space */
      .list-panel {
        width: 100%;
        flex: 1;
        border-right: none;
        border-top: 1px solid var(--gray-200);
        order: 2;
        min-height: 0;
      }
      
      /* Toggle button visible on mobile */
      .mobile-toggle { display: block; }
      
      /* Fullscreen states */
      .map-panel.fullscreen {
        height: calc(100vh - 160px);
        flex: 1;
      }
      .map-panel.hidden {
        display: none;
      }
      .list-panel.fullscreen {
        height: calc(100vh - 160px);
        flex: 1;
      }
      .list-panel.hidden {
        display: none;
      }
      
      /* Card adjustments for mobile */
      .card-img { height: 140px; }
    }
    
    @media (max-width: 480px) {
      .header-inner { padding: 0.75rem 1rem; }
      .search-wrap { padding: 0.75rem 1rem; top: 60px; }
      .main { top: 140px; }
      .logo img { height: 32px; }
      .map-panel { height: 35vh; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="https://joe.coffee/images/joe-logo.svg" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Coffee Shops</a>
        <a href="/about/">About</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
      <button class="mobile-menu-btn" id="menuBtn">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </header>
  
  <nav class="mobile-nav" id="mobileNav">
    <div class="mobile-nav-header">
      <a href="/" class="logo"><img src="https://joe.coffee/images/joe-logo.svg" alt="joe" style="height:32px"></a>
      <button class="mobile-nav-close" id="menuClose">✕</button>
    </div>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee">Get the App</a>
  </nav>
  
  <div class="search-wrap">
    <form class="search-inner" action="/locations/search/" method="GET">
      <input type="text" name="q" class="search-input" value="${query || ''}" placeholder="Search shops, cities, or zip codes...">
      <button type="submit" class="btn-search">Search</button>
      <button type="button" class="btn-locate" id="locateBtn">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span>Use my location</span>
      </button>
      <div class="result-count">${shops.length} coffee shops found</div>
    </form>
  </div>
  
  <main class="main">
    <div class="list-panel" id="listPanel">
      <div class="list-scroll" id="listScroll">
        ${cards || '<div class="empty-state"><h2>No results found</h2><p>Try a different search or use your location</p></div>'}
      </div>
    </div>
    <div class="map-panel" id="mapPanel">
      <div id="map"></div>
    </div>
  </main>
  
  <button class="mobile-toggle" id="mobileToggle">Show List</button>
  
  <script>
    (function() {
      var shops = ${shopsJson};
      var markers = [];
      var activeCard = null;
      var activeMarker = null;
      var viewMode = 'split'; // 'split', 'map', 'list'
      
      // Initialize map
      mapboxgl.accessToken = '${MAPBOX_TOKEN}';
      var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [${userLng || shops[0]?.lng || -122.4194}, ${userLat || shops[0]?.lat || 47.6062}],
        zoom: 11
      });
      
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // Add markers when map loads
      map.on('load', function() {
        var bounds = new mapboxgl.LngLatBounds();
        
        shops.forEach(function(shop, i) {
          if (!shop.lat || !shop.lng) return;
          
          var el = document.createElement('div');
          el.className = 'marker-dot' + (shop.is_joe_partner ? ' marker-partner' : '');
          el.dataset.index = i;
          
          // CRITICAL: Pin click navigates to shop page
          el.addEventListener('click', function(e) {
            e.stopPropagation();
            window.location.href = shop.url;
          });
          
          var marker = new mapboxgl.Marker({ element: el })
            .setLngLat([shop.lng, shop.lat])
            .addTo(map);
          
          markers.push({ marker: marker, el: el, shop: shop, index: i });
          bounds.extend([shop.lng, shop.lat]);
        });
        
        // Add user location marker if available
        ${userLat && userLng ? `
        var userEl = document.createElement('div');
        userEl.className = 'user-marker';
        new mapboxgl.Marker({ element: userEl })
          .setLngLat([${userLng}, ${userLat}])
          .addTo(map);
        bounds.extend([${userLng}, ${userLat}]);
        ` : ''}
        
        // Fit to bounds
        if (shops.length > 0) {
          map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
        }
      });
      
      // Card click - highlight and pan to location
      document.querySelectorAll('.card').forEach(function(card) {
        card.addEventListener('click', function(e) {
          // Don't interfere with button clicks
          if (e.target.closest('.btn-view') || e.target.closest('.btn-order')) return;
          
          var idx = parseInt(card.dataset.index);
          var lat = parseFloat(card.dataset.lat);
          var lng = parseFloat(card.dataset.lng);
          var url = card.dataset.url;
          
          // On mobile, clicking card navigates to shop
          if (window.innerWidth <= 900) {
            window.location.href = url;
            return;
          }
          
          // Desktop: highlight card and pan map
          highlightCard(idx);
          map.flyTo({ center: [lng, lat], zoom: 14 });
        });
      });
      
      function highlightCard(idx) {
        // Remove previous highlight
        if (activeCard !== null) {
          var prevCard = document.querySelector('.card[data-index="' + activeCard + '"]');
          if (prevCard) prevCard.classList.remove('active');
          markers.forEach(function(m) { m.el.classList.remove('active'); });
        }
        
        // Add new highlight
        var card = document.querySelector('.card[data-index="' + idx + '"]');
        if (card) {
          card.classList.add('active');
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        markers.forEach(function(m) {
          if (m.index === idx) m.el.classList.add('active');
        });
        
        activeCard = idx;
      }
      
      // Mobile toggle
      var toggle = document.getElementById('mobileToggle');
      var mapPanel = document.getElementById('mapPanel');
      var listPanel = document.getElementById('listPanel');
      
      toggle.addEventListener('click', function() {
        if (viewMode === 'split' || viewMode === 'map') {
          // Show list fullscreen
          viewMode = 'list';
          mapPanel.classList.add('hidden');
          mapPanel.classList.remove('fullscreen');
          listPanel.classList.remove('hidden');
          listPanel.classList.add('fullscreen');
          toggle.textContent = 'Show Map';
        } else {
          // Show map fullscreen
          viewMode = 'map';
          listPanel.classList.add('hidden');
          listPanel.classList.remove('fullscreen');
          mapPanel.classList.remove('hidden');
          mapPanel.classList.add('fullscreen');
          toggle.textContent = 'Show List';
          map.resize();
        }
      });
      
      // Geolocation
      document.getElementById('locateBtn').addEventListener('click', function() {
        var btn = this;
        if (!navigator.geolocation) {
          alert('Geolocation is not supported by your browser');
          return;
        }
        btn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            window.location.href = '/locations/search/?lat=' + pos.coords.latitude + '&lng=' + pos.coords.longitude;
          },
          function(err) {
            btn.disabled = false;
            alert('Unable to get your location. Please try searching instead.');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
      
      // Mobile menu
      document.getElementById('menuBtn').addEventListener('click', function() {
        document.getElementById('mobileNav').classList.add('open');
      });
      document.getElementById('menuClose').addEventListener('click', function() {
        document.getElementById('mobileNav').classList.remove('open');
      });
      
      // Auto-locate on page load if no query
      ${!query && !userLat ? `
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            window.location.href = '/locations/search/?lat=' + pos.coords.latitude + '&lng=' + pos.coords.longitude;
          },
          function() {},
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
      ` : ''}
    })();
  </script>
</body>
</html>`;
}

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const query = params.q?.trim() || '';
    const userLat = parseFloat(params.lat) || null;
    const userLng = parseFloat(params.lng) || null;
    
    let shops = [];
    
    if (query) {
      shops = await smartSearch(query, userLat, userLng);
    } else if (userLat && userLng) {
      shops = await getNearbyShops(userLat, userLng, 50);
    }
    
    // Fallback if no results
    if (shops.length === 0) {
      const fallbackLat = userLat || 47.6062;
      const fallbackLng = userLng || -122.3321;
      shops = await getNearbyShops(fallbackLat, fallbackLng, 100, 50);
    }
    
    // Add distance if we have user location
    if (userLat && userLng) {
      shops = shops.map(shop => ({
        ...shop,
        distance: shop.distance || calculateDistance(userLat, userLng, shop.lat, shop.lng)
      }));
    }
    
    // Look up partner store IDs for order URLs
    const partnerIds = shops.filter(s => s.is_joe_partner).map(s => s.id);
    let partnerStoreIds = {};
    
    if (partnerIds.length > 0) {
      const { data: partners } = await supabase
        .from('partners')
        .select('shop_id, store_id')
        .in('shop_id', partnerIds);
      
      if (partners) {
        partners.forEach(p => {
          partnerStoreIds[p.shop_id] = p.store_id;
        });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: renderSearchPage(query, shops, userLat, userLng, partnerStoreIds)
    };

  } catch (err) {
    console.error('Search error:', err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: renderSearchPage('', [], null, null, {})
    };
  }
};