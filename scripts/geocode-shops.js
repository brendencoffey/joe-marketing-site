// Geocode shops missing lat/lng using Google Places API
// Run with: node geocode-shops.js
// Requires: GOOGLE_PLACES_API_KEY and SUPABASE_SERVICE_KEY env vars

const SUPABASE_URL = 'https://vpnoaxpmhuknyaxcyxsu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use service key for updates
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const BATCH_SIZE = 50; // Process 50 at a time
const DELAY_MS = 200; // 200ms between API calls to avoid rate limits

async function supabase(endpoint, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers
    },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error: ${res.status} ${text}`);
  }
  return res.json();
}

async function searchGooglePlaces(query) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=cafe|coffee_shop|restaurant|bakery&key=${GOOGLE_API_KEY}`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status === 'OK' && data.results.length > 0) {
    return data.results[0]; // Return top result
  }
  return null;
}

async function getPlaceDetails(placeId) {
  const fields = 'formatted_address,formatted_phone_number,website,geometry,address_components,rating,user_ratings_total';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status === 'OK') {
    return data.result;
  }
  return null;
}

function parseAddressComponents(components) {
  const result = {};
  for (const comp of components || []) {
    if (comp.types.includes('locality')) result.city = comp.long_name;
    if (comp.types.includes('administrative_area_level_1')) {
      result.state = comp.long_name;
      result.state_code = comp.short_name;
    }
    if (comp.types.includes('postal_code')) result.zip = comp.short_name;
    if (comp.types.includes('country')) result.country = comp.short_name;
  }
  return result;
}

async function geocodeShop(shop) {
  // Build search query
  let query = shop.name;
  if (shop.city) query += ` ${shop.city}`;
  if (shop.state) query += ` ${shop.state}`;
  query += ' coffee'; // Help find coffee shops specifically
  
  console.log(`  Searching: "${query}"`);
  
  // Search Google Places
  const place = await searchGooglePlaces(query);
  if (!place) {
    console.log(`  ❌ No results found`);
    return null;
  }
  
  // Get details
  const details = await getPlaceDetails(place.place_id);
  if (!details) {
    console.log(`  ❌ Could not get place details`);
    return null;
  }
  
  const addressParts = parseAddressComponents(details.address_components);
  
  // Only update if it's in the US
  if (addressParts.country && addressParts.country !== 'US') {
    console.log(`  ❌ Not in US: ${addressParts.country}`);
    return null;
  }
  
  const updates = {
    lat: details.geometry?.location?.lat,
    lng: details.geometry?.location?.lng,
    address: details.formatted_address,
    city: addressParts.city || shop.city,
    state: addressParts.state || shop.state,
    state_code: addressParts.state_code || shop.state_code,
    phone: details.formatted_phone_number || shop.phone,
    website: details.website || shop.website,
    google_rating: details.rating,
    total_reviews: details.user_ratings_total,
    google_place_id: place.place_id
  };
  
  // Filter out null/undefined values
  const cleanUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && value !== undefined) {
      cleanUpdates[key] = value;
    }
  }
  
  console.log(`  ✅ Found: ${details.formatted_address}`);
  return cleanUpdates;
}

async function updateShop(shopId, updates) {
  await supabase(`shops?id=eq.${shopId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

async function getMissingShops(limit = BATCH_SIZE, offset = 0) {
  // Prioritize shops with city/state info, then just name
  const shops = await supabase(
    `shops?or=(lat.is.null,lng.is.null)&select=id,name,city,state,state_code&order=city.desc.nullsfirst&limit=${limit}&offset=${offset}`
  );
  return shops;
}

async function getShopsCount() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/shops?or=(lat.is.null,lng.is.null)&select=id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact'
    },
    method: 'HEAD'
  });
  return parseInt(res.headers.get('content-range')?.split('/')[1] || '0');
}

async function main() {
  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(1);
  }
  if (!GOOGLE_API_KEY) {
    console.error('Missing GOOGLE_PLACES_API_KEY env var');
    process.exit(1);
  }
  
  const totalMissing = await getShopsCount();
  console.log(`\n🔍 Found ${totalMissing} shops missing coordinates\n`);
  
  let processed = 0;
  let updated = 0;
  let failed = 0;
  let offset = 0;
  
  // Process in batches
  while (processed < totalMissing) {
    const shops = await getMissingShops(BATCH_SIZE, 0); // Always offset 0 since we're updating
    if (shops.length === 0) break;
    
    console.log(`\n📦 Batch ${Math.floor(processed / BATCH_SIZE) + 1}: Processing ${shops.length} shops...\n`);
    
    for (const shop of shops) {
      processed++;
      console.log(`[${processed}/${totalMissing}] ${shop.name}`);
      
      try {
        const updates = await geocodeShop(shop);
        
        if (updates && updates.lat && updates.lng) {
          await updateShop(shop.id, updates);
          updated++;
          console.log(`  💾 Updated in database\n`);
        } else {
          failed++;
          console.log(`  ⏭️ Skipped\n`);
        }
        
        // Rate limit delay
        await new Promise(r => setTimeout(r, DELAY_MS));
        
      } catch (err) {
        console.error(`  ❌ Error: ${err.message}\n`);
        failed++;
      }
    }
    
    // Progress summary
    console.log(`\n📊 Progress: ${updated} updated, ${failed} failed, ${totalMissing - processed} remaining\n`);
    
    // Safety check - stop if too many failures
    if (failed > 100 && failed > updated) {
      console.log('⚠️ Too many failures, stopping...');
      break;
    }
  }
  
  console.log(`\n✅ Done! Updated ${updated} shops, ${failed} failed out of ${processed} processed`);
}

main().catch(console.error);