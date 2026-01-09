/**
 * Photo Enrichment Script
 * Fetches Google Places photos for shops with google_place_id but no photos
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function fetchPhotosForShop(shop) {
  try {
    // Get place details with photos
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${shop.google_place_id}&fields=photos&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.result?.photos?.length > 0) {
      // Get up to 5 photo URLs
      const photos = data.result.photos.slice(0, 5).map(photo => 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
      );

      // Update shop
      const { error } = await supabase
        .from('shops')
        .update({ photos })
        .eq('id', shop.id);

      if (error) {
        console.error(`Error updating ${shop.name}:`, error.message);
        return false;
      }
      
      console.log(`✅ ${shop.name} - ${photos.length} photos`);
      return true;
    } else {
      console.log(`⚠️ ${shop.name} - no photos found`);
      return false;
    }
  } catch (err) {
    console.error(`❌ ${shop.name}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('Fetching shops without photos...\n');

  // Get shops with google_place_id but no photos
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, name, google_place_id')
    .not('google_place_id', 'is', null)
    .or('photos.is.null,photos.eq.{}')
    .neq('pipeline_stage', 'legacy')
    .order('is_joe_partner', { ascending: false }) // Partners first
    .limit(500); // Process in batches

  if (error) {
    console.error('Error fetching shops:', error);
    return;
  }

  console.log(`Found ${shops.length} shops to enrich\n`);

  let success = 0;
  let failed = 0;

  for (const shop of shops) {
    const result = await fetchPhotosForShop(shop);
    if (result) success++;
    else failed++;
    
    // Rate limit: 1 request per 100ms
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✅ Success: ${success}`);
  console.log(`❌ Failed/No photos: ${failed}`);
}

main();
