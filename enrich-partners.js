/**
 * Enrich Joe Partners v2 - Smarter matching
 * 
 * Improvements:
 * - Strips location suffixes (- Federal Way, etc.)
 * - Uses address-based search first
 * - Logs failures to CSV for manual review
 * 
 * Run with:
 * export GOOGLE_PLACES_API_KEY="your_key"
 * export SUPABASE_URL="your_url"  
 * export SUPABASE_SERVICE_KEY="your_key"
 * node scripts/enrich-partners-v2.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// Track failures for CSV export
const failures = [];

async function main() {
  console.log('🔍 Fetching partners still missing google_place_id...\n');
  
  if (!GOOGLE_API_KEY) {
    console.error('❌ Missing GOOGLE_PLACES_API_KEY');
    process.exit(1);
  }
  
  if (DRY_RUN) console.log('🔸 DRY RUN MODE\n');
  
  let query = supabase
    .from('shops')
    .select('id, name, address, city, state_code, zip, lat, lng')
    .eq('is_joe_partner', true)
    .eq('is_active', true)
    .is('google_place_id', null)
    .order('name');
  
  if (LIMIT) query = query.limit(LIMIT);
  
  const { data: partners, error } = await query;
  
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  console.log(`Found ${partners.length} partners to enrich\n`);
  
  let enriched = 0, merged = 0, failed = 0;
  
  for (const partner of partners) {
    console.log(`\n📍 ${partner.name}`);
    console.log(`   ${partner.address}, ${partner.city}, ${partner.state_code}`);
    
    try {
      // Try multiple search strategies
      let placeData = null;
      
      // Strategy 1: Address-based search (most accurate)
      placeData = await searchByAddress(partner);
      
      // Strategy 2: Clean name + city search
      if (!placeData) {
        const cleanName = cleanShopName(partner.name);
        console.log(`   Trying clean name: "${cleanName}"`);
        placeData = await searchByName(cleanName, partner);
      }
      
      // Strategy 3: First part of name only
      if (!placeData) {
        const shortName = partner.name.split(/[-–—]/)[0].trim();
        if (shortName !== partner.name) {
          console.log(`   Trying short name: "${shortName}"`);
          placeData = await searchByName(shortName, partner);
        }
      }
      
      if (!placeData) {
        console.log('   ⚠️  No match found');
        failures.push({
          id: partner.id,
          name: partner.name,
          address: partner.address,
          city: partner.city,
          state: partner.state_code,
          reason: 'No Google Places match'
        });
        failed++;
        continue;
      }
      
      console.log(`   ✓ Found: ${placeData.name}`);
      console.log(`   ✓ Place ID: ${placeData.place_id}`);
      
      // Check for duplicate
      const { data: existing } = await supabase
        .from('shops')
        .select('id, name')
        .eq('google_place_id', placeData.place_id)
        .neq('id', partner.id)
        .single();
      
      if (existing) {
        console.log(`   ⚠️  Duplicate: "${existing.name}" (ID: ${existing.id})`);
        
        if (!DRY_RUN) {
          // Transfer partner status to existing record
          await supabase
            .from('shops')
            .update({ is_joe_partner: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          
          // Deactivate duplicate
          await supabase
            .from('shops')
            .update({ is_active: false, notes: `Merged with ${existing.id}` })
            .eq('id', partner.id);
        }
        
        console.log('   ✅ Merged');
        merged++;
        continue;
      }
      
      if (DRY_RUN) {
        console.log('   🔸 Would update (dry run)');
        enriched++;
        continue;
      }
      
      // Get details and update
      const details = await getPlaceDetails(placeData.place_id);
      
      const updateData = {
        google_place_id: placeData.place_id,
        google_rating: placeData.rating || null,
        google_reviews: placeData.user_ratings_total || null,
        updated_at: new Date().toISOString()
      };
      
      if (details?.website) updateData.website = details.website;
      if (details?.formatted_phone_number) updateData.phone = details.formatted_phone_number;
      if (details?.opening_hours?.periods) updateData.hours = formatHours(details.opening_hours);
      
      if (placeData.photos?.length > 0) {
        updateData.photos = placeData.photos.slice(0, 5).map(p =>
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${GOOGLE_API_KEY}`
        );
      }
      
      const { error: updateError } = await supabase
        .from('shops')
        .update(updateData)
        .eq('id', partner.id);
      
      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
        failures.push({
          id: partner.id,
          name: partner.name,
          address: partner.address,
          city: partner.city,
          state: partner.state_code,
          reason: updateError.message
        });
        failed++;
      } else {
        console.log('   ✅ Updated!');
        enriched++;
      }
      
      await sleep(200);
      
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failures.push({
        id: partner.id,
        name: partner.name,
        address: partner.address,
        city: partner.city,
        state: partner.state_code,
        reason: err.message
      });
      failed++;
    }
  }
  
  // Save failures to CSV
  if (failures.length > 0) {
    const csv = [
      'id,name,address,city,state,reason',
      ...failures.map(f => `${f.id},"${f.name}","${f.address}","${f.city}","${f.state}","${f.reason}"`)
    ].join('\n');
    
    fs.writeFileSync('partner-enrichment-failures.csv', csv);
    console.log(`\n📄 Failures saved to partner-enrichment-failures.csv`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Enriched: ${enriched}`);
  console.log(`🔀 Merged: ${merged}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50));
}

function cleanShopName(name) {
  // Remove location suffixes
  return name
    .replace(/\s*[-–—]\s*([\w\s]+)$/, '') // "Cafe - Location" -> "Cafe"
    .replace(/\s*\([\w\s]+\)$/, '')        // "Cafe (Location)" -> "Cafe"
    .replace(/\s+(at|@)\s+.+$/i, '')       // "Cafe at Mall" -> "Cafe"
    .trim();
}

async function searchByAddress(partner) {
  if (!partner.address || !partner.city) return null;
  
  const query = `${partner.address}, ${partner.city}, ${partner.state_code}`;
  
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', query);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id,name,formatted_address,geometry,rating,user_ratings_total,photos,types');
  url.searchParams.set('key', GOOGLE_API_KEY);
  
  if (partner.lat && partner.lng) {
    url.searchParams.set('locationbias', `circle:500@${partner.lat},${partner.lng}`);
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === 'OK' && data.candidates?.length > 0) {
    // Verify it's a cafe/restaurant type
    const candidate = data.candidates[0];
    const validTypes = ['cafe', 'restaurant', 'food', 'bakery', 'establishment'];
    const hasValidType = candidate.types?.some(t => validTypes.includes(t));
    if (hasValidType || !candidate.types) {
      return candidate;
    }
  }
  
  return null;
}

async function searchByName(name, partner) {
  const query = `${name} ${partner.city} ${partner.state_code}`;
  
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', query);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id,name,formatted_address,geometry,rating,user_ratings_total,photos,types');
  url.searchParams.set('key', GOOGLE_API_KEY);
  
  if (partner.lat && partner.lng) {
    url.searchParams.set('locationbias', `circle:5000@${partner.lat},${partner.lng}`);
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === 'OK' && data.candidates?.length > 0) {
    return data.candidates[0];
  }
  
  return null;
}

async function getPlaceDetails(placeId) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'website,formatted_phone_number,opening_hours');
  url.searchParams.set('key', GOOGLE_API_KEY);
  
  const response = await fetch(url);
  const data = await response.json();
  
  return data.status === 'OK' ? data.result : null;
}

function formatHours(openingHours) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const hours = {};
  
  days.forEach(day => { hours[day] = { closed: true }; });
  
  if (!openingHours.periods) return hours;
  
  for (const period of openingHours.periods) {
    if (!period.open) continue;
    const dayName = days[period.open.day];
    hours[dayName] = {
      open: period.open.time?.replace(/(\d{2})(\d{2})/, '$1:$2') || '00:00',
      close: period.close?.time?.replace(/(\d{2})(\d{2})/, '$1:$2') || '23:59',
      closed: false
    };
  }
  
  return hours;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);