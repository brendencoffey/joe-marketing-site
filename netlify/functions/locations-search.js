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

    // Search for exact city match first
    const { data: cityMatch } = await supabase
      .from('shops')
      .select('city, city_slug, state_code')
      .ilike('city', q)
      .not('state_code', 'is', null)
      .limit(1);

    if (cityMatch && cityMatch.length > 0) {
      const { city_slug, state_code } = cityMatch[0];
      return redirect(`/locations/${state_code.toLowerCase()}/${city_slug}/`);
    }

    // Search for partial city match
    const { data: partialCity } = await supabase
      .from('shops')
      .select('city, city_slug, state_code')
      .ilike('city', `%${q}%`)
      .not('state_code', 'is', null)
      .limit(1);

    if (partialCity && partialCity.length > 0) {
      const { city_slug, state_code } = partialCity[0];
      return redirect(`/locations/${state_code.toLowerCase()}/${city_slug}/`);
    }

    // Search for shop name
    const { data: shopMatch } = await supabase
      .from('shops')
      .select('slug, city_slug, state_code, name')
      .ilike('name', `%${q}%`)
      .not('state_code', 'is', null)
      .limit(10);

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
    <h1>Results for "${query}"</h1>
    <div class="results">
      ${results}
    </div>
    <a href="/locations/" class="back-link">← Browse all locations</a>
  </main>
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