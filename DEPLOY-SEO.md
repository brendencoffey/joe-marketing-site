# Product SEO Pages & Sitemap Deployment

## Files Created

### 1. `netlify/functions/product-page.js`
SSR product pages with clean URLs:
- `/marketplace/product/{slug}/` instead of `?id=xxx`
- Full SEO meta tags rendered server-side
- Schema.org Product markup
- Open Graph tags for social sharing

### 2. `scripts/generate-sitemap.js`
Generates sitemaps from Supabase:
- `sitemap-products.xml` - All active products with URLs
- `sitemap-locations.xml` - All shops (splits if >45k)
- `sitemap.xml` - Index pointing to all sitemaps

### 3. `_redirects`
Updated with new route:
```
/marketplace/product/:slug/ /.netlify/functions/product-page 200!
```

---

## Deployment Steps

### Step 1: Copy Files
```bash
# Copy the new files to your project
cp /path/to/product-page.js ~/Desktop/joe-marketing-site/netlify/functions/
cp /path/to/generate-sitemap.js ~/Desktop/joe-marketing-site/scripts/
cp /path/to/_redirects ~/Desktop/joe-marketing-site/
```

### Step 2: Update Product Links (2 files)

**In `netlify/functions/location-page.js`** (around line 153):
Change:
```javascript
<a href="/marketplace/product/?id=${p.id}" class="product-card">
```
To:
```javascript
<a href="/marketplace/product/${p.slug || p.id}/" class="product-card">
```

**In `marketplace/index.html`** (wherever product cards link):
Change any:
```javascript
href="/marketplace/product/?id=${p.id}"
```
To:
```javascript
href="/marketplace/product/${p.slug || p.id}/"
```

### Step 3: Generate Sitemaps
```bash
cd ~/Desktop/joe-marketing-site

# Install dependencies if needed
npm install @supabase/supabase-js

# Generate sitemaps
SUPABASE_SERVICE_KEY=your-key node scripts/generate-sitemap.js
```

### Step 4: Deploy
```bash
git add .
git commit -m "Add SSR product pages and sitemaps for SEO"
git push
```

### Step 5: Submit Sitemap
1. Go to Google Search Console
2. Submit: https://joe.coffee/sitemap.xml

---

## URL Structure After Deployment

```
Marketplace:
├── /marketplace/                    → Product grid page
└── /marketplace/product/{slug}/     → Individual product (SSR)

Sitemaps:
├── /sitemap.xml                     → Index
├── /sitemap-static.xml              → Static pages
├── /sitemap-products.xml            → All products
└── /sitemap-locations.xml           → All shops
```

---

## Testing

After deploy, test these URLs:
1. `https://joe.coffee/marketplace/product/some-product-slug/` - Should render with meta tags
2. View page source - Should see Schema.org JSON-LD
3. `https://joe.coffee/sitemap.xml` - Should list all sitemaps
4. `https://joe.coffee/sitemap-products.xml` - Should list all products
