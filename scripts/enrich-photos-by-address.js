/**
 * Photo Enrichment by Address
 * Searches Google Places by address, gets place_id, then fetches photos
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.https://vpnoaxpmhuknyaxcyxsu.supabase.co,
  process.env.sb_secret_sLDfsCjF0hQupOTlx-jgCQ_0aXbFWVy
);

const GOOGLE_API_KEY = process.env.AIzaSyCZDBTej3OX4KngmuZSwS26VUEvYSyp8Wc;

async function searchAndEnrich(shop) {
  try {
    // Search for the place by name + address
    const query = encodeURIComponent(`${shop.name} ${shop.address || ''} ${shop.city} ${shop.state}`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,photos&key=${GOOGLE_API_KEY}`;
    
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.candidates || searchData.candidates.length === 0) {
      console.log(`⚠️  ${shop.name} - not found`);
      return false;
    }

    const candidate = searchData.candidates[0];
    const placeId = candidate.place_id;

    // Get place details with photos
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_API_KEY}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (!detailsData.result?.photos?.length) {
      console.log(`⚠️  ${shop.name} - no photos available`);
      return false;
    }

    // Get up to 5 photo URLs
    const photos = detailsData.result.photos.slice(0, 5).map(photo =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
    );

    // Update shop with place_id and photos
    const { error } = await supabase
      .from('shops')
      .update({ 
        google_place_id: placeId,
        photos 
      })
      .eq('id', shop.id);

    if (error) {
      console.error(`❌ ${shop.name}:`, error.message);
      return false;
    }

    console.log(`✅ ${shop.name} - ${photos.length} photos`);
    return true;

  } catch (err) {
    console.error(`❌ ${shop.name}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('Fetching shops without photos (with address data)...\n');

  // Get shops without photos but with address/city
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, name, address, city, state')
    .or('photos.is.null,photos.eq.{}')
    .neq('pipeline_stage', 'legacy')
    .not('city', 'is', null)
    .order('is_joe_partner', { ascending: false })
    .limit(100); // Start with 100

  if (error) {
    console.error('Error fetching shops:', error);
    return;
  }

  console.log(`Found ${shops.length} shops to enrich\n`);

  let success = 0;
  let failed = 0;

  for (const shop of shops) {
    const result = await searchAndEnrich(shop);
    if (result) success++;
    else failed++;

    // Rate limit: 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Success: ${success}`);
  console.log(`❌ Failed/No photos: ${failed}`);
}

main();
