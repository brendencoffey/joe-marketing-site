#!/usr/bin/env node

/**
 * joe CRM - Add New City
 * Scrapes Google Places, enriches with Yelp, scrapes websites
 * 
 * Usage:
 *   node add-city.js "Portland, OR"
 *   node add-city.js "Austin, TX" --limit 50
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const { URL } = require('url');

// Config
const SUPABASE_URL = 'https://vpnoaxpmhuknyaxcyxsu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbm9heHBtaHVrbnlheGN5eHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NjkzNTMsImV4cCI6MjA4MjQ0NTM1M30.0JVwCaY-3nUHuJk49ibifQviT0LxBSdYXMslw9WIr9M';
const GOOGLE_API_KEY = 'AIzaSyCZDBTej3OX4KngmuZSwS26VUEvYSyp8Wc';
const YELP_API_KEY = '9YwSmpVUqeSo9YZkfxh07KEVPhJFRUc_K6xdXDElGK23xyIvHNoEDy0RK1iR9cFkKa2eyltq0nEediuiv4sONrhL--fKLfbxrQ_QX23YHDdlGYnCIy6u624znFFQaXYx';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper: HTTP GET with JSON response
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { 'User-Agent': 'Mozilla/5.0', ...headers }
    };
    
    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    }).on('error', reject);
  });
}

// Helper: Fetch HTML
function fetchHtml(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.get({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirect = res.headers.location;
        if (!redirect.startsWith('http')) redirect = new URL(redirect, url).href;
        fetchHtml(redirect).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Step 1: Google Places Search
async function searchGooglePlaces(city, limit = 60) {
  console.log(`\n📍 Step 1: Searching Google Places for coffee shops in ${city}...`);
  
  const shops = [];
  let nextPageToken = null;
  let page = 1;
  
  do {
    const url = nextPageToken
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${GOOGLE_API_KEY}`
      : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=coffee+shop+in+${encodeURIComponent(city)}&type=cafe&key=${GOOGLE_API_KEY}`;
    
    const data = await httpGet(url);
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.log(`   ⚠️  Google API: ${data.status}`);
      break;
    }
    
    for (const place of (data.results || [])) {
      if (shops.length >= limit) break;
      
      // Get place details for website/phone
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,opening_hours&key=${GOOGLE_API_KEY}`;
      const details = await httpGet(detailsUrl);
      
      const addressParts = (place.formatted_address || '').split(', ');
      const stateZip = addressParts[addressParts.length - 2] || '';
      const state = stateZip.split(' ')[0];
      
      shops.push({
        google_place_id: place.place_id,
        name: place.name,
        address: place.formatted_address,
        city: addressParts[addressParts.length - 3] || city.split(',')[0].trim(),
        state: state,
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng,
        google_rating: place.rating,
        google_reviews: place.user_ratings_total,
        phone: details.result?.formatted_phone_number,
        website: details.result?.website,
        pipeline_stage: 'new',
        lead_score: 50
      });
      
      process.stdout.write(`   Found: ${shops.length} shops\r`);
      await new Promise(r => setTimeout(r, 100)); // Rate limit
    }
    
    nextPageToken = data.next_page_token;
    if (nextPageToken) {
      page++;
      await new Promise(r => setTimeout(r, 2000)); // Google requires delay between pages
    }
    
  } while (nextPageToken && shops.length < limit);
  
  console.log(`   ✓ Found ${shops.length} coffee shops`);
  return shops;
}

// Step 2: Save to Supabase
async function saveToSupabase(shops) {
  console.log(`\n💾 Step 2: Saving to database...`);
  
  let added = 0, skipped = 0;
  
  for (const shop of shops) {
    const { error } = await supabase
      .from('shops')
      .upsert(shop, { onConflict: 'google_place_id' });
    
    if (error) {
      skipped++;
    } else {
      added++;
    }
  }
  
  console.log(`   ✓ Added: ${added}, Skipped/Updated: ${skipped}`);
  return added;
}

// Step 3: Yelp Enrichment
async function enrichWithYelp(shops) {
  console.log(`\n⭐ Step 3: Enriching with Yelp data...`);
  
  let enriched = 0;
  
  for (let i = 0; i < shops.length; i++) {
    const shop = shops[i];
    process.stdout.write(`   Processing: ${i + 1}/${shops.length}\r`);
    
    try {
      const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(shop.name)}&location=${encodeURIComponent(shop.address || shop.city)}&limit=1`;
      const data = await httpGet(url, { 'Authorization': `Bearer ${YELP_API_KEY}` });
      
      if (data.businesses && data.businesses.length > 0) {
        const biz = data.businesses[0];
        
        // Calculate lead score
        const googleScore = (shop.google_rating || 0) * 10;
        const yelpScore = (biz.rating || 0) * 10;
        const reviewScore = Math.min(((shop.google_reviews || 0) + (biz.review_count || 0)) / 10, 30);
        const leadScore = Math.round(googleScore * 0.4 + yelpScore * 0.3 + reviewScore + 20);
        
        await supabase.from('shops').update({
          yelp_id: biz.id,
          yelp_rating: biz.rating,
          yelp_reviews: biz.review_count,
          yelp_url: biz.url,
          lead_score: Math.min(leadScore, 100)
        }).eq('google_place_id', shop.google_place_id);
        
        enriched++;
      }
      
      await new Promise(r => setTimeout(r, 200)); // Yelp rate limit
    } catch (err) {
      // Skip errors
    }
  }
  
  console.log(`   ✓ Enriched ${enriched} shops with Yelp data`);
}

// Step 4: Website Scraping
async function scrapeWebsites(shops) {
  console.log(`\n🌐 Step 4: Scraping websites for contact info...`);
  
  let scraped = 0, noWebsite = 0, failed = 0;
  
  for (let i = 0; i < shops.length; i++) {
    const shop = shops[i];
    process.stdout.write(`   Processing: ${i + 1}/${shops.length}\r`);
    
    if (!shop.website) {
      noWebsite++;
      await supabase.from('shops').update({
        website_type: 'none',
        enrichment_status: 'no_website'
      }).eq('google_place_id', shop.google_place_id);
      continue;
    }
    
    try {
      let url = shop.website;
      if (!url.startsWith('http')) url = 'https://' + url;
      
      const html = await fetchHtml(url);
      
      // Extract emails
      const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const emails = [...new Set(emailMatches)]
        .filter(e => !e.match(/\.(png|jpg|gif|svg)$/i))
        .filter(e => !e.includes('wixpress') && !e.includes('sentry'));
      
      // Extract phones
      const phoneMatches = html.replace(/<[^>]+>/g, ' ').match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
      const phones = [...new Set(phoneMatches.map(p => {
        const d = p.replace(/\D/g, '');
        return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : null;
      }).filter(Boolean))];
      
      // Extract social
      const fbMatch = html.match(/(?:https?:\/\/)?(?:www\.)?facebook\.com\/[a-zA-Z0-9.]+/i);
      const igMatch = html.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+/i);
      
      // Classify website type
      let websiteType = 'basic';
      const urlLower = url.toLowerCase();
      if (urlLower.includes('facebook.com')) websiteType = 'facebook';
      else if (urlLower.includes('instagram.com')) websiteType = 'instagram';
      
      await supabase.from('shops').update({
        email: emails[0] || shop.email,
        phone: phones[0] || shop.phone,
        facebook_url: fbMatch ? fbMatch[0] : null,
        instagram_url: igMatch ? igMatch[0] : null,
        website_type: websiteType,
        enrichment_status: 'enriched',
        enriched_at: new Date().toISOString()
      }).eq('google_place_id', shop.google_place_id);
      
      scraped++;
      await new Promise(r => setTimeout(r, 1000)); // Be nice to servers
      
    } catch (err) {
      failed++;
      await supabase.from('shops').update({
        enrichment_status: 'failed'
      }).eq('google_place_id', shop.google_place_id);
    }
  }
  
  console.log(`   ✓ Scraped: ${scraped}, No website: ${noWebsite}, Failed: ${failed}`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node add-city.js "City, ST" [--limit N]');
    console.log('Example: node add-city.js "Portland, OR" --limit 50');
    process.exit(1);
  }
  
  const city = args[0];
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 60;
  
  console.log('\n☕ joe CRM - Add New City');
  console.log('='.repeat(50));
  console.log(`City: ${city}`);
  console.log(`Limit: ${limit} shops`);
  console.log('='.repeat(50));
  
  // Step 1: Search Google
  const shops = await searchGooglePlaces(city, limit);
  
  if (shops.length === 0) {
    console.log('\n❌ No shops found. Check city name and try again.');
    process.exit(1);
  }
  
  // Step 2: Save to database
  await saveToSupabase(shops);
  
  // Step 3: Yelp enrichment
  await enrichWithYelp(shops);
  
  // Step 4: Website scraping
  await scrapeWebsites(shops);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Complete!');
  console.log(`   Added ${shops.length} shops from ${city}`);
  console.log('   View in CRM: https://joe.coffee/crm');
  console.log('='.repeat(50) + '\n');
}

main().catch(console.error);
