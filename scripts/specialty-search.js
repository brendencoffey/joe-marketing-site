const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Different search terms to find specialty coffee businesses
const SEARCH_TERMS = [
  'coffee roaster',
  'espresso bar', 
  'specialty coffee',
  'third wave coffee',
  'artisan coffee',
  'craft coffee',
  'coffee roastery',
  'micro roaster coffee',
  'pour over coffee',
  'cafe and bakery',
  'coffee and tea',
  'matcha cafe',
  'boba tea',  // often have coffee too
];

// Top 100 US cities by population
const CITIES = [
  { city: 'New York', state: 'NY' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Houston', state: 'TX' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Philadelphia', state: 'PA' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'San Diego', state: 'CA' },
  { city: 'Dallas', state: 'TX' },
  { city: 'San Jose', state: 'CA' },
  { city: 'Austin', state: 'TX' },
  { city: 'Jacksonville', state: 'FL' },
  { city: 'Fort Worth', state: 'TX' },
  { city: 'Columbus', state: 'OH' },
  { city: 'Indianapolis', state: 'IN' },
  { city: 'Charlotte', state: 'NC' },
  { city: 'San Francisco', state: 'CA' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Denver', state: 'CO' },
  { city: 'Washington', state: 'DC' },
  { city: 'Boston', state: 'MA' },
  { city: 'Nashville', state: 'TN' },
  { city: 'Detroit', state: 'MI' },
  { city: 'Portland', state: 'OR' },
  { city: 'Las Vegas', state: 'NV' },
  { city: 'Memphis', state: 'TN' },
  { city: 'Louisville', state: 'KY' },
  { city: 'Baltimore', state: 'MD' },
  { city: 'Milwaukee', state: 'WI' },
  { city: 'Albuquerque', state: 'NM' },
  { city: 'Tucson', state: 'AZ' },
  { city: 'Fresno', state: 'CA' },
  { city: 'Sacramento', state: 'CA' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Kansas City', state: 'MO' },
  { city: 'Miami', state: 'FL' },
  { city: 'Raleigh', state: 'NC' },
  { city: 'Omaha', state: 'NE' },
  { city: 'Minneapolis', state: 'MN' },
  { city: 'Cleveland', state: 'OH' },
  { city: 'Tampa', state: 'FL' },
  { city: 'Oakland', state: 'CA' },
  { city: 'Pittsburgh', state: 'PA' },
  { city: 'Cincinnati', state: 'OH' },
  { city: 'St Louis', state: 'MO' },
  { city: 'Orlando', state: 'FL' },
  { city: 'New Orleans', state: 'LA' },
  { city: 'Salt Lake City', state: 'UT' },
  { city: 'Honolulu', state: 'HI' },
  { city: 'Richmond', state: 'VA' },
];

let stats = { processed: 0, added: 0, skipped: 0, errors: 0 };
let processedSearches = new Set();

async function loadProgress() {
  try {
    const fs = require('fs');
    if (fs.existsSync('specialty-progress.json')) {
      const data = JSON.parse(fs.readFileSync('specialty-progress.json'));
      processedSearches = new Set(data.processedSearches || []);
      stats = data.stats || stats;
      console.log(`Resuming from ${processedSearches.size} processed searches`);
    }
  } catch (e) {}
}

function saveProgress() {
  const fs = require('fs');
  fs.writeFileSync('specialty-progress.json', JSON.stringify({ processedSearches: [...processedSearches], stats }));
}

async function searchPlaces(query, city, state) {
  const fullQuery = `${query} in ${city}, ${state}`;
  const url = `https://places.googleapis.com/v1/places:searchText`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.businessStatus,places.types'
    },
    body: JSON.stringify({ textQuery: fullQuery, maxResultCount: 20 })
  });
  
  const data = await response.json();
  return data.places || [];
}

async function processSearch(term, city, state) {
  const key = `${term}|${city}|${state}`;
  if (processedSearches.has(key)) return;
  
  try {
    const places = await searchPlaces(term, city, state);
    let added = 0;
    
    for (const place of places) {
      if (place.businessStatus !== 'OPERATIONAL') continue;
      
      // Check if exists
      const { data: existing } = await db.from('shops')
        .select('id')
        .eq('google_place_id', place.id)
        .maybeSingle();
      
      if (existing) {
        stats.skipped++;
        continue;
      }
      
      // Determine shop type from search term
      let shopType = 'Unknown';
      if (term.includes('roaster') || term.includes('roastery')) shopType = 'Roaster';
      else if (term.includes('espresso') || term.includes('specialty') || term.includes('third wave') || term.includes('artisan') || term.includes('craft') || term.includes('pour over')) shopType = 'Specialty Cafe';
      else if (term.includes('bakery')) shopType = 'Bakery/Cafe';
      else if (term.includes('boba') || term.includes('tea')) shopType = 'Tea/Boba';
      else if (term.includes('matcha')) shopType = 'Matcha Cafe';
      
      const shopData = {
        name: place.displayName?.text,
        google_place_id: place.id,
        address: place.formattedAddress,
        city: city,
        state: state,
        state_code: state,
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        phone: place.nationalPhoneNumber,
        website: place.websiteUri,
        google_rating: place.rating,
        google_reviews: place.userRatingCount,
        coffee_shop_type: shopType,
        source: 'enriched',
        is_active: true,
        lead_score: shopType === 'Roaster' ? 70 : 50
      };
      
      if (shopData.name) {
        await db.from('shops').insert(shopData);
        added++;
        stats.added++;
      }
    }
    
    stats.processed++;
    processedSearches.add(key);
    
    const total = SEARCH_TERMS.length * CITIES.length;
    if (added > 0) {
      console.log(`✓ "${term}" in ${city}, ${state}: +${added} new (${stats.processed}/${total})`);
    }
    
    if (stats.processed % 50 === 0) {
      console.log(`  Progress: ${stats.processed}/${total} | Added: ${stats.added} | Skipped: ${stats.skipped}`);
      saveProgress();
    }
    
  } catch (err) {
    console.error(`✗ ${term} in ${city}: ${err.message}`);
    stats.errors++;
  }
  
  await new Promise(r => setTimeout(r, 150));
}

async function main() {
  console.log('☕ Specialty Coffee Search');
  console.log(`${SEARCH_TERMS.length} search terms × ${CITIES.length} cities = ${SEARCH_TERMS.length * CITIES.length} searches\n`);
  
  await loadProgress();
  
  for (const term of SEARCH_TERMS) {
    console.log(`\n🔍 Searching: "${term}"...`);
    for (const { city, state } of CITIES) {
      await processSearch(term, city, state);
    }
  }
  
  saveProgress();
  
  console.log('\n==================================================');
  console.log('📊 FINAL RESULTS');
  console.log('==================================================');
  console.log(`Searches: ${stats.processed}`);
  console.log(`New Shops: ${stats.added}`);
  console.log(`Already Had: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
}

main().catch(console.error);
