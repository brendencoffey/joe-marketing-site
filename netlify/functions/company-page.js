const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/company-page', '').replace('/companies/', '').replace(/\/$/, '');
  const slug = path.split('/').filter(Boolean)[0];

  if (!slug) {
    return { statusCode: 404, body: 'Company not found' };
  }

  // Get company
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !company) {
    return { statusCode: 404, body: 'Company not found' };
  }

  // Get all locations
  const { data: locations, error: locError } = await supabase
    .from('shops')
    .select('id, name, slug, address, city, state, state_code, city_slug, phone, website, google_rating, is_joe_partner, photos')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .order('state')
    .order('city');

   // Get products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, slug, price, image_url')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .order('name')
    .limit(12);

  const locationCount = locations?.length || 0;
  const productCount = products?.length || 0;
  // Group by states
  const byState = {};
  locations?.forEach(loc => {
    const st = loc.state || 'Unknown';
    if (!byState[st]) byState[st] = [];
    byState[st].push(loc);
  });

  const stateCount = Object.keys(byState).length;
  const partnerCount = locations?.filter(l => l.is_joe_partner).length || 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${company.name} - ${locationCount} Locations | joe coffee</title>
  <meta name="description" content="${company.description || `Find ${company.name} locations near you. ${locationCount} locations across ${stateCount} states.`}">
  <link rel="canonical" href="https://joe.coffee/companies/${slug}/">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #FAF9F6; color: #1a1a1a; }
    .header { background: #fff; border-bottom: 1px solid #e5e5e5; padding: 1rem 1.5rem; position: sticky; top: 0; z-index: 100; }
    .header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .logo { font-size: 1.5rem; font-weight: 700; text-decoration: none; color: #1a1a1a; }
    
    .hero { background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: white; padding: 3rem 1.5rem; }
    .hero-inner { max-width: 1200px; margin: 0 auto; }
    .hero h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    .hero-desc { font-size: 1.1rem; opacity: 0.9; margin-top: 1rem; max-width: 700px; line-height: 1.6; }
    .hero-stats { display: flex; gap: 2rem; margin-top: 1.5rem; flex-wrap: wrap; }
    .stat { text-align: center; }
    .stat-num { font-size: 2rem; font-weight: 700; }
    .stat-label { font-size: 0.875rem; opacity: 0.8; }
    
    .content { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    
    .section-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; }
    
    .products-section { margin-bottom: 3rem; }
    .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .product-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s; }
    .product-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .product-card img { width: 100%; height: 150px; object-fit: cover; }
    .product-card-body { padding: 1rem; }
    .product-card h4 { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.25rem; }
    .product-card .price { font-size: 0.875rem; color: #666; }
    .product-card a { text-decoration: none; color: inherit; }
    .view-all-btn { display: inline-block; margin-top: 1rem; background: #f5f5f5; color: #1a1a1a; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 500; text-decoration: none; }
    .view-all-btn:hover { background: #e5e5e5; }
    
    .search-box { padding: 0.75rem 1rem; border: 1px solid #e5e5e5; border-radius: 8px; width: 100%; max-width: 400px; font-size: 1rem; margin-bottom: 2rem; }
    
    .state-section { margin-bottom: 2rem; }
    .state-header { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #1a1a1a; }
    
    .locations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .location-card { background: white; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s; }
    .location-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .location-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
    .location-card h3 a { color: inherit; text-decoration: none; }
    .location-card h3 a:hover { text-decoration: underline; }
    .location-address { font-size: 0.875rem; color: #666; margin-bottom: 0.75rem; }
    .location-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .action-btn { padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 500; text-decoration: none; }
    .action-btn.primary { background: #1a1a1a; color: white; }
    .action-btn.secondary { background: #f5f5f5; color: #1a1a1a; }
    .partner-badge { display: inline-block; background: #22c55e; color: white; font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; }
    
    .claim-cta { background: white; border-radius: 12px; padding: 2rem; text-align: center; margin-top: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .claim-cta h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .claim-cta p { color: #666; margin-bottom: 1.5rem; }
    .claim-btn { display: inline-block; background: #1a1a1a; color: white; padding: 0.875rem 2rem; border-radius: 8px; font-weight: 600; text-decoration: none; }
    .claim-btn:hover { background: #333; }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">joe</a>
      <a href="/locations/" style="font-size:0.875rem;color:#666;text-decoration:none;">← All Locations</a>
    </div>
  </header>

  <div class="hero" style="${locations?.[0]?.photos?.[0] ? `background: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('${locations[0].photos[0]}'); background-size: cover; background-position: center;` : ''}">
    <div class="hero-inner">
      <h1>${company.name}</h1>
      ${company.website ? `<a href="${company.website}" target="_blank" style="color:#fff;opacity:0.8;font-size:0.875rem;">${company.website.replace(/https?:\/\//, '').replace(/\/$/, '')}</a>` : ''}
      ${company.description ? `<p class="hero-desc">${company.description}</p>` : ''}
      <div class="hero-stats">
        <div class="stat">
          <div class="stat-num">${locationCount}</div>
          <div class="stat-label">Locations</div>
        </div>
        <div class="stat">
          <div class="stat-num">${stateCount}</div>
          <div class="stat-label">States</div>
        </div>
        ${partnerCount > 0 ? `
        <div class="stat">
          <div class="stat-num">${partnerCount}</div>
          <div class="stat-label">joe Partners</div>
        </div>
        ` : ''}
        ${productCount > 0 ? `
        <div class="stat">
          <div class="stat-num">${productCount}+</div>
          <div class="stat-label">Products</div>
        </div>
        ` : ''}
      </div>
    </div>
  </div>

  <div class="content">
    ${productCount > 0 ? `
    <div class="products-section">
      <h2 class="section-title">Shop ${company.name} Products</h2>
      <div class="products-grid">
        ${products.map(p => `
          <div class="product-card">
            <a href="/marketplace/?company=${company.slug}">
              ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<div style="height:150px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#999;">No image</div>`}
              <div class="product-card-body">
                <h4>${p.name}</h4>
                ${p.price ? `<div class="price">$${(p.price / 100).toFixed(2)}</div>` : ''}
              </div>
            </a>
          </div>
        `).join('')}
      </div>
      <a href="/marketplace/?company=${company.slug}" class="view-all-btn">View All Products →</a>
    </div>
    ` : ''}

    <h2 class="section-title">${locationCount} Locations</h2>
    <input type="text" class="search-box" placeholder="Search by city or state..." id="searchBox" onkeyup="filterLocations()">
    
    <div id="locationsContainer">
      ${Object.entries(byState).sort().map(([state, locs]) => `
        <div class="state-section" data-state="${state}">
          <h2 class="state-header">${state} (${locs.length})</h2>
          <div class="locations-grid">
            ${locs.map(loc => `
              <div class="location-card" data-city="${loc.city?.toLowerCase() || ''}" data-state="${state.toLowerCase()}">
                ${loc.photos?.[0] ? `<img src="${loc.photos[0]}" alt="${loc.city}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:0.75rem;">` : ''}
                <h3>
                  <a href="/locations/${loc.state_code?.toLowerCase()}/${loc.city_slug}/${loc.slug}/">${loc.city || 'Location'}</a>
                  ${loc.is_joe_partner ? '<span class="partner-badge">joe Partner</span>' : ''}
                </h3>
                <div class="location-address">${loc.address || ''}</div>
                <div class="location-actions">
                  <a href="/locations/${loc.state_code?.toLowerCase()}/${loc.city_slug}/${loc.slug}/" class="action-btn primary">View</a>
                  ${loc.phone ? `<a href="tel:${loc.phone}" class="action-btn secondary">Call</a>` : ''}
                  ${loc.address ? `<a href="https://maps.google.com/?q=${encodeURIComponent(loc.address)}" target="_blank" class="action-btn secondary">Directions</a>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="claim-cta">
      <h2>Own or manage ${company.name}?</h2>
      <p>Claim your locations to update info, respond to customers, and enable mobile ordering.</p>
      <a href="/claim-company/?id=${company.id}" class="claim-btn">Claim All ${locationCount} Locations</a>
    </div>
  </div>

  <script>
    function filterLocations() {
      const query = document.getElementById('searchBox').value.toLowerCase();
      document.querySelectorAll('.location-card').forEach(card => {
        const city = card.dataset.city;
        const state = card.dataset.state;
        const match = city.includes(query) || state.includes(query);
        card.style.display = match ? '' : 'none';
      });
      document.querySelectorAll('.state-section').forEach(section => {
        const visible = section.querySelectorAll('.location-card:not([style*="none"])').length;
        section.style.display = visible > 0 ? '' : 'none';
      });
    }
  </script>
  <script src="/includes/tracking.js"></script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: html
  };
};