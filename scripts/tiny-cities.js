const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Cities with population 10k-25k - coffee shop gold mines (college towns, suburbs, tourist spots)
const TINY_CITIES = [
  // California
  { city: 'Capitola', state: 'CA' },
  { city: 'Pacific Grove', state: 'CA' },
  { city: 'Mill Valley', state: 'CA' },
  { city: 'Sausalito', state: 'CA' },
  { city: 'Tiburon', state: 'CA' },
  { city: 'Los Gatos', state: 'CA' },
  { city: 'Carmel-by-the-Sea', state: 'CA' },
  { city: 'Solvang', state: 'CA' },
  { city: 'Ojai', state: 'CA' },
  { city: 'Sebastopol', state: 'CA' },
  { city: 'Healdsburg', state: 'CA' },
  { city: 'St Helena', state: 'CA' },
  { city: 'Sonoma', state: 'CA' },
  { city: 'Fairfax', state: 'CA' },
  { city: 'San Anselmo', state: 'CA' },
  { city: 'Larkspur', state: 'CA' },
  
  // Pacific Northwest
  { city: 'Ashland', state: 'OR' },
  { city: 'Hood River', state: 'OR' },
  { city: 'Cannon Beach', state: 'OR' },
  { city: 'Astoria', state: 'OR' },
  { city: 'Florence', state: 'OR' },
  { city: 'Bandon', state: 'OR' },
  { city: 'Sisters', state: 'OR' },
  { city: 'Leavenworth', state: 'WA' },
  { city: 'Port Townsend', state: 'WA' },
  { city: 'Sequim', state: 'WA' },
  { city: 'Langley', state: 'WA' },
  { city: 'Friday Harbor', state: 'WA' },
  { city: 'La Conner', state: 'WA' },
  { city: 'Poulsbo', state: 'WA' },
  { city: 'Gig Harbor', state: 'WA' },
  { city: 'Winthrop', state: 'WA' },
  
  // Colorado
  { city: 'Telluride', state: 'CO' },
  { city: 'Crested Butte', state: 'CO' },
  { city: 'Breckenridge', state: 'CO' },
  { city: 'Vail', state: 'CO' },
  { city: 'Aspen', state: 'CO' },
  { city: 'Steamboat Springs', state: 'CO' },
  { city: 'Durango', state: 'CO' },
  { city: 'Salida', state: 'CO' },
  { city: 'Buena Vista', state: 'CO' },
  { city: 'Manitou Springs', state: 'CO' },
  { city: 'Nederland', state: 'CO' },
  { city: 'Lyons', state: 'CO' },
  { city: 'Louisville', state: 'CO' },
  { city: 'Lafayette', state: 'CO' },
  { city: 'Erie', state: 'CO' },
  
  // Mountain West
  { city: 'Park City', state: 'UT' },
  { city: 'Moab', state: 'UT' },
  { city: 'Springdale', state: 'UT' },
  { city: 'Jackson', state: 'WY' },
  { city: 'Whitefish', state: 'MT' },
  { city: 'Bozeman', state: 'MT' },
  { city: 'Missoula', state: 'MT' },
  { city: 'Helena', state: 'MT' },
  { city: 'Sandpoint', state: 'ID' },
  { city: 'McCall', state: 'ID' },
  { city: 'Ketchum', state: 'ID' },
  { city: 'Sun Valley', state: 'ID' },
  
  // Southwest
  { city: 'Sedona', state: 'AZ' },
  { city: 'Bisbee', state: 'AZ' },
  { city: 'Jerome', state: 'AZ' },
  { city: 'Tubac', state: 'AZ' },
  { city: 'Taos', state: 'NM' },
  { city: 'Las Vegas', state: 'NM' },
  { city: 'Silver City', state: 'NM' },
  { city: 'Truth or Consequences', state: 'NM' },
  { city: 'Madrid', state: 'NM' },
  
  // Texas
  { city: 'Marfa', state: 'TX' },
  { city: 'Fredericksburg', state: 'TX' },
  { city: 'Wimberley', state: 'TX' },
  { city: 'Dripping Springs', state: 'TX' },
  { city: 'Gruene', state: 'TX' },
  { city: 'Boerne', state: 'TX' },
  { city: 'Rockport', state: 'TX' },
  { city: 'Port Aransas', state: 'TX' },
  { city: 'South Padre Island', state: 'TX' },
  { city: 'Granbury', state: 'TX' },
  
  // Southeast
  { city: 'Asheville', state: 'NC' },
  { city: 'Blowing Rock', state: 'NC' },
  { city: 'Brevard', state: 'NC' },
  { city: 'Black Mountain', state: 'NC' },
  { city: 'Beaufort', state: 'NC' },
  { city: 'Beaufort', state: 'SC' },
  { city: 'Folly Beach', state: 'SC' },
  { city: 'Isle of Palms', state: 'SC' },
  { city: 'Fernandina Beach', state: 'FL' },
  { city: 'Apalachicola', state: 'FL' },
  { city: 'Cedar Key', state: 'FL' },
  { city: 'Mount Dora', state: 'FL' },
  { city: 'Dunedin', state: 'FL' },
  { city: 'Gulfport', state: 'FL' },
  { city: 'St Augustine Beach', state: 'FL' },
  { city: 'Savannah', state: 'GA' },
  { city: 'Tybee Island', state: 'GA' },
  { city: 'St Simons Island', state: 'GA' },
  { city: 'Dahlonega', state: 'GA' },
  { city: 'Blue Ridge', state: 'GA' },
  { city: 'Helen', state: 'GA' },
  { city: 'Madison', state: 'GA' },
  { city: 'Oxford', state: 'MS' },
  { city: 'Ocean Springs', state: 'MS' },
  { city: 'Bay St Louis', state: 'MS' },
  { city: 'Fairhope', state: 'AL' },
  { city: 'Gulf Shores', state: 'AL' },
  { city: 'Orange Beach', state: 'AL' },
  { city: 'Gatlinburg', state: 'TN' },
  { city: 'Pigeon Forge', state: 'TN' },
  { city: 'Jonesborough', state: 'TN' },
  
  // Northeast
  { city: 'Northampton', state: 'MA' },
  { city: 'Amherst', state: 'MA' },
  { city: 'Provincetown', state: 'MA' },
  { city: 'Chatham', state: 'MA' },
  { city: 'Nantucket', state: 'MA' },
  { city: 'Marthas Vineyard', state: 'MA' },
  { city: 'Newport', state: 'RI' },
  { city: 'Narragansett', state: 'RI' },
  { city: 'Westerly', state: 'RI' },
  { city: 'Mystic', state: 'CT' },
  { city: 'Essex', state: 'CT' },
  { city: 'Stowe', state: 'VT' },
  { city: 'Burlington', state: 'VT' },
  { city: 'Woodstock', state: 'VT' },
  { city: 'Manchester', state: 'VT' },
  { city: 'Brattleboro', state: 'VT' },
  { city: 'Bennington', state: 'VT' },
  { city: 'Montpelier', state: 'VT' },
  { city: 'Portsmouth', state: 'NH' },
  { city: 'Hanover', state: 'NH' },
  { city: 'North Conway', state: 'NH' },
  { city: 'Kennebunkport', state: 'ME' },
  { city: 'Camden', state: 'ME' },
  { city: 'Bar Harbor', state: 'ME' },
  { city: 'Rockland', state: 'ME' },
  { city: 'Belfast', state: 'ME' },
  { city: 'Brunswick', state: 'ME' },
  { city: 'Freeport', state: 'ME' },
  { city: 'Ogunquit', state: 'ME' },
  { city: 'Rhinebeck', state: 'NY' },
  { city: 'Cold Spring', state: 'NY' },
  { city: 'Beacon', state: 'NY' },
  { city: 'Woodstock', state: 'NY' },
  { city: 'New Paltz', state: 'NY' },
  { city: 'Saugerties', state: 'NY' },
  { city: 'Hudson', state: 'NY' },
  { city: 'Cooperstown', state: 'NY' },
  { city: 'Saratoga Springs', state: 'NY' },
  { city: 'Lake Placid', state: 'NY' },
  { city: 'Lake George', state: 'NY' },
  { city: 'Ithaca', state: 'NY' },
  { city: 'Corning', state: 'NY' },
  { city: 'Canandaigua', state: 'NY' },
  { city: 'Skaneateles', state: 'NY' },
  { city: 'Lewes', state: 'DE' },
  { city: 'Rehoboth Beach', state: 'DE' },
  { city: 'Bethany Beach', state: 'DE' },
  { city: 'Cape May', state: 'NJ' },
  { city: 'Spring Lake', state: 'NJ' },
  { city: 'Red Bank', state: 'NJ' },
  { city: 'Lambertville', state: 'NJ' },
  { city: 'Princeton', state: 'NJ' },
  { city: 'Haddonfield', state: 'NJ' },
  { city: 'Collingswood', state: 'NJ' },
  { city: 'New Hope', state: 'PA' },
  { city: 'Doylestown', state: 'PA' },
  { city: 'Jim Thorpe', state: 'PA' },
  { city: 'Lititz', state: 'PA' },
  { city: 'Gettysburg', state: 'PA' },
  { city: 'Media', state: 'PA' },
  
  // Midwest
  { city: 'Galena', state: 'IL' },
  { city: 'Geneva', state: 'IL' },
  { city: 'St Charles', state: 'IL' },
  { city: 'Naperville', state: 'IL' },
  { city: 'Oak Park', state: 'IL' },
  { city: 'Evanston', state: 'IL' },
  { city: 'Saugatuck', state: 'MI' },
  { city: 'Holland', state: 'MI' },
  { city: 'Traverse City', state: 'MI' },
  { city: 'Petoskey', state: 'MI' },
  { city: 'Charlevoix', state: 'MI' },
  { city: 'Mackinac Island', state: 'MI' },
  { city: 'Marquette', state: 'MI' },
  { city: 'Ann Arbor', state: 'MI' },
  { city: 'Northville', state: 'MI' },
  { city: 'Birmingham', state: 'MI' },
  { city: 'Royal Oak', state: 'MI' },
  { city: 'Door County', state: 'WI' },
  { city: 'Fish Creek', state: 'WI' },
  { city: 'Ephraim', state: 'WI' },
  { city: 'Sister Bay', state: 'WI' },
  { city: 'Cedarburg', state: 'WI' },
  { city: 'Lake Geneva', state: 'WI' },
  { city: 'Spring Green', state: 'WI' },
  { city: 'Baraboo', state: 'WI' },
  { city: 'Bayfield', state: 'WI' },
  { city: 'Stillwater', state: 'MN' },
  { city: 'Excelsior', state: 'MN' },
  { city: 'Red Wing', state: 'MN' },
  { city: 'Northfield', state: 'MN' },
  { city: 'Grand Marais', state: 'MN' },
  { city: 'Ely', state: 'MN' },
  { city: 'Lanesboro', state: 'MN' },
  { city: 'Decorah', state: 'IA' },
  { city: 'Pella', state: 'IA' },
  { city: 'Fairfield', state: 'IA' },
  { city: 'Iowa City', state: 'IA' },
  { city: 'Lawrence', state: 'KS' },
  { city: 'Manhattan', state: 'KS' },
  { city: 'Weston', state: 'MO' },
  { city: 'Hermann', state: 'MO' },
  { city: 'Eureka Springs', state: 'AR' },
  { city: 'Hot Springs', state: 'AR' },
  { city: 'Bentonville', state: 'AR' },
  { city: 'Fayetteville', state: 'AR' },
  
  // College Towns
  { city: 'Athens', state: 'GA' },
  { city: 'Chapel Hill', state: 'NC' },
  { city: 'Charlottesville', state: 'VA' },
  { city: 'Blacksburg', state: 'VA' },
  { city: 'Lexington', state: 'VA' },
  { city: 'State College', state: 'PA' },
  { city: 'Bloomington', state: 'IN' },
  { city: 'Madison', state: 'WI' },
  { city: 'Boulder', state: 'CO' },
  { city: 'Fort Collins', state: 'CO' },
  { city: 'Eugene', state: 'OR' },
  { city: 'Corvallis', state: 'OR' },
  { city: 'Bellingham', state: 'WA' },
  { city: 'Pullman', state: 'WA' },
  { city: 'Moscow', state: 'ID' },
  { city: 'Davis', state: 'CA' },
  { city: 'San Luis Obispo', state: 'CA' },
  { city: 'Santa Cruz', state: 'CA' },
  { city: 'Berkeley', state: 'CA' },
];

let stats = { processed: 0, added: 0, enriched: 0, errors: 0 };
let processedCities = new Set();

async function loadProgress() {
  try {
    const fs = require('fs');
    if (fs.existsSync('tiny-cities-progress.json')) {
      const data = JSON.parse(fs.readFileSync('tiny-cities-progress.json'));
      processedCities = new Set(data.processedCities || []);
      console.log(`Resuming from ${processedCities.size} processed cities`);
    }
  } catch (e) {}
}

function saveProgress() {
  const fs = require('fs');
  fs.writeFileSync('tiny-cities-progress.json', JSON.stringify({
    processedCities: [...processedCities],
    stats
  }));
}

async function searchCoffeeShops(city, state) {
  const query = `coffee shops in ${city}, ${state}`;
  const url = `https://places.googleapis.com/v1/places:searchText`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.types,places.businessStatus'
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 20 })
  });
  
  const data = await response.json();
  return data.places || [];
}

async function processCity(city, state) {
  const key = `${city}, ${state}`;
  if (processedCities.has(key)) return;
  
  try {
    const places = await searchCoffeeShops(city, state);
    let added = 0, enriched = 0;
    
    for (const place of places) {
      if (place.businessStatus !== 'OPERATIONAL') continue;
      
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
        source: 'enriched',
        is_active: true,
        lead_score: 50
      };
      
      // Check if exists
      const { data: existing } = await db.from('shops')
        .select('id')
        .eq('google_place_id', place.id)
        .maybeSingle();
      
      if (existing) {
        // Update with any new info
        await db.from('shops').update({
          google_rating: shopData.google_rating,
          google_reviews: shopData.google_reviews,
          phone: shopData.phone || undefined,
          website: shopData.website || undefined
        }).eq('id', existing.id);
        enriched++;
      } else if (shopData.name) {
        // Check by name + city
        const { data: byName } = await db.from('shops')
          .select('id')
          .ilike('name', shopData.name)
          .eq('city', city)
          .maybeSingle();
        
        if (!byName) {
          await db.from('shops').insert(shopData);
          added++;
        }
      }
    }
    
    stats.processed++;
    stats.added += added;
    stats.enriched += enriched;
    processedCities.add(key);
    
    console.log(`✓ ${city}, ${state}: +${added} new, ${enriched} updated (${stats.processed}/${TINY_CITIES.length})`);
    
    if (stats.processed % 10 === 0) saveProgress();
    
  } catch (err) {
    console.error(`✗ ${city}, ${state}: ${err.message}`);
    stats.errors++;
  }
  
  // Rate limit
  await new Promise(r => setTimeout(r, 200));
}

async function main() {
  console.log('🏘️ Tiny Cities Enrichment');
  console.log(`Processing ${TINY_CITIES.length} charming small towns...\n`);
  
  await loadProgress();
  
  for (const { city, state } of TINY_CITIES) {
    await processCity(city, state);
  }
  
  saveProgress();
  
  console.log('\n==================================================');
  console.log('📊 FINAL RESULTS');
  console.log('==================================================');
  console.log(`Cities Processed: ${stats.processed}`);
  console.log(`Total Added: ${stats.added}`);
  console.log(`Total Enriched: ${stats.enriched}`);
  console.log(`Errors: ${stats.errors}`);
}

main().catch(console.error);
