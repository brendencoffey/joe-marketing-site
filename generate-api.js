const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Directories to scan
const collections = {
  posts: 'blog/posts',
  testimonials: 'blog/testimonials',
  partners: 'partners',
  campaigns: 'campaigns',
  authors: 'authors'
};

// Output directory - use 'api' in root, Eleventy will copy to _site
const outputDir = 'api';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('📊 Generating API JSON files for admin dashboard...');

for (const [name, folder] of Object.entries(collections)) {
  const items = [];
  
  // Check if folder exists
  if (!fs.existsSync(folder)) {
    console.log(`  ⚠️  Folder ${folder} doesn't exist, creating empty ${name}.json`);
    fs.writeFileSync(path.join(outputDir, `${name}.json`), JSON.stringify([]));
    continue;
  }
  
  // Read all markdown files in the folder
  const files = fs.readdirSync(folder).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(folder, file), 'utf-8');
      const { data } = matter(content);
      
      items.push({
        slug: file.replace('.md', ''),
        title: data.title || file.replace('.md', '').replace(/-/g, ' '),
        date: data.date || null,
        status: data.status || 'published',
        category: data.category || null,
        excerpt: data.excerpt || null,
        featured: data.featured || false,
        shop_name: data.shop_name || null,
        partner_type: data.partner_type || null,
        campaign_type: data.campaign_type || null,
        type: name
      });
    } catch (err) {
      console.log(`  ⚠️  Error reading ${file}: ${err.message}`);
    }
  }
  
  // Sort by date (newest first)
  items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });
  
  // Write JSON file
  fs.writeFileSync(
    path.join(outputDir, `${name}.json`),
    JSON.stringify(items, null, 2)
  );
  
  console.log(`  ✅ ${name}.json - ${items.length} items`);
}

console.log('✨ API files generated!');
