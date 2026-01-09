/**
 * Enrich Joe Partners - Priority
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const JOE_PARTNERS = [
  { id: 'f012368c-5cb1-4d67-97ec-024bdbc78316', name: 'Makawao Marketplace', search: 'Makawao Marketplace Makawao Hawaii' },
  { id: '1b42ed46-8fa6-4b89-bf23-334424813803', name: 'Rooster Roast', search: 'Rooster Roast Coffee Winlock WA' },
  { id: '07e8e0ea-d26c-4beb-af43-855cbcd37ec4', name: 'Coal Creek Coffee', search: 'Coal Creek Coffee Newcastle WA' },
  { id: '83ddc106-93c7-4452-94bf-1d53b8236a27', name: 'Tin Star Coffee Pecan Square', search: 'Tin Star Coffee Pecan Square Northlake TX' },
  { id: 'a79cff66-5822-4a45-9d37-d5bf0dd1c9a3', name: 'Silo Market', placeId: 'ChIJTT3KH_WLhocR5X6tdLV9nO4' }
];

async function getPhotosFromPlaceId(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.result?.photos?.length > 0) {
    return data.result.photos.slice(0, 5).map(photo =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
    );
  }
  return null;
}

async function searchAndGetPhotos(searchQuery) {
  const query = encodeURIComponent(searchQuery);
  const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id&key=${GOOGLE_API_KEY}`;
  
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  
  console.log(`  Search result for "${searchQuery}":`, searchData.candidates?.length || 0, 'candidates');
  
  if (!searchData.candidates || searchData.candidates.length === 0) {
    return { placeId: null, photos: null };
  }
  
  const placeId = searchData.candidates[0].place_id;
  const photos = await getPhotosFromPlaceId(placeId);
  
  return { placeId, photos };
}

async function main() {
  console.log('Enriching Joe Partners...\n');

  for (const partner of JOE_PARTNERS) {
    console.log(`Processing: ${partner.name}`);
    
    let placeId = partner.placeId;
    let photos = null;
    
    if (placeId) {
      photos = await getPhotosFromPlaceId(placeId);
    } else {
      const result = await searchAndGetPhotos(partner.search);
      placeId = result.placeId;
      photos = result.photos;
    }
    
    if (photos && photos.length > 0) {
      const { error } = await supabase
        .from('shops')
        .update({ google_place_id: placeId, photos })
        .eq('id', partner.id);
      
      if (error) {
        console.log(`  Error: ${error.message}`);
      } else {
        console.log(`  Done - ${photos.length} photos saved`);
      }
    } else {
      console.log(`  No photos found`);
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log('\nDone!');
}

main();