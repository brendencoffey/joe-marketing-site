/**
 * Generate AI descriptions for all neighborhoods
 * Run with: ANTHROPIC_API_KEY=your_key node generate-neighborhood-descriptions.js
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to set these or use environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpnoaxpmhuknyaxcyxsu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generateDescription(neighborhood) {
  const { neighborhood_name, city_name, state_code, shop_count } = neighborhood;
  
  const prompt = `Write a 2-3 sentence description of the coffee scene in ${neighborhood_name} for a coffee shop directory website. 

Context:
- Neighborhood: ${neighborhood_name}
- City: ${city_name}
- State: ${state_code.toUpperCase()}
- Number of independent coffee shops: ${shop_count}

Guidelines:
- Focus on the neighborhood's character and what makes its coffee scene unique
- Mention the types of people who frequent the area (artists, families, professionals, students, etc.)
- Reference any notable characteristics (historic buildings, waterfront, walkable streets, creative community, etc.)
- Keep it warm and inviting, highlighting independent/local coffee culture
- Do NOT mention specific shop names
- Write in present tense
- Maximum 280 characters

Example style: "A maritime neighborhood with Scandinavian roots and a thriving craft coffee scene. From converted warehouses to cozy corner spots, Ballard's independent coffee shops reflect the area's blend of fishing heritage and modern creative energy."

Write only the description, no quotes or extra text:`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  return data.content?.[0]?.text?.trim() || null;
}

async function main() {
  console.log('Fetching neighborhoods without descriptions...');
  
  // Get neighborhoods that need descriptions
  const { data: neighborhoods, error } = await supabase
    .from('neighborhoods')
    .select('*')
    .is('description', null)
    .order('shop_count', { ascending: false })
    .limit(50); // Process in batches of 50
  
  if (error) {
    console.error('Error fetching neighborhoods:', error);
    return;
  }
  
  console.log(`Found ${neighborhoods.length} neighborhoods to process`);
  
  for (let i = 0; i < neighborhoods.length; i++) {
    const n = neighborhoods[i];
    console.log(`[${i + 1}/${neighborhoods.length}] Generating description for ${n.neighborhood_name}...`);
    
    try {
      const description = await generateDescription(n);
      
      if (description) {
        const { error: updateError } = await supabase
          .from('neighborhoods')
          .update({ description, updated_at: new Date().toISOString() })
          .eq('id', n.id);
        
        if (updateError) {
          console.error(`  Error updating: ${updateError.message}`);
        } else {
          console.log(`  ✓ Updated: "${description.substring(0, 60)}..."`);
        }
      }
      
      // Rate limit: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }
  
  console.log('Done!');
}

main();
