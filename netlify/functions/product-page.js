/**
 * Product Page - SEO-friendly SSR product pages
 * URL: /marketplace/product/{slug}/
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const path = event.path || event.rawUrl || "";
    // Extract slug from /marketplace/product/{slug}/ or query param
    const pathSlug = path.replace(/^\/marketplace\/product\/?/, '').replace(/\/$/, '').split('/')[0];
    const slug = pathSlug || event.queryStringParameters?.slug || event.queryStringParameters?.id;
    
    if (!slug) return redirect('/marketplace/');

    // Try to find product by slug first, then by ID
    let product = null;
    
    // First try by slug
    const { data: bySlug } = await supabase
      .from('products')
      .select(`
        *,
        shops:shop_id (
          id, name, slug, city, state, state_code, city_slug,
          logo_url, has_free_shipping, free_shipping_threshold
        )
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    
    if (bySlug) {
      product = bySlug;
    } else {
      // Try by ID
      const { data: byId } = await supabase
        .from('products')
        .select(`
          *,
          shops:shop_id (
            id, name, slug, city, state, state_code, city_slug,
            logo_url, has_free_shipping, free_shipping_threshold
          )
        `)
        .eq('id', slug)
        .eq('is_active', true)
        .single();
      
      if (byId) {
        // Redirect to proper slug URL if product has a slug
        if (byId.slug && byId.slug !== slug) {
          return redirect(`/marketplace/product/${byId.slug}/`);
        }
        product = byId;
      }
    }

    if (!product) return notFound();

    // Get all variants for this product (products with same base name)
    const baseName = product.name.split(' - ')[0];
    const { data: variants } = await supabase
      .from('products')
      .select('id, name, price, compare_at_price, size, grind_type, in_stock, product_url, image_url, shop_id')
      .eq('shop_id', product.shop_id)
      .eq('is_active', true)
      .or(`id.eq.${product.id},name.ilike.${baseName}%`)
      .order('price', { ascending: true });

    // Get related products from same shop
    const { data: related } = await supabase
      .from('products')
      .select('id, name, slug, price, image_url')
      .eq('shop_id', product.shop_id)
      .eq('is_active', true)
      .neq('id', product.id)
      .limit(4);

    const html = renderProductPage(product, variants || [product], related || []);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8', 
        'Cache-Control': 'public, max-age=300' 
      },
      body: html
    };
  } catch (err) {
    console.error('Product page error:', err);
    return error500();
  }
};

function renderProductPage(product, variants, related) {
  const shop = product.shops || {};
  const price = parseFloat(product.price || 0);
  const comparePrice = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const onSale = comparePrice && comparePrice > price;
  const productSlug = product.slug || product.id;
  
  const canonicalUrl = `https://joe.coffee/marketplace/product/${productSlug}/`;
  const title = `${product.name} | ${shop.name || 'joe Marketplace'}`;
  const description = product.description 
    ? stripHtml(product.description).substring(0, 155) + '...'
    : `Shop ${product.name} from ${shop.name || 'local roasters'} on joe - fresh roasted coffee from independent coffee shops.`;
  const imageUrl = product.image_url || 'https://joe.coffee/images/og-marketplace.jpg';
  
  // Get unique sizes and grinds from variants
  const sizes = [...new Set(variants.filter(v => v.size).map(v => v.size))];
  const grinds = [...new Set(variants.filter(v => v.grind_type).map(v => v.grind_type))];
  
  const grindLabels = {
    'whole_bean': 'Whole Bean',
    'drip': 'Drip/Pour Over',
    'espresso': 'Espresso',
    'french_press': 'French Press',
    'cold_brew': 'Cold Brew',
    'aeropress': 'AeroPress'
  };

  // Schema.org Product markup
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": stripHtml(product.description || ''),
    "image": imageUrl,
    "brand": {
      "@type": "Brand",
      "name": shop.name || 'Independent Roaster'
    },
    "offers": {
      "@type": "Offer",
      "url": canonicalUrl,
      "priceCurrency": "USD",
      "price": price.toFixed(2),
      "availability": product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": shop.name || 'joe coffee'
      }
    }
  };

  // Build shop location URL
  const shopUrl = shop.state_code && shop.city_slug && shop.slug
    ? `/locations/${shop.state_code.toLowerCase()}/${shop.city_slug}/${shop.slug}/`
    : `/marketplace/?shop=${shop.id}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="product:price:amount" content="${price.toFixed(2)}">
  <meta property="product:price:currency" content="USD">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Schema.org -->
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  
  <link rel="icon" type="image/png" href="/images/favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://js.stripe.com/v3/"></script>
  <link rel="stylesheet" href="/includes/footer.css">
  
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--black:#1c1917;--white:#fff;--gray-50:#fafaf9;--gray-100:#f5f5f4;--gray-200:#e7e5e3;--gray-300:#d6d3d1;--gray-400:#a8a29e;--gray-500:#78716c;--gray-600:#57534e;--gray-800:#292524;--amber-500:#f59e0b;--green-500:#22c55e}
    body{font-family:'Inter',-apple-system,sans-serif;background:var(--gray-50);color:var(--black);line-height:1.6}
    a{color:inherit;text-decoration:none}
    
    .header{background:var(--white);border-bottom:1px solid var(--gray-200);padding:1rem 1.5rem;position:sticky;top:0;z-index:100}
    .header-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
    .logo{font-size:1.5rem;font-weight:700}
    .nav{display:flex;gap:1.5rem;align-items:center}
    .nav a{font-weight:500;color:var(--gray-600)}
    .nav a:hover{color:var(--black)}
    .cart-btn{background:var(--black);color:var(--white);padding:0.5rem 1rem;border-radius:8px;font-weight:600;display:flex;align-items:center;gap:0.5rem;cursor:pointer;border:none}
    .cart-count{background:var(--amber-500);color:var(--black);padding:0.125rem 0.5rem;border-radius:10px;font-size:0.75rem;font-weight:700}
    
    .breadcrumb{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;font-size:0.875rem;color:var(--gray-500)}
    .breadcrumb a:hover{color:var(--black)}
    .breadcrumb span{margin:0 0.5rem;color:var(--gray-300)}
    
    .product-page{max-width:1280px;margin:0 auto;padding:0 1.5rem 3rem;display:grid;grid-template-columns:1fr 1fr;gap:3rem}
    @media(max-width:768px){.product-page{grid-template-columns:1fr;gap:2rem}}
    
    .product-image-container{position:sticky;top:100px}
    .product-image{width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px;background:var(--gray-100)}
    .product-image-placeholder{width:100%;aspect-ratio:1;border-radius:16px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;font-size:6rem}
    
    .product-info{padding:1rem 0}
    .product-roaster{font-size:0.875rem;color:var(--gray-500);margin-bottom:0.5rem}
    .product-roaster a:hover{color:var(--black);text-decoration:underline}
    .product-name{font-size:2rem;font-weight:700;margin-bottom:1rem;line-height:1.2}
    .product-price-row{display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1.5rem}
    .product-price{font-size:1.75rem;font-weight:700}
    .product-price-compare{font-size:1.25rem;color:var(--gray-400);text-decoration:line-through}
    .sale-badge{background:#fef2f2;color:#dc2626;padding:0.25rem 0.75rem;border-radius:20px;font-size:0.75rem;font-weight:600}
    
    .options-section{margin-bottom:1.5rem}
    .option-label{font-weight:600;font-size:0.875rem;margin-bottom:0.75rem}
    .option-buttons{display:flex;flex-wrap:wrap;gap:0.5rem}
    .option-btn{padding:0.75rem 1.25rem;border:2px solid var(--gray-200);border-radius:8px;background:var(--white);cursor:pointer;font-size:0.9rem;font-weight:500;transition:all 0.15s}
    .option-btn:hover{border-color:var(--gray-400)}
    .option-btn.selected{border-color:var(--black);background:var(--black);color:var(--white)}
    
    .add-to-cart-section{display:flex;gap:1rem;margin-bottom:2rem}
    .qty-selector{display:flex;align-items:center;border:2px solid var(--gray-200);border-radius:8px;overflow:hidden}
    .qty-btn{width:44px;height:44px;border:none;background:var(--white);font-size:1.25rem;cursor:pointer}
    .qty-btn:hover{background:var(--gray-100)}
    .qty-value{width:44px;text-align:center;font-weight:600;border-left:1px solid var(--gray-200);border-right:1px solid var(--gray-200)}
    .add-btn{flex:1;background:var(--black);color:var(--white);border:none;padding:0.875rem 1.5rem;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;transition:all 0.2s}
    .add-btn:hover:not(:disabled){background:#333;transform:translateY(-1px)}
    .add-btn:disabled{background:var(--gray-300);cursor:not-allowed}
    
    .product-description{margin-bottom:2rem;padding:1.5rem;background:var(--white);border-radius:12px}
    .product-description h3{font-size:1rem;font-weight:600;margin-bottom:0.75rem}
    .product-description p{color:var(--gray-600);line-height:1.8}
    
    .roaster-card{display:flex;gap:1rem;padding:1.5rem;background:var(--white);border-radius:12px;align-items:center}
    .roaster-avatar{width:48px;height:48px;background:var(--gray-100);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem}
    .roaster-name{font-weight:600;margin-bottom:0.25rem}
    .roaster-link{font-size:0.875rem;color:var(--gray-500)}
    .roaster-link:hover{color:var(--black)}
    
    .shipping-info{padding:1rem;background:var(--gray-100);border-radius:8px;font-size:0.9rem;color:var(--gray-600);margin-bottom:1.5rem}
    
    .related-section{max-width:1280px;margin:3rem auto;padding:0 1.5rem}
    .related-section h2{font-size:1.5rem;margin-bottom:1.5rem}
    .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1.5rem}
    .related-card{background:var(--white);border-radius:12px;overflow:hidden;transition:transform 0.2s,box-shadow 0.2s}
    .related-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,0.1)}
    .related-card img{width:100%;height:140px;object-fit:cover}
    .related-card-info{padding:1rem}
    .related-card-name{font-weight:600;font-size:0.9rem;margin-bottom:0.25rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .related-card-price{color:var(--gray-600);font-size:0.875rem}
    
    .cart-overlay{position:fixed;top:0;right:-400px;width:400px;max-width:100%;height:100vh;background:var(--white);box-shadow:-4px 0 20px rgba(0,0,0,0.15);z-index:1000;transition:right 0.3s;display:flex;flex-direction:column}
    .cart-overlay.open{right:0}
    .cart-header{padding:1.5rem;border-bottom:1px solid var(--gray-200);display:flex;justify-content:space-between;align-items:center}
    .cart-header h3{font-size:1.25rem}
    .close-cart{background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-500)}
    .cart-items{flex:1;overflow-y:auto;padding:1rem}
    .cart-empty{text-align:center;padding:3rem 1rem;color:var(--gray-500)}
    .cart-item{display:flex;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--gray-100)}
    .cart-item-image{width:60px;height:60px;object-fit:cover;border-radius:8px;background:var(--gray-100)}
    .cart-item-info{flex:1}
    .cart-item-name{font-weight:600;font-size:0.9rem}
    .cart-item-variant{font-size:0.8rem;color:var(--gray-500)}
    .cart-item-price{font-size:0.875rem;margin-top:0.25rem}
    .cart-footer{padding:1.5rem;border-top:1px solid var(--gray-200)}
    .cart-total{display:flex;justify-content:space-between;font-size:1.25rem;font-weight:700;margin-bottom:1rem}
    .checkout-btn{width:100%;background:var(--black);color:var(--white);border:none;padding:1rem;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}
    .checkout-btn:disabled{background:var(--gray-300);cursor:not-allowed}
    
    .toast{position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(100px);background:var(--black);color:var(--white);padding:1rem 2rem;border-radius:8px;font-weight:500;opacity:0;transition:all 0.3s;z-index:2000}
    .toast.show{transform:translateX(-50%) translateY(0);opacity:1}
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">joe</a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/marketplace/">Shop</a>
        <a href="/for-coffee-shops/">For Business</a>
        <button class="cart-btn" onclick="toggleCart()">
          Cart <span class="cart-count" id="cartCount">0</span>
        </button>
      </nav>
    </div>
  </header>
  
  <div class="breadcrumb">
    <a href="/">Home</a>
    <span>›</span>
    <a href="/marketplace/">Marketplace</a>
    <span>›</span>
    <a href="${shopUrl}">${esc(shop.name || 'Shop')}</a>
    <span>›</span>
    ${esc(product.name)}
  </div>
  
  <main class="product-page">
    <div class="product-image-container">
      ${product.image_url 
        ? `<img src="${esc(product.image_url)}" alt="${esc(product.name)}" class="product-image">`
        : `<div class="product-image-placeholder">☕</div>`
      }
    </div>
    
    <div class="product-info">
      <div class="product-roaster">
        <a href="${shopUrl}">${esc(shop.name || 'Independent Roaster')}</a>
        ${shop.city && shop.state ? ` • ${esc(shop.city)}, ${esc(shop.state)}` : ''}
      </div>
      
      <h1 class="product-name">${esc(product.name)}</h1>
      
      <div class="product-price-row">
        <span class="product-price" id="currentPrice">$${price.toFixed(2)}</span>
        ${onSale ? `<span class="product-price-compare">$${comparePrice.toFixed(2)}</span><span class="sale-badge">Sale</span>` : ''}
      </div>
      
      ${sizes.length > 0 ? `
        <div class="options-section">
          <div class="option-label">Size</div>
          <div class="option-buttons" id="sizeOptions">
            ${sizes.map((s, i) => `<button class="option-btn ${i === 0 ? 'selected' : ''}" onclick="selectSize('${esc(s)}')">${esc(s)}</button>`).join('')}
          </div>
        </div>
      ` : ''}
      
      ${grinds.length > 0 ? `
        <div class="options-section">
          <div class="option-label">Grind</div>
          <div class="option-buttons" id="grindOptions">
            ${grinds.map((g, i) => `<button class="option-btn ${i === 0 ? 'selected' : ''}" onclick="selectGrind('${esc(g)}')">${esc(grindLabels[g] || g)}</button>`).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="add-to-cart-section">
        <div class="qty-selector">
          <button class="qty-btn" onclick="updateQuantity(-1)">−</button>
          <span class="qty-value" id="qtyValue">1</span>
          <button class="qty-btn" onclick="updateQuantity(1)">+</button>
        </div>
        <button class="add-btn" id="addBtn" onclick="addToCart()" ${!product.in_stock ? 'disabled' : ''}>
          ${product.in_stock ? `Add to Cart — $${price.toFixed(2)}` : 'Sold Out'}
        </button>
      </div>
      
      <div class="shipping-info">
        ${shop.has_free_shipping 
          ? `📦 Free shipping${shop.free_shipping_threshold ? ` on orders over $${shop.free_shipping_threshold}` : ''}`
          : '📦 Shipping calculated at checkout'
        }
      </div>
      
      ${product.description ? `
        <div class="product-description">
          <h3>About this coffee</h3>
          <p>${product.description}</p>
        </div>
      ` : ''}
      
      <div class="roaster-card">
        <div class="roaster-avatar">☕</div>
        <div>
          <div class="roaster-name">${esc(shop.name || 'Independent Roaster')}</div>
          <a href="${shopUrl}" class="roaster-link">View all products →</a>
        </div>
      </div>
    </div>
  </main>
  
  ${related.length > 0 ? `
    <section class="related-section">
      <h2>More from ${esc(shop.name || 'this roaster')}</h2>
      <div class="related-grid">
        ${related.map(r => `
          <a href="/marketplace/product/${esc(r.slug || r.id)}/" class="related-card">
            ${r.image_url 
              ? `<img src="${esc(r.image_url)}" alt="${esc(r.name)}">`
              : `<div style="height:140px;background:#f5f5f4;display:flex;align-items:center;justify-content:center;font-size:2rem">☕</div>`
            }
            <div class="related-card-info">
              <div class="related-card-name">${esc(r.name)}</div>
              <div class="related-card-price">$${parseFloat(r.price || 0).toFixed(2)}</div>
            </div>
          </a>
        `).join('')}
      </div>
    </section>
  ` : ''}
  
  <!-- Cart Overlay -->
  <div class="cart-overlay" id="cartOverlay">
    <div class="cart-header">
      <h3>Your Cart</h3>
      <button class="close-cart" onclick="toggleCart()">×</button>
    </div>
    <div class="cart-items" id="cartItems">
      <div class="cart-empty">Your cart is empty</div>
    </div>
    <div class="cart-footer">
      <div class="cart-total">
        <span>Total</span>
        <span id="cartTotal">$0.00</span>
      </div>
      <button class="checkout-btn" id="checkoutBtn" onclick="checkout()" disabled>Checkout</button>
    </div>
  </div>
  
  <div class="toast" id="toast"></div>
  
  <script src="/includes/footer-loader.js"></script>
  
  <script>
    const SUPABASE_URL = 'https://vpnoaxpmhuknyaxcyxsu.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbm9heHBtaHVrbnlheGN5eHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzOTU1MDUsImV4cCI6MjA0Nzk3MTUwNX0.LFjBBwKRV2mTdNhfYwruBL7rE3BgAflI8xyRclnnhEE';
    const stripe = Stripe('pk_live_51NCBpZCfyxzF7msXcWLlvDCqB1NFTN7V1t4YwLe3KdWHy8gW7V9SqPl7P7D0YkLqQ8kKcFmHzMPJC7G5wVqKm7Dc00nH2e7JxH');
    
    const GRIND_LABELS = {
      'whole_bean': 'Whole Bean',
      'drip': 'Drip/Pour Over',
      'espresso': 'Espresso',
      'french_press': 'French Press',
      'cold_brew': 'Cold Brew',
      'aeropress': 'AeroPress'
    };
    
    const product = ${JSON.stringify({ id: product.id, name: product.name, shop_id: product.shop_id, shops: shop })};
    const variants = ${JSON.stringify(variants)};
    let selectedVariant = variants[0] || ${JSON.stringify(product)};
    let quantity = 1;
    let cart = JSON.parse(localStorage.getItem('joe_cart') || '[]');
    
    function selectSize(size) {
      const variant = variants.find(v => v.size === size && (!selectedVariant.grind_type || v.grind_type === selectedVariant.grind_type))
                   || variants.find(v => v.size === size);
      if (variant) {
        selectedVariant = variant;
        updatePrice();
        document.querySelectorAll('#sizeOptions .option-btn').forEach(btn => {
          btn.classList.toggle('selected', btn.textContent === size);
        });
      }
    }
    
    function selectGrind(grind) {
      const variant = variants.find(v => v.grind_type === grind && (!selectedVariant.size || v.size === selectedVariant.size))
                   || variants.find(v => v.grind_type === grind);
      if (variant) {
        selectedVariant = variant;
        updatePrice();
        document.querySelectorAll('#grindOptions .option-btn').forEach(btn => {
          btn.classList.toggle('selected', btn.textContent === (GRIND_LABELS[grind] || grind));
        });
      }
    }
    
    function updateQuantity(delta) {
      quantity = Math.max(1, quantity + delta);
      document.getElementById('qtyValue').textContent = quantity;
      updatePrice();
    }
    
    function updatePrice() {
      document.getElementById('currentPrice').textContent = '$' + parseFloat(selectedVariant.price).toFixed(2);
      const btn = document.getElementById('addBtn');
      if (!selectedVariant.in_stock) {
        btn.disabled = true;
        btn.textContent = 'Sold Out';
      } else if (!selectedVariant.product_url) {
        btn.disabled = true;
        btn.textContent = 'Temporarily Unavailable';
      } else {
        btn.disabled = false;
        btn.textContent = 'Add to Cart — $' + (parseFloat(selectedVariant.price) * quantity).toFixed(2);
      }
    }
    
    function addToCart() {
      if (!selectedVariant || !selectedVariant.in_stock || !selectedVariant.product_url) return;
      
      for (let i = 0; i < quantity; i++) {
        const existing = cart.find(item => item.id === selectedVariant.id);
        if (existing) {
          existing.qty++;
        } else {
          cart.push({
            id: selectedVariant.id,
            productId: selectedVariant.id,
            name: selectedVariant.name,
            price: parseFloat(selectedVariant.price),
            image: selectedVariant.image_url,
            roaster: product.shops?.name,
            shop_id: selectedVariant.shop_id,
            size: selectedVariant.size,
            grind: selectedVariant.grind_type,
            product_url: selectedVariant.product_url,
            qty: 1
          });
        }
      }
      
      localStorage.setItem('joe_cart', JSON.stringify(cart));
      renderCart();
      showToast('Added ' + quantity + 'x ' + selectedVariant.name + ' to cart');
      quantity = 1;
      document.getElementById('qtyValue').textContent = '1';
      updatePrice();
    }
    
    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
    
    function toggleCart() {
      document.getElementById('cartOverlay').classList.toggle('open');
    }
    
    function renderCart() {
      const itemsEl = document.getElementById('cartItems');
      const countEl = document.getElementById('cartCount');
      const totalEl = document.getElementById('cartTotal');
      const checkoutBtn = document.getElementById('checkoutBtn');
      
      const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
      const subtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
      
      countEl.textContent = totalQty;
      totalEl.textContent = '$' + subtotal.toFixed(2);
      checkoutBtn.disabled = cart.length === 0;
      
      if (cart.length === 0) {
        itemsEl.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
        return;
      }
      
      itemsEl.innerHTML = cart.map(item => \`
        <div class="cart-item">
          \${item.image 
            ? \`<img src="\${item.image}" alt="\${item.name}" class="cart-item-image">\`
            : \`<div class="cart-item-image" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;">☕</div>\`
          }
          <div class="cart-item-info">
            <div class="cart-item-name">\${item.name}</div>
            <div class="cart-item-variant">\${[item.size, GRIND_LABELS[item.grind] || item.grind].filter(Boolean).join(' • ')}</div>
            <div class="cart-item-price">$\${(item.price * item.qty).toFixed(2)} × \${item.qty}</div>
          </div>
        </div>
      \`).join('');
    }
    
    async function checkout() {
      const checkoutBtn = document.getElementById('checkoutBtn');
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Processing...';
      
      try {
        const res = await fetch('/.netlify/functions/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cart })
        });
        
        const { sessionId, error } = await res.json();
        if (error) throw new Error(error);
        
        const result = await stripe.redirectToCheckout({ sessionId });
        if (result.error) throw new Error(result.error.message);
      } catch (err) {
        alert('Checkout error: ' + err.message);
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Checkout';
      }
    }
    
    renderCart();
  </script>
  <script src="/includes/tracking.js"></script>
</body>
</html>`;
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').trim();
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function redirect(url) {
  return { statusCode: 301, headers: { Location: url }, body: '' };
}

function notFound() {
  return { 
    statusCode: 404, 
    headers: { 'Content-Type': 'text/html' }, 
    body: `<!DOCTYPE html>
<html><head><title>Product Not Found | joe</title></head>
<body style="font-family:system-ui;padding:4rem;text-align:center">
<h1>Product not found</h1>
<p><a href="/marketplace/">Browse all products →</a></p>
</body></html>` 
  };
}

function error500() {
  return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<h1>Server error</h1>' };
}
