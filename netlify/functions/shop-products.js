/**
 * Shop Products Page - All products for a shop
 * Route: /locations/:state/:city/:shop/products/
 * Supports multi-location brands via company_id
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_LEGACY_KEY || process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const path = event.path || event.rawUrl || "";
    const parts = path.replace("/.netlify/functions/shop-products", "")
                      .split("/")
                      .filter(Boolean)
                      .filter(p => p !== "products" && p !== "locations");
    
    // Extract state, city, shopSlug from path
    const [stateCode, citySlug, shopSlug] = parts.slice(-3);

    if (!shopSlug) return { statusCode: 404, body: 'Shop not found' };

    // Get shop with company info
    const { data: shop } = await supabase
      .from('shops')
      .select('id, name, slug, city, state, state_code, city_slug, company_id, is_joe_partner, photos')
      .eq('slug', shopSlug)
      .single();

    if (!shop) return { statusCode: 404, body: 'Shop not found' };

    // Get products - check company_id first for multi-location brands
    let productsQuery = supabase
      .from('products')
      .select('id, name, slug, price, image_url, product_url, description, roast_level, origin, flavor_notes')
      .eq('is_active', true)
      .order('name');

    if (shop.company_id) {
      // Multi-location brand - get products by company
      productsQuery = productsQuery.eq('company_id', shop.company_id);
    } else {
      // Single location - get products by shop
      productsQuery = productsQuery.eq('shop_id', shop.id);
    }

    const { data: products, error } = await productsQuery;
    
    console.log('Shop products query:', { 
      shopId: shop.id, 
      companyId: shop.company_id, 
      productCount: products?.length,
      error 
    });

    const html = renderProductsPage(shop, products || [], stateCode, citySlug);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      body: html
    };
  } catch (err) {
    console.error('Shop products page error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};

function renderProductsPage(shop, products, stateCode, citySlug) {
  const stateName = getStateName(stateCode);
  const shopUrl = `/locations/${stateCode}/${citySlug}/${shop.slug}/`;
  const canonicalUrl = `https://joe.coffee${shopUrl}products/`;

  // Categorize products by name pattern
  const coffeeProducts = products.filter(p => {
    const name = (p.name || '').toLowerCase();
    return name.includes('coffee') || name.includes('roast') || name.includes('blend') || name.includes('espresso') || name.includes('bean') || name.includes('decaf');
  });
  
  const merchProducts = products.filter(p => {
    const name = (p.name || '').toLowerCase();
    return name.includes('shirt') || name.includes('mug') || name.includes('hat') || name.includes('tote') || name.includes('hoodie') || name.includes('sweatshirt') || name.includes('bag');
  });
  
  const otherProducts = products.filter(p => !coffeeProducts.includes(p) && !merchProducts.includes(p));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(shop.name)} Products | joe coffee</title>
  <meta name="description" content="Shop coffee and products from ${esc(shop.name)} in ${esc(shop.city)}, ${esc(stateName)}. ${products.length} products available.">
  <link rel="canonical" href="${canonicalUrl}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--black:#1c1917;--white:#fff;--gray-50:#fafaf9;--gray-100:#f5f5f4;--gray-200:#e7e5e3;--gray-300:#d6d3d1;--gray-400:#a8a29e;--gray-500:#78716c;--gray-600:#57534e;--gray-800:#292524;--green-500:#22c55e}
    body{font-family:'Inter',-apple-system,sans-serif;background:var(--gray-50);color:var(--black);line-height:1.6}
    a{color:inherit;text-decoration:none}
    .header{background:var(--white);border-bottom:1px solid var(--gray-200);padding:1rem 1.5rem;position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
    .logo img{height:40px}
    .nav{display:flex;gap:1.5rem;align-items:center}
    .nav a{font-weight:500;color:var(--gray-600)}
    .nav a:hover{color:var(--black)}
    .btn{padding:.75rem 1.5rem;border-radius:8px;font-weight:600;cursor:pointer;border:none;transition:all .2s}
    .btn-primary{background:#1c1917;color:#fff !important}
    .btn-primary:hover{background:var(--gray-800)}
    .btn-outline{background:var(--white);border:1px solid var(--gray-300);color:var(--gray-800)}
    .btn-outline:hover{border-color:var(--black)}
    .breadcrumb{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;font-size:.875rem;color:var(--gray-500)}
    .breadcrumb a:hover{color:var(--black)}
    .breadcrumb span{margin:0 .5rem;color:var(--gray-300)}
    .main{max-width:1280px;margin:0 auto;padding:0 1.5rem 3rem}
    .page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;flex-wrap:wrap;gap:1rem}
    .page-title{font-size:1.75rem;font-weight:700;display:flex;align-items:center;gap:.75rem}
    .joe-badge{background:var(--green-500);color:var(--white);padding:.25rem .5rem;border-radius:4px;font-size:.7rem;font-weight:700}
    .page-subtitle{color:var(--gray-500);margin-top:.25rem}
    .section-title{font-size:1.25rem;font-weight:600;margin:2rem 0 1rem;display:flex;align-items:center;gap:.5rem}
    .section-title::before{content:'';width:4px;height:1.25rem;background:var(--black);border-radius:2px}
    .products-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:1.5rem}
    .product-card{background:var(--white);border:1px solid var(--gray-200);border-radius:12px;overflow:hidden;transition:all .2s}
    .product-card:hover{border-color:var(--gray-300);box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-2px)}
    .product-card img{width:100%;height:200px;object-fit:cover;background:var(--gray-100)}
    .product-card .placeholder{width:100%;height:200px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;font-size:3rem}
    .product-card .info{padding:1rem}
    .product-card .name{font-weight:600;margin-bottom:.25rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .product-card .meta{display:flex;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap}
    .product-card .tag{font-size:.7rem;padding:.25rem .5rem;background:var(--gray-100);border-radius:4px;color:var(--gray-600)}
    .product-card .price{font-weight:700;font-size:1.1rem}
    .empty-state{text-align:center;padding:4rem 2rem;background:var(--white);border-radius:12px;border:1px solid var(--gray-200)}
    .empty-state h2{font-size:1.25rem;margin-bottom:.5rem}
    .empty-state p{color:var(--gray-500);margin-bottom:1.5rem}
    footer{background:var(--black);color:var(--white);padding:2rem 1.5rem;margin-top:3rem;text-align:center}
    .footer-links{display:flex;justify-content:center;gap:1.5rem;margin-bottom:1rem;flex-wrap:wrap}
    .footer-links a{color:var(--gray-400);font-size:.875rem}
    .footer-links a:hover{color:var(--white)}
    @media(max-width:640px){.nav a:not(.btn-primary){display:none}.page-header{flex-direction:column;align-items:flex-start}.products-grid{grid-template-columns:repeat(2, 1fr);gap:1rem}.product-card img,.product-card .placeholder{height:150px}}
  </style>
</head>
<body data-shop-id="${shop.id}">
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/marketplace/">Shop</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
    </div>
  </header>
  <nav class="breadcrumb">
    <a href="/">Home</a><span>›</span>
    <a href="/locations/">Locations</a><span>›</span>
    <a href="/locations/${stateCode}/">${esc(stateName)}</a><span>›</span>
    <a href="/locations/${stateCode}/${citySlug}/">${esc(shop.city)}</a><span>›</span>
    <a href="${shopUrl}">${esc(shop.name)}</a><span>›</span>
    Products
  </nav>
  <main class="main">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          ${esc(shop.name)} Products
          ${shop.is_joe_partner ? '<span class="joe-badge">JOE PARTNER</span>' : ''}
        </h1>
        <p class="page-subtitle">${products.length} product${products.length !== 1 ? 's' : ''} available</p>
      </div>
      <a href="${shopUrl}" class="btn btn-outline">← Back to Shop</a>
    </div>

    ${coffeeProducts.length > 0 ? `
      <h2 class="section-title">Coffee</h2>
      <div class="products-grid">
        ${coffeeProducts.map(p => renderProductCard(p, shop, stateCode, citySlug)).join('')}
      </div>
    ` : ''}

    ${merchProducts.length > 0 ? `
      <h2 class="section-title">Merchandise</h2>
      <div class="products-grid">
        ${merchProducts.map(p => renderProductCard(p, shop, stateCode, citySlug)).join('')}
      </div>
    ` : ''}

    ${otherProducts.length > 0 ? `
      <h2 class="section-title">${coffeeProducts.length > 0 || merchProducts.length > 0 ? 'Other Products' : 'All Products'}</h2>
      <div class="products-grid">
        ${otherProducts.map(p => renderProductCard(p, shop, stateCode, citySlug)).join('')}
      </div>
    ` : ''}

    ${products.length === 0 ? `
    <div class="empty-state">
      <h2>No products available</h2>
      <p>This shop doesn't have any products listed yet.</p>
      <a href="${shopUrl}" class="btn btn-primary">Back to Shop</a>
    </div>
    ` : ''}
  </main>
  <footer>
    <div class="footer-links">
      <a href="/about/">About</a>
      <a href="/for-coffee-shops/">For Coffee Shops</a>
      <a href="/locations/">Find Coffee</a>
      <a href="/privacy/">Privacy</a>
    </div>
    <p style="color:var(--gray-500);font-size:.75rem">© 2026 The Joe Collective</p>
  </footer>
  <script src="/includes/tracking.js"></script>
</body>
</html>`;
}

function renderProductCard(p, shop, stateCode, citySlug) {
  const productUrl = `/locations/${stateCode}/${citySlug}/${shop.slug}/products/${p.slug || p.id}/`;
  return `
    <a href="${productUrl}" class="product-card">
      ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : '<div class="placeholder">☕</div>'}
      <div class="info">
        <div class="name">${esc(p.name)}</div>
        <div class="meta">
          ${p.roast_level ? `<span class="tag">${esc(p.roast_level)}</span>` : ''}
          ${p.origin ? `<span class="tag">${esc(p.origin)}</span>` : ''}
        </div>
        <div class="price">$${parseFloat(p.price || 0).toFixed(2)}</div>
      </div>
    </a>
  `;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getStateName(c) {
  const states = {
    'al':'Alabama','ak':'Alaska','az':'Arizona','ar':'Arkansas','ca':'California',
    'co':'Colorado','ct':'Connecticut','de':'Delaware','fl':'Florida','ga':'Georgia',
    'hi':'Hawaii','id':'Idaho','il':'Illinois','in':'Indiana','ia':'Iowa',
    'ks':'Kansas','ky':'Kentucky','la':'Louisiana','me':'Maine','md':'Maryland',
    'ma':'Massachusetts','mi':'Michigan','mn':'Minnesota','ms':'Mississippi','mo':'Missouri',
    'mt':'Montana','ne':'Nebraska','nv':'Nevada','nh':'New Hampshire','nj':'New Jersey',
    'nm':'New Mexico','ny':'New York','nc':'North Carolina','nd':'North Dakota','oh':'Ohio',
    'ok':'Oklahoma','or':'Oregon','pa':'Pennsylvania','ri':'Rhode Island','sc':'South Carolina',
    'sd':'South Dakota','tn':'Tennessee','tx':'Texas','ut':'Utah','vt':'Vermont',
    'va':'Virginia','wa':'Washington','wv':'West Virginia','wi':'Wisconsin','wy':'Wyoming',
    'dc':'District of Columbia'
  };
  return states[(c||'').toLowerCase()] || c;
}