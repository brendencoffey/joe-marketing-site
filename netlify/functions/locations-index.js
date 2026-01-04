/**
 * Locations Index - All States & Cities Directory
 * SEO-optimized page with all locations
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
    // Get all shops with location data
    const { data: shops, error } = await supabase
      .from('shops')
      .select('state_code, city, city_slug')
      .not('state_code', 'is', null)
      .not('city', 'is', null);

    if (error) throw error;

    // Aggregate by state and city
    const stateData = {};
    (shops || []).forEach(shop => {
      const state = shop.state_code.toUpperCase();
      if (!stateData[state]) {
        stateData[state] = { count: 0, cities: {} };
      }
      stateData[state].count++;
      
      const cityKey = `${shop.city}|${shop.city_slug}`;
      if (!stateData[state].cities[cityKey]) {
        stateData[state].cities[cityKey] = 0;
      }
      stateData[state].cities[cityKey]++;
    });

    // Sort states alphabetically
    const sortedStates = Object.keys(stateData)
      .filter(s => stateNames[s])
      .sort((a, b) => stateNames[a].localeCompare(stateNames[b]));

    const totalShops = shops?.length || 0;
    const totalCities = Object.values(stateData).reduce((sum, s) => sum + Object.keys(s.cities).length, 0);

    const html = renderPage(sortedStates, stateData, totalShops, totalCities);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8', 
        'Cache-Control': 'public, max-age=3600' 
      },
      body: html
    };
  } catch (err) {
    console.error('Locations index error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: '<h1>Server error</h1>'
    };
  }
};

function renderPage(sortedStates, stateData, totalShops, totalCities) {
  const stateCards = sortedStates.map(state => {
    const data = stateData[state];
    const cities = Object.entries(data.cities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cityKey, count]) => {
        const [city, slug] = cityKey.split('|');
        return `<a href="/locations/${state.toLowerCase()}/${slug}/" class="city-link">${city} <span>(${count})</span></a>`;
      }).join('');
    
    const moreCount = Object.keys(data.cities).length - 8;
    const moreLink = moreCount > 0 
      ? `<a href="/locations/${state.toLowerCase()}/" class="more-link">+${moreCount} more cities</a>` 
      : '';

    return `
      <div class="state-card">
        <a href="/locations/${state.toLowerCase()}/" class="state-header">
          <h2>${stateNames[state]}</h2>
          <span class="shop-count">${data.count.toLocaleString()} shops</span>
        </a>
        <div class="city-list">
          ${cities}
          ${moreLink}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Find Coffee Shops by State & City | joe</title>
  <meta name="description" content="Browse ${totalShops.toLocaleString()} coffee shops across ${sortedStates.length} states and ${totalCities.toLocaleString()} cities. Find local cafes, order ahead, and earn rewards.">
  <link rel="canonical" href="https://joe.coffee/locations/">
  <link rel="icon" type="image/png" href="/images/logo.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
      background: #FAFAFA; 
      color: #111; 
      line-height: 1.5;
    }
    
    /* Header */
    .header { 
      background: #fff; 
      border-bottom: 1px solid #eee; 
      padding: 16px 24px; 
      position: sticky; 
      top: 0; 
      z-index: 100; 
    }
    .header-inner { 
      max-width: 1200px; 
      margin: 0 auto; 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
    }
    .logo img { height: 40px; }
    .nav { display: flex; gap: 24px; align-items: center; }
    .nav a { color: #666; text-decoration: none; font-size: 14px; font-weight: 500; }
    .nav a:hover { color: #000; }
    .btn-primary { 
      background: #000; 
      color: #fff !important; 
      padding: 10px 20px; 
      border-radius: 8px; 
    }
    .btn-primary:hover { background: #333; }
    
    /* Hero */
    .hero {
      background: linear-gradient(135deg, #111 0%, #333 100%);
      color: #fff;
      padding: 60px 24px;
      text-align: center;
    }
    .hero h1 { font-size: 42px; font-weight: 700; margin-bottom: 12px; }
    .hero p { font-size: 18px; opacity: 0.9; }
    .stats { 
      display: flex; 
      justify-content: center; 
      gap: 48px; 
      margin-top: 32px; 
    }
    .stat-number { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 14px; opacity: 0.8; }
    
    /* Main Content */
    .container { 
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 48px 24px; 
    }
    
    /* State Grid */
    .states-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }
    
    .state-card {
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      overflow: hidden;
      transition: box-shadow 0.2s;
    }
    .state-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    
    .state-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #f9f9f9;
      border-bottom: 1px solid #eee;
      text-decoration: none;
      color: inherit;
    }
    .state-header:hover { background: #f0f0f0; }
    .state-header h2 { font-size: 18px; font-weight: 600; }
    .shop-count { 
      font-size: 13px; 
      color: #666; 
      background: #fff;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid #e5e5e5;
    }
    
    .city-list {
      padding: 16px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .city-link {
      font-size: 14px;
      color: #333;
      text-decoration: none;
      padding: 6px 12px;
      background: #f5f5f5;
      border-radius: 6px;
      transition: background 0.2s;
    }
    .city-link:hover { background: #e5e5e5; }
    .city-link span { color: #999; font-size: 12px; }
    
    .more-link {
      font-size: 14px;
      color: #666;
      text-decoration: none;
      padding: 6px 12px;
      font-weight: 500;
    }
    .more-link:hover { color: #000; text-decoration: underline; }
    
    /* Footer */
    .footer {
      background: #111;
      color: #fff;
      padding: 40px 24px;
      text-align: center;
      margin-top: 48px;
    }
    .footer a { color: #888; text-decoration: none; margin: 0 12px; }
    .footer a:hover { color: #fff; }
    .footer-bottom { margin-top: 24px; color: #666; font-size: 14px; }
    
    /* Breadcrumb */
    .breadcrumb {
      padding: 16px 24px;
      background: #fff;
      border-bottom: 1px solid #eee;
    }
    .breadcrumb-inner {
      max-width: 1200px;
      margin: 0 auto;
      font-size: 14px;
      color: #666;
    }
    .breadcrumb a { color: #666; text-decoration: none; }
    .breadcrumb a:hover { color: #000; }
    
    @media (max-width: 768px) {
      .hero h1 { font-size: 28px; }
      .stats { gap: 24px; }
      .stat-number { font-size: 22px; }
      .states-grid { grid-template-columns: 1fr; }
    }
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

  <div class="breadcrumb">
    <div class="breadcrumb-inner">
      <a href="/">Home</a> / <strong>All Locations</strong>
    </div>
  </div>

  <section class="hero">
    <h1>Coffee Shops by Location</h1>
    <p>Browse independent coffee shops across the United States</p>
    <div class="stats">
      <div>
        <div class="stat-number">${totalShops.toLocaleString()}</div>
        <div class="stat-label">Coffee Shops</div>
      </div>
      <div>
        <div class="stat-number">${sortedStates.length}</div>
        <div class="stat-label">States</div>
      </div>
      <div>
        <div class="stat-number">${totalCities.toLocaleString()}</div>
        <div class="stat-label">Cities</div>
      </div>
    </div>
  </section>

  <main class="container">
    <div class="states-grid">
      ${stateCards}
    </div>
  </main>

  <footer id="site-footer"></footer>
  <script src="/includes/footer-loader.js"></script>
</body>
</html>`;
}
