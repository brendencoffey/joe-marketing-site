/**
 * Locations Search - FIXED
 * - Looks up partner store_ids for proper Order Ahead URLs
 * - User location blue pulsing dot
 * - Map zooms to include user location + nearby shops
 * - Clean /locations/search/ URLs
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
      shops = await getNearbyShops(userLat, userLng, 25); // Tighter radius
    }
    
    if (shops.length === 0) {
      const fallbackLat = userLat || 39.8283;
      const fallbackLng = userLng || -98.5795;
      shops = await getNearbyShops(fallbackLat, fallbackLng, 100, 50);
    }
    
    if (userLat && userLng) {
      shops = shops.map(shop => ({
        ...shop,
        distance: shop.distance || calculateDistance(userLat, userLng, shop.lat, shop.lng)
      }));
      
      // Sort by distance, with partners getting a slight boost (show 20% closer than they are)
      shops.sort((a, b) => {
        const aDist = a.distance * (a.is_joe_partner ? 0.8 : 1);
        const bDist = b.distance * (b.is_joe_partner ? 0.8 : 1);
        return aDist - bDist;
      });
    }

    // Add order_url flag - only if ordering_url contains shop.joe.coffee
    shops = shops.map(shop => {
      const hasJoeOrdering = shop.ordering_url && shop.ordering_url.includes('shop.joe.coffee');
      return {
        ...shop,
        order_url: hasJoeOrdering ? shop.ordering_url : null
      };
    });

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
const COMMON_CITIES = ['seattle', 'portland', 'san francisco', 'los angeles', 'new york', 'chicago', 'austin', 'denver', 'phoenix', 'dallas', 'houston', 'miami', 'atlanta', 'boston', 'philadelphia', 'tacoma', 'bellevue', 'spokane', 'gig harbor', 'puyallup', 'olympia'];

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
  let searchTerm = query.toLowerCase().trim();
  const isZipCode = /^\d{5}$/.test(query);
  
  // Handle "City, STATE" format - strip state suffix
  const cityStateMatch = searchTerm.match(/^(.+),\s*([a-z]{2})$/i);
  if (cityStateMatch) {
    searchTerm = cityStateMatch[1].trim();
  }
  
  if (isZipCode) {
    const { data } = await supabase.from('shops').select('*').eq('zip', query).eq('is_active', true).not('lat', 'is', null).limit(200);
    if (data?.length > 0) return filterChains(data).slice(0, 100);
  }
  
  // Always try city search first for cleaner terms
  const { data: cityData } = await supabase.from('shops').select('*').ilike('city', `${searchTerm}%`).eq('is_active', true).not('lat', 'is', null).limit(200);
  if (cityData?.length > 0) {
    const filtered = filterChains(cityData);
    if (userLat && userLng) {
      const withDist = filtered.map(s => ({ ...s, distance: calculateDistance(userLat, userLng, s.lat, s.lng) }));
      withDist.sort((a, b) => {
        const aDist = a.distance * (a.is_joe_partner ? 0.8 : 1);
        const bDist = b.distance * (b.is_joe_partner ? 0.8 : 1);
        return aDist - bDist;
      });
      return withDist.slice(0, 100);
    }
    return filtered.slice(0, 100);
  }
  
  // Try name search
  const { data: nameMatches } = await supabase.from('shops').select('*').ilike('name', `%${searchTerm}%`).eq('is_active', true).not('lat', 'is', null).limit(200);
  const filtered = nameMatches ? filterChains(nameMatches) : [];
  
  if (filtered.length > 0 && userLat && userLng) {
    const withDist = filtered.map(s => ({ ...s, distance: calculateDistance(userLat, userLng, s.lat, s.lng) }));
    withDist.sort((a, b) => {
      const aDist = a.distance * (a.is_joe_partner ? 0.8 : 1);
      const bDist = b.distance * (b.is_joe_partner ? 0.8 : 1);
      return aDist - bDist;
    });
    return withDist.slice(0, 100);
  }
  if (filtered.length > 0) return filtered.slice(0, 100);
  
  return [];
}

async function getNearbyShops(lat, lng, radiusMiles = 25, limit = 50) {
  const radiusDeg = radiusMiles / 69;
  const { data } = await supabase.from('shops').select('*').eq('is_active', true).not('lat', 'is', null)
    .gte('lat', lat - radiusDeg).lte('lat', lat + radiusDeg)
    .gte('lng', lng - radiusDeg).lte('lng', lng + radiusDeg).limit(300);
  
  if (!data?.length) {
    const { data: fallback } = await supabase.from('shops').select('*').eq('is_active', true).not('lat', 'is', null)
      .order('google_rating', { ascending: false, nullsFirst: false }).limit(limit);
    return boostPartners(filterChains(fallback || [])).slice(0, limit);
  }
  
  const filtered = filterChains(data);
  const withDist = filtered.map(s => ({ ...s, distance: calculateDistance(lat, lng, s.lat, s.lng) }));
  // Sort by distance with slight partner boost
  withDist.sort((a, b) => {
    const aDist = a.distance * (a.is_joe_partner ? 0.8 : 1);
    const bDist = b.distance * (b.is_joe_partner ? 0.8 : 1);
    return aDist - bDist;
  });
  return withDist.slice(0, limit);
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
    const url = '/locations/' + (s.state_code?.toLowerCase() || 'us') + '/' + (s.city_slug || 'unknown') + '/' + (s.slug || s.id) + '/';
    const dist = s.distance ? formatDist(s.distance) : '';
    const rating = s.google_rating ? parseFloat(s.google_rating).toFixed(1) : '';
    const hasOrderUrl = s.order_url;
    
    return `
      <div class="card" data-idx="${i}">
        <div class="card-img">
          <img src="${esc(getPhoto(s))}" alt="${esc(s.name)}" loading="lazy">
          ${hasOrderUrl ? '<span class="partner-badge">☕ Order Ahead</span>' : ''}
        </div>
        <div class="card-body">
          <h3>${esc(s.name)}</h3>
          <div class="card-meta">${rating ? '⭐ ' + rating : ''}${s.google_reviews ? ' (' + s.google_reviews + ')' : ''}${dist ? '<span class="card-dist">' + dist + '</span>' : ''}</div>
          <p class="card-addr">${esc(s.address || '')}</p>
          <p class="card-city">${esc(s.city || '')}, ${s.state_code?.toUpperCase() || ''}</p>
          <div class="card-btns">
            <a href="${url}" class="btn-view">View</a>
            ${hasOrderUrl ? `<a href="${esc(s.order_url)}" class="btn-order" target="_blank">☕ Order</a>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const markers = JSON.stringify(shops.slice(0, 50).map((s, i) => ({
    idx: i, lat: s.lat, lng: s.lng, partner: !!s.order_url
  })));

  // Center on user if available, else first shop
  const center = userLat && userLng 
    ? { lat: userLat, lng: userLng, z: 12 }
    : shops.length 
      ? { lat: shops[0].lat, lng: shops[0].lng, z: 12 } 
      : { lat: 39.8283, lng: -98.5795, z: 4 };

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
    :root{--white:#fff;--black:#000;--gray-100:#f3f4f6;--gray-200:#e5e7eb;--gray-500:#6b7280;--gray-700:#374151;--blue-500:#3b82f6}
    body{font-family:'Inter',system-ui,sans-serif;background:#fafafa;color:#111;min-height:100vh}
    
    /* Header */
    .header{background:var(--white);position:fixed;top:0;left:0;right:0;z-index:100;border-bottom:1px solid var(--gray-200)}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px;width:auto}
    .nav{display:flex;align-items:center;gap:2.5rem}
    .nav a{font-size:0.95rem;font-weight:500;color:var(--gray-700);text-decoration:none}
    .nav a:hover{color:var(--black)}
    .btn{display:inline-flex;align-items:center;justify-content:center;padding:0.75rem 1.5rem;border-radius:100px;font-weight:600;font-size:0.95rem;cursor:pointer;border:none;text-decoration:none}
    .btn-primary{background:#000;color:#fff!important}
    
    .mobile-menu-btn{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:10px}
    .mobile-menu-btn span{display:block;width:24px;height:2px;background:#111}
    .mobile-menu{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:200;padding:2rem;flex-direction:column}
    .mobile-menu.open{display:flex}
    .mobile-menu-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem}
    .mobile-menu-header img{height:40px}
    .mobile-menu-close{font-size:28px;cursor:pointer;padding:10px;background:none;border:none}
    .mobile-menu a{font-size:1.25rem;color:#111;text-decoration:none;padding:1rem 0;border-bottom:1px solid var(--gray-200)}
    .mobile-menu .btn{margin-top:1rem;text-align:center}
    
    @media(max-width:768px){.nav{display:none}.mobile-menu-btn{display:flex}}
    
    /* Search Bar */
    .search-bar{position:fixed;top:73px;left:0;right:0;z-index:90;background:var(--white);border-bottom:1px solid var(--gray-200);padding:0.75rem 1.5rem}
    .search-bar-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;gap:0.75rem}
    .search-input{flex:1;padding:0.75rem 1rem;border:1px solid var(--gray-200);border-radius:8px;font-size:1rem;font-family:inherit}
    .search-input:focus{outline:none;border-color:var(--black)}
    .btn-search{background:var(--black);color:var(--white);padding:0.75rem 1.5rem;border:none;border-radius:8px;font-weight:600;cursor:pointer}
    .btn-locate{background:var(--white);border:1px solid var(--gray-200);border-radius:8px;padding:0.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .btn-locate svg{width:20px;height:20px}
    .btn-locate:hover{border-color:var(--black)}
    .search-count{color:var(--gray-500);font-size:0.9rem;white-space:nowrap}
    @media(max-width:768px){.search-count{display:none}}
    
    /* Main Layout */
    .main{display:flex;height:calc(100vh - 130px);margin-top:130px}
    .list-panel{width:420px;display:flex;flex-direction:column;background:var(--white);border-right:1px solid var(--gray-200)}
    .list-scroll{flex:1;overflow-y:auto;padding:1rem}
    .map-panel{flex:1;position:relative}
    #map{width:100%;height:100%}
    
    @media(max-width:900px){
      .main{flex-direction:column-reverse}
      .list-panel{width:100%;height:auto;flex:1;border-right:none;border-top:1px solid var(--gray-200)}
      .map-panel{height:250px;flex:none}
    }
    
    /* Cards */
    .card{background:var(--white);border:1px solid var(--gray-200);border-radius:12px;overflow:hidden;margin-bottom:1rem;transition:all 0.2s}
    .card.active{border-color:var(--black);box-shadow:0 4px 12px rgba(0,0,0,0.1)}
    @media(min-width:901px){.card{cursor:pointer}.card:hover{border-color:var(--black);box-shadow:0 4px 12px rgba(0,0,0,0.1)}}
    .card-img{position:relative;height:160px;overflow:hidden}
    .card-img img{width:100%;height:100%;object-fit:cover}
    .partner-badge{position:absolute;top:0.75rem;left:0.75rem;background:var(--black);color:var(--white);padding:0.35rem 0.75rem;border-radius:100px;font-size:0.8rem;font-weight:600}
    .card-body{padding:1rem}
    .card-body h3{font-size:1.1rem;margin-bottom:0.25rem}
    .card-meta{font-size:0.9rem;color:var(--gray-500);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem}
    .card-dist{margin-left:auto;font-weight:500}
    .card-addr,.card-city{font-size:0.85rem;color:var(--gray-500);margin-bottom:0.25rem}
    .card-btns{display:flex;gap:0.5rem;margin-top:0.75rem}
    .btn-view,.btn-order{flex:1;padding:0.6rem;border-radius:8px;font-size:0.9rem;font-weight:600;text-align:center;text-decoration:none}
    .btn-view{background:var(--gray-100);color:var(--black)}
    .btn-order{background:var(--black);color:var(--white)}
    
    .empty{text-align:center;padding:3rem 1rem;color:var(--gray-500)}
    .empty h2{color:var(--black);margin-bottom:0.5rem}
    
    /* Map Markers */
    .marker-dot{width:14px;height:14px;background:var(--black);border:2px solid var(--white);border-radius:50%;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.3)}
    .marker-dot.partner{background:#16a34a}
    .marker-dot.active,.marker-dot:hover{transform:scale(1.4);z-index:10}
    
    /* User Location Marker */
    .user-location{width:18px;height:18px;background:var(--blue-500);border:3px solid var(--white);border-radius:50%;box-shadow:0 0 0 2px var(--blue-500),0 2px 8px rgba(59,130,246,0.5);animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{box-shadow:0 0 0 2px var(--blue-500),0 2px 8px rgba(59,130,246,0.5)}50%{box-shadow:0 0 0 6px rgba(59,130,246,0.3),0 2px 8px rgba(59,130,246,0.5)}}
    
    /* Mobile Toggle */
    .mobile-toggle{display:none;position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:var(--black);color:var(--white);border:none;padding:0.75rem 2rem;border-radius:100px;font-weight:600;cursor:pointer;z-index:80;box-shadow:0 4px 12px rgba(0,0,0,0.2)}
    @media(max-width:900px){.mobile-toggle{display:block}}
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
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
      <button class="mobile-menu-close" id="mobileMenuClose">✕</button>
    </div>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
  </div>

  <div class="search-bar">
    <div class="search-bar-inner">
      <form action="/locations/search/" method="GET" style="display:contents">
        <input type="text" name="q" class="search-input" placeholder="Search shops, cities, or zip codes..." value="${esc(query)}">
        <button type="submit" class="btn-search">Search</button>
      </form>
      <button type="button" class="btn-locate" id="locateBtn" title="Use my location">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
      </button>
      <span class="search-count">${shops.length} coffee shop${shops.length !== 1 ? 's' : ''} found</span>
    </div>
  </div>

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
      var userLat=${userLat || 'null'};
      var userLng=${userLng || 'null'};
      var center=${JSON.stringify(center)};
      var isMobile=window.innerWidth<=900;
      var activeIdx=-1;
      var markerDots=[];
      
      var map=new mapboxgl.Map({
        container:'map',
        style:'mapbox://styles/mapbox/light-v11',
        center:[center.lng,center.lat],
        zoom:center.z
      });
      
      map.addControl(new mapboxgl.NavigationControl(),'top-right');
      
      // Add user location marker
      if(userLat&&userLng){
        var userEl=document.createElement('div');
        userEl.className='user-location';
        new mapboxgl.Marker({element:userEl,anchor:'center'})
          .setLngLat([userLng,userLat])
          .addTo(map);
      }
      
      // Create shop markers
      shopData.forEach(function(shop){
        var dot=document.createElement('div');
        dot.className='marker-dot'+(shop.partner?' partner':'');
        
        new mapboxgl.Marker({element:dot,anchor:'center'})
          .setLngLat([shop.lng,shop.lat])
          .addTo(map);
        
        markerDots[shop.idx]=dot;
        
        dot.addEventListener('click',function(e){
          e.stopPropagation();
          selectShop(shop.idx);
        });
      });
      
      // Fit bounds to include user location and first 10 shops
      map.on('load',function(){
        if(shopData.length>0){
          var bounds=new mapboxgl.LngLatBounds();
          
          // Add user location
          if(userLat&&userLng){
            bounds.extend([userLng,userLat]);
          }
          
          // Add first 10 shops (closest ones)
          shopData.slice(0,10).forEach(function(s){
            bounds.extend([s.lng,s.lat]);
          });
          
          map.fitBounds(bounds,{padding:60,maxZoom:13});
        }
      });
      
      function selectShop(idx){
        if(activeIdx>=0&&markerDots[activeIdx]){
          markerDots[activeIdx].classList.remove('active');
        }
        document.querySelectorAll('.card.active').forEach(function(c){c.classList.remove('active')});
        
        activeIdx=idx;
        if(markerDots[idx])markerDots[idx].classList.add('active');
        
        var card=document.querySelector('.card[data-idx="'+idx+'"]');
        if(card){
          card.classList.add('active');
          var listScroll=document.getElementById('listScroll');
          var containerRect=listScroll.getBoundingClientRect();
          var cardRect=card.getBoundingClientRect();
          var scrollOffset=cardRect.top-containerRect.top+listScroll.scrollTop;
          listScroll.scrollTo({top:scrollOffset,behavior:'smooth'});
        }
        
        var shop=shopData[idx];
        if(shop)map.flyTo({center:[shop.lng,shop.lat],zoom:14});
      }
      
      // Card interactions - click to select only on desktop
      document.querySelectorAll('.card').forEach(function(card){
        var idx=parseInt(card.getAttribute('data-idx'));
        
        card.addEventListener('mouseenter',function(){
          if(!isMobile&&markerDots[idx])markerDots[idx].classList.add('active');
        });
        
        card.addEventListener('mouseleave',function(){
          if(!isMobile&&activeIdx!==idx&&markerDots[idx])markerDots[idx].classList.remove('active');
        });
        
        // Only handle card clicks on desktop
        if(!isMobile){
          card.addEventListener('click',function(e){
            if(e.target.closest('a'))return;
            selectShop(idx);
          });
        }
      });
      
      // Mobile menu
      var menuBtn=document.getElementById('mobileMenuBtn');
      var menuClose=document.getElementById('mobileMenuClose');
      var mobileMenu=document.getElementById('mobileMenu');
      
      if(menuBtn)menuBtn.addEventListener('click',function(){
        mobileMenu.classList.add('open');
        document.body.style.overflow='hidden';
      });
      if(menuClose)menuClose.addEventListener('click',function(){
        mobileMenu.classList.remove('open');
        document.body.style.overflow='';
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
      
      // Geolocation button
      var locateBtn=document.getElementById('locateBtn');
      if(locateBtn)locateBtn.addEventListener('click',function(){
        if(!navigator.geolocation){alert('Geolocation not supported');return}
        this.disabled=true;
        var btn=this;
        navigator.geolocation.getCurrentPosition(
          function(p){location.href='/locations/search/?lat='+p.coords.latitude+'&lng='+p.coords.longitude},
          function(){btn.disabled=false;alert('Unable to get location')},
          {enableHighAccuracy:true,timeout:10000}
        );
      });
    })();
  <\/script>
</body>
</html>`;
}