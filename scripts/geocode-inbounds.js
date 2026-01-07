// Geocode shops from Inbounds pipeline first (highest priority)
// Run with: node geocode-inbounds.js
// Requires: GOOGLE_PLACES_API_KEY and SUPABASE_SERVICE_KEY env vars

const SUPABASE_URL = 'https://vpnoaxpmhuknyaxcyxsu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const DELAY_MS = 250;

async function supabaseFetch(endpoint, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers
    },
    ...options
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase error: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function searchPlace(query) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=cafe&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.status === 'OK' ? data.results[0] : null;
}

async function getPlaceDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,formatted_phone_number,website,geometry,address_components,rating,user_ratings_total&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.status === 'OK' ? data.result : null;
}

function parseAddress(components) {
  const r = {};
  for (const c of components || []) {
    if (c.types.includes('locality')) r.city = c.long_name;
    if (c.types.includes('administrative_area_level_1')) {
      r.state = c.long_name;
      r.state_code = c.short_name;
    }
    if (c.types.includes('country')) r.country = c.short_name;
  }
  return r;
}

async function geocodeAndUpdate(shop) {
  let query = shop.name.replace(/^\[.*?\]\s*/, ''); // Remove [AM] prefixes
  if (shop.city) query += ` ${shop.city}`;
  if (shop.state) query += ` ${shop.state}`;
  query += ' coffee shop';
  
  console.log(`  🔍 "${query}"`);
  
  const place = await searchPlace(query);
  if (!place) {
    console.log(`  ❌ No results\n`);
    return false;
  }
  
  const details = await getPlaceDetails(place.place_id);
  if (!details?.geometry?.location) {
    console.log(`  ❌ No location data\n`);
    return false;
  }
  
  const addr = parseAddress(details.address_components);
  if (addr.country && addr.country !== 'US') {
    console.log(`  ❌ Not US: ${addr.country}\n`);
    return false;
  }
  
  const updates = {
    lat: details.geometry.location.lat,
    lng: details.geometry.location.lng,
    address: details.formatted_address,
    city: addr.city || shop.city,
    state: addr.state || shop.state,
    state_code: addr.state_code,
    phone: details.formatted_phone_number || shop.phone,
    website: details.website || shop.website,
    google_rating: details.rating,
    total_reviews: details.user_ratings_total,
    google_place_id: place.place_id,
    lead_source: shop.lead_source || 'inbound'
  };
  
  // Remove nulls
  Object.keys(updates).forEach(k => updates[k] == null && delete updates[k]);
  
  await supabaseFetch(`shops?id=eq.${shop.id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
  
  console.log(`  ✅ ${details.formatted_address}\n`);
  return true;
}

async function main() {
  if (!SUPABASE_KEY || !GOOGLE_API_KEY) {
    console.error('Missing env vars: SUPABASE_SERVICE_KEY and/or GOOGLE_PLACES_API_KEY');
    process.exit(1);
  }
  
  // Get inbounds pipeline ID
  const pipelines = await supabaseFetch(`pipelines?name=ilike.*inbound*&select=id,name`);
  if (!pipelines.length) {
    console.error('No inbounds pipeline found');
    process.exit(1);
  }
  const pipelineId = pipelines[0].id;
  console.log(`📋 Found pipeline: ${pipelines[0].name} (${pipelineId})\n`);
  
  // Get shops from inbound deals that are missing coordinates
  const deals = await supabaseFetch(
    `deals?pipeline_id=eq.${pipelineId}&select=shop_id,shops(id,name,city,state,state_code,phone,website,lat,lng,lead_source)`
  );
  
  const shopsToGeocode = deals
    .map(d => d.shops)
    .filter(s => s && (!s.lat || !s.lng));
  
  // Dedupe by shop id
  const uniqueShops = [...new Map(shopsToGeocode.map(s => [s.id, s])).values()];
  
  console.log(`🎯 Found ${uniqueShops.length} inbound shops missing coordinates\n`);
  
  let updated = 0, failed = 0;
  
  for (let i = 0; i < uniqueShops.length; i++) {
    const shop = uniqueShops[i];
    console.log(`[${i + 1}/${uniqueShops.length}] ${shop.name}`);
    
    try {
      const success = await geocodeAndUpdate(shop);
      if (success) updated++;
      else failed++;
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}\n`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  
  console.log(`\n✅ Done! ${updated} updated, ${failed} failed`);
}

main().catch(console.error);