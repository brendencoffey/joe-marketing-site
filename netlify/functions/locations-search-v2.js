/**
 * Smart Locations Search v3
 * - List on LEFT, Map on RIGHT
 * - Nav matches homepage exactly
 * - No popup - clicking pin highlights card in list
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
    
    if (query) {
      shops = await smartSearch(query, userLat, userLng);
    } else if (userLat && userLng) {
      shops = await getNearbyShops(userLat, userLng, 50);
    }
    
    if (shops.length === 0) {
      const fallbackLat = userLat || 39.8283;
      const fallbackLng = userLng || -98.5795;
      shops = await getNearbyShops(fallbackLat, fallbackLng, 500, 20);
    }
    
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
      body: renderSearchPage(query, shops, userLat, userLng)
    };

  } catch (err) {
    console.error('Search error:', err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: renderSearchPage('', [], null, null)
    };
  }
};

const CHAIN_NAMES = ["starbucks", "dunkin", "peet's", "peets", "seattle's best", "caribou coffee", "tim hortons", "dutch bros", "coffee bean & tea leaf", "mcdonald's", "mcdonalds"];
const COMMON_CITIES = ['seattle', 'portland', 'san francisco', 'los angeles', 'new york', 'chicago', 'austin', 'denver', 'phoenix', 'dallas', 'houston', 'miami', 'atlanta', 'boston', 'philadelphia', 'tacoma', 'bellevue', 'spokane'];

function isChainCoffee(name) {
  const lower = name.toLowerCase();
  return CHAIN_NAMES.some(chain => lower.includes(chain));
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
  return COMMON_CITIES.includes(query.toLowerCase().trim());
}

async function smartSearch(query, userLat, userLng) {
  const searchTerm = query.toLowerCase().trim();
  const isZipCode = /^\d{5}$/.test(query);
  
  if (isZipCode) {
    const { data } = await supabase.from('shops').select('*').eq('zip', query).eq('is_active', true).not('lat', 'is', null).limit(50);
    if (data?.length > 0) return boostPartners(filterChains(data)).slice(0, 30);
  }
  
  if (isLikelyCity(searchTerm)) {
    const { data } = await supabase.from('shops').select('*').ilike('city', `${searchTerm}%`).eq('is_active', true).not('lat', 'is', null).limit(50);
    if (data?.length > 0) return boostPartners(filterChains(data)).slice(0, 30);
  }
  
  const { data: nameMatches } = await supabase.from('shops').select('*').ilike('name', `%${searchTerm}%`).eq('is_active', true).not('lat', 'is', null).limit(50);
  const filtered = nameMatches ? filterChains(nameMatches) : [];
  
  if (filtered.length > 0 && userLat && userLng) {
    const withDist = filtered.map(s => ({ ...s, distance: calculateDistance(userLat, userLng, s.lat, s.lng) }));
    const p = withDist.filter(s => s.is_joe_partner).sort((a, b) => a.distance - b.distance);
    const np = withDist.filter(s => !s.is_joe_partner).sort((a, b) => a.distance - b.distance);
    return [...p, ...np].slice(0, 30);
  }
  if (filtered.length > 0) return boostPartners(filtered).slice(0, 30);
  
  const { data: cityMatches } = await supabase.from('shops').select('*').ilike('city', `%${searchTerm}%`).eq('is_active', true).not('lat', 'is', null).limit(50);
  if (cityMatches?.length > 0) return boostPartners(filterChains(cityMatches)).slice(0, 30);
  
  return [];
}

async function getNearbyShops(lat, lng, radiusMiles = 50, limit = 30) {
  const radiusDeg = radiusMiles / 69;
  const { data } = await supabase.from('shops').select('*').eq('is_active', true).not('lat', 'is', null)
    .gte('lat', lat - radiusDeg).lte('lat', lat + radiusDeg)
    .gte('lng', lng - radiusDeg).lte('lng', lng + radiusDeg).limit(100);
  
  if (!data?.length) {
    const { data: fallback } = await supabase.from('shops').select('*').eq('is_active', true).not('lat', 'is', null)
      .order('google_rating', { ascending: false, nullsFirst: false }).limit(limit * 2);
    return boostPartners(filterChains(fallback || [])).slice(0, limit);
  }
  
  const filtered = filterChains(data);
  const withDist = filtered.map(s => ({ ...s, distance: calculateDistance(lat, lng, s.lat, s.lng) }));
  const p = withDist.filter(s => s.is_joe_partner).sort((a, b) => a.distance - b.distance);
  const np = withDist.filter(s => !s.is_joe_partner).sort((a, b) => a.distance - b.distance);
  return [...p, ...np].slice(0, limit);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function formatDist(m) { return m < 0.1 ? '< 0.1 mi' : m < 10 ? m.toFixed(1) + ' mi' : Math.round(m) + ' mi'; }
function getPhoto(s) { return s.photos?.[0] || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'; }

function renderSearchPage(query, shops, userLat, userLng) {
  const cards = shops.map((s, i) => {
    const url = '/locations/' + (s.state_code?.toLowerCase() || '') + '/' + (s.city_slug || '') + '/' + (s.slug || '') + '/';
    const dist = s.distance ? formatDist(s.distance) : '';
    const rating = s.google_rating ? parseFloat(s.google_rating).toFixed(1) : '';
    return `
      <div class="card" data-idx="${i}">
        <div class="card-img">
          <img src="${esc(getPhoto(s))}" alt="${esc(s.name)}" loading="lazy">
          ${s.is_joe_partner ? '<span class="partner-badge">☕ Order Ahead</span>' : ''}
        </div>
        <div class="card-body">
          <h3>${esc(s.name)}</h3>
          <div class="card-meta">${rating ? '⭐ ' + rating : ''}${s.google_reviews ? ' (' + s.google_reviews + ')' : ''}${dist ? '<span class="card-dist">' + dist + '</span>' : ''}</div>
          <p class="card-addr">${esc(s.address || '')}</p>
          <p class="card-city">${esc(s.city || '')}, ${s.state_code?.toUpperCase() || ''}</p>
          <div class="card-btns">
            <a href="${url}" class="btn-view">View</a>
            ${s.is_joe_partner ? '<a href="https://order.joe.coffee" class="btn-order">Order</a>' : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const markers = JSON.stringify(shops.map((s, i) => ({
    idx: i, lat: s.lat, lng: s.lng
  })));

  const center = shops.length ? { lat: shops[0].lat, lng: shops[0].lng, z: 11 } : { lat: 39.8283, lng: -98.5795, z: 4 };
  if (userLat && userLng) { center.lat = userLat; center.lng = userLng; center.z = 11; }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${query ? 'Coffee near "' + esc(query) + '"' : 'Find Coffee'} | joe</title>
  <link rel="icon" href="/images/logo.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"><\/script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--white:#fff;--black:#000;--gray-100:#f3f4f6;--gray-200:#e5e7eb;--gray-500:#6b7280;--gray-700:#374151}
    body{font-family:'Inter',system-ui,sans-serif;background:#fafafa;color:#111;min-height:100vh}
    
    /* Header - matches homepage exactly */
    .header{background:var(--white);position:fixed;top:0;left:0;right:0;z-index:100;border-bottom:1px solid var(--gray-200)}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    .logo{display:flex;align-items:center}
    .logo img{height:40px;width:auto}
    .nav{display:flex;align-items:center;gap:2.5rem}
    .nav a{font-size:0.95rem;font-weight:500;color:var(--gray-700);text-decoration:none;transition:color 0.3s}
    .nav a:hover{color:var(--black)}
    .btn{display:inline-flex;align-items:center;justify-content:center;padding:0.75rem 1.5rem;border-radius:100px;font-weight:600;font-size:0.95rem;cursor:pointer;border:none;text-decoration:none}
    .btn-primary{background:#000;color:#fff!important}
    .btn-primary:hover{background:#1F2937}
    
    /* Mobile menu button */
    .mobile-menu-btn{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:10px;z-index:1001}
    .mobile-menu-btn span{display:block;width:24px;height:2px;background:#111;transition:all 0.3s ease}
    .mobile-menu-btn.active span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}
    .mobile-menu-btn.active span:nth-child(2){opacity:0}
    .mobile-menu-btn.active span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}
    
    /* Mobile menu panel */
    .mobile-menu{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:200;padding:2rem;flex-direction:column}
    .mobile-menu.open{display:flex}
    .mobile-menu-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem}
    .mobile-menu-header img{height:40px}
    .mobile-menu-close{font-size:28px;cursor:pointer;padding:10px}
    .mobile-menu a{font-size:1.25rem;color:#111;text-decoration:none;padding:1rem 0;border-bottom:1px solid var(--gray-200)}
    .mobile-menu .btn{margin-top:1rem;text-align:center}
    
    /* Search bar below header */
    .search-bar{background:var(--white);border-bottom:1px solid var(--gray-200);padding:12px 1.5rem;margin-top:73px}
    .search-bar-inner{max-width:1280px;margin:0 auto;display:flex;gap:10px;align-items:center}
    .search-input{flex:1;max-width:400px;padding:10px 14px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px;font-family:inherit}
    .search-input:focus{outline:none;border-color:#111}
    .btn-search{padding:10px 20px;background:#000;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
    .btn-locate{padding:10px;background:var(--white);border:1px solid var(--gray-200);border-radius:8px;cursor:pointer;display:flex;align-items:center}
    .btn-locate svg{width:18px;height:18px}
    .search-count{font-size:13px;color:var(--gray-500);margin-left:auto}
    
    /* Main layout - List LEFT, Map RIGHT */
    .main{display:flex;height:calc(100vh - 130px)}
    .list-panel{width:450px;background:var(--white);border-right:1px solid var(--gray-200);display:flex;flex-direction:column;overflow:hidden}
    .list-scroll{flex:1;overflow-y:auto;padding:16px}
    .map-panel{flex:1;position:relative}
    #map{width:100%;height:100%}
    
    /* Cards */
    .card{background:var(--white);border:1px solid var(--gray-200);border-radius:12px;overflow:hidden;margin-bottom:12px;cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s}
    .card:hover,.card.active{border-color:#111;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
    .card-img{height:140px;position:relative;overflow:hidden}
    .card-img img{width:100%;height:100%;object-fit:cover}
    .partner-badge{position:absolute;top:10px;left:10px;background:#000;color:#fff;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600}
    .card-body{padding:12px 14px}
    .card-body h3{font-size:15px;font-weight:600;margin-bottom:4px}
    .card-meta{font-size:12px;color:var(--gray-500);margin-bottom:6px;display:flex;gap:4px}
    .card-dist{margin-left:auto}
    .card-addr,.card-city{font-size:12px;color:var(--gray-500);line-height:1.4}
    .card-btns{display:flex;gap:8px;margin-top:10px}
    .btn-view,.btn-order{flex:1;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;text-decoration:none;transition:background 0.15s}
    .btn-view{background:var(--gray-100);color:#111;border:1px solid var(--gray-200)}
    .btn-view:hover{background:var(--gray-200)}
    .btn-order{background:#000;color:#fff}
    .btn-order:hover{background:#333}
    
    /* Map marker */
    .marker-dot{width:14px;height:14px;background:#000;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer}
    .marker-dot.active{width:18px;height:18px;margin:-2px 0 0 -2px}
    
    .empty{padding:40px 20px;text-align:center}
    .empty h2{font-size:18px;margin-bottom:8px}
    .empty p{color:var(--gray-500)}
    
    /* Mobile toggle */
    .mobile-toggle{display:none}
    
    /* Mobile styles */
    @media(max-width:768px){
      .nav{display:none}
      .mobile-menu-btn{display:flex}
      .search-bar{margin-top:73px;padding:10px 16px}
      .search-bar-inner{flex-wrap:wrap}
      .search-input{max-width:none;flex:1 1 auto}
      .search-count{width:100%;margin:8px 0 0 0}
      .main{flex-direction:column;height:auto;min-height:calc(100vh - 180px)}
      .list-panel{width:100%;border-right:none;order:2}
      .map-panel{height:250px;flex:none;order:1}
      .list-scroll{padding:12px}
      .card{display:flex;flex-direction:row}
      .card-img{width:100px;height:100px;flex-shrink:0}
      .card-body{flex:1;padding:10px 12px}
      .card-body h3{font-size:14px}
      .card-btns{flex-direction:column;gap:6px}
      .btn-view,.btn-order{padding:6px 10px;font-size:12px}
      .mobile-toggle{display:block;position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#000;color:#fff;padding:12px 24px;border-radius:50px;border:none;font-weight:600;font-size:14px;cursor:pointer;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,0.2)}
    }
  </style>
</head>
<body>
  <!-- Header - matches homepage -->
  <header class="header">
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
  
  <!-- Mobile Menu -->
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

  <!-- Search Bar -->
  <div class="search-bar">
    <div class="search-bar-inner">
      <form action="/.netlify/functions/locations-search-v2" method="GET" style="display:contents">
        <input type="text" name="q" class="search-input" placeholder="Search shops, cities, or zip codes..." value="${esc(query)}">
        <button type="submit" class="btn-search">Search</button>
      </form>
      <button type="button" class="btn-locate" id="locateBtn">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
      </button>
      <span class="search-count">${shops.length} coffee shop${shops.length !== 1 ? 's' : ''} found</span>
    </div>
  </div>

  <!-- Main: List LEFT, Map RIGHT -->
  <main class="main">
    <div class="list-panel">
      <div class="list-scroll" id="listScroll">
        ${shops.length ? cards : '<div class="empty"><h2>Find your perfect coffee</h2><p>Search by name, city, or zip code</p></div>'}
      </div>
    </div>
    <div class="map-panel">
      <div id="map"></div>
    </div>
  </main>
  
  <button class="mobile-toggle" id="mobileToggle">Show Map</button>

  <script>
    (function(){
      mapboxgl.accessToken='${MAPBOX_TOKEN}';
      var shopData=${markers};
      var center=${JSON.stringify(center)};
      var isMobile=window.innerWidth<=768;
      var activeIdx=-1;
      var markerDots=[];
      
      var map=new mapboxgl.Map({
        container:'map',
        style:'mapbox://styles/mapbox/light-v11',
        center:[center.lng,center.lat],
        zoom:center.z
      });
      
      map.addControl(new mapboxgl.NavigationControl(),'top-right');
      
      // Create markers
      shopData.forEach(function(shop){
        var dot=document.createElement('div');
        dot.className='marker-dot';
        
        new mapboxgl.Marker({element:dot,anchor:'center'})
          .setLngLat([shop.lng,shop.lat])
          .addTo(map);
        
        markerDots[shop.idx]=dot;
        
        dot.addEventListener('click',function(e){
          e.stopPropagation();
          selectShop(shop.idx);
        });
      });
      
      // Fit bounds
      if(shopData.length>1){
        var bounds=new mapboxgl.LngLatBounds();
        shopData.forEach(function(s){bounds.extend([s.lng,s.lat])});
        map.fitBounds(bounds,{padding:50,maxZoom:14});
      }
      
      function selectShop(idx){
        // Clear previous
        if(activeIdx>=0&&markerDots[activeIdx]){
          markerDots[activeIdx].classList.remove('active');
        }
        document.querySelectorAll('.card.active').forEach(function(c){c.classList.remove('active')});
        
        // Set new active
        activeIdx=idx;
        if(markerDots[idx])markerDots[idx].classList.add('active');
        
        var card=document.querySelector('.card[data-idx="'+idx+'"]');
        if(card){
          card.classList.add('active');
          var listScroll=document.getElementById('listScroll');
          listScroll.scrollTo({top:card.offsetTop-listScroll.offsetTop-10,behavior:'smooth'});
        }
        
        // Zoom map
        var shop=shopData[idx];
        if(shop)map.flyTo({center:[shop.lng,shop.lat],zoom:15});
      }
      
      // Card interactions
      document.querySelectorAll('.card').forEach(function(card){
        var idx=parseInt(card.getAttribute('data-idx'));
        
        card.addEventListener('mouseenter',function(){
          if(!isMobile&&markerDots[idx])markerDots[idx].classList.add('active');
        });
        
        card.addEventListener('mouseleave',function(){
          if(!isMobile&&activeIdx!==idx&&markerDots[idx])markerDots[idx].classList.remove('active');
        });
        
        card.addEventListener('click',function(e){
          if(e.target.closest('a'))return;
          selectShop(idx);
        });
      });
      
      // Mobile menu
      var menuBtn=document.getElementById('mobileMenuBtn');
      var menuClose=document.getElementById('mobileMenuClose');
      var mobileMenu=document.getElementById('mobileMenu');
      
      if(menuBtn)menuBtn.addEventListener('click',function(){
        this.classList.toggle('active');
        mobileMenu.classList.add('open');
      });
      if(menuClose)menuClose.addEventListener('click',function(){
        menuBtn.classList.remove('active');
        mobileMenu.classList.remove('open');
      });
      
      // Mobile map toggle
      var mobileToggle=document.getElementById('mobileToggle');
      var mapPanel=document.querySelector('.map-panel');
      var listPanel=document.querySelector('.list-panel');
      var showingMap=false;
      
      if(mobileToggle)mobileToggle.addEventListener('click',function(){
        showingMap=!showingMap;
        if(showingMap){
          mapPanel.style.height='calc(100vh - 180px)';
          listPanel.style.display='none';
          mobileToggle.textContent='Show List';
        }else{
          mapPanel.style.height='250px';
          listPanel.style.display='flex';
          mobileToggle.textContent='Show Map';
        }
        map.resize();
      });
      
      // Geolocation
      var locateBtn=document.getElementById('locateBtn');
      if(locateBtn)locateBtn.addEventListener('click',function(){
        if(!navigator.geolocation){alert('Geolocation not supported');return}
        this.disabled=true;
        var btn=this;
        navigator.geolocation.getCurrentPosition(
          function(p){location.href='/.netlify/functions/locations-search-v2?lat='+p.coords.latitude+'&lng='+p.coords.longitude},
          function(){btn.disabled=false;alert('Unable to get location')},
          {enableHighAccuracy:true,timeout:10000}
        );
      });
      
      // Auto-locate if no query
      ${!query && !userLat ? `
      if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(
          function(p){location.href='/.netlify/functions/locations-search-v2?lat='+p.coords.latitude+'&lng='+p.coords.longitude},
          function(){},
          {enableHighAccuracy:true,timeout:5000}
        );
      }` : ''}
    })();
  <\/script>
</body>
</html>`;
}