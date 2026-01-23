/**
 * Locations Search - Enhanced
 * REBRANDED with new color palette and fonts
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || 'pk.eyJ1IjoiYnJlbmRlbm1hcnRpbjA1IiwiYSI6ImNtanAwZWZidjJodjEza3E2NDR4b242bW8ifQ.CjDrXl01VxVoEg6jh81c5Q';

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const q = params.q?.trim();
    const lat = parseFloat(params.lat);
    const lng = parseFloat(params.lng);
    
    if (!isNaN(lat) && !isNaN(lng)) {
      return await searchByLocation(lat, lng);
    }
    
    if (!q) {
      return redirect('/locations/');
    }

    const isZipCode = /^\d{5}$/.test(q);
    
    if (isZipCode) {
      return await searchByZipCode(q);
    }
    
    const coordMatch = q.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return await searchByLocation(parseFloat(coordMatch[1]), parseFloat(coordMatch[2]));
    }

    return await searchByText(q);

  } catch (err) {
    console.error('Search error:', err);
    return redirect('/locations/');
  }
};

async function searchByZipCode(zip) {
  try {
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${zip}.json?country=us&types=postcode&access_token=${MAPBOX_TOKEN}`
    );
    const geoData = await geoRes.json();
    
    if (geoData.features && geoData.features.length > 0) {
      const [lng, lat] = geoData.features[0].center;
      const placeName = geoData.features[0].place_name || zip;
      return await searchByLocation(lat, lng, `Coffee shops near ${placeName}`);
    }
  } catch (e) {
    console.error('Geocoding error:', e);
  }
  
  return renderNoResultsWithNearby(zip, []);
}

async function searchByLocation(lat, lng, title = null) {
  const { data: allShops } = await supabase
    .from('shops')
    .select('id, name, slug, city, city_slug, state_code, street_address, photo_url, google_rating, google_reviews_count, latitude, longitude, is_claimed, has_online_ordering, joe_partner')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(1000);
  
  let results = [];
  if (allShops) {
    results = allShops
      .map(shop => ({
        ...shop,
        distance: haversineDistance(lat, lng, shop.latitude, shop.longitude)
      }))
      .filter(shop => shop.distance <= 50)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 30);
  }
  
  if (results.length === 0) {
    if (allShops) {
      results = allShops
        .map(shop => ({
          ...shop,
          distance: haversineDistance(lat, lng, shop.latitude, shop.longitude)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 15);
    }
  }
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: renderRichResults(title || `Coffee shops near you`, results || [], { lat, lng })
  };
}

async function searchByText(query) {
  const q = query.toLowerCase();
  
  const { data: results } = await supabase
    .from('shops')
    .select('id, name, slug, city, city_slug, state_code, street_address, photo_url, google_rating, google_reviews_count, latitude, longitude, is_claimed, has_online_ordering, joe_partner')
    .not('state_code', 'is', null)
    .or(`city.ilike.%${q}%,name.ilike.%${q}%,street_address.ilike.%${q}%`)
    .limit(50);

  if (results && results.length > 0) {
    const exactCity = results.find(r => r.city?.toLowerCase() === q);
    if (exactCity) {
      return redirect(`/locations/${exactCity.state_code.toLowerCase()}/${exactCity.city_slug}/`);
    }
    
    if (results.length === 1) {
      const shop = results[0];
      return redirect(`/locations/${shop.state_code.toLowerCase()}/${shop.city_slug}/${shop.slug}/`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: renderRichResults(`Results for "${query}"`, results)
    };
  }

  return await searchByTextWithGeocode(query);
}

async function searchByTextWithGeocode(query) {
  try {
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=us&types=neighborhood,locality,place&access_token=${MAPBOX_TOKEN}`
    );
    const geoData = await geoRes.json();
    
    if (geoData.features && geoData.features.length > 0) {
      const [lng, lat] = geoData.features[0].center;
      const placeName = geoData.features[0].place_name || query;
      return await searchByLocation(lat, lng, `Coffee shops near ${placeName}`);
    }
  } catch (e) {
    console.error('Geocoding error:', e);
  }
  
  return renderNoResultsWithNearby(query, []);
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function redirect(url) {
  return { statusCode: 302, headers: { Location: url }, body: '' };
}

function renderRichResults(title, shops, location = null) {
  const defaultPhoto = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop';
  
  const results = shops.map(shop => {
    const photo = shop.photo_url || defaultPhoto;
    const rating = shop.google_rating ? `<span class="rating">⭐ ${shop.google_rating}</span>` : '';
    const reviews = shop.google_reviews_count ? `<span class="reviews">(${shop.google_reviews_count})</span>` : '';
    const distance = shop.distance ? `<span class="distance">${shop.distance.toFixed(1)} mi</span>` : '';
    const partnerBadge = shop.joe_partner ? '<span class="badge partner">☕ joe Partner</span>' : '';
    const orderBadge = shop.has_online_ordering ? '<span class="badge order">📱 Order Ahead</span>' : '';
    const address = shop.street_address || '';
    const cityState = `${shop.city || ''}, ${(shop.state_code || '').toUpperCase()}`;
    
    return `
      <a href="/locations/${(shop.state_code || '').toLowerCase()}/${shop.city_slug}/${shop.slug}/" class="shop-card">
        <div class="shop-photo">
          <img src="${photo}" alt="${shop.name}" loading="lazy" onerror="this.src='${defaultPhoto}'">
          ${partnerBadge || orderBadge ? `<div class="badges">${partnerBadge}${orderBadge}</div>` : ''}
        </div>
        <div class="shop-info">
          <div class="shop-header">
            <h3 class="shop-name">${shop.name}</h3>
            ${distance}
          </div>
          <div class="shop-address">${address}</div>
          <div class="shop-city">${cityState}</div>
          <div class="shop-meta">
            ${rating}${reviews}
          </div>
        </div>
      </a>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | joe</title>
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    :root {
      --paper-cream: #fef8ec;
      --stone-gray: #7c7c7c;
      --soft-charcoal: #2e2e2e;
      --espresso-black: #000000;
      --caramel-clay: #b66a32;
      --cafe-grove: #252610;
      --milk-moss: #4d502c;
      --color-border: #e8e2d9;
      --font-display: 'Cormorant Garamond', Georgia, serif;
      --font-body: 'Inter', -apple-system, sans-serif;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: var(--font-body); background: var(--paper-cream); color: var(--soft-charcoal); line-height: 1.6; }
    a { color: inherit; text-decoration: none; }
    
    .main-nav { background: #fff; border-bottom: 1px solid var(--color-border); padding: 1rem 1.5rem; position: sticky; top: 0; z-index: 100; }
    .nav-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .logo img { height: 40px; }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a { color: var(--soft-charcoal); text-decoration: none; font-size: 0.9rem; }
    .nav-cta { background: var(--espresso-black) !important; color: #fff !important; padding: 0.5rem 1rem; border-radius: 50px; font-weight: 500; }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    
    .search-header { margin-bottom: 2rem; }
    .search-header h1 { font-family: var(--font-display); font-size: clamp(1.5rem, 4vw, 2rem); font-weight: 500; margin-bottom: 1rem; color: var(--espresso-black); }
    .search-form { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .search-input { flex: 1; min-width: 200px; padding: 0.875rem 1rem; border: 1px solid var(--color-border); border-radius: 8px; font-size: 1rem; font-family: var(--font-body); background: #fff; }
    .search-input:focus { outline: none; border-color: var(--caramel-clay); }
    .search-btn { padding: 0.875rem 1.5rem; background: var(--caramel-clay); color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .search-btn:hover { background: #a35d2a; }
    .location-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1rem; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; font-weight: 500; cursor: pointer; color: var(--soft-charcoal); transition: all 0.2s; }
    .location-btn:hover { background: var(--paper-cream); border-color: var(--caramel-clay); }
    
    .results-count { color: var(--stone-gray); font-size: 0.9rem; margin-bottom: 1.5rem; }
    
    .results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
    
    .shop-card { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; transition: all 0.2s; }
    .shop-card:hover { border-color: var(--caramel-clay); box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-2px); }
    
    .shop-photo { position: relative; height: 180px; overflow: hidden; background: #f5f0e8; }
    .shop-photo img { width: 100%; height: 100%; object-fit: cover; }
    .badges { position: absolute; top: 12px; left: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge.partner { background: #fef3c7; color: var(--caramel-clay); }
    .badge.order { background: #d1fae5; color: #065f46; }
    
    .shop-info { padding: 1rem; }
    .shop-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .shop-name { font-size: 1.1rem; font-weight: 600; color: var(--espresso-black); }
    .distance { font-size: 0.85rem; color: var(--stone-gray); white-space: nowrap; }
    .shop-address { font-size: 0.9rem; color: var(--soft-charcoal); }
    .shop-city { font-size: 0.85rem; color: var(--stone-gray); margin-bottom: 0.5rem; }
    .shop-meta { display: flex; align-items: center; gap: 0.5rem; }
    .rating { font-size: 0.9rem; font-weight: 600; }
    .reviews { font-size: 0.85rem; color: var(--stone-gray); }
    
    .back-link { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 2rem; color: var(--stone-gray); }
    .back-link:hover { color: var(--caramel-clay); }
    
    .mobile-menu-btn { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 10px; }
    .mobile-menu-btn span { display: block; width: 24px; height: 2px; background: var(--espresso-black); }
    .mobile-menu { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #fff; z-index: 999; padding: 24px; flex-direction: column; }
    .mobile-menu.active { display: flex; }
    .mobile-menu-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .mobile-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
    .mobile-menu a { display: block; font-size: 1.1rem; color: var(--espresso-black); padding: 1rem 0; border-bottom: 1px solid var(--color-border); }
    .mobile-menu .mobile-cta { background: var(--espresso-black); color: #fff !important; padding: 1rem; border-radius: 50px; text-align: center; margin-top: 1rem; }
    
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .mobile-menu-btn { display: flex; }
      .results-grid { grid-template-columns: 1fr; }
      .search-form { flex-direction: column; }
      .location-btn { justify-content: center; }
    }
  </style>
</head>
<body>
  <nav class="main-nav">
    <div class="nav-inner">
      <a href="/" class="logo"><img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe"></a>
      <div class="nav-links">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="nav-cta">Get the App</a>
      </div>
      <div class="mobile-menu-btn" onclick="document.getElementById('mobileMenu').classList.add('active')">
        <span></span><span></span><span></span>
      </div>
    </div>
  </nav>
  
  <div class="mobile-menu" id="mobileMenu">
    <div class="mobile-menu-header">
      <a href="/" class="logo"><img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" style="height:40px"></a>
      <button class="mobile-close" onclick="document.getElementById('mobileMenu').classList.remove('active')">✕</button>
    </div>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="https://get.joe.coffee" class="mobile-cta">Get the App</a>
  </div>

  <main class="container">
    <div class="search-header">
      <h1>${title}</h1>
      <form class="search-form" action="/locations/search/" method="get">
        <input type="text" name="q" class="search-input" placeholder="Search city, zip, or shop name...">
        <button type="submit" class="search-btn">Search</button>
        <button type="button" onclick="useMyLocation()" class="location-btn" id="locationBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4"></path>
          </svg>
          Use my location
        </button>
      </form>
    </div>
    
    <p class="results-count">${shops.length} coffee shop${shops.length !== 1 ? 's' : ''} found</p>
    
    <div class="results-grid">
      ${results}
    </div>
    
    <a href="/locations/" class="back-link">← Browse all locations</a>
  </main>
  
  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
  
  <script>
    function useMyLocation() {
      const btn = document.getElementById('locationBtn');
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
      }
      btn.innerHTML = 'Finding...';
      navigator.geolocation.getCurrentPosition(
        (position) => {
          window.location.href = '/locations/search/?lat=' + position.coords.latitude + '&lng=' + position.coords.longitude;
        },
        (error) => {
          btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4m0 12v4M2 12h4m12 0h4"></path></svg> Use my location';
          alert('Unable to get your location.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  </script>
</body>
</html>`;
}

function renderNoResultsWithNearby(query) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>No Results for "${query}" | joe</title>
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    :root {
      --paper-cream: #fef8ec;
      --stone-gray: #7c7c7c;
      --soft-charcoal: #2e2e2e;
      --espresso-black: #000000;
      --caramel-clay: #b66a32;
      --color-border: #e8e2d9;
      --font-display: 'Cormorant Garamond', Georgia, serif;
      --font-body: 'Inter', -apple-system, sans-serif;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: var(--font-body); background: var(--paper-cream); color: var(--soft-charcoal); }
    .main-nav { background: #fff; border-bottom: 1px solid var(--color-border); padding: 1rem 1.5rem; }
    .nav-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .logo img { height: 40px; }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a { color: var(--soft-charcoal); font-size: 0.9rem; text-decoration: none; }
    .nav-cta { background: var(--espresso-black) !important; color: #fff !important; padding: 0.5rem 1rem; border-radius: 50px; }
    
    .container { max-width: 600px; margin: 0 auto; padding: 4rem 1.5rem; text-align: center; }
    h1 { font-family: var(--font-display); font-size: 1.75rem; font-weight: 500; margin-bottom: 1rem; color: var(--espresso-black); }
    p { color: var(--stone-gray); margin-bottom: 2rem; line-height: 1.6; }
    .btn { display: inline-block; padding: 0.875rem 1.5rem; border-radius: 8px; font-weight: 600; text-decoration: none; margin: 0.5rem; transition: all 0.2s; }
    .btn-primary { background: var(--caramel-clay); color: #fff; }
    .btn-primary:hover { background: #a35d2a; }
    .btn-secondary { background: #fff; color: var(--soft-charcoal); border: 1px solid var(--color-border); }
    .btn-secondary:hover { border-color: var(--caramel-clay); }
    
    .location-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1.5rem; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; font-weight: 500; cursor: pointer; color: var(--soft-charcoal); margin: 0.5rem; }
    .location-btn:hover { background: var(--paper-cream); border-color: var(--caramel-clay); }
    
    .suggestions { margin-top: 3rem; text-align: left; }
    .suggestions h3 { font-size: 1rem; margin-bottom: 1rem; color: var(--espresso-black); }
    .suggestion-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .suggestion-list a { padding: 0.5rem 1rem; background: #fff; border: 1px solid var(--color-border); border-radius: 20px; font-size: 0.9rem; color: var(--soft-charcoal); transition: all 0.2s; }
    .suggestion-list a:hover { border-color: var(--caramel-clay); color: var(--caramel-clay); }
  </style>
</head>
<body>
  <nav class="main-nav">
    <div class="nav-inner">
      <a href="/" class="logo"><img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe"></a>
      <div class="nav-links">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="nav-cta">Get the App</a>
      </div>
    </div>
  </nav>
  
  <main class="container">
    <h1>No results for "${query}"</h1>
    <p>We couldn't find any coffee shops matching your search. Try using your location or browse popular cities below.</p>
    
    <button onclick="useMyLocation()" class="location-btn" id="locationBtn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 2v4m0 12v4M2 12h4m12 0h4"></path>
      </svg>
      Use my location
    </button>
    <a href="/locations/" class="btn btn-secondary">Browse All States</a>
    
    <div class="suggestions">
      <h3>Popular cities</h3>
      <div class="suggestion-list">
        <a href="/locations/search/?q=seattle">Seattle</a>
        <a href="/locations/search/?q=portland">Portland</a>
        <a href="/locations/search/?q=san francisco">San Francisco</a>
        <a href="/locations/search/?q=los angeles">Los Angeles</a>
        <a href="/locations/search/?q=new york">New York</a>
        <a href="/locations/search/?q=chicago">Chicago</a>
        <a href="/locations/search/?q=austin">Austin</a>
        <a href="/locations/search/?q=denver">Denver</a>
      </div>
    </div>
  </main>
  
  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
  
  <script>
    function useMyLocation() {
      const btn = document.getElementById('locationBtn');
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
      }
      btn.innerHTML = 'Finding...';
      navigator.geolocation.getCurrentPosition(
        (pos) => { window.location.href = '/locations/search/?lat=' + pos.coords.latitude + '&lng=' + pos.coords.longitude; },
        () => { btn.innerHTML = 'Use my location'; alert('Unable to get location'); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  </script>
</body>
</html>`;
}