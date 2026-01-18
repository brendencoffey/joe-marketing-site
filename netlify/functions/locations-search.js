/**
 * Locations Search
 * Searches cities and shops, redirects or shows results
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const stateNames = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'Washington DC'
};

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters?.q?.trim().toLowerCase();
    
    if (!q) {
      return redirect('/locations/');
    }

    // Single combined search query
    const { data: results } = await supabase
      .from('shops')
      .select('slug, city, city_slug, state_code, name')
      .not('state_code', 'is', null)
      .or(`city.ilike.${q},city.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(10);

    if (results && results.length > 0) {
      // Exact city match takes priority - redirect to city page
      const exactCity = results.find(r => r.city?.toLowerCase() === q);
      if (exactCity) {
        return redirect(`/locations/${exactCity.state_code.toLowerCase()}/${exactCity.city_slug}/`);
      }
      
      // Partial city match - redirect to city page
      const cityMatch = results.find(r => r.city?.toLowerCase().includes(q));
      if (cityMatch) {
        return redirect(`/locations/${cityMatch.state_code.toLowerCase()}/${cityMatch.city_slug}/`);
      }

      // Single shop result - redirect directly
      if (results.length === 1) {
        const shop = results[0];
        return redirect(`/locations/${shop.state_code.toLowerCase()}/${shop.city_slug}/${shop.slug}/`);
      }

      // Multiple shop results - show search results page
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: renderSearchResults(q, results)
      };
    }

    if (shopMatch && shopMatch.length === 1) {
      // Single result - redirect directly
      const shop = shopMatch[0];
      return redirect(`/locations/${shop.state_code.toLowerCase()}/${shop.city_slug}/${shop.slug}/`);
    }

    if (shopMatch && shopMatch.length > 1) {
      // Multiple results - show search results page
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: renderSearchResults(q, shopMatch)
      };
    }

    // No results
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: renderNoResults(q)
    };

  } catch (err) {
    console.error('Search error:', err);
    return redirect('/locations/');
  }
};

function redirect(url) {
  return { statusCode: 302, headers: { Location: url }, body: '' };
}

function renderSearchResults(query, shops) {
  const results = shops.map(shop => `
    <a href="/locations/${shop.state_code.toLowerCase()}/${shop.city_slug}/${shop.slug}/" class="result-card">
      <div class="result-name">${shop.name}</div>
      <div class="result-location">${shop.city_slug.replace(/-/g, ' ')}, ${shop.state_code.toUpperCase()}</div>
    </a>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search Results for "${query}" | joe</title>
  <link rel="icon" type="image/png" href="/images/logo.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #fafafa; color: #111; }
    .header { background: #fff; border-bottom: 1px solid #eee; padding: 16px 24px; }
    .header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .logo img { height: 40px; }
    .nav { display: flex; gap: 24px; align-items: center; }
    .nav a { color: #666; text-decoration: none; font-size: 14px; font-weight: 500; }
    .btn-primary { background: #000; color: #fff !important; padding: 10px 20px; border-radius: 8px; }
    .container { max-width: 800px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 28px; margin-bottom: 24px; }
    .results { display: flex; flex-direction: column; gap: 12px; }
    .result-card { background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px; text-decoration: none; color: inherit; transition: all 0.2s; }
    .result-card:hover { border-color: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .result-name { font-size: 18px; font-weight: 600; margin-bottom: 4px; text-transform: capitalize; }
    .result-location { font-size: 14px; color: #666; text-transform: capitalize; }
    .back-link { display: inline-block; margin-top: 24px; color: #666; text-decoration: none; }
    .back-link:hover { color: #000; }
  
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
<link rel="stylesheet" href="/includes/footer.css"></head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="btn-primary">Get the App</a>
      </nav>
      <button class="mobile-menu-btn" onclick="document.getElementById('mobileMenu').classList.add('open');document.getElementById('mobileOverlay').classList.add('open')">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>
  <main class="container">
    <h1>Results for "${query}"</h1>
    <div class="results">
      ${results}
    </div>
    <a href="/locations/" class="back-link">← Browse all locations</a>
  </main>

  <div id="mobileOverlay" class="mobile-overlay" onclick="document.getElementById('mobileMenu').classList.remove('open');this.classList.remove('open')"></div>
  <div id="mobileMenu" class="mobile-menu">
    <button class="mobile-menu-close" onclick="document.getElementById('mobileMenu').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('open')">&times;</button>
    <a href="/locations/">Find Coffee</a>
    <a href="/for-coffee-shops/">For Coffee Shops</a>
    <a href="/about/">About</a>
    <a href="https://get.joe.coffee">Get the App</a>
  </div>
  <footer id="site-footer"></footer><script src="/includes/footer-loader.js"></script></body>
</html>`;
}

function renderNoResults(query) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>No Results for "${query}" | joe</title>
  <link rel="icon" type="image/png" href="/images/logo.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #fafafa; color: #111; }
    .header { background: #fff; border-bottom: 1px solid #eee; padding: 16px 24px; }
    .header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .logo img { height: 40px; }
    .nav { display: flex; gap: 24px; align-items: center; }
    .nav a { color: #666; text-decoration: none; font-size: 14px; font-weight: 500; }
    .btn-primary { background: #000; color: #fff !important; padding: 10px 20px; border-radius: 8px; }
    .container { max-width: 800px; margin: 0 auto; padding: 48px 24px; text-align: center; }
    h1 { font-size: 28px; margin-bottom: 16px; }
    p { color: #666; margin-bottom: 24px; }
    .btn { display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; }
    .btn:hover { background: #333; }
  </style>
<link rel="stylesheet" href="/includes/footer.css"></head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/images/logo.png" alt="joe"></a>
      <nav class="nav">
        <a href="/locations/">Find Coffee</a>
        <a href="/for-coffee-shops/">For Shops</a>
        <a href="https://get.joe.coffee" class="btn-primary">Get the App</a>
      </nav>
    </div>
  </header>
  <main class="container">
    <h1>No results for "${query}"</h1>
    <p>We couldn't find any coffee shops matching your search. Try a different city or browse all locations.</p>
    <a href="/locations/" class="btn">Browse All Locations</a>
  </main>
<footer id="site-footer"></footer><script src="/includes/footer-loader.js"></script></body>
</html>`;
}