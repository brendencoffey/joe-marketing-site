/**
 * Locations Search - Enhanced with Neighborhood Search
 * - Searches shops by name, city, zip, AND neighborhood
 * - Shows neighborhood banner when query matches a neighborhood
 * - Shows all shops in matched neighborhood (not just name matches)
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
    let matchedNeighborhood = null;
    
    if (query) {
      // First check if query matches a neighborhood
      matchedNeighborhood = await findMatchingNeighborhood(query);
      
      if (matchedNeighborhood) {
        // Get all shops in this neighborhood
        shops = await getShopsInNeighborhood(matchedNeighborhood, userLat, userLng);
      } else {
        // Fall back to regular search
        shops = await smartSearch(query, userLat, userLng);
      }
    } else if (userLat && userLng) {
      shops = await getNearbyShops(userLat, userLng, 25);
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
      
      shops.sort((a, b) => {
        const aDist = a.distance * (a.is_joe_partner ? 0.8 : 1);
        const bDist = b.distance * (b.is_joe_partner ? 0.8 : 1);
        return aDist - bDist;
      });
    }

    // Add order_url flag
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
      body: renderSearchPage(query, shops, userLat, userLng, matchedNeighborhood)
    };

  } catch (err) {
    console.error('Search error:', err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: renderSearchPage('', [], null, null, null)
    };
  }
};

// Find matching neighborhood from neighborhoods table
async function findMatchingNeighborhood(query) {
  const searchTerm = query.toLowerCase().trim();
  
  try {
    // Try exact match first (case insensitive)
    const { data: exactMatch } = await supabase
      .from('neighborhoods')
      .select('*')
      .ilike('neighborhood_name', searchTerm)
      .gt('shop_count', 0)
      .order('shop_count', { ascending: false })
      .limit(1);
    
    if (exactMatch?.length > 0) {
      return exactMatch[0];
    }
    
    // Try partial match
    const { data: partialMatch } = await supabase
      .from('neighborhoods')
      .select('*')
      .ilike('neighborhood_name', `%${searchTerm}%`)
      .gt('shop_count', 0)
      .order('shop_count', { ascending: false })
      .limit(1);
    
    if (partialMatch?.length > 0) {
      return partialMatch[0];
    }
    
    return null;
  } catch (e) {
    console.error('Neighborhood search error:', e);
    return null;
  }
}

// Get all shops in a neighborhood
async function getShopsInNeighborhood(neighborhood, userLat, userLng) {
  const { data: shops } = await supabase
    .from('shops')
    .select('*')
    .eq('state_code', neighborhood.state_code)
    .eq('city_slug', neighborhood.city_slug)
    .or(`neighborhood.ilike.%${neighborhood.neighborhood_name}%,neighborhood.ilike.%${neighborhood.neighborhood_slug.replace(/-/g, ' ')}%`)
    .eq('is_active', true)
    .not('lat', 'is', null)
    .order('is_joe_partner', { ascending: false })
    .order('google_rating', { ascending: false, nullsFirst: false })
    .limit(100);
  
  if (!shops?.length) return [];
  
  const filtered = filterChains(shops);
  
  if (userLat && userLng) {
    return filtered.map(s => ({
      ...s,
      distance: calculateDistance(userLat, userLng, s.lat, s.lng)
    }));
  }
  
  return filtered;
}

const CHAIN_NAMES = ["starbucks", "dunkin", "peet's", "peets", "seattle's best", "caribou coffee", "tim hortons", "dutch bros", "coffee bean & tea leaf", "mcdonald's", "mcdonalds"];

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

async function smartSearch(query, userLat, userLng) {
  let searchTerm = query.toLowerCase().trim();
  const isZipCode = /^\d{5}$/.test(query);
  
  // Handle "City, STATE" format
  const cityStateMatch = searchTerm.match(/^(.+),\s*([a-z]{2})$/i);
  if (cityStateMatch) {
    searchTerm = cityStateMatch[1].trim();
  }
  
  if (isZipCode) {
    const { data } = await supabase.from('shops').select('*').eq('zip', query).eq('is_active', true).not('lat', 'is', null).limit(200);
    if (data?.length > 0) return filterChains(data).slice(0, 100);
  }
  
  // Try city search first
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
  
  // Try neighborhood search (shops with this neighborhood field)
  const { data: neighborhoodData } = await supabase.from('shops').select('*').ilike('neighborhood', `%${searchTerm}%`).eq('is_active', true).not('lat', 'is', null).limit(200);
  if (neighborhoodData?.length > 0) {
    const filtered = filterChains(neighborhoodData);
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
function getAmenityIcon(amenity) {
  const icons = {
    'WiFi': '📶', 'Pickup': '🛍️', 'Curbside': '🚗', 'Dine-In': '🍽️', 'Delivery': '🚚',
    'Private Meeting Rooms': '🚪', 'Quiet Room': '🤫', 'Child Play Area': '🧒',
    'Outdoor Seating': '🌳', 'Indoor Seating': '🪑', 'Drive-Thru': '🚙',
    'Parking': '🅿️', 'Pet Friendly': '🐕', 'Wheelchair Access': '♿',
    'Power Outlets': '🔌', 'Restroom': '🚻', 'Laptop Friendly': '💻',
    'Food Menu': '🍴', 'Pastries': '🥐', 'Vegan Options': '🌱',
    'Beer/Wine': '🍷', 'Roasts On-Site': '🔥', 'Retail': '🛒', 'Live Music': '🎵'
  };
  return icons[amenity] || '✓';
}

function renderSearchPage(query, shops, userLat, userLng, matchedNeighborhood) {
  const cards = shops.map((s, i) => {
    const url = '/locations/' + (s.state_code?.toLowerCase() || 'us') + '/' + (s.city_slug || 'unknown') + '/' + (s.slug || s.id) + '/';
    const dist = s.distance ? formatDist(s.distance) : '';
    const rating = s.google_rating ? parseFloat(s.google_rating).toFixed(1) : '';
    const hasOrderUrl = s.order_url;
    const amenities = s.amenities || [];
    const displayAmenities = amenities.slice(0, 3);
    
    return `
      <a href="${url}" class="card" data-idx="${i}" data-amenities="${esc(amenities.join(','))}" data-type="${esc(s.business_type || '')}" data-partner="${hasOrderUrl ? 'true' : 'false'}">
        <div class="card-img">
          <img src="${esc(getPhoto(s))}" alt="${esc(s.name)}" loading="lazy">
          ${hasOrderUrl ? '<span class="partner-badge">☕ joe Partner</span>' : ''}
          <span class="card-number">${i + 1}</span>
        </div>
        <div class="card-body">
          <h3>${esc(s.name)}</h3>
          <div class="card-meta">${rating ? '⭐ ' + rating : ''}${s.google_reviews ? ' (' + s.google_reviews + ')' : ''}${dist ? '<span class="card-dist">' + dist + '</span>' : ''}</div>
          <p class="card-addr">${esc(s.address || '')}</p>
          <p class="card-city">${esc(s.city || '')}, ${s.state_code?.toUpperCase() || ''}</p>
          ${displayAmenities.length > 0 ? `<div class="card-amenities">${displayAmenities.map(a => `<span class="card-amenity">${getAmenityIcon(a)} ${esc(a)}</span>`).join('')}</div>` : ''}
        </div>
      </a>`;
  }).join('');

  const markers = JSON.stringify(shops.slice(0, 100).map((s, i) => ({
    idx: i, lat: s.lat, lng: s.lng, partner: !!s.order_url, name: s.name, photo: getPhoto(s), rating: s.google_rating, url: '/locations/' + (s.state_code?.toLowerCase() || 'us') + '/' + (s.city_slug || 'unknown') + '/' + (s.slug || s.id) + '/'
  })));

  const center = userLat && userLng 
    ? { lat: userLat, lng: userLng, z: 12 }
    : shops.length 
      ? { lat: shops[0].lat, lng: shops[0].lng, z: 12 } 
      : { lat: 39.8283, lng: -98.5795, z: 4 };

  // Generate neighborhood banner HTML if matched
  const neighborhoodBanner = matchedNeighborhood ? `
    <div class="neighborhood-banner">
      <div class="nb-content">
        <div class="nb-title">Showing coffee shops in ${esc(matchedNeighborhood.neighborhood_name.replace(` ${matchedNeighborhood.city_name}`, ''))}, ${esc(matchedNeighborhood.city_name)}</div>
        <div class="nb-subtitle">${shops.length} independent coffee shops in this neighborhood</div>
      </div>
      <a href="/locations/${matchedNeighborhood.state_code}/${matchedNeighborhood.city_slug}/neighborhoods/${matchedNeighborhood.neighborhood_slug}/" class="nb-link">
        View Neighborhood →
      </a>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${query ? 'Coffee near "' + esc(query) + '"' : 'Find Coffee'} | joe</title>
  <link rel="icon" href="/images/logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"><\/script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--white:#fff;--black:#000;--gray-50:#f9fafb;--gray-100:#f3f4f6;--gray-200:#e5e7eb;--gray-500:#6b7280;--gray-700:#374151;--gray-800:#1f2937;--gray-900:#111827;--blue-500:#3b82f6;--font-body:'Inter',system-ui,sans-serif;--font-display:'Cormorant Garamond',Georgia,serif}
    body{font-family:var(--font-body);background:#fafafa;color:#111;min-height:100vh}
    h1,h2,h3,h4{font-family:var(--font-display);font-weight:500}
    
    /* Header */
    .header{background:var(--white);position:fixed;top:0;left:0;right:0;z-index:100;border-bottom:1px solid var(--gray-200)}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px;width:auto}
    .nav{display:flex;align-items:center;gap:2.5rem}
    .nav a{font-size:0.95rem;font-weight:500;color:var(--gray-700);text-decoration:none}
    .nav a:hover{color:var(--black)}
    .btn{display:inline-flex;align-items:center;justify-content:center;padding:0.75rem 1.5rem;border-radius:100px;font-weight:600;font-size:0.95rem;cursor:pointer;border:none;text-decoration:none}
    .btn-primary{background:#000;color:#fff!important}
    .nav-item{position:relative}
    .nav-dropdown-trigger{cursor:pointer;display:flex;align-items:center;gap:0.25rem;font-size:0.95rem;font-weight:500;color:var(--gray-700)}
    .nav-dropdown-trigger::after{content:'';width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:4px solid currentColor;transition:transform 0.2s}
    .nav-item:hover .nav-dropdown-trigger::after{transform:rotate(180deg)}
    .nav-dropdown{position:absolute;top:100%;left:50%;transform:translateX(-50%);min-width:200px;background:var(--white);border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.15);padding:0.5rem 0;opacity:0;visibility:hidden;transition:all 0.2s ease;margin-top:0.75rem;z-index:100}
    .nav-item:hover .nav-dropdown{opacity:1;visibility:visible;margin-top:0.5rem}
    .nav-dropdown a{display:block;padding:0.75rem 1.25rem;color:var(--gray-700);font-size:0.85rem}
    .nav-dropdown a:hover{background:var(--gray-50);color:var(--gray-900)}
    .mobile-dropdown{border-bottom:1px solid var(--gray-200)}
    .mobile-dropdown-trigger{display:flex;justify-content:space-between;align-items:center;padding:1rem 0;font-size:1.25rem;font-weight:500;cursor:pointer}
    .mobile-dropdown-trigger::after{content:'▼';font-size:0.65rem;transition:transform 0.2s}
    .mobile-dropdown.active .mobile-dropdown-trigger::after{transform:rotate(180deg)}
    .mobile-dropdown-content{max-height:0;overflow:hidden;transition:max-height 0.3s ease;padding-left:1rem}
    .mobile-dropdown.active .mobile-dropdown-content{max-height:300px}
    .mobile-dropdown-content a{display:block;padding:0.75rem 0;font-size:1rem;color:var(--gray-500);border-bottom:1px solid var(--gray-100)}
    
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
    
    /* Filter Bar */
    .filter-bar{position:fixed;top:130px;left:0;right:0;z-index:85;background:var(--white);border-bottom:1px solid var(--gray-200);padding:0.5rem 1.5rem}
    .filter-bar-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap}
    .filter-btn{display:inline-flex;align-items:center;gap:0.35rem;padding:0.5rem 0.85rem;border:1px solid var(--gray-200);border-radius:100px;font-size:0.85rem;font-weight:500;cursor:pointer;background:var(--white);color:var(--gray-700);transition:all 0.15s}
    .filter-btn:hover{border-color:var(--gray-400)}
    .filter-btn.active{background:var(--black);color:var(--white);border-color:var(--black)}
    .filter-btn svg{width:16px;height:16px}
    .filter-select{padding:0.5rem 0.85rem;border:1px solid var(--gray-200);border-radius:100px;font-size:0.85rem;font-weight:500;cursor:pointer;background:var(--white);color:var(--gray-700);appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 0.75rem center;padding-right:2rem}
    .filter-select:focus{outline:none;border-color:var(--black)}
    .filter-divider{width:1px;height:24px;background:var(--gray-200);margin:0 0.25rem}
    .filter-clear{color:var(--gray-500);font-size:0.85rem;cursor:pointer;text-decoration:underline}
    .filter-clear:hover{color:var(--black)}
    @media(max-width:768px){.filter-bar{padding:0.5rem 1rem}.filter-btn{padding:0.4rem 0.7rem;font-size:0.8rem}.filter-divider{display:none}}
    
    /* Neighborhood Banner */
    .neighborhood-banner{display:flex;align-items:center;gap:1rem;background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border:1px solid #bae6fd;border-radius:12px;padding:1rem 1.25rem;margin:0 0 1rem}
    .nb-content{flex:1;min-width:0}
    .nb-title{font-weight:600;color:#0369a1;font-size:0.95rem;line-height:1.3}
    .nb-subtitle{font-size:0.8rem;color:#64748b;margin-top:0.25rem}
    .nb-link{background:#0284c7;color:#fff;padding:0.6rem 1.25rem;border-radius:8px;font-weight:600;text-decoration:none;white-space:nowrap;font-size:0.85rem;flex-shrink:0}
    .nb-link:hover{background:#0369a1}
    @media(max-width:500px){
      .neighborhood-banner{flex-direction:column;align-items:flex-start;gap:0.75rem}
      .nb-link{width:100%;text-align:center}
    }
    
    /* Main Layout */
    .main{display:flex;height:calc(100vh - 175px);margin-top:175px}
    .list-panel{width:420px;display:flex;flex-direction:column;background:var(--white);border-right:1px solid var(--gray-200)}
    .list-scroll{flex:1;overflow-y:auto;padding:1rem}
    .map-panel{flex:1;position:relative}
    #map{width:100%;height:100%}
    
    @media(max-width:900px){
  .main{flex-direction:column;height:calc(100vh - 195px);margin-top:195px}
  .map-panel{height:250px;flex:none;order:1}
  .list-panel{width:100%;flex:1;border-right:none;border-top:1px solid var(--gray-200);order:2;overflow-y:auto}
  }
  
    /* Map Popup */
    .map-popup{position:absolute;background:var(--white);border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.2);padding:0;min-width:260px;z-index:50;transform:translate(-50%,-100%);margin-top:-15px;overflow:hidden}
    .map-popup::after{content:'';position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid var(--white)}
    .map-popup-img{height:100px;overflow:hidden}
    .map-popup-img img{width:100%;height:100%;object-fit:cover}
    .map-popup-body{padding:0.75rem}
    .map-popup-name{font-family:var(--font-display);font-size:1rem;font-weight:600;margin-bottom:0.25rem}
    .map-popup-meta{font-size:0.8rem;color:var(--gray-500);margin-bottom:0.5rem}
    .map-popup-link{display:block;text-align:center;background:var(--black);color:var(--white);padding:0.5rem;border-radius:6px;font-size:0.85rem;font-weight:600;text-decoration:none}
    
    /* Cards */
    .card{background:var(--white);border:1px solid var(--gray-200);border-radius:12px;overflow:hidden;margin-bottom:1rem;transition:all 0.2s;cursor:pointer;text-decoration:none;display:block;color:inherit}
    .card.active{border-color:var(--black);box-shadow:0 4px 12px rgba(0,0,0,0.15);transform:scale(1.02)}
    @media(min-width:901px){.card:hover{border-color:var(--gray-400);box-shadow:0 2px 8px rgba(0,0,0,0.08)}}
    .card-img{position:relative;height:160px;overflow:hidden}
    .card-img img{width:100%;height:100%;object-fit:cover}
    .partner-badge{position:absolute;top:0.75rem;left:0.75rem;background:var(--black);color:var(--white);padding:0.35rem 0.75rem;border-radius:100px;font-size:0.8rem;font-weight:600}
    .card-number{position:absolute;top:0.75rem;right:0.75rem;background:var(--white);color:var(--black);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.2)}
    .card-body{padding:1rem}
    .card-body h3{font-size:1.1rem;margin-bottom:0.25rem}
    .card-meta{font-size:0.9rem;color:var(--gray-500);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem}
    .card-dist{margin-left:auto;font-weight:500}
    .card-addr,.card-city{font-size:0.85rem;color:var(--gray-500);margin-bottom:0.25rem}
    .card-amenities{display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.5rem}
    .card-amenity{display:inline-flex;align-items:center;gap:0.25rem;padding:0.25rem 0.5rem;background:var(--gray-100);border-radius:4px;font-size:0.75rem;color:var(--gray-700)}
    .card-btns{display:flex;gap:0.5rem;margin-top:0.75rem}
    .btn-view,.btn-order{flex:1;padding:0.6rem;border-radius:8px;font-size:0.9rem;font-weight:600;text-align:center;text-decoration:none}
    .btn-view{background:var(--gray-100);color:var(--black)}
    .btn-order{background:var(--black);color:var(--white)}
    
    .empty{text-align:center;padding:3rem 1rem;color:var(--gray-500)}
    .empty h2{color:var(--black);margin-bottom:0.5rem}
    
    /* Map Markers */
    .marker-dot{width:14px;height:14px;background:var(--black);border:2px solid var(--white);border-radius:50%;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.3);transition:all 0.2s}
    .marker-dot.partner{background:#16a34a}
    .marker-dot:hover{transform:scale(1.3)}
    .marker-dot.active{width:24px;height:24px;background:#ef4444;border:3px solid var(--white);box-shadow:0 0 0 3px #ef4444,0 4px 12px rgba(0,0,0,0.3);z-index:100!important}
    .marker-label{position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:var(--white);color:var(--black);padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
    
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
        <a href="/">For Coffee Lovers</a>
        <a href="/for-coffee-shops/">For Coffee Shops</a>
        <div class="nav-item">
          <span class="nav-dropdown-trigger">Company</span>
          <div class="nav-dropdown">
            <a href="/about/">About</a>
            <a href="/blog/">Blog</a>
            <a href="/testimonials/">Partner Stories</a>
            <a href="https://joe-partner-community.circle.so">Community Hub</a>
            <a href="https://support.joe.coffee">Support & FAQs</a>
          </div>
        </div>
        <div class="nav-item">
          <span class="nav-dropdown-trigger">Solutions</span>
          <div class="nav-dropdown">
            <a href="/point-of-sale-for-coffee-shops/">POS for Coffee Shops</a>
            <a href="/rewards/">Rewards & Loyalty</a>
            <a href="/gift-cards/">Gift Cards</a>
            <a href="/point-of-sale-for-coffee-shops/">See All Features</a>
          </div>
        </div>
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
    <a href="/">For Coffee Lovers</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <div class="mobile-dropdown">
      <div class="mobile-dropdown-trigger">Company</div>
      <div class="mobile-dropdown-content">
        <a href="/about/">About</a>
        <a href="/blog/">Blog</a>
        <a href="/testimonials/">Partner Stories</a>
        <a href="https://joe-partner-community.circle.so">Community Hub</a>
        <a href="https://support.joe.coffee">Support & FAQs</a>
      </div>
    </div>
    <div class="mobile-dropdown">
      <div class="mobile-dropdown-trigger">Solutions</div>
      <div class="mobile-dropdown-content">
        <a href="/point-of-sale-for-coffee-shops/">POS for Coffee Shops</a>
        <a href="/rewards/">Rewards & Loyalty</a>
        <a href="/gift-cards/">Gift Cards</a>
        <a href="/point-of-sale-for-coffee-shops/">See All Features</a>
      </div>
    </div>
    <a href="https://get.joe.coffee" class="btn btn-primary" style="margin-top:1rem">Get the App</a>
  </div>

  <div class="search-bar">
    <div class="search-bar-inner">
      <form action="/locations/search/" method="GET" style="display:contents">
        <input type="text" name="q" class="search-input" placeholder="Search shops, cities, neighborhoods, or zip codes..." value="${esc(query)}">
        <button type="submit" class="btn-search">Search</button>
      </form>
      <button type="button" class="btn-locate" id="locateBtn" title="Use my location">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
      </button>
      <span class="search-count">${shops.length} coffee shop${shops.length !== 1 ? 's' : ''} found</span>
    </div>
  </div>
  
  <div class="filter-bar">
    <div class="filter-bar-inner">
      <button class="filter-btn" data-filter="partner" title="Show only joe partners">☕ joe Partners</button>
      <button class="filter-btn" data-filter="WiFi" title="Has WiFi">📶 WiFi</button>
      <button class="filter-btn" data-filter="Dine-In" title="Dine-in available">🍽️ Dine-In</button>
      <button class="filter-btn" data-filter="Pickup" title="Pickup available">🛍️ Pickup</button>
      <button class="filter-btn" data-filter="Drive-Thru" title="Has drive-thru">🚙 Drive-Thru</button>
      <button class="filter-btn" data-filter="Outdoor Seating" title="Outdoor seating">🌳 Outdoor</button>
      <div class="filter-divider"></div>
      <select class="filter-select" id="typeFilter">
        <option value="">All Types</option>
        <option value="Cafe">☕ Cafe</option>
        <option value="Roaster">🔥 Roaster</option>
        <option value="Cafe Roaster">☕🔥 Cafe + Roaster</option>
        <option value="Drive-Thru">🚙 Drive-Thru Only</option>
        <option value="Bakery">🥐 Bakery Cafe</option>
      </select>
      <span class="filter-clear" id="clearFilters" style="display:none">Clear filters</span>
    </div>
  </div>

  <main class="main">
    <div class="list-panel">
      <div class="list-scroll" id="listScroll">
        ${neighborhoodBanner}
        ${shops.length ? cards : '<div class="empty"><h2>Find your perfect coffee</h2><p>Search by name, city, neighborhood, or zip code</p></div>'}
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
      var activeFilters=new Set();
      var typeFilter='';
      var popup=null;
      
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
      
      // Create shop markers with numbers
      shopData.forEach(function(shop){
        var dot=document.createElement('div');
        dot.className='marker-dot'+(shop.partner?' partner':'');
        
        var label=document.createElement('div');
        label.className='marker-label';
        label.textContent=shop.idx+1;
        dot.appendChild(label);
        
        new mapboxgl.Marker({element:dot,anchor:'center'})
          .setLngLat([shop.lng,shop.lat])
          .addTo(map);
        
        markerDots[shop.idx]=dot;
        
        dot.addEventListener('click',function(e){
          e.stopPropagation();
          selectShop(shop.idx,true);
          showPopup(shop);
        });
      });
      
      // Show popup on map
      function showPopup(shop){
        closePopup();
        var popupEl=document.createElement('div');
        popupEl.className='map-popup';
        popupEl.innerHTML='<div class="map-popup-img"><img src="'+shop.photo+'" alt=""></div>'+
          '<div class="map-popup-body">'+
          '<div class="map-popup-name">'+shop.name+'</div>'+
          '<div class="map-popup-meta">'+(shop.rating?'⭐ '+parseFloat(shop.rating).toFixed(1):'')+(shop.partner?' • joe Partner':'')+'</div>'+
          '<a href="'+shop.url+'" class="map-popup-link">View Shop</a>'+
          '</div>';
        
        popup=new mapboxgl.Marker({element:popupEl,anchor:'bottom'})
          .setLngLat([shop.lng,shop.lat])
          .addTo(map);
      }
      
      function closePopup(){
        if(popup){popup.remove();popup=null;}
      }
      
      // Close popup when clicking map
      map.on('click',function(){closePopup();});
      
      // Fit bounds to include user location and first 10 shops
      map.on('load',function(){
        if(shopData.length>0){
          var bounds=new mapboxgl.LngLatBounds();
          if(userLat&&userLng)bounds.extend([userLng,userLat]);
          shopData.slice(0,10).forEach(function(s){bounds.extend([s.lng,s.lat])});
          map.fitBounds(bounds,{padding:50,maxZoom:14,duration:0});
        }
      });
      
      function selectShop(idx,fromMap){
        var cards=document.querySelectorAll('.card:not([style*="display: none"])');
        var allCards=document.querySelectorAll('.card');
        allCards.forEach(function(c){c.classList.remove('active');});
        markerDots.forEach(function(d){if(d)d.classList.remove('active');});
        
        var card=document.querySelector('.card[data-idx="'+idx+'"]');
        if(card){card.classList.add('active');}
        if(markerDots[idx])markerDots[idx].classList.add('active');
        activeIdx=idx;
        
        if(card&&!fromMap){
          card.scrollIntoView({behavior:'smooth',block:'nearest'});
        }
        
        var shop=shopData[idx];
        if(shop&&!isMobile&&!fromMap){
          map.flyTo({center:[shop.lng,shop.lat],zoom:15,duration:500});
        }
      }
      
      // Card hover
      var cards=document.querySelectorAll('.card');
      cards.forEach(function(card){
        var idx=parseInt(card.dataset.idx);
        card.addEventListener('mouseenter',function(){
          if(!isMobile){
            selectShop(idx,false);
            var shop=shopData[idx];
            if(shop)showPopup(shop);
          }
        });
        card.addEventListener('mouseleave',function(){
          if(!isMobile)closePopup();
        });
      });
      
      // Filter functionality
      var filterBtns=document.querySelectorAll('.filter-btn');
      var typeSelect=document.getElementById('typeFilter');
      var clearBtn=document.getElementById('clearFilters');
      
      filterBtns.forEach(function(btn){
        btn.addEventListener('click',function(){
          var filter=btn.dataset.filter;
          if(activeFilters.has(filter)){
            activeFilters.delete(filter);
            btn.classList.remove('active');
          }else{
            activeFilters.add(filter);
            btn.classList.add('active');
          }
          applyFilters();
        });
      });
      
      if(typeSelect){
        typeSelect.addEventListener('change',function(){
          typeFilter=this.value;
          applyFilters();
        });
      }
      
      if(clearBtn){
        clearBtn.addEventListener('click',function(){
          activeFilters.clear();
          typeFilter='';
          filterBtns.forEach(function(b){b.classList.remove('active');});
          if(typeSelect)typeSelect.value='';
          applyFilters();
        });
      }
      
      function applyFilters(){
        var hasFilters=activeFilters.size>0||typeFilter;
        if(clearBtn)clearBtn.style.display=hasFilters?'inline':'none';
        
        var visibleCount=0;
        cards.forEach(function(card){
          var amenities=(card.dataset.amenities||'').split(',').filter(Boolean);
          var cardType=card.dataset.type||'';
          var isPartner=card.dataset.partner==='true';
          var show=true;
          
          // Check partner filter
          if(activeFilters.has('partner')&&!isPartner)show=false;
          
          // Check amenity filters
          activeFilters.forEach(function(f){
            if(f!=='partner'&&!amenities.includes(f))show=false;
          });
          
          // Check type filter
          if(typeFilter&&cardType.toLowerCase().indexOf(typeFilter.toLowerCase())===-1)show=false;
          
          card.style.display=show?'':'none';
          var idx=parseInt(card.dataset.idx);
          if(markerDots[idx])markerDots[idx].style.display=show?'':'none';
          if(show)visibleCount++;
        });
        
        // Update count
        var countEl=document.querySelector('.search-count');
        if(countEl)countEl.textContent=visibleCount+' coffee shop'+(visibleCount!==1?'s':'')+' found';
      }
      
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

      document.querySelectorAll('.mobile-dropdown-trigger').forEach(function(trigger){
        trigger.addEventListener('click',function(){
          trigger.parentElement.classList.toggle('active');
        });
      });
      
      // Mobile map toggle
      var mobileToggle=document.getElementById('mobileToggle');
      var mapPanel=document.querySelector('.map-panel');
      var listPanel=document.querySelector('.list-panel');
      var showingMap=false;
      
      if(mobileToggle)mobileToggle.addEventListener('click',function(){
        showingMap=!showingMap;
        if(showingMap){
          mapPanel.style.height='calc(100vh - 220px)';
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