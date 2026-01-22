/**
 * Locations Search
 * Searches cities, shops, zip codes, and neighborhoods
 * Redirects or shows results
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
    const q = event.queryStringParameters?.q?.trim();
    
    if (!q) {
      return redirect('/locations/');
    }

    const searchTerm = q.toLowerCase();
    const isZipCode = /^\d{5}$/.test(q);

    // Check if searching for a zip code
    if (isZipCode) {
      const { data: zipResults } = await supabase
        .from('shops')
        .select('slug, city, city_slug, state_code, name, zip')
        .eq('zip', q)
        .not('state_code', 'is', null)
        .not('city_slug', 'is', null)
        .limit(20);

      if (zipResults && zipResults.length > 0) {
        // If all same city, redirect to city
        const cities = [...new Set(zipResults.map(r => r.city_slug))];
        if (cities.length === 1) {
          const shop = zipResults[0];
          return redirect(`/locations/${shop.state_code.toLowerCase()}/${shop.city_slug}/`);
        }
        // Multiple cities - show results
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          body: renderSearchResults(q, zipResults)
        };
      }
    }

    // Search by exact city name first
    const { data: exactCityMatch } = await supabase
      .from('shops')
      .select('slug, city, city_slug, state_code, name')
      .ilike('city', searchTerm)
      .not('state_code', 'is', null)
      .not('city_slug', 'is', null)
      .limit(1);

    if (exactCityMatch && exactCityMatch.length > 0) {
      const city = exactCityMatch[0];
      return redirect(`/locations/${city.state_code.toLowerCase()}/${city.city_slug}/`);
    }

    // Search by partial city, neighborhood, or shop name
    const { data: results } = await supabase
      .from('shops')
      .select('slug, city, city_slug, state_code, name, neighborhood, address')
      .not('state_code', 'is', null)
      .not('city_slug', 'is', null)
      .or(`city.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,neighborhood.ilike.%${searchTerm}%`)
      .limit(20);

    if (results && results.length > 0) {
      // Check for city match first
      const cityMatch = results.find(r => r.city?.toLowerCase().includes(searchTerm));
      if (cityMatch) {
        // If searching seems to be for a city (no results match name closely), redirect
        const nameMatches = results.filter(r => r.name?.toLowerCase().includes(searchTerm));
        if (nameMatches.length === 0) {
          return redirect(`/locations/${cityMatch.state_code.toLowerCase()}/${cityMatch.city_slug}/`);
        }
      }

      // Check for neighborhood match
      const neighborhoodMatch = results.find(r => r.neighborhood?.toLowerCase().includes(searchTerm));
      if (neighborhoodMatch && !results.some(r => r.name?.toLowerCase().includes(searchTerm))) {
        return redirect(`/locations/${neighborhoodMatch.state_code.toLowerCase()}/${neighborhoodMatch.city_slug}/`);
      }

      // Single shop result - redirect directly to shop page
      if (results.length === 1) {
        const shop = results[0];
        return redirect(`/locations/${shop.state_code.toLowerCase()}/${shop.city_slug}/${shop.slug}/`);
      }

      // Filter to prioritize name matches for display
      const nameMatches = results.filter(r => r.name?.toLowerCase().includes(searchTerm));
      const displayResults = nameMatches.length > 0 ? nameMatches : results;

      // Multiple results - show search results page
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: renderSearchResults(q, displayResults)
      };
    }

    // No results found
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
      <div class="result-name">${escapeHtml(shop.name)}</div>
      <div class="result-location">${escapeHtml(shop.city || shop.city_slug.replace(/-/g, ' '))}, ${shop.state_code.toUpperCase()}</div>
    </a>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search Results for "${escapeHtml(query)}" | joe</title>
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
    h1 { font-size: 28px; margin-bottom: 8px; }
    .result-count { color: #666; font-size: 14px; margin-bottom: 24px; }
    .results { display: flex; flex-direction: column; gap: 12px; }
    .result-card { background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px; text-decoration: none; color: inherit; transition: all 0.2s; }
    .result-card:hover { border-color: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .result-name { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    .result-location { font-size: 14px; color: #666; text-transform: capitalize; }
    .back-link { display: inline-block; margin-top: 24px; color: #666; text-decoration: none; }
    .back-link:hover { color: #000; }
    .search-again { margin-bottom: 32px; }
    .search-again form { display: flex; gap: 8px; max-width: 400px; }
    .search-again input { flex: 1; padding: 12px 16px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
    .search-again button { background: #000; color: #fff; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; }
  
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
  
  <main class="container">
    <h1>Results for "${escapeHtml(query)}"</h1>
    <p class="result-count">${shops.length} coffee shop${shops.length !== 1 ? 's' : ''} found</p>
    
    <div class="search-again">
      <form action="/locations/" method="get">
        <input type="text" name="q" placeholder="Search city, zip, or shop name..." value="${escapeHtml(query)}">
        <button type="submit">Search</button>
      </form>
    </div>
    
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
  <title>No Results for "${escapeHtml(query)}" | joe</title>
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
    .search-again { margin-bottom: 32px; }
    .search-again form { display: flex; gap: 8px; max-width: 400px; margin: 0 auto; }
    .search-again input { flex: 1; padding: 12px 16px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
    .search-again button { background: #000; color: #fff; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; }
    .btn { display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; }
    .btn:hover { background: #333; }
    .suggestions { margin-top: 32px; text-align: left; max-width: 400px; margin-left: auto; margin-right: auto; }
    .suggestions h3 { font-size: 16px; margin-bottom: 12px; }
    .suggestions ul { list-style: none; }
    .suggestions li { margin-bottom: 8px; }
    .suggestions a { color: #3b82f6; text-decoration: none; }
    .suggestions a:hover { text-decoration: underline; }
  </style>
<link rel="stylesheet" href="/includes/footer.css"></head>
<body>
  
  <main class="container">
    <h1>No results for "${escapeHtml(query)}"</h1>
    <p>We couldn't find any coffee shops matching your search.</p>
    
    <div class="search-again">
      <form action="/locations/" method="get">
        <input type="text" name="q" placeholder="Try a different search...">
        <button type="submit">Search</button>
      </form>
    </div>
    
    <a href="/locations/" class="btn">Browse All Locations</a>
    
    <div class="suggestions">
      <h3>Try searching for:</h3>
      <ul>
        <li>A city name (e.g., "Seattle", "Portland")</li>
        <li>A zip code (e.g., "98101")</li>
        <li>A coffee shop name</li>
        <li>A neighborhood (e.g., "Capitol Hill")</li>
      </ul>
    </div>
  </main>
<footer id="site-footer"></footer><script src="/includes/footer-loader.js"></script></body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}