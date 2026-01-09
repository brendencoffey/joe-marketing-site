/**
 * Generate slugs for products that don't have them
 * 
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node generate-product-slugs.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpnoaxpmhuknyaxcyxsu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function slugify(text, id) {
  let slug = (text || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
  
  // Add short ID to ensure uniqueness
  const shortId = id.substring(0, 8);
  return `${slug}-${shortId}`;
}

async function main() {
  console.log('Fetching products without slugs...\n');
  
  // Find products without slugs
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, slug')
    .is('slug', null)
    .eq('is_active', true);
  
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  
  console.log(`Found ${products.length} products without slugs\n`);
  
  if (products.length === 0) {
    console.log('All products have slugs!');
    return;
  }
  
  // Generate slugs
  let updated = 0;
  let failed = 0;
  
  for (const product of products) {
    const slug = slugify(product.name, product.id);
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ slug })
      .eq('id', product.id);
    
    if (updateError) {
      console.error(`Failed to update ${product.id}:`, updateError.message);
      failed++;
    } else {
      updated++;
      if (updated % 100 === 0) {
        console.log(`Updated ${updated} products...`);
      }
    }
  }
  
  console.log(`\nDone!`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
