/**
 * Location Page - Rich Layout
 * Server-Side Rendered with full shop details
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const path = event.path || event.rawUrl || ""; const parts = path.replace("/.netlify/functions/location-page", "").replace("/locations/", "").split("/").filter(Boolean); const state = parts[0] || event.queryStringParameters?.state; const city = parts[1] || event.queryStringParameters?.city; const slug = parts[2] || event.queryStringParameters?.slug;
    if (!slug) return redirect('/locations/');

    const stateCode = (state || '').toLowerCase();
    const citySlug = (city || '').toLowerCase();

    let query = supabase.from('shops').select('*').eq('slug', slug);
    if (stateCode) query = query.ilike('state_code', stateCode);
    if (citySlug) query = query.ilike('city_slug', citySlug);
    
    const { data: shop, error } = await query.single();
    if (error || !shop) return notFound();

    const isPartner = shop.is_partner || !!shop.partner_id;
    let partner = null;
    if (shop.partner_id) {
      const { data: p } = await supabase.from('partners').select('id, name, slug, store_id').eq('id', shop.partner_id).single();
      partner = p;
    }

    trackPageView(shop.id, event);
    const html = renderLocationPage(shop, partner, isPartner);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      body: html
    };
  } catch (err) {
    console.error('Location page error:', err);
    return error500();
  }
};

function renderLocationPage(shop, partner, isPartner) {
  const stateCode = (shop.state_code || 'us').toLowerCase();
  const citySlug = shop.city_slug || slugify(shop.city || 'unknown');
  const stateName = getStateName(stateCode);
  const canonicalUrl = `https://joe.coffee/locations/${stateCode}/${citySlug}/${shop.slug}/`;
  
  const hours = parseHours(shop.hours);
  const isOpen = checkIfOpen(hours);
  const photos = shop.photos?.length ? shop.photos : [];
  const amenities = shop.amenities || [];
  const rating = shop.combined_rating || shop.google_rating;
  const reviewCount = (shop.google_review_count || 0) + (shop.yelp_review_count || 0);
  const priceRange = shop.price_range || shop.yelp_price || '$$';
  const description = shop.description || shop.about_text || `Coffee shop in ${shop.city}, ${shop.state}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(shop.name)} - ${esc(shop.city)}, ${esc(shop.state)} | joe coffee</title>
  <meta name="description" content="${esc(shop.name)} in ${esc(shop.city)}. ${rating ? rating + ' stars. ' : ''}${isPartner ? 'Order ahead with joe.' : 'Find hours and location.'}">
  <link rel="canonical" href="${canonicalUrl}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--black:#000;--white:#fff;--gray-50:#F9FAFB;--gray-100:#F3F4F6;--gray-200:#E5E7EB;--gray-300:#D1D5DB;--gray-400:#9CA3AF;--gray-500:#6B7280;--gray-600:#4B5563;--gray-700:#374151;--gray-800:#1F2937;--gray-900:#111827;--green-500:#22C55E;--green-600:#16A34A;--amber-500:#F59E0B;--red-500:#EF4444}
    html{scroll-behavior:smooth}body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--gray-50);color:var(--gray-900);line-height:1.6}a{color:inherit;text-decoration:none}
    .header{position:sticky;top:0;z-index:100;background:var(--white);border-bottom:1px solid var(--gray-200)}
    .header-inner{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    .logo{display:flex;align-items:center}.logo img{height:40px}
    .nav{display:flex;align-items:center;gap:2.5rem}.nav a{font-size:.95rem;font-weight:500;color:var(--gray-700)}.nav a:hover{color:var(--black)}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.75rem 1.5rem;border-radius:8px;font-weight:600;font-size:.95rem;cursor:pointer;border:none;transition:all .2s}
    .btn-primary{background:var(--black);color:var(--white) !important}.btn-primary:hover{background:var(--gray-800)}
    .btn-outline{background:var(--white);color:var(--gray-900);border:1px solid var(--gray-300)}.btn-outline:hover{background:var(--gray-50)}
    .btn-green{background:var(--green-600);color:var(--white) !important}.btn-green:hover{background:var(--green-500)}
    .breadcrumb{max-width:1280px;margin:0 auto;padding:1rem 1.5rem;font-size:.875rem;color:var(--gray-500);background:var(--white)}
    .breadcrumb a{color:var(--gray-600);font-weight:500}.breadcrumb a:hover{color:var(--gray-900)}.breadcrumb span{margin:0 .5rem;color:var(--gray-400)}
    .main{max-width:1280px;margin:0 auto;padding:1.5rem}
    .layout{display:grid;grid-template-columns:1fr 380px;gap:1.5rem}
    .photo-gallery{display:grid;grid-template-columns:1.5fr 1fr;gap:.5rem;border-radius:16px;overflow:hidden;margin-bottom:1.5rem;background:var(--gray-200)}
    .photo-main{grid-row:span 2}.photo-gallery img{width:100%;height:100%;object-fit:cover;display:block}.photo-main img{height:400px}.photo-small img{height:198px}
    .no-photos{grid-column:span 2;height:300px;display:flex;align-items:center;justify-content:center;background:var(--gray-100);color:var(--gray-400);font-size:4rem}
    .card{background:var(--white);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .card-title{display:flex;align-items:center;gap:.75rem;font-size:1.25rem;font-weight:600;margin-bottom:1rem}.card-title svg{width:24px;height:24px;color:var(--gray-600)}
    .sidebar{position:sticky;top:100px;align-self:start}
    .sidebar-header{background:var(--white);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .neighborhood-badge{display:inline-flex;align-items:center;gap:.375rem;padding:.375rem .75rem;background:var(--gray-100);border-radius:100px;font-size:.875rem;font-weight:500;margin-bottom:1rem}
    .shop-name{font-size:2rem;font-weight:700;line-height:1.2;margin-bottom:.25rem}.shop-location{color:var(--gray-500);margin-bottom:1rem}
    .rating-row{display:flex;align-items:center;gap:.5rem;margin-bottom:1.5rem;flex-wrap:wrap}
    .stars{color:var(--amber-500);font-size:1.125rem}.rating-score{font-weight:700}.rating-count{color:var(--gray-500)}.price-range{color:var(--gray-600);font-weight:500}
    .sidebar-buttons{display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.5rem}.sidebar-buttons .btn{width:100%;padding:.875rem}
    .status-row{display:flex;align-items:center;gap:1.5rem;padding-top:1rem;border-top:1px solid var(--gray-100);font-size:.95rem;flex-wrap:wrap}
    .status-item{display:flex;align-items:center;gap:.5rem;color:var(--gray-600)}
    .status-open{color:var(--green-600);font-weight:500}.status-closed{color:var(--red-500);font-weight:500}
    .map-card{background:var(--white);border-radius:16px;overflow:hidden;margin-bottom:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .map-placeholder{height:180px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;color:var(--gray-500);font-size:.875rem}
    .map-info{padding:1.25rem}.map-address{font-size:1rem;font-weight:500;margin-bottom:.25rem}.map-city{color:var(--gray-500);font-size:.95rem;margin-bottom:1rem}
    .map-buttons{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.map-buttons .btn{padding:.75rem;font-size:.875rem}
    .contact-card{background:var(--white);border-radius:16px;padding:1.25rem;margin-bottom:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .contact-item{display:flex;align-items:flex-start;gap:.75rem;padding:.75rem 0;border-bottom:1px solid var(--gray-100)}
    .contact-item:last-child{border-bottom:none;padding-bottom:0}.contact-item:first-child{padding-top:0}
    .contact-icon{width:20px;height:20px;color:var(--gray-500);flex-shrink:0;margin-top:2px}
    .contact-label{font-size:.75rem;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.125rem}
    .contact-value{font-weight:500;color:var(--gray-900)}.contact-value a{color:var(--gray-900)}.contact-value a:hover{text-decoration:underline}
    .social-links{display:flex;gap:1rem;padding-top:1rem;border-top:1px solid var(--gray-100);margin-top:.5rem}
    .social-links a{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:var(--gray-600);transition:all .2s}
    .social-links a:hover{background:var(--gray-100);color:var(--gray-900)}
    .claim-card{background:var(--gray-900);border-radius:16px;padding:1.5rem;color:var(--white);text-align:center}
    .claim-card h3{font-size:1.125rem;font-weight:600;margin-bottom:.5rem}.claim-card p{color:var(--gray-400);font-size:.95rem;margin-bottom:1.25rem;line-height:1.5}
    .claim-card .btn{background:var(--white);color:var(--gray-900);width:100%}.claim-card .btn:hover{background:var(--gray-100)}
    .about-text{color:var(--gray-700);line-height:1.8}.about-text p{margin-bottom:1rem}.about-text p:last-child{margin-bottom:0}
    .hours-list{display:flex;flex-direction:column}.hours-row{display:flex;justify-content:space-between;padding:.75rem 0;border-bottom:1px solid var(--gray-100)}.hours-row:last-child{border-bottom:none}
    .hours-day{font-weight:500}.hours-day.today{color:var(--green-600)}.hours-time{color:var(--gray-600)}
    .amenities-grid{display:flex;flex-wrap:wrap;gap:.75rem}
    .amenity-tag{display:inline-flex;align-items:center;gap:.5rem;padding:.5rem 1rem;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:100px;font-size:.875rem;font-weight:500;color:var(--gray-700)}
    .amenity-tag svg{width:16px;height:16px;color:var(--green-600)}
    .partner-badge{display:inline-flex;align-items:center;gap:.25rem;background:var(--green-600);color:var(--white);padding:.25rem .75rem;border-radius:100px;font-size:.75rem;font-weight:600}
    .footer{background:var(--gray-50);padding:3rem 1.5rem 1.5rem;margin-top:3rem;border-top:1px solid var(--gray-200)}
    .footer-inner{max-width:1280px;margin:0 auto;text-align:center;color:var(--gray-500);font-size:.875rem}
    .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;padding:1rem}
    .modal-overlay.active{display:flex}
    .modal{background:var(--white);border-radius:16px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;position:relative}
    .modal-header{padding:1.5rem 1.5rem 0}.modal-header h2{font-size:1.5rem;font-weight:700;margin-bottom:.5rem}.modal-header p{color:var(--gray-600)}
    .modal-body{padding:1.5rem}
    .form-group{margin-bottom:1rem}.form-group label{display:block;font-size:.875rem;font-weight:500;margin-bottom:.375rem}
    .form-group input,.form-group select{width:100%;padding:.75rem;border:1px solid var(--gray-300);border-radius:8px;font-size:1rem;font-family:inherit}
    .form-group input:focus,.form-group select:focus{outline:none;border-color:var(--gray-900);box-shadow:0 0 0 3px rgba(0,0,0,.05)}
    .form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
    .modal-footer{padding:0 1.5rem 1.5rem;display:flex;gap:.75rem}.modal-footer .btn{flex:1}
    .close-btn{position:absolute;top:1rem;right:1rem;width:36px;height:36px;border-radius:50%;border:none;background:var(--gray-100);cursor:pointer;font-size:1.25rem}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}.sidebar{position:static}.photo-gallery{grid-template-columns:1fr 1fr}.photo-main{grid-row:span 1}.photo-main img,.photo-small img{height:200px}}
    @media(max-width:768px){.nav{display:none}.photo-gallery{grid-template-columns:1fr}.photo-small{display:none}.form-row{grid-template-columns:1fr}}
  </style>
<link rel="stylesheet" href="/includes/footer.css"></head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Coffee Shops</a>
        <a href="/about/">About</a>
        <a href="https://get.joe.coffee" class="btn btn-primary">Get the App</a>
      </nav>
    </div>
  </header>
  
  <div class="breadcrumb">
    <a href="/">Home</a><span>›</span>
    <a href="/locations/">Locations</a><span>›</span>
    <a href="/locations/${stateCode}/">${esc(stateName)}</a><span>›</span>
    <a href="/locations/${stateCode}/${citySlug}/">${esc(shop.city)}</a><span>›</span>
    ${esc(shop.name)}
  </div>
  
  <main class="main">
    <div class="layout">
      <div class="content">
        <div class="photo-gallery">
          ${photos.length >= 3 ? `
          <div class="photo-main"><img src="${photos[0]}" alt="${esc(shop.name)}" loading="lazy"></div>
          <div class="photo-small"><img src="${photos[1]}" alt="${esc(shop.name)}" loading="lazy"></div>
          <div class="photo-small"><img src="${photos[2]}" alt="${esc(shop.name)}" loading="lazy"></div>
          ` : photos.length > 0 ? `
          <div class="photo-main" style="grid-column:span 2"><img src="${photos[0]}" alt="${esc(shop.name)}" loading="lazy"></div>
          ` : `<div class="no-photos">☕</div>`}
        </div>
        
        <div class="card">
          <h2 class="card-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>About</h2>
          <div class="about-text"><p>${esc(description)}</p></div>
        </div>
        
        ${hours ? `
        <div class="card">
          <h2 class="card-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Hours</h2>
          <div class="hours-list">${renderHours(hours)}</div>
        </div>` : ''}
        
        ${amenities.length > 0 ? `
        <div class="card">
          <h2 class="card-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Amenities</h2>
          <div class="amenities-grid">${amenities.map(a => `<span class="amenity-tag"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>${esc(a)}</span>`).join('')}</div>
        </div>` : ''}
      </div>
      
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="neighborhood-badge"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>${esc(shop.city)}</div>
          <h1 class="shop-name">${esc(shop.name)}</h1>
          <p class="shop-location">${esc(shop.city)}, ${esc(stateName)}</p>
          ${rating ? `<div class="rating-row"><span class="stars">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5-Math.round(rating))}</span><span class="rating-score">${rating}</span>${reviewCount ? `<span class="rating-count">(${reviewCount} reviews)</span>` : ''}<span class="price-range">${esc(priceRange)}</span></div>` : ''}
          <div class="sidebar-buttons">
            ${isPartner ? `<a href="https://shop.joe.coffee/explore/stores/${partner?.store_id || ''}" class="btn btn-green"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>Order with joe</a>` : `
            ${shop.website ? `<a href="${esc(shop.website)}" class="btn btn-outline" target="_blank"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>Visit Website</a>` : ''}
            <button class="btn btn-primary" onclick="openClaimModal()"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Claim This Listing</button>`}
          </div>
          <div class="status-row">
            <div class="status-item"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="${isOpen ? 'status-open' : 'status-closed'}">${isOpen ? 'Open' : 'Closed'}</span></div>
            ${isPartner ? `<span class="partner-badge">☕ joe Partner</span>` : ''}
          </div>
        </div>
        
        <div class="map-card">
          <div class="map-placeholder">📍 ${shop.latitude ? shop.latitude.toFixed(4) + ', ' + shop.longitude.toFixed(4) : 'Map'}</div>
          <div class="map-info">
            <p class="map-address">${esc(shop.address)}</p>
            <p class="map-city">${esc(shop.city)}, ${esc(shop.state)} ${esc(shop.zip || '')}</p>
            <div class="map-buttons">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${shop.latitude || ''},${shop.longitude || ''}" class="btn btn-outline" target="_blank" onclick="trackClick('directions')"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>Directions</a>
              ${shop.phone ? `<a href="tel:${shop.phone}" class="btn btn-outline" onclick="trackClick('phone')"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>Call</a>` : ''}
            </div>
          </div>
        </div>
        
        ${!isPartner ? `
        <div class="claim-card">
          <h3>Own this business?</h3>
          <p>Claim your listing to update information and access joe's tools for coffee shops.</p>
          <button class="btn" onclick="openClaimModal()"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Claim Your Listing</button>
        </div>` : ''}
      </div>
    </div>
  </main>
  
  <footer id="site-footer"></footer><script src="/includes/footer-loader.js"></script>
  
  ${!isPartner ? `
  <div class="modal-overlay" id="claimModal">
    <div class="modal">
      <button class="close-btn" onclick="closeClaimModal()">✕</button>
      <div class="modal-header"><h2>Claim Your Listing</h2><p>Tell us about yourself and we'll verify your ownership of ${esc(shop.name)}.</p></div>
      <form id="claimForm" class="modal-body">
        <input type="hidden" name="shop_id" value="${shop.id}">
        <input type="hidden" name="shop_name" value="${esc(shop.name)}">
        <div class="form-row"><div class="form-group"><label>First Name *</label><input type="text" name="first_name" required></div><div class="form-group"><label>Last Name *</label><input type="text" name="last_name" required></div></div>
        <div class="form-group"><label>Email *</label><input type="email" name="email" required></div>
        <div class="form-group"><label>Phone</label><input type="tel" name="phone"></div>
        <div class="form-group"><label>Your Role *</label><select name="role" required><option value="">Select...</option><option value="owner">Owner</option><option value="manager">Manager</option><option value="marketing">Marketing</option><option value="other">Other</option></select></div>
        <div class="modal-footer" style="padding:0"><button type="button" class="btn btn-outline" onclick="closeClaimModal()">Cancel</button><button type="submit" class="btn btn-primary">Submit</button></div>
      </form>
    </div>
  </div>
  <script>
    function openClaimModal(){document.getElementById('claimModal').classList.add('active');document.body.style.overflow='hidden';trackClick('claim');}
    function closeClaimModal(){document.getElementById('claimModal').classList.remove('active');document.body.style.overflow='';}
    document.getElementById('claimModal').addEventListener('click',function(e){if(e.target===this)closeClaimModal();});
    document.getElementById('claimForm').addEventListener('submit',async function(e){
      e.preventDefault();const data=Object.fromEntries(new FormData(this));const btn=this.querySelector('button[type="submit"]');btn.textContent='Submitting...';btn.disabled=true;
      try{const res=await fetch('/api/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(res.ok){alert('Thanks! We\\'ll be in touch within 1-2 business days.');closeClaimModal();}else throw new Error();}
      catch(err){alert('Something went wrong. Please email hello@joe.coffee');btn.textContent='Submit';btn.disabled=false;}
    });
  </script>` : ''}
  <script>function trackClick(type){fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop_id:'${shop.id}',type:'click_'+type})}).catch(()=>{});}</script>
</body>
</html>`;
}

function parseHours(h){if(!h)return null;try{return typeof h==='string'?JSON.parse(h):h;}catch{return null;}}
function renderHours(hours){if(!hours)return'';const days=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];const names=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];const today=days[new Date().getDay()===0?6:new Date().getDay()-1];return days.map((d,i)=>`<div class="hours-row"><span class="hours-day ${d===today?'today':''}">${names[i]}</span><span class="hours-time">${hours[d]||'Closed'}</span></div>`).join('');}
function checkIfOpen(hours){if(!hours)return false;const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];const today=days[new Date().getDay()];const t=hours[today];return t&&t.toLowerCase()!=='closed';}
function slugify(s){return(s||'').toLowerCase().replace(/['']/g,'').replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function getStateName(c){const s={'al':'Alabama','ak':'Alaska','az':'Arizona','ar':'Arkansas','ca':'California','co':'Colorado','ct':'Connecticut','de':'Delaware','fl':'Florida','ga':'Georgia','hi':'Hawaii','id':'Idaho','il':'Illinois','in':'Indiana','ia':'Iowa','ks':'Kansas','ky':'Kentucky','la':'Louisiana','me':'Maine','md':'Maryland','ma':'Massachusetts','mi':'Michigan','mn':'Minnesota','ms':'Mississippi','mo':'Missouri','mt':'Montana','ne':'Nebraska','nv':'Nevada','nh':'New Hampshire','nj':'New Jersey','nm':'New Mexico','ny':'New York','nc':'North Carolina','nd':'North Dakota','oh':'Ohio','ok':'Oklahoma','or':'Oregon','pa':'Pennsylvania','ri':'Rhode Island','sc':'South Carolina','sd':'South Dakota','tn':'Tennessee','tx':'Texas','ut':'Utah','vt':'Vermont','va':'Virginia','wa':'Washington','wv':'West Virginia','wi':'Wisconsin','wy':'Wyoming','dc':'Washington D.C.'};return s[c?.toLowerCase()]||c?.toUpperCase();}
function redirect(url){return{statusCode:301,headers:{Location:url},body:''};}
function notFound(){return{statusCode:404,headers:{'Content-Type':'text/html'},body:'<h1>Shop not found</h1><p><a href="/locations/">Browse all locations</a></p>'};}
function error500(){return{statusCode:500,headers:{'Content-Type':'text/html'},body:'<h1>Server error</h1>'};}
async function trackPageView(shopId,event){try{await supabase.from('website_activity').insert({shop_id:shopId,activity_type:'page_view',metadata:{user_agent:event.headers?.['user-agent'],referer:event.headers?.['referer']}});}catch{}}
