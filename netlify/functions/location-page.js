/**
 * Location Page - Rich Shop Detail
 * Features: Map, directions, about, partner ordering, claim listing, products
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAPBOX_TOKEN = process.env.MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiYnJlbmRlbm1hcnRpbjA1IiwiYSI6ImNtanAwZWZidjJodjEza3E2NDR4b242bW8ifQ.CjDrXl01VxVoEg6jh81c5Q';

function generateJsonLd(shop) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    "name": shop.name,
    "description": shop.description || `${shop.name} is an independent coffee shop in ${shop.city}, ${shop.state}.`,
    "url": `https://joe.coffee/locations/${shop.state_code?.toLowerCase()}/${shop.city_slug}/${shop.slug}/`,
    "telephone": shop.phone || undefined,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": shop.address,
      "addressLocality": shop.city,
      "addressRegion": shop.state,
      "addressCountry": "US"
    },
    "image": shop.photos && shop.photos.length > 0 ? shop.photos[0] : undefined,
    "priceRange": shop.price_range || "$$"
  };
  if (shop.google_rating) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": shop.google_rating,
      "bestRating": 5
    };
  }
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

exports.handler = async (event) => {
  try {
    const path = event.path || event.rawUrl || "";
    const parts = path.replace("/.netlify/functions/location-page", "").replace("/locations/", "").split("/").filter(Boolean);
    const state = parts[0] || event.queryStringParameters?.state;
    const city = parts[1] || event.queryStringParameters?.city;
    const slug = parts[2] || event.queryStringParameters?.slug;
  
    if (!slug) return redirect('/locations/');

    const stateCode = (state || '').toLowerCase();
    const citySlug = (city || '').toLowerCase();

    // Try exact slug match first
    let query = supabase.from('shops').select('*').eq('slug', slug).eq('is_active', true);
    if (stateCode && stateCode !== 'unknown' && stateCode !== 'null') {
      query = query.ilike('state_code', stateCode);
    }
    if (citySlug && stateCode !== 'unknown' && stateCode !== 'null') {
      query = query.ilike('city_slug', citySlug);
    }
    
    let { data: shop, error } = await query.single();
    
    // If not found, try fuzzy match (slug starts with requested slug)
    if (error || !shop) {
      let fuzzyQuery = supabase
        .from('shops')
        .select('*')
        .ilike('slug', `${slug}%`)
        .eq('is_active', true);
      // Only filter by state/city if they're valid (not 'unknown' or 'null')
      const skipStateCity = stateCode === 'unknown' || stateCode === 'null';
      if (!skipStateCity && stateCode) {
        fuzzyQuery = fuzzyQuery.ilike('state_code', stateCode);
      }
      if (!skipStateCity && citySlug) {
        fuzzyQuery = fuzzyQuery.ilike('city_slug', citySlug);
      }
      
      const { data: fuzzyResults, error: fuzzyError } = await fuzzyQuery.limit(1);
      const fuzzyShop = fuzzyResults?.[0];
      if (fuzzyShop && fuzzyShop.state_code && fuzzyShop.city_slug) {
        // Redirect to correct URL
        const correctUrl = `/locations/${fuzzyShop.state_code.toLowerCase()}/${fuzzyShop.city_slug}/${fuzzyShop.slug}/`;
        return {
          statusCode: 301,
          headers: { Location: correctUrl },
          body: ''
        };
      }
      return notFound();
    }

    const isPartner = shop.is_joe_partner || !!shop.partner_id;
    
    // Get partner info if exists
    let partner = null;
    if (shop.partner_id) {
      const { data: p } = await supabase
        .from('partners')
        .select('id, name, slug, store_id')
        .eq('id', shop.partner_id)
        .single();
      partner = p;
    }

    // Get company info if multi-location
    let company = null;
    if (shop.company_id) {
      const { data: c } = await supabase
        .from('companies')
        .select('id, name, slug, is_multi_location')
        .eq('id', shop.company_id)
        .single();
      if (c?.is_multi_location) {
        // Get location count
        const { count } = await supabase
          .from('shops')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', c.id)
          .eq('is_active', true);
        company = { ...c, location_count: count };
      }
    }

    // Fetch products for this shop or company (for multi-location brands)
    let productsQuery = supabase
      .from('products')
      .select('id, name, price, image_url, product_url, slug')
      .eq('is_active', true)
      .limit(10);
    
    // If shop has a company_id, get products for the whole company
    if (shop.company_id) {
      productsQuery = productsQuery.eq('company_id', shop.company_id);
    } else {
      productsQuery = productsQuery.eq('shop_id', shop.id);
    }
    
    const { data: products, error: productsError } = await productsQuery;

    trackPageView(shop.id, event);
    const html = renderLocationPage(shop, partner, isPartner, products || [], company);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8', 
        'Cache-Control': 'public, max-age=300' 
      },
      body: html
    };
  } catch (err) {
    console.error('Location page error:', err);
    return error500();
  }
};

function renderLocationPage(shop, partner, isPartner, products, company) {
  const stateCode = (shop.state_code || 'us').toLowerCase();
  const citySlug = shop.city_slug || slugify(shop.city || 'unknown');
  const stateName = getStateName(stateCode);
  const canonicalUrl = `https://joe.coffee/locations/${stateCode}/${citySlug}/${shop.slug}/`;
  
  const hours = parseHours(shop.hours);
  const isOpen = checkIfOpen(hours);
  const photos = shop.photos?.length ? shop.photos : [];
  const amenities = shop.amenities || [];
  const rating = shop.combined_rating || shop.google_rating;
  const reviewCount = (shop.google_reviews || 0) + (shop.yelp_reviews || 0);
  const priceRange = shop.price_range || '$$';
  const description = shop.description || '';
  const hasCoords = shop.lat && shop.lng;
  
  // Order URL for partners
  const orderUrl = partner?.store_id 
    ? `https://shop.joe.coffee/explore/stores/${partner.store_id}`
    : (shop.ordering_url || '');

  // Build products HTML (server-side rendered)
  const productsHTML = products.length > 0 ? `
        <div class="card">
          <div class="products-header">
            <h2 class="card-title" style="margin-bottom:0">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              Shop Products
            </h2>
            <a href="/locations/${stateCode}/${citySlug}/${shop.slug}/products/">See All ${products.length}${products.length >= 10 ? '+' : ''} →</a>
          </div>
          <div class="products-scroll">
            ${products.map(p => `
              <a href="/locations/${stateCode}/${citySlug}/${shop.slug}/products/${p.slug || p.id}/" class="product-card">
                ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">` : '<div style="height:140px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:2rem">☕</div>'}
                <div class="product-info">
                  <div class="product-name">${esc(p.name)}</div>
                  <div class="product-price">$${parseFloat(p.price || 0).toFixed(2)}</div>
                </div>
              </a>
            `).join('')}
          </div>
        </div>
  ` : '';

  // Schema markup
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: shop.name,
    image: photos[0] || '',
    url: canonicalUrl,
    telephone: shop.phone || '',
    address: {
      '@type': 'PostalAddress',
      streetAddress: shop.address,
      addressLocality: shop.city,
      addressRegion: shop.state,
      postalCode: shop.zip || '',
      addressCountry: 'US'
    },
    geo: hasCoords ? {
      '@type': 'GeoCoordinates',
      latitude: shop.lat,
      longitude: shop.lng
    } : undefined,
    aggregateRating: rating ? {
      '@type': 'AggregateRating',
      ratingValue: rating,
      reviewCount: reviewCount || 1
    } : undefined,
    priceRange: priceRange
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(shop.name)} - ${esc(shop.city)}, ${esc(shop.state)} | joe coffee</title>
  <meta name="description" content="${esc(shop.name)} in ${esc(shop.city)}, ${esc(stateName)}. ${rating ? rating + ' stars. ' : ''}${isPartner ? 'Order ahead with joe app.' : 'Hours, location, and menu info.'}">
  <link rel="canonical" href="${canonicalUrl}">
  <!-- Open Graph -->
  <meta property="og:type" content="place">
  <meta property="og:title" content="${esc(shop.name)} - ${esc(shop.city)}, ${esc(shop.state)}">
  <meta property="og:description" content="${esc(shop.name)} in ${esc(shop.city)}, ${esc(stateName)}. ${rating ? rating + ' stars.' : ''} ${isPartner ? 'Order ahead with joe app.' : 'Find hours and location.'}">
  <meta property="og:image" content="${shop.photos?.[0] || 'https://joe.coffee/img/joe-og.png'}">
  <meta property="og:url" content="${canonicalUrl}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(shop.name)} | joe coffee">
  <meta name="twitter:description" content="${esc(shop.name)} in ${esc(shop.city)}, ${esc(stateName)}">
  <meta name="twitter:image" content="${shop.photos?.[0] || 'https://joe.coffee/img/joe-og.png'}">
  
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://joe.coffee/" },
      { "@type": "ListItem", "position": 2, "name": "Find Coffee", "item": "https://joe.coffee/locations/" },
      { "@type": "ListItem", "position": 3, "name": stateName, "item": "https://joe.coffee/locations/" + stateCode + "/" },
      { "@type": "ListItem", "position": 4, "name": shop.city, "item": "https://joe.coffee/locations/" + stateCode + "/" + citySlug + "/" },
      { "@type": "ListItem", "position": 5, "name": shop.name }
    ]
  })}</script>
  
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
  <link rel="stylesheet" href="/includes/footer.css">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--black:#000;--white:#fff;--gray-50:#F9FAFB;--gray-100:#F3F4F6;--gray-200:#E5E7EB;--gray-300:#D1D5DB;--gray-400:#9CA3AF;--gray-500:#6B7280;--gray-600:#4B5563;--gray-700:#374151;--gray-800:#1F2937;--gray-900:#111827;--amber-500:#F59E0B;--red-500:#EF4444}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#FAF9F6;color:var(--gray-900);line-height:1.6}
    a{color:inherit;text-decoration:none}
    
    .header{position:sticky;top:0;z-index:100;background:var(--white);border-bottom:1px solid var(--gray-200)}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px}
    .nav{display:flex;align-items:center;gap:2rem}
    .nav a{font-size:.95rem;font-weight:500;color:var(--gray-700)}.nav a:hover{color:var(--black)}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.75rem 1.5rem;border-radius:8px;font-weight:600;font-size:.95rem;cursor:pointer;border:none;transition:all .2s}
    .btn-primary{background:var(--black);color:var(--white) !important}.btn-primary:hover{background:var(--gray-800)}
    
    .btn-outline{background:var(--white);color:var(--gray-700);border:1px solid var(--gray-300)}.btn-outline:hover{background:#FAF9F6}
    
    .breadcrumb{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;font-size:.875rem;color:var(--gray-500)}
    .breadcrumb a{color:var(--gray-600);font-weight:500}.breadcrumb a:hover{color:var(--gray-900)}
    .breadcrumb span{margin:0 .5rem;color:var(--gray-400)}
    
    .main{max-width:1280px;margin:0 auto;padding:0 1.5rem 3rem}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:2rem}
    
    /* Photo Gallery */
    .photo-gallery{display:grid;grid-template-columns:2fr 1fr;grid-template-rows:200px 200px;gap:.5rem;border-radius:16px;overflow:hidden;margin-bottom:1.5rem}
    .photo-gallery .photo-main{grid-row:span 2}
    .photo-gallery img{width:100%;height:100%;object-fit:cover}
    .photo-placeholder{background:linear-gradient(135deg,var(--gray-700),var(--gray-800));display:flex;align-items:center;justify-content:center;color:var(--gray-400);font-size:3rem}
    
    /* Content Cards */
    .card{background:var(--white);border-radius:12px;padding:1.5rem;margin-bottom:1rem;border:1px solid var(--gray-200)}
    .card-title{font-size:1.1rem;font-weight:600;margin-bottom:1rem;display:flex;align-items:center;gap:.5rem}
    .card-title svg{width:20px;height:20px;color:var(--gray-500)}
    
    /* About Section */
    .about-text{color:var(--gray-600);line-height:1.8}
    .social-btn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:8px;background:#f3f4f6;color:#374151;transition:all 0.2s}
    .social-btn:hover{background:#e5e7eb;color:#111827}
    
    /* Hours */
    .hours-grid{display:grid;gap:.5rem}
    .hours-row{display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--gray-100)}
    .hours-row:last-child{border:none}
    .hours-day{font-weight:500;color:var(--gray-700)}
    .hours-day.today{color:#1c1917;font-weight:600}
    .hours-time{color:var(--gray-600)}
    
    /* Amenities */
    .amenities-grid{display:flex;flex-wrap:wrap;gap:.5rem}
    .amenity-tag{background:var(--gray-100);padding:.5rem .75rem;border-radius:20px;font-size:.85rem;color:var(--gray-700);display:flex;align-items:center;gap:.35rem}
    .amenity-tag svg{width:14px;height:14px;color:#1c1917}
    
    /* Products Section */
    .products-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
    .products-header a{font-size:.875rem;color:var(--gray-600);font-weight:500}
    .products-header a:hover{color:var(--black)}
    .products-scroll{display:flex;max-width:100%;gap:1rem;overflow-x:auto;padding-bottom:.5rem;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
    .products-scroll::-webkit-scrollbar{height:6px}
    .products-scroll::-webkit-scrollbar-track{background:var(--gray-100);border-radius:3px}
    .products-scroll::-webkit-scrollbar-thumb{background:var(--gray-300);border-radius:3px}
    .product-card{flex:0 0 180px;scroll-snap-align:start;background:var(--white);border:1px solid var(--gray-200);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;transition:all .2s}
    .product-card:hover{border-color:var(--gray-300);box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .product-card img{width:100%;height:140px;object-fit:cover;background:var(--gray-100)}
    .product-card .product-info{padding:.75rem}
    .product-card .product-name{font-weight:600;font-size:.875rem;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.25rem}
    .product-card .product-price{font-weight:700;font-size:.875rem}
    
    /* Sidebar */
    .sidebar{position:sticky;top:100px}
    .sidebar-header{background:var(--white);border-radius:12px;padding:1.5rem;margin-bottom:1rem;border:1px solid var(--gray-200)}
    .shop-name{font-size:1.75rem;font-weight:700;margin-bottom:.25rem}
    .company-link { display: inline-block; font-size: 0.875rem; color: #666; text-decoration: none; margin-bottom: 0.5rem; }
    .company-link:hover { color: #1a1a1a; text-decoration: underline; }
    .shop-location{color:var(--gray-500);margin-bottom:.75rem}
    .rating-row{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap}
    .stars{color:var(--amber-500);font-size:1rem}
    .rating-score{font-weight:600}
    .rating-count{color:var(--gray-500);font-size:.9rem}
    .price-range{color:var(--gray-500)}
    .status-badge{display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .75rem;border-radius:20px;font-size:.85rem;font-weight:500}
    .status-badge.open{background:#e7e5e4;color:#1c1917}
    .status-badge.closed{background:var(--gray-100);color:var(--gray-600)}
    .partner-badge{background:#1c1917;color:var(--white);padding:.35rem .75rem;border-radius:20px;font-size:.8rem;font-weight:600}
    .sidebar-buttons{display:flex;flex-direction:column;gap:.75rem;margin:1.25rem 0}
    .sidebar-buttons .btn{width:100%;justify-content:center}
    
    /* Map */
    .map-card{background:var(--white);border-radius:12px;overflow:hidden;margin-bottom:1rem;border:1px solid var(--gray-200)}
    .map-container{height:200px;background:var(--gray-200)}
    #map{width:100%;height:100%}
    .map-info{padding:1rem}
    .map-address{font-weight:500;margin-bottom:.25rem}
    .map-city{color:var(--gray-500);font-size:.9rem;margin-bottom:1rem}
    .map-buttons{display:flex;gap:.75rem}
    .map-buttons .btn{flex:1;font-size:.875rem;padding:.625rem 1rem}
    
    /* Claim Card */
    .claim-card{background:linear-gradient(135deg,#FEF3C7,#FDE68A);border-radius:12px;padding:1.5rem;border:1px solid #F59E0B}
    .claim-card h3{font-size:1.1rem;margin-bottom:.5rem}
    .claim-card p{color:var(--gray-700);font-size:.9rem;margin-bottom:1rem}
    .claim-card .btn{width:100%}

    /* Order Ahead */
    .partner-cta{background:linear-gradient(135deg,#1c1917,#292524);color:#fff;border-radius:12px;padding:1.5rem;margin-bottom:1rem;text-align:center}
    .partner-cta h3{font-size:1.1rem;font-weight:600;margin-bottom:0.5rem}
    .partner-cta p{font-size:0.875rem;opacity:0.9;margin-bottom:1rem}
    .partner-cta .btn{background:#fff;color:#1c1917;width:100%;margin-bottom:0.75rem}
    .partner-cta .btn:hover{background:#f5f5f4}
    .app-badges{display:flex;gap:0.75rem;justify-content:center}
    .app-badges a{display:block;height:40px}
    .app-badges img{height:100%}

    /* Upvote Card */
    .upvote-card{background:linear-gradient(135deg,#DBEAFE,#BFDBFE);border-radius:12px;padding:1.5rem;border:1px solid #3B82F6;margin-bottom:1rem}
    .upvote-card h3{font-size:1.1rem;margin-bottom:.5rem;display:flex;align-items:center;gap:.5rem}
    .upvote-card p{color:var(--gray-700);font-size:.9rem;margin-bottom:1rem}
    .upvote-card .btn{width:100%;background:#2563EB;color:white}.upvote-card .btn:hover{background:#1D4ED8}
    .upvote-count{font-size:.85rem;color:var(--gray-600);margin-top:.75rem;text-align:center}
    
    /* Modal */
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;visibility:hidden;transition:all .3s}
    .modal-overlay.active{opacity:1;visibility:visible}
    .modal{background:var(--white);border-radius:16px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;position:relative}
    .modal-header{padding:1.5rem;border-bottom:1px solid var(--gray-200)}
    .modal-header h2{font-size:1.25rem;margin-bottom:.25rem}
    .modal-header p{color:var(--gray-500);font-size:.9rem}
    .modal-body{padding:1.5rem}
    .close-btn{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-400);width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px}
    .close-btn:hover{background:var(--gray-100);color:var(--gray-600)}
    
    /* Form */
    .form-group{margin-bottom:1rem}
    .form-group label{display:block;margin-bottom:.5rem;font-weight:500;font-size:.9rem}
    .form-group label .required{color:var(--red-500)}
    .form-group input,.form-group select{width:100%;padding:.75rem;border:1px solid var(--gray-300);border-radius:8px;font-size:1rem;font-family:inherit}
    .form-group input:focus,.form-group select:focus{outline:none;border-color:var(--black)}
    .form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
    .modal-footer{padding:1.5rem;border-top:1px solid var(--gray-200);display:flex;gap:1rem}
    .modal-footer .btn{flex:1}

    /* Review Highlights */
    .reviews-grid{display:grid;gap:1rem}
    .review-item{padding:1rem;background:var(--gray-50);border-radius:8px;border-left:3px solid var(--amber-500)}
    .review-text{color:var(--gray-700);font-style:italic;margin-bottom:.5rem;line-height:1.6}
    .review-meta{display:flex;justify-content:space-between;font-size:.85rem;color:var(--gray-500)}
    .review-stars{color:var(--amber-500)}

    /* Categories */
    .categories{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.75rem}
    .category-tag{background:var(--gray-100);padding:.25rem .5rem;border-radius:4px;font-size:.75rem;color:var(--gray-600)}
    
    @media(max-width:900px){
      .layout{grid-template-columns:1fr}
      .sidebar{position:static}
      .photo-gallery{grid-template-columns:1fr;grid-template-rows:250px}
      .photo-gallery .photo-main{grid-row:auto}
      .photo-gallery > *:not(.photo-main){display:none}
    }
    @media(max-width:640px){
      .nav{display:none}
      .form-row{grid-template-columns:1fr}
    }
  
    .mobile-menu-btn{display:none;background:none;border:none;cursor:pointer;padding:0.5rem}
    .mobile-menu-btn span{display:block;width:24px;height:2px;background:#1c1917;margin:5px 0}
    .mobile-menu{position:fixed;top:0;right:-100%;width:280px;height:100vh;background:#fff;z-index:1000;padding:2rem;transition:right 0.3s;box-shadow:-4px 0 20px rgba(0,0,0,0.1)}
    .mobile-menu.open{right:0}
    .mobile-menu-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:2rem;cursor:pointer;line-height:1}
    .mobile-menu a{display:block;padding:1rem 0;font-weight:500;color:#1c1917;border-bottom:1px solid #e7e5e3}
    .mobile-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:999}
    .mobile-overlay.open{display:block}
    @media(max-width:768px){.nav{display:none}.mobile-menu-btn{display:block}}
  </style>
  ${generateJsonLd(shop)}
</head>
<body data-shop-id="${shop.id}">
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
      <button class="mobile-menu-btn" onclick="document.getElementById('mobileMenu').classList.add('open');document.getElementById('mobileOverlay').classList.add('open')">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <nav class="breadcrumb">
    <a href="/">Home</a><span>›</span>
    <a href="/locations/">Locations</a><span>›</span>
    <a href="/locations/${stateCode}/">${esc(stateName)}</a><span>›</span>
    <a href="/locations/${stateCode}/${citySlug}/">${esc(shop.city)}</a><span>›</span>
    ${esc(shop.name)}
  </nav>

  <main class="main">
    <div class="layout">
      <div class="content">
        <!-- Photo Gallery -->
        <div class="photo-gallery">
          ${photos.length > 0 ? `
            <div class="photo-main"><img src="${esc(photos[0])}" alt="${esc(shop.name)}"></div>
            ${photos[1] ? `<img src="${esc(photos[1])}" alt="${esc(shop.name)}">` : '<div class="photo-placeholder">☕</div>'}
            ${photos[2] ? `<img src="${esc(photos[2])}" alt="${esc(shop.name)}">` : '<div class="photo-placeholder">☕</div>'}
          ` : `
            <div class="photo-main photo-placeholder">☕</div>
            <div class="photo-placeholder">📍</div>
            <div class="photo-placeholder">🏪</div>
          `}
        </div>

        <!-- About -->
        ${description ? `
        <div class="card">
          <h2 class="card-title">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            About ${esc(shop.name)}
          </h2>
          <p class="about-text">${esc(description)}</p>
        </div>
        ` : ''}

        <!-- Review Highlights -->
        ${shop.review_highlights?.length ? `
        <div class="card">
          <h2 class="card-title">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            What People Are Saying
          </h2>
          <div class="reviews-grid">
            ${shop.review_highlights.map(r => `
              <div class="review-item">
                <p class="review-text">"${esc(r.text)}"</p>
                <div class="review-meta">
                  <span>— ${esc(r.user)}</span>
                  <span class="review-stars">${'★'.repeat(r.rating)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Hours -->
        ${hours ? `
        <div class="card">
          <h2 class="card-title">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Hours
          </h2>
          <div class="hours-grid">${renderHours(hours)}</div>
        </div>
        ` : ''}

        <!-- Amenities -->
        ${amenities.length > 0 ? `
        <div class="card">
          <h2 class="card-title">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Amenities
          </h2>
          <div class="amenities-grid">
            ${amenities.map(a => `<span class="amenity-tag"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>${esc(a)}</span>`).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Products -->
        ${productsHTML}
      </div>

      <!-- Sidebar -->
      <div class="sidebar">
        <div class="sidebar-header">
          <h1 class="shop-name">${esc(shop.name)}</h1>
          <p class="shop-location">${esc(shop.city)}, ${esc(stateName)}</p>
          ${company ? `
          <a href="/companies/${company.slug}/" class="company-link">
            Part of ${esc(company.name)} (${company.location_count} locations) →
          </a>
          ` : ''}
          ${shop.categories?.length ? `
          <div class="categories">
            ${shop.categories.map(c => `<span class="category-tag">${esc(c)}</span>`).join('')}
          </div>
          ` : ''}
          
          ${rating ? `
          <div class="rating-row">
            <span class="stars">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5-Math.round(rating))}</span>
            <span class="rating-score">${rating}</span>
            ${reviewCount ? `<span class="rating-count">(${reviewCount} reviews)</span>` : ''}
            <span class="price-range">${esc(priceRange)}</span>
          </div>
          ` : ''}
          
          <div style="display:flex;gap:.75rem;align-items:center;margin-bottom:1rem">
            <span class="status-badge ${isOpen ? 'open' : 'closed'}">${isOpen ? '● Open' : '● Closed'}</span>
            ${isPartner ? '<span class="partner-badge">☕ joe Partner</span>' : ''}
          </div>

          <div class="sidebar-buttons">
            ${isPartner ? `
              <a href="${orderUrl ? esc(orderUrl) : 'https://get.joe.coffee'}" class="btn btn-primary" target="_blank">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                Order Ahead
              </a>
            ` : ''}
            ${shop.website ? `
              <a href="${esc(shop.website)}" class="btn btn-outline" target="_blank">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                Visit Website
              </a>
            ` : ''}
          </div>
          
          ${(shop.instagram_url || shop.facebook_url || shop.twitter_url || shop.tiktok_url) ? `
          <div class="social-links" style="display:flex;gap:0.75rem;margin-top:1rem;flex-wrap:wrap;">
            ${shop.instagram_url ? `<a href="${esc(shop.instagram_url)}" target="_blank" class="social-btn" title="Instagram" onclick="trackClick('instagram')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>` : ''}
            ${shop.facebook_url ? `<a href="${esc(shop.facebook_url)}" target="_blank" class="social-btn" title="Facebook" onclick="trackClick('facebook')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>` : ''}
            ${shop.twitter_url ? `<a href="${esc(shop.twitter_url)}" target="_blank" class="social-btn" title="Twitter/X" onclick="trackClick('twitter')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>` : ''}
            ${shop.tiktok_url ? `<a href="${esc(shop.tiktok_url)}" target="_blank" class="social-btn" title="TikTok" onclick="trackClick('tiktok')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
            </a>` : ''}
          </div>
          ` : ''}
        </div>

        ${isPartner ? `
        <div class="partner-cta">
          <h3>☕ Skip the Line</h3>
          <p>Order ahead & earn rewards with the joe app</p>
          <div class="app-badges">
            <a href="https://apps.apple.com/app/joe-coffee-order-ahead/id1437558382" target="_blank">
              <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on App Store">
            </a>
            <a href="https://play.google.com/store/apps/details?id=coffee.joe.JoeCoffee" target="_blank">
              <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play">
            </a>
          </div>
        </div>
        ` : ''}

        <!-- Map -->
        <div class="map-card">
          <div class="map-container">
            ${hasCoords ? `<div id="map"></div>` : '<div class="photo-placeholder" style="height:100%">📍</div>'}
          </div>
          <div class="map-info">
            <p class="map-address">${esc(shop.address)}</p>
            <p class="map-city">${esc(shop.city)}, ${esc(shop.state)} ${esc(shop.zip || '')}</p>
            <div class="map-buttons">
              ${hasCoords ? `
                <a href="https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}" class="btn btn-outline" target="_blank">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                  Directions
                </a>
              ` : ''}
              ${shop.phone ? `
                <a href="tel:${shop.phone}" class="btn btn-outline">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  Call
                </a>
              ` : ''}
            </div>
          </div>
        </div>

        ${!isPartner ? `
        <!-- Upvote Card -->
        <div class="upvote-card">
          <h3>☕ Want to order ahead?</h3>
          <p>Let ${esc(shop.name)} know you'd love to order ahead for pickup!</p>
          <button class="btn" onclick="openUpvoteModal()">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
            I Want This!
          </button>
          <p class="upvote-count" id="upvoteCount"></p>
        </div>
        ` : ''}

        <!-- Claim Card (non-partners only) -->
        ${!isPartner ? `
        <div class="claim-card">
          <h3>Own this business?</h3>
          <p>Claim your listing to update info, add photos, and access joe's tools for coffee shops.</p>
          <button class="btn btn-primary" onclick="openClaimModal()">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Claim This Listing
          </button>
        </div>
        ` : ''}
      </div>
    </div>
  </main>

  
  <div id="mobileOverlay" class="mobile-overlay" onclick="document.getElementById('mobileMenu').classList.remove('open');this.classList.remove('open')"></div>
  <div id="mobileMenu" class="mobile-menu">
    <button class="mobile-menu-close" onclick="document.getElementById('mobileMenu').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('open')">&times;</button>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee">Get the App</a>
  </div>
  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>

  ${hasCoords ? `
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
  <script>
    mapboxgl.accessToken = '${MAPBOX_TOKEN}';
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [${shop.lng}, ${shop.lat}],
      zoom: 15,
      interactive: true
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    new mapboxgl.Marker({ color: '#1c1917' })
      .setLngLat([${shop.lng}, ${shop.lat}])
      .addTo(map);
  </script>
  ` : ''}

  <!-- Upvote Modal -->
    <div class="modal-overlay" id="upvoteModal">
      <div class="modal">
        <button class="close-btn" onclick="closeUpvoteModal()">×</button>
        <div class="modal-header">
          <h2>☕ Let Them Know!</h2>
          <p>We'll tell ${esc(shop.name)} that you want to order ahead.</p>
        </div>
        <form id="upvoteForm" class="modal-body">
          <input type="hidden" name="shop_id" value="${shop.id}">
          
          <div class="form-group">
            <label>Your Name <span class="required">*</span></label>
            <input type="text" name="name" required placeholder="Your name">
          </div>
          
          <div class="form-group">
            <label>Email <span class="required">*</span></label>
            <input type="email" name="email" required placeholder="you@example.com">
          </div>
          
          <div class="modal-footer" style="padding:0;border:none;margin-top:1.5rem">
            <button type="button" class="btn btn-outline" onclick="closeUpvoteModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit</button>
          </div>
        </form>
      </div>
    </div>

  ${!isPartner ? `
  <!-- Claim Modal -->
  <div class="modal-overlay" id="claimModal">
    <div class="modal">
      <button class="close-btn" onclick="closeClaimModal()">×</button>
      <div class="modal-header">
        <h2>Claim This Listing</h2>
        <p>Verify your ownership of ${esc(shop.name)} and get access to joe's tools.</p>
      </div>
      <form id="claimForm" class="modal-body">
        <input type="hidden" name="shop_id" value="${shop.id}">
        <input type="hidden" name="shop_name" value="${esc(shop.name)}">
        <input type="text" name="website_url" style="display:none" tabindex="-1" autocomplete="off">
        
        <div class="form-row">
          <div class="form-group">
            <label>First Name <span class="required">*</span></label>
            <input type="text" name="first_name" required placeholder="First">
          </div>
          <div class="form-group">
            <label>Last Name <span class="required">*</span></label>
            <input type="text" name="last_name" required placeholder="Last">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Email <span class="required">*</span></label>
            <input type="email" name="email" required placeholder="you@example.com">
          </div>
          <div class="form-group">
            <label>Phone <span class="required">*</span></label>
            <input type="tel" name="phone" required placeholder="(555) 123-4567">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Your Role <span class="required">*</span></label>
            <select name="role" required>
              <option value="">Select your role...</option>
              <option value="Owner">Owner</option>
              <option value="Manager">Manager</option>
              <option value="Marketing">Marketing</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label>Coffee Shop Type <span class="required">*</span></label>
            <select name="coffee_shop_type" required>
              <option value="">Please Select</option>
              <option value="Cafe">Cafe</option>
              <option value="Drive-Thru">Drive-Thru</option>
              <option value="Roaster">Roaster</option>
              <option value="Coffee Cart/Truck">Coffee Cart/Truck</option>
              <option value="Bakery/Cafe">Bakery/Cafe</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label>Current POS <span class="required">*</span></label>
          <select name="current_pos" required>
            <option value="">Please Select</option>
            <option value="Square">Square</option>
            <option value="Toast">Toast</option>
            <option value="Clover">Clover</option>
            <option value="Lightspeed">Lightspeed</option>
            <option value="Revel">Revel</option>
            <option value="TouchBistro">TouchBistro</option>
            <option value="SpotOn">SpotOn</option>
            <option value="Other">Other</option>
            <option value="None">None</option>
          </select>
        </div>
        
        <div class="modal-footer" style="padding:0;border:none;margin-top:1.5rem">
          <button type="button" class="btn btn-outline" onclick="closeClaimModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Submit Claim</button>
        </div>
      </form>
    </div>
  </div>
  
  <script>
    function openClaimModal() {
      document.getElementById('claimModal').classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    
    function closeClaimModal() {
      document.getElementById('claimModal').classList.remove('active');
      document.body.style.overflow = '';
    }
    
    document.getElementById('claimModal').addEventListener('click', function(e) {
      if (e.target === this) closeClaimModal();
    });
    
    document.getElementById('claimForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = this.querySelector('button[type="submit"]');
      btn.textContent = 'Submitting...';
      btn.disabled = true;
      
      const data = Object.fromEntries(new FormData(this));
      
      try {
        const res = await fetch('/.netlify/functions/submit-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await res.json();

        if (res.ok) {
          alert('Check your email to verify your claim!');
          closeClaimModal();
          this.reset();
        } else {
          throw new Error(result.error || 'Something went wrong');
        }
      } catch (err) {
        alert('Error: ' + err.message + '\\n\\nPlease email hello@joe.coffee for help.');
        btn.textContent = 'Submit Claim';
        btn.disabled = false;
      }
    });
  </script>
  ` : ''}

  <!-- Upvote & Tracking Scripts -->
  <script>
    // Upvote Modal
    function openUpvoteModal() {
      document.getElementById('upvoteModal').classList.add('active');
      document.body.style.overflow = 'hidden';
      trackClick('upvote_button');
    }
    
    function closeUpvoteModal() {
      document.getElementById('upvoteModal').classList.remove('active');
      document.body.style.overflow = '';
    }
    
    document.getElementById('upvoteModal')?.addEventListener('click', function(e) {
      if (e.target === this) closeUpvoteModal();
    });
    
    document.getElementById('upvoteForm')?.addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = this.querySelector('button[type="submit"]');
      btn.textContent = 'Submitting...';
      btn.disabled = true;
      
      const data = Object.fromEntries(new FormData(this));
      
      try {
        const res = await fetch('/.netlify/functions/submit-upvote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
          alert(result.message || 'Thanks! We\\'ll let them know.');
          closeUpvoteModal();
          this.reset();
          if (result.upvote_count) {
            document.getElementById('upvoteCount').textContent = result.upvote_count + ' people want this!';
          }
        } else {
          throw new Error(result.error || 'Something went wrong');
        }
      } catch (err) {
        alert('Error: ' + err.message);
        btn.textContent = 'Submit';
        btn.disabled = false;
      }
    });
    
    // Click Tracking
    function trackClick(subtype) {
      fetch('/.netlify/functions/track-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: '${shop.id}',
          event_type: 'click',
          activity_subtype: subtype,
          page_url: window.location.href,
          page_title: document.title
        })
      }).catch(() => {});
    }
    
    // Track button clicks
    document.querySelectorAll('a[href*="maps/dir"]').forEach(a => a.addEventListener('click', () => trackClick('directions')));
    document.querySelectorAll('a[href^="tel:"]').forEach(a => a.addEventListener('click', () => trackClick('phone')));
    document.querySelectorAll('a[href="${esc(shop.website || '')}"]').forEach(a => a.addEventListener('click', () => trackClick('website')));
  </script>
  <script src="/includes/tracking.js"></script>
</body>
</html>`;
}

function parseHours(h) {
  if (!h) return null;
  try {
    return typeof h === 'string' ? JSON.parse(h) : h;
  } catch {
    return null;
  }
}

function renderHours(hours) {
  if (!hours) return '';
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const now = new Date();
  const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
  
  return days.map((d, i) => `
    <div class="hours-row">
      <span class="hours-day ${i === todayIndex ? 'today' : ''}">${names[i]}</span>
      <span class="hours-time">${hours[d] || 'Closed'}</span>
    </div>
  `).join('');
}

function checkIfOpen(hours) {
  if (!hours) return false;
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  const t = hours[today];
  return t && t.toLowerCase() !== 'closed';
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/['']/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getStateName(c) {
  const s = {'al':'Alabama','ak':'Alaska','az':'Arizona','ar':'Arkansas','ca':'California','co':'Colorado','ct':'Connecticut','de':'Delaware','fl':'Florida','ga':'Georgia','hi':'Hawaii','id':'Idaho','il':'Illinois','in':'Indiana','ia':'Iowa','ks':'Kansas','ky':'Kentucky','la':'Louisiana','me':'Maine','md':'Maryland','ma':'Massachusetts','mi':'Michigan','mn':'Minnesota','ms':'Mississippi','mo':'Missouri','mt':'Montana','ne':'Nebraska','nv':'Nevada','nh':'New Hampshire','nj':'New Jersey','nm':'New Mexico','ny':'New York','nc':'North Carolina','nd':'North Dakota','oh':'Ohio','ok':'Oklahoma','or':'Oregon','pa':'Pennsylvania','ri':'Rhode Island','sc':'South Carolina','sd':'South Dakota','tn':'Tennessee','tx':'Texas','ut':'Utah','vt':'Vermont','va':'Virginia','wa':'Washington','wv':'West Virginia','wi':'Wisconsin','wy':'Wyoming','dc':'Washington D.C.'};
  return s[c?.toLowerCase()] || c?.toUpperCase();
}

function redirect(url) {
  return { statusCode: 301, headers: { Location: url }, body: '' };
}

function notFound() {
  return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: '<h1>Shop not found</h1><p><a href="/locations/">Browse all locations</a></p>' };
}

function error500() {
  return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<h1>Server error</h1>' };
}

async function trackPageView(shopId, event) {
  try {
    await supabase.from('website_activity').insert({
      shop_id: shopId,
      activity_type: 'page_view',
      metadata: {
        user_agent: event.headers?.['user-agent'],
        referer: event.headers?.['referer']
      }
    });
  } catch {}
}