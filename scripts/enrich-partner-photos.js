const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function getGooglePhotos(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.result?.photos) {
      return data.result.photos.slice(0, 5).map(p => 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${GOOGLE_API_KEY}`
      );
    }
    return [];
  } catch (err) { 
    console.error(err.message); 
    return []; 
  }
}

async function run() {
  console.log('Fetching partners...');
  const { data: partners, error } = await supabase
    .from('shops')
    .select('id, name, photos, google_place_id')
    .or('is_joe_partner.eq.true,partner_id.not.is.null')
    .not('google_place_id', 'is', null);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const need = partners.filter(p => !p.photos || p.photos.length < 3);
  console.log(`${need.length} partners need photos (of ${partners.length} total with place_id)`);
  
  let done = 0;
  for (let i = 0; i < need.length; i++) {
    const p = need[i];
    const gPhotos = await getGooglePhotos(p.google_place_id);
    
    if (gPhotos.length) {
      const existing = p.photos || [];
      const newPhotos = [...existing];
      for (const gp of gPhotos) {
        if (!newPhotos.includes(gp) && newPhotos.length < 6) {
          newPhotos.push(gp);
        }
      }
      
      if (newPhotos.length > existing.length) {
        await supabase.from('shops').update({ photos: newPhotos }).eq('id', p.id);
        done++;
        console.log(`[${i+1}/${need.length}] ${p.name}: +${newPhotos.length - existing.length} photos (now ${newPhotos.length})`);
      } else {
        console.log(`[${i+1}/${need.length}] ${p.name}: skipped (no new)`);
      }
    } else {
      console.log(`[${i+1}/${need.length}] ${p.name}: no Google photos`);
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\nDone! Enriched ${done} partners with new photos`);
}

run();