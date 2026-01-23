/**
 * Smart Locations Search v3
 * - Desktop: Split panel OR full list view (toggle)
 * - Mobile: Map on top, list below
 * - Plain dot pins (fixed click handler)
 * - Black buttons (no orange)
 * - Joe partners boosted
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
      <div class="card" data-i="${i}" data-lat="${s.lat}" data-lng="${s.lng}">
        <div class="card-img">
          <img src="${esc(getPhoto(s))}" alt="${esc(s.name)}" loading="lazy">
          ${s.is_joe_partner ? '<span class="badge">☕ Order Ahead</span>' : ''}
        </div>
        <div class="card-body">
          <h3>${esc(s.name)}</h3>
          <div class="meta">${rating ? '⭐ ' + rating : ''}${s.google_reviews ? ' (' + s.google_reviews + ')' : ''}${dist ? '<span class="dist">' + dist + '</span>' : ''}</div>
          <p class="addr">${esc(s.address || '')}</p>
          <p class="city">${esc(s.city || '')}, ${s.state_code?.toUpperCase() || ''}</p>
          <div class="btns">
            <a href="${url}" class="btn-secondary">View</a>
            ${s.is_joe_partner ? '<a href="https://order.joe.coffee" class="btn-primary">Order</a>' : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const markers = JSON.stringify(shops.map((s, i) => ({
    i, lat: s.lat, lng: s.lng, name: s.name, addr: s.address || '', city: s.city || '', state: s.state_code?.toUpperCase() || '',
    rating: s.google_rating, reviews: s.google_reviews || 0, photo: getPhoto(s),
    url: '/locations/' + (s.state_code?.toLowerCase() || '') + '/' + (s.city_slug || '') + '/' + (s.slug || '') + '/',
    partner: s.is_joe_partner || false
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
    :root{--bg:#fafafa;--white:#fff;--text:#1a1a1a;--muted:#666;--border:#e5e5e5;--black:#1a1a1a}
    body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden}
    
    .header{background:var(--white);border-bottom:1px solid var(--border);padding:0 20px;height:56px;display:flex;align-items:center;position:fixed;top:0;left:0;right:0;z-index:100}
    .header-inner{max-width:1600px;margin:0 auto;width:100%;display:flex;align-items:center;gap:20px}
    .logo img{height:26px}
    .search-form{display:flex;gap:8px;flex:1;max-width:480px}
    .search-input{flex:1;padding:9px 14px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit}
    .search-input:focus{outline:none;border-color:var(--text)}
    .btn-search{padding:9px 16px;background:var(--black);color:var(--white);border:none;border-radius:8px;font-weight:600;cursor:pointer}
    .btn-locate{padding:9px;background:var(--white);border:1px solid var(--border);border-radius:8px;cursor:pointer;display:flex}
    .btn-locate svg{width:18px;height:18px}
    .nav{display:flex;gap:20px;align-items:center;margin-left:auto}
    .nav a{color:var(--text);text-decoration:none;font-size:14px;font-weight:500}
    .nav .btn-app{background:var(--black);color:var(--white);padding:8px 14px;border-radius:8px}
    .menu-btn{display:none;background:none;border:none;cursor:pointer;padding:8px}
    .menu-btn svg{width:24px;height:24px}
    
    .view-toggle{display:flex;gap:4px;background:#f0f0f0;padding:3px;border-radius:8px;margin-left:16px}
    .view-btn{padding:6px 12px;border:none;background:transparent;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px}
    .view-btn.active{background:var(--white);box-shadow:0 1px 3px rgba(0,0,0,0.1)}
    .view-btn svg{width:14px;height:14px}
    
    .main{display:flex;height:calc(100vh - 56px);margin-top:56px}
    .map-panel{flex:1;position:relative}
    .map-panel.hidden{display:none}
    #map{width:100%;height:100%}
    
    .list-panel{width:400px;background:var(--white);border-left:1px solid var(--border);display:flex;flex-direction:column}
    .list-panel.full-width{width:100%;border-left:none}
    .list-header{padding:14px 16px;border-bottom:1px solid var(--border);font-size:13px;color:var(--muted)}
    .list-scroll{flex:1;overflow-y:auto;padding:12px}
    
    .list-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
    
    .card{background:var(--white);border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:all .15s}
    .card:hover,.card.active{border-color:var(--black);box-shadow:0 3px 10px rgba(0,0,0,.1)}
    .card-img{height:120px;position:relative;overflow:hidden}
    .card-img img{width:100%;height:100%;object-fit:cover}
    .badge{position:absolute;top:8px;left:8px;background:var(--black);color:var(--white);padding:3px 7px;border-radius:5px;font-size:11px;font-weight:600}
    .card-body{padding:10px 12px}
    .card-body h3{font-size:14px;font-weight:600;margin-bottom:3px}
    .meta{font-size:12px;color:var(--muted);margin-bottom:4px;display:flex;gap:4px}
    .dist{margin-left:auto}
    .addr,.city{font-size:11px;color:var(--muted)}
    .btns{display:flex;gap:6px;margin-top:8px}
    .btn-secondary,.btn-primary{flex:1;padding:7px;border-radius:6px;font-size:12px;font-weight:600;text-align:center;text-decoration:none;transition:all .15s}
    .btn-secondary{background:var(--bg);color:var(--text);border:1px solid var(--border)}
    .btn-secondary:hover{background:#eee}
    .btn-primary{background:var(--black);color:var(--white);border:none}
    .btn-primary:hover{background:#333}
    
    .mapboxgl-popup{max-width:260px!important}
    .mapboxgl-popup-content{padding:0;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.2)}
    .mapboxgl-popup-close-button{font-size:18px;padding:6px 8px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)}
    .popup-img{width:100%;height:110px;object-fit:cover}
    .popup-body{padding:10px}
    .popup-badge{display:inline-block;background:var(--black);color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;margin-bottom:4px}
    .popup-name{font-weight:600;font-size:14px;margin-bottom:2px}
    .popup-meta{font-size:12px;color:#666;margin-bottom:2px}
    .popup-addr{font-size:11px;color:#888;margin-bottom:8px}
    .popup-btns{display:flex;gap:6px}
    .popup-btn{flex:1;padding:8px;border-radius:6px;font-size:12px;font-weight:600;text-align:center;text-decoration:none}
    .popup-btn-view{background:#f3f4f6;color:#1a1a1a}
    .popup-btn-order{background:var(--black);color:#fff}
    
    .empty{padding:40px 20px;text-align:center}
    .empty h2{font-size:16px;margin-bottom:6px}
    .empty p{color:var(--muted);font-size:13px}
    
    .mobile-toggle{display:none}
    .mobile-menu{display:none;position:fixed;inset:0;background:var(--white);z-index:200;padding:20px;flex-direction:column}
    .mobile-menu.open{display:flex}
    .mobile-menu-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px}
    .mobile-menu-close{background:none;border:none;font-size:24px;cursor:pointer}
    .mobile-menu-links{display:flex;flex-direction:column;gap:20px}
    .mobile-menu-links a{color:var(--text);text-decoration:none;font-size:17px;font-weight:500}
    
    @media(max-width:768px){
      body{height:auto;overflow:auto}
      .search-form,.nav,.view-toggle{display:none}
      .menu-btn{display:block}
      .main{flex-direction:column;height:auto;min-height:calc(100vh - 56px)}
      .map-panel{height:220px;flex:none}
      .map-panel.hidden{display:none}
      .list-panel{width:100%;border-left:none}
      .list-scroll{padding:10px 14px}
      .list-grid{grid-template-columns:1fr}
      .card{display:flex}
      .card-img{width:90px;height:auto;min-height:90px}
      .card-body{flex:1;padding:8px 10px}
      .card-body h3{font-size:13px}
      .btns{flex-direction:column;gap:4px}
      .btn-secondary,.btn-primary{padding:6px;font-size:11px}
      .mobile-toggle{display:block;position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--black);color:var(--white);padding:10px 20px;border-radius:50px;border:none;font-weight:600;font-size:14px;cursor:pointer;z-index:50;box-shadow:0 3px 10px rgba(0,0,0,.2)}
      .mobile-search{display:flex;gap:8px;padding:10px 14px;background:var(--white);border-bottom:1px solid var(--border)}
      .mobile-search .search-input{flex:1}
    }
    @media(min-width:769px){.mobile-search{display:none}}
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe"></a>
      <form class="search-form" action="/.netlify/functions/locations-search-v2" method="GET" id="searchForm">
        <input type="text" name="q" class="search-input" placeholder="Search shops, cities, zip..." value="${esc(query)}">
        <input type="hidden" name="lat" id="latInput" value="${userLat || ''}">
        <input type="hidden" name="lng" id="lngInput" value="${userLng || ''}">
        <button type="submit" class="btn-search">Search</button>
        <button type="button" class="btn-locate" id="locateBtn"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg></button>
      </form>
      <div class="view-toggle">
        <button class="view-btn active" id="viewMapBtn">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
          Map
        </button>
        <button class="view-btn" id="viewListBtn">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          List
        </button>
      </div>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="btn-app">Get the App</a>
      </nav>
      <button class="menu-btn" id="menuBtn"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
    </div>
  </header>
  
  <div class="mobile-menu" id="mobileMenu">
    <div class="mobile-menu-header">
      <a href="/"><img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" style="height:26px"></a>
      <button class="mobile-menu-close" id="menuClose">✕</button>
    </div>
    <nav class="mobile-menu-links">
      <a href="/locations/">Find Coffee</a>
      <a href="/for-coffee-shops/">For Shops</a>
      <a href="https://get.joe.coffee">Get the App</a>
    </nav>
  </div>

  <main class="main">
    <div class="map-panel" id="mapPanel"><div id="map"></div></div>
    <div class="list-panel" id="listPanel">
      <div class="mobile-search">
        <form action="/.netlify/functions/locations-search-v2" method="GET" style="display:flex;gap:8px;width:100%">
          <input type="text" name="q" class="search-input" placeholder="Search..." value="${esc(query)}">
          <button type="submit" class="btn-search">Go</button>
        </form>
      </div>
      <div class="list-header">${shops.length} coffee shop${shops.length !== 1 ? 's' : ''} found</div>
      <div class="list-scroll" id="listScroll">
        <div class="list-grid" id="listGrid">
          ${shops.length ? cards : '<div class="empty"><h2>Find your perfect coffee</h2><p>Search by name, city, or zip</p></div>'}
        </div>
      </div>
    </div>
  </main>
  
  <button class="mobile-toggle" id="mobileToggle">Show Map</button>

  <script>
    mapboxgl.accessToken='${MAPBOX_TOKEN}';
    const markersData=${markers};
    const center=${JSON.stringify(center)};
    
    const map=new mapboxgl.Map({
      container:'map',
      style:'mapbox://styles/mapbox/light-v11',
      center:[center.lng,center.lat],
      zoom:center.z
    });
    
    map.addControl(new mapboxgl.NavigationControl(),'top-right');
    
    // Store marker elements separately
    const markerElements=[];
    const mapboxMarkers=[];
    
    markersData.forEach((m,idx)=>{
      const el=document.createElement('div');
      el.className='map-pin';
      el.setAttribute('data-idx',idx);
      el.style.cssText='width:12px;height:12px;background:#1a1a1a;border-radius:50%;border:2px solid white;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.3);transition:all .15s;';
      
      const marker=new mapboxgl.Marker({element:el})
        .setLngLat([m.lng,m.lat])
        .addTo(map);
      
      el.addEventListener('click',function(e){
        e.stopPropagation();
        const i=parseInt(this.getAttribute('data-idx'));
        showPopup(markersData[i]);
        highlightCard(i);
      });
      
      markerElements.push(el);
      mapboxMarkers.push(marker);
    });
    
    if(markersData.length>1){
      const bounds=new mapboxgl.LngLatBounds();
      markersData.forEach(m=>bounds.extend([m.lng,m.lat]));
      map.fitBounds(bounds,{padding:50,maxZoom:14});
    }
    
    let popup=null;
    function showPopup(m){
      if(popup)popup.remove();
      const r=m.rating?'⭐ '+parseFloat(m.rating).toFixed(1)+(m.reviews?' ('+m.reviews+')':''):'';
      const badge=m.partner?'<span class="popup-badge">☕ Order Ahead</span>':'';
      const orderBtn=m.partner?'<a href="https://order.joe.coffee" class="popup-btn popup-btn-order">Order</a>':'';
      popup=new mapboxgl.Popup({offset:20,closeOnClick:true}).setHTML(
        '<img src="'+m.photo+'" class="popup-img" onerror="this.src=\\'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop\\'">'+
        '<div class="popup-body">'+badge+'<div class="popup-name">'+m.name+'</div><div class="popup-meta">'+r+'</div><div class="popup-addr">'+m.addr+'<br>'+m.city+', '+m.state+'</div>'+
        '<div class="popup-btns"><a href="'+m.url+'" class="popup-btn popup-btn-view">View</a>'+orderBtn+'</div></div>'
      ).setLngLat([m.lng,m.lat]).addTo(map);
    }
    
    function highlightCard(idx){
      document.querySelectorAll('.card').forEach(c=>c.classList.remove('active'));
      markerElements.forEach((el,j)=>{
        el.style.background=j===idx?'#1a1a1a':'#1a1a1a';
        el.style.transform=j===idx?'scale(1.4)':'scale(1)';
        el.style.zIndex=j===idx?'10':'1';
      });
      const card=document.querySelector('.card[data-i="'+idx+'"]');
      if(card){
        card.classList.add('active');
        const listScroll=document.getElementById('listScroll');
        listScroll.scrollTo({top:card.offsetTop-listScroll.offsetTop-10,behavior:'smooth'});
      }
    }
    
    document.querySelectorAll('.card').forEach(card=>{
      const i=parseInt(card.dataset.i);
      card.addEventListener('mouseenter',()=>{
        markerElements[i].style.transform='scale(1.4)';
        markerElements[i].style.zIndex='10';
      });
      card.addEventListener('mouseleave',()=>{
        if(!card.classList.contains('active')){
          markerElements[i].style.transform='scale(1)';
          markerElements[i].style.zIndex='1';
        }
      });
      card.addEventListener('click',e=>{
        if(e.target.closest('a'))return;
        const m=markersData[i];
        map.flyTo({center:[m.lng,m.lat],zoom:15});
        showPopup(m);
        highlightCard(i);
      });
    });
    
    // Desktop view toggle
    const viewMapBtn=document.getElementById('viewMapBtn');
    const viewListBtn=document.getElementById('viewListBtn');
    const mapPanel=document.getElementById('mapPanel');
    const listPanel=document.getElementById('listPanel');
    
    viewMapBtn.addEventListener('click',()=>{
      viewMapBtn.classList.add('active');
      viewListBtn.classList.remove('active');
      mapPanel.classList.remove('hidden');
      listPanel.classList.remove('full-width');
      setTimeout(()=>map.resize(),100);
    });
    
    viewListBtn.addEventListener('click',()=>{
      viewListBtn.classList.add('active');
      viewMapBtn.classList.remove('active');
      mapPanel.classList.add('hidden');
      listPanel.classList.add('full-width');
    });
    
    // Mobile menu
    document.getElementById('menuBtn').onclick=()=>document.getElementById('mobileMenu').classList.add('open');
    document.getElementById('menuClose').onclick=()=>document.getElementById('mobileMenu').classList.remove('open');
    
    // Mobile toggle
    const mobileToggle=document.getElementById('mobileToggle');
    let showMap=false;
    mobileToggle.onclick=()=>{
      showMap=!showMap;
      mapPanel.style.height=showMap?'calc(100vh - 56px)':'220px';
      listPanel.style.display=showMap?'none':'flex';
      mobileToggle.textContent=showMap?'Show List':'Show Map';
      map.resize();
    };
    
    // Geolocation
    function locate(btn){
      if(!navigator.geolocation)return alert('Geolocation not supported');
      btn.disabled=true;
      navigator.geolocation.getCurrentPosition(
        p=>location.href='/.netlify/functions/locations-search-v2?lat='+p.coords.latitude+'&lng='+p.coords.longitude,
        ()=>{btn.disabled=false;alert('Unable to get location')},
        {enableHighAccuracy:true,timeout:10000}
      );
    }
    document.getElementById('locateBtn')?.addEventListener('click',function(){locate(this)});
    
    ${!query && !userLat ? "navigator.geolocation?.getCurrentPosition(p=>location.href='/.netlify/functions/locations-search-v2?lat='+p.coords.latitude+'&lng='+p.coords.longitude,()=>{},{enableHighAccuracy:true,timeout:5000});" : ''}
  <\/script>
</body>
</html>`;
}