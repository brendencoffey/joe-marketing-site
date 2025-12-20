/**
 * Image Migration Script for joe Coffee Blog
 * 
 * This script:
 * 1. Scans your local markdown files for posts/testimonials
 * 2. Fetches the corresponding page from blog.joe.coffee
 * 3. Downloads the featured image
 * 4. Updates the markdown file with the local image path
 * 
 * Usage:
 *   npm install node-fetch@2 gray-matter
 *   node migrate-images.js
 * 
 * Run from your repo root directory.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const matter = require('gray-matter');

// Configuration
const CONFIG = {
  testimonialsDir: './blog/testimonials',
  postsDir: './blog/posts',
  imagesDir: './images/blog',
  hubspotBase: 'https://blog.joe.coffee',
  delay: 500 // ms between requests to be polite
};

// Create images directory if it doesn't exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

// Fetch a URL and return the HTML
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Download an image to local path
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    // Handle URL encoding
    const cleanUrl = url.replace(/ /g, '%20');
    const client = cleanUrl.startsWith('https') ? https : http;
    
    const req = client.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(filepath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete partial file
        reject(err);
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Extract featured image from HubSpot page HTML
function extractFeaturedImage(html) {
  // Try og:image first
  let match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (match && !match[1].includes('joe%20logo')) {
    return match[1];
  }
  
  // Try twitter:image
  match = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
  if (match && !match[1].includes('joe%20logo')) {
    return match[1];
  }
  
  // Look for HubSpot hosted images in the content
  match = html.match(/https:\/\/blog\.joe\.coffee\/hs-fs\/hubfs\/[^"'\s<>]+\.(jpg|jpeg|png|webp|gif)/i);
  if (match) {
    return match[0];
  }
  
  // Look for Google user content images (some testimonials use these)
  match = html.match(/https:\/\/lh3\.googleusercontent\.com\/[^"'\s<>]+/i);
  if (match) {
    return match[0];
  }
  
  return null;
}

// Get file extension from URL
function getExtension(url) {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
  return match ? match[1].toLowerCase() : 'jpg';
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Build reverse lookup (HubSpot slug -> local slug)
function buildReverseLookup(slugMap) {
  const reverse = {};
  for (const [local, hubspot] of Object.entries(slugMap)) {
    reverse[hubspot] = local;
  }
  return reverse;
}

// Try to find the HubSpot URL for a local file
async function findHubspotUrl(localSlug, type) {
  const testimonialSlugs = {
    'tropical-express': 'how-joe-os-drives-growth-and-convenience-for-tropical-express-drive-thru-coffee-shop',
    'paradox-coffee': 'paradox-coffee-embracing-community-loyalty-and-growth-with-joe-point-of-sale',
    'caffe-ladro': 'caffe-ladro-upgrades-all-18-locations-in-greater-seattle-to-the-joe-point-of-sale-platform-for-coffee-shops',
    'wandering-bean': 'the-wandering-bean-and-joe-point-of-sale',
    'zero-tolerance': 'reducing-costs-and-building-brand-with-joe-point-of-sale',
    'coffeehouse-brookside': 'the-coffeehouse-brookside',
    'soul-good-coffee': 'soul-good-coffee',
    'maple-moose': 'how-joe-point-of-sale-loyalty-helps-maple-moose-differentiate',
    'catalinas-coffee': 'latina-owned-catalinas-coffee-grows-with-joe-point-of-sale',
    'buffalo-grove': 'buffalo-grove-grows-with-joe-point-of-sale',
    'surfers-coffee': 'surfers-coffee-streamlines-workflow',
    'sips-coffee': 'sips-coffee',
    'momentum-coffee': 'celebrating-1-year-with-momentum-coffee',
    'kalona-coffee': 'kalona-coffee-house',
    'farmhouse-coffee': 'farmhouse-coffee',
    'issaquah-coffee': 'issaquah-coffee-company',
    'vail-coffee': 'coffee-shop-pos-vail-coffee-testimonial',
    'leveraging-loyalty': 'leveraging-loyalty-marketing',
    'asensio-barista': 'barista',
    'asensio-coffee': 'asensio-coffee-owner',
    'thomas-hammer': 'mentorship-in-mobile-ordering',
    'coffee-cabana': 'switching-from-square-coffee-cabana',
    'urban-coffee-lounge': 'urban-coffee-lounge',
    'honu-coffee': 'acquiring-new-users-with-honu-coffee',
    'momentum-average-ticket': 'maximizing-average-ticket-with-momentum-coffee',
    'indaba-coffee': 'partner-journey-indaba-coffee-roasters',
    'willamette-coffee': 'partner-journey-willamette-coffee-house',
    'left-hand-coffee': 'partner-journey-left-hand-coffee',
    'hot-shot-sisters': 'rising-star-hot-shot-sisters-maximizes-revenue-with-joe',
    'cafe-red': 'partner-spotlight-cafe-red-brings-a-commitment-to-community-in-south-seattle'
  };
  
  const blogSlugs = {
    'stripe-holiday-payment-guide': 'stripe-holiday-payment-guide',
    'understanding-outage': 'understanding-todays-outage-what-happened-and-how-were-supporting-you',
    'employee-brown-bag': 'behind-the-scenes-employee-brown-bag-on-growth-philosophy',
    'podcast-highlights': 'highlights-from-the-joe-coffee-podcast-leadership-culture-and-purpose-driven-growth',
    'kiosk-experience': 'embracing-the-fourth-wave-how-kiosks-are-helping-us-reclaim-hospitality-in-coffee',
    'regenerative-systems': 'reimagining-coffee-from-root-to-cup-building-regenerative-systems-at-joe-coffee',
    'may-june-offer': 'reaction-video-what-its-like-for-baristas-to-make-the-switch-to-joe',
    'loyalty-marketing-smarter': 'loyalty-marketing-with-joe-smarter-growth-not-just-redemptions',
    'profit-killers': 'coffee-shop-profit-killers',
    'collaboration-over-competition': 'collaboration-over-competition-why-we-have-more-to-gain-coming-together',
    'maxwell-mooney': 'maxwell_mooney_square_price_increase_coffee-shops',
    'community-hub-launch': 'making-owners-and-baristas-a-more-integrated-part-of-product-planning',
    'demo-coffee-shop-os': 'square_price_increase_coffee_shop_pos',
    'biggest-challenges': 'the-3-biggest-challenges-holding-independent-coffee-shops-back-and-how-to-overcome-them',
    'positioning-leap': 'strategy-session-a-big-leap-forward-on-positioning',
    'shifting-paradigms': 'changing_paradigms_for_coffee_shops',
    'conscious-entrepreneurship': 'conscious-entrepreneurship-venture-capital-and-building-a-business-with-purpose',
    'campfire-coffee': 'campfire_coffee_fundraiser',
    'building-in-public-podcast': 'building-in-public-podcast-new-hardware-and-🤯-data',
    'autumn-challenges': 'exciting-new-challenges-this-autumn-more-ways-to-enjoy-your-favorite-coffee',
    'branded-app-cost': 'the-real-cost-of-a-branded-mobile-app-vs.-joe-a-comparative-analysis',
    'coffee-community-podcast': 'coffee-community-pod-series',
    'starbucks-rewards': 'lookout-starbucks-joes-the-most-rewarding-experience-in-coffee',
    'gift-cards': 'joe-coffee-shop-gift-cards',
    'verizon-partnership': 'joe-partners-with-verizon-to-offer-exclusive-benefits-for-coffee-shops',
    'naomi-joe-pos': 'innovation-in-coffee-why-naomi-joe-chose-joe-point-of-sale',
    'google-business-seo': '4-questions-your-google-business-should-answer-to-boost-local-seo',
    'cafe-avole': 'cafe-avole-a-catalyst-for-connection-community-and-discovery',
    'loyalty-key-success': 'level-up-your-coffee-shop-loyalty-why-joe-is-the-key-to-success',
    'unlocking-loyalty': 'unlocking-coffee-shop-loyalty',
    'kds-reasons': '4-reasons-why-your-coffee-shop-needs-a-kitchen-display-system-kds',
    'pos-guide': 'the-ultimate-guide-to-choosing-a-point-of-sale-for-your-coffee-shop',
    'modern-marketing': 'modern-marketing-strategies-for-independent-coffee-shops',
    'promo-codes-vs-gift-cards': 'coffee-shop-marketing-why-promo-codes-are-a-better-option-than-gift-cards-for-user-acquisition',
    'barista-moments': 'barista-moments',
    'seasonal-sales': 'tips-to-boost-seasonal-sales-with-joes-menu-features',
    'chai-growth': 'how-the-right-chai-can-lead-to-coffee-shop-growth',
    'recession-proof': '3-ways-to-recession-proof-your-cafe-or-coffee-shop',
    'seasonal-drinks-data': 'when-coffee-shops-should-promote-seasonal-drinks-based-on-the-data',
    'economic-realities': 'coffee_shop_recession_tips',
    'rising-costs-survey': 'survey-how-rising-costs-impact-indie-coffee',
    'founders-letter': 'letter-from-the-founders',
    'coffee-shop-tools': 'coffee-shop-tools',
    'qr-codes': 'maximizeaqrcode',
    'loyalty-tips': '5-tips-for-upgrading-coffee-shop-loyalty',
    'boost-profitability': '4-ways-to-boost-profitability',
    'san-antonio-culture': 'culture-in-every-cup',
    'san-antonio-community': '-community',
    'coffee-hop': 'san-antonio-coffee-hop',
    'veteran-owned': 'veteran-owned-shops-that-know-true-meaning-of-service',
    'starbucks-advantage': 'how-to-combat-the-starbucks-structural-advantage',
    'coronavirus-long-beach': '11-with-long-beach-coffee-club',
    'dolla-java-days': 'dolla-java-days'
  };
  
  const slugMap = type === 'testimonials' ? testimonialSlugs : blogSlugs;
  const reverseMap = buildReverseLookup(slugMap);
  
  // Try direct match first (local slug is in our map)
  if (slugMap[localSlug]) {
    return slugMap[localSlug];
  }
  
  // Try reverse match (local file uses HubSpot slug directly)
  if (reverseMap[localSlug]) {
    return localSlug; // The local slug IS the HubSpot slug
  }
  
  // Try partial matching (local slug contains key parts)
  for (const [local, hubspot] of Object.entries(slugMap)) {
    if (localSlug.includes(local) || local.includes(localSlug)) {
      return hubspot;
    }
  }
  
  // Default: assume local slug matches HubSpot slug
  return localSlug;
}

// Process a single markdown file
async function processFile(filepath, type) {
  const filename = path.basename(filepath, '.md');
  const content = fs.readFileSync(filepath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);
  
  // Skip if already has a local featured image
  if (frontmatter.featured_image && frontmatter.featured_image.startsWith('/images/')) {
    console.log(`  ⏭️  ${filename}: already has local image`);
    return { status: 'skipped', reason: 'has local image' };
  }
  
  // Build HubSpot URL using smart lookup
  const hubspotSlug = await findHubspotUrl(filename, type);
  const hubspotUrl = type === 'testimonials' 
    ? `${CONFIG.hubspotBase}/testimonials/${hubspotSlug}`
    : `${CONFIG.hubspotBase}/${hubspotSlug}`;
  
  console.log(`  🔍 ${filename}: fetching ${hubspotUrl}`);
  
  try {
    const html = await fetchPage(hubspotUrl);
    const imageUrl = extractFeaturedImage(html);
    
    if (!imageUrl) {
      console.log(`  ⚠️  ${filename}: no image found`);
      return { status: 'no-image' };
    }
    
    // Download image
    const ext = getExtension(imageUrl);
    const imageFilename = `${filename}.${ext}`;
    const localImagePath = path.join(CONFIG.imagesDir, type, imageFilename);
    const webPath = `/images/blog/${type}/${imageFilename}`;
    
    ensureDir(path.dirname(localImagePath));
    
    console.log(`  ⬇️  ${filename}: downloading image...`);
    await downloadImage(imageUrl, localImagePath);
    
    // Update frontmatter
    frontmatter.featured_image = webPath;
    
    // Write updated file
    const newContent = matter.stringify(body, frontmatter);
    fs.writeFileSync(filepath, newContent);
    
    console.log(`  ✅ ${filename}: saved to ${webPath}`);
    return { status: 'success', image: webPath };
    
  } catch (error) {
    console.log(`  ❌ ${filename}: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

// Main function
async function main() {
  console.log('🖼️  joe Coffee Image Migration Tool\n');
  console.log('This will download images from blog.joe.coffee and update your markdown files.\n');
  
  const results = {
    testimonials: { success: 0, skipped: 0, noImage: 0, error: 0 },
    posts: { success: 0, skipped: 0, noImage: 0, error: 0 }
  };
  
  // Process testimonials
  if (fs.existsSync(CONFIG.testimonialsDir)) {
    console.log('📝 Processing testimonials...\n');
    const files = fs.readdirSync(CONFIG.testimonialsDir).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      const result = await processFile(path.join(CONFIG.testimonialsDir, file), 'testimonials');
      if (result.status === 'success') results.testimonials.success++;
      else if (result.status === 'skipped') results.testimonials.skipped++;
      else if (result.status === 'no-image') results.testimonials.noImage++;
      else results.testimonials.error++;
      
      await sleep(CONFIG.delay);
    }
  } else {
    console.log(`⚠️  Testimonials directory not found: ${CONFIG.testimonialsDir}`);
  }
  
  // Process blog posts
  if (fs.existsSync(CONFIG.postsDir)) {
    console.log('\n📝 Processing blog posts...\n');
    const files = fs.readdirSync(CONFIG.postsDir).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      const result = await processFile(path.join(CONFIG.postsDir, file), 'posts');
      if (result.status === 'success') results.posts.success++;
      else if (result.status === 'skipped') results.posts.skipped++;
      else if (result.status === 'no-image') results.posts.noImage++;
      else results.posts.error++;
      
      await sleep(CONFIG.delay);
    }
  } else {
    console.log(`⚠️  Posts directory not found: ${CONFIG.postsDir}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary\n');
  console.log('Testimonials:');
  console.log(`  ✅ Success: ${results.testimonials.success}`);
  console.log(`  ⏭️  Skipped: ${results.testimonials.skipped}`);
  console.log(`  ⚠️  No image: ${results.testimonials.noImage}`);
  console.log(`  ❌ Errors: ${results.testimonials.error}`);
  console.log('\nBlog Posts:');
  console.log(`  ✅ Success: ${results.posts.success}`);
  console.log(`  ⏭️  Skipped: ${results.posts.skipped}`);
  console.log(`  ⚠️  No image: ${results.posts.noImage}`);
  console.log(`  ❌ Errors: ${results.posts.error}`);
  console.log('\n✨ Done! Remember to:');
  console.log('  1. Add /images/blog/ to your .eleventy.js passthrough copy');
  console.log('  2. Commit the new images and updated markdown files');
  console.log('  3. Push to GitHub to trigger a rebuild');
}

main().catch(console.error);
