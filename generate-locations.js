const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const DATA_FILE = './_data/shops.json';
const OUTPUT_DIR = './locations';

// State abbreviation to full name mapping
const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois',
  'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
  'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
  'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
  'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
  'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
  'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

// Zip code to state mapping (first 3 digits)
const ZIP_TO_STATE = {
  '980': 'WA', '981': 'WA', '982': 'WA', '983': 'WA', '984': 'WA', '985': 'WA', '986': 'WA', '987': 'WA', '988': 'WA', '989': 'WA', '990': 'WA', '991': 'WA', '992': 'WA', '993': 'WA', '994': 'WA', '995': 'WA', '996': 'WA', '997': 'WA', '998': 'WA', '999': 'WA',
  '970': 'OR', '971': 'OR', '972': 'OR', '973': 'OR', '974': 'OR', '975': 'OR', '976': 'OR', '977': 'OR', '978': 'OR', '979': 'OR',
  '900': 'CA', '901': 'CA', '902': 'CA', '903': 'CA', '904': 'CA', '905': 'CA', '906': 'CA', '907': 'CA', '908': 'CA', '909': 'CA', '910': 'CA', '911': 'CA', '912': 'CA', '913': 'CA', '914': 'CA', '915': 'CA', '916': 'CA', '917': 'CA', '918': 'CA', '919': 'CA', '920': 'CA', '921': 'CA', '922': 'CA', '923': 'CA', '924': 'CA', '925': 'CA', '926': 'CA', '927': 'CA', '928': 'CA', '930': 'CA', '931': 'CA', '932': 'CA', '933': 'CA', '934': 'CA', '935': 'CA', '936': 'CA', '937': 'CA', '938': 'CA', '939': 'CA', '940': 'CA', '941': 'CA', '942': 'CA', '943': 'CA', '944': 'CA', '945': 'CA', '946': 'CA', '947': 'CA', '948': 'CA', '949': 'CA', '950': 'CA', '951': 'CA', '952': 'CA', '953': 'CA', '954': 'CA', '955': 'CA', '956': 'CA', '957': 'CA', '958': 'CA', '959': 'CA', '960': 'CA', '961': 'CA',
  '832': 'ID', '833': 'ID', '834': 'ID', '835': 'ID', '836': 'ID', '837': 'ID', '838': 'ID',
  '590': 'MT', '591': 'MT', '592': 'MT', '593': 'MT', '594': 'MT', '595': 'MT', '596': 'MT', '597': 'MT', '598': 'MT', '599': 'MT',
  '820': 'WY', '821': 'WY', '822': 'WY', '823': 'WY', '824': 'WY', '825': 'WY', '826': 'WY', '827': 'WY', '828': 'WY', '829': 'WY', '830': 'WY', '831': 'WY',
  '800': 'CO', '801': 'CO', '802': 'CO', '803': 'CO', '804': 'CO', '805': 'CO', '806': 'CO', '807': 'CO', '808': 'CO', '809': 'CO', '810': 'CO', '811': 'CO', '812': 'CO', '813': 'CO', '814': 'CO', '815': 'CO', '816': 'CO',
  '840': 'UT', '841': 'UT', '842': 'UT', '843': 'UT', '844': 'UT', '845': 'UT', '846': 'UT', '847': 'UT',
  '850': 'AZ', '851': 'AZ', '852': 'AZ', '853': 'AZ', '855': 'AZ', '856': 'AZ', '857': 'AZ', '858': 'AZ', '859': 'AZ', '860': 'AZ', '863': 'AZ', '864': 'AZ', '865': 'AZ',
  '870': 'NM', '871': 'NM', '872': 'NM', '873': 'NM', '874': 'NM', '875': 'NM', '876': 'NM', '877': 'NM', '878': 'NM', '879': 'NM', '880': 'NM', '881': 'NM', '882': 'NM', '883': 'NM', '884': 'NM',
  '889': 'NV', '890': 'NV', '891': 'NV', '893': 'NV', '894': 'NV', '895': 'NV', '896': 'NV', '897': 'NV', '898': 'NV',
  '750': 'TX', '751': 'TX', '752': 'TX', '753': 'TX', '754': 'TX', '755': 'TX', '756': 'TX', '757': 'TX', '758': 'TX', '759': 'TX', '760': 'TX', '761': 'TX', '762': 'TX', '763': 'TX', '764': 'TX', '765': 'TX', '766': 'TX', '767': 'TX', '768': 'TX', '769': 'TX', '770': 'TX', '771': 'TX', '772': 'TX', '773': 'TX', '774': 'TX', '775': 'TX', '776': 'TX', '777': 'TX', '778': 'TX', '779': 'TX', '780': 'TX', '781': 'TX', '782': 'TX', '783': 'TX', '784': 'TX', '785': 'TX', '786': 'TX', '787': 'TX', '788': 'TX', '789': 'TX', '790': 'TX', '791': 'TX', '792': 'TX', '793': 'TX', '794': 'TX', '795': 'TX', '796': 'TX', '797': 'TX', '798': 'TX', '799': 'TX',
  '600': 'IL', '601': 'IL', '602': 'IL', '603': 'IL', '604': 'IL', '605': 'IL', '606': 'IL', '607': 'IL', '608': 'IL', '609': 'IL', '610': 'IL', '611': 'IL', '612': 'IL', '613': 'IL', '614': 'IL', '615': 'IL', '616': 'IL', '617': 'IL', '618': 'IL', '619': 'IL', '620': 'IL', '621': 'IL', '622': 'IL', '623': 'IL', '624': 'IL', '625': 'IL', '626': 'IL', '627': 'IL', '628': 'IL', '629': 'IL',
  '967': 'HI', '968': 'HI',
  '995': 'AK', '996': 'AK', '997': 'AK', '998': 'AK', '999': 'AK',
  '320': 'FL', '321': 'FL', '322': 'FL', '323': 'FL', '324': 'FL', '325': 'FL', '326': 'FL', '327': 'FL', '328': 'FL', '329': 'FL', '330': 'FL', '331': 'FL', '332': 'FL', '333': 'FL', '334': 'FL', '335': 'FL', '336': 'FL', '337': 'FL', '338': 'FL', '339': 'FL', '340': 'FL', '341': 'FL', '342': 'FL', '344': 'FL', '346': 'FL', '347': 'FL', '349': 'FL',
  '300': 'GA', '301': 'GA', '302': 'GA', '303': 'GA', '304': 'GA', '305': 'GA', '306': 'GA', '307': 'GA', '308': 'GA', '309': 'GA', '310': 'GA', '311': 'GA', '312': 'GA', '313': 'GA', '314': 'GA', '315': 'GA', '316': 'GA', '317': 'GA', '318': 'GA', '319': 'GA',
  '100': 'NY', '101': 'NY', '102': 'NY', '103': 'NY', '104': 'NY', '105': 'NY', '106': 'NY', '107': 'NY', '108': 'NY', '109': 'NY', '110': 'NY', '111': 'NY', '112': 'NY', '113': 'NY', '114': 'NY', '115': 'NY', '116': 'NY', '117': 'NY', '118': 'NY', '119': 'NY', '120': 'NY', '121': 'NY', '122': 'NY', '123': 'NY', '124': 'NY', '125': 'NY', '126': 'NY', '127': 'NY', '128': 'NY', '129': 'NY', '130': 'NY', '131': 'NY', '132': 'NY', '133': 'NY', '134': 'NY', '135': 'NY', '136': 'NY', '137': 'NY', '138': 'NY', '139': 'NY', '140': 'NY', '141': 'NY', '142': 'NY', '143': 'NY', '144': 'NY', '145': 'NY', '146': 'NY', '147': 'NY', '148': 'NY', '149': 'NY',
  '150': 'PA', '151': 'PA', '152': 'PA', '153': 'PA', '154': 'PA', '155': 'PA', '156': 'PA', '157': 'PA', '158': 'PA', '159': 'PA', '160': 'PA', '161': 'PA', '162': 'PA', '163': 'PA', '164': 'PA', '165': 'PA', '166': 'PA', '167': 'PA', '168': 'PA', '169': 'PA', '170': 'PA', '171': 'PA', '172': 'PA', '173': 'PA', '174': 'PA', '175': 'PA', '176': 'PA', '177': 'PA', '178': 'PA', '179': 'PA', '180': 'PA', '181': 'PA', '182': 'PA', '183': 'PA', '184': 'PA', '185': 'PA', '186': 'PA', '187': 'PA', '188': 'PA', '189': 'PA', '190': 'PA', '191': 'PA', '192': 'PA', '193': 'PA', '194': 'PA', '195': 'PA', '196': 'PA',
  '430': 'OH', '431': 'OH', '432': 'OH', '433': 'OH', '434': 'OH', '435': 'OH', '436': 'OH', '437': 'OH', '438': 'OH', '439': 'OH', '440': 'OH', '441': 'OH', '442': 'OH', '443': 'OH', '444': 'OH', '445': 'OH', '446': 'OH', '447': 'OH', '448': 'OH', '449': 'OH', '450': 'OH', '451': 'OH', '452': 'OH', '453': 'OH', '454': 'OH', '455': 'OH', '456': 'OH', '457': 'OH', '458': 'OH', '459': 'OH',
  '480': 'MI', '481': 'MI', '482': 'MI', '483': 'MI', '484': 'MI', '485': 'MI', '486': 'MI', '487': 'MI', '488': 'MI', '489': 'MI', '490': 'MI', '491': 'MI', '492': 'MI', '493': 'MI', '494': 'MI', '495': 'MI', '496': 'MI', '497': 'MI', '498': 'MI', '499': 'MI',
  '460': 'IN', '461': 'IN', '462': 'IN', '463': 'IN', '464': 'IN', '465': 'IN', '466': 'IN', '467': 'IN', '468': 'IN', '469': 'IN', '470': 'IN', '471': 'IN', '472': 'IN', '473': 'IN', '474': 'IN', '475': 'IN', '476': 'IN', '477': 'IN', '478': 'IN', '479': 'IN',
  '530': 'WI', '531': 'WI', '532': 'WI', '534': 'WI', '535': 'WI', '537': 'WI', '538': 'WI', '539': 'WI', '540': 'WI', '541': 'WI', '542': 'WI', '543': 'WI', '544': 'WI', '545': 'WI', '546': 'WI', '547': 'WI', '548': 'WI', '549': 'WI',
  '550': 'MN', '551': 'MN', '553': 'MN', '554': 'MN', '555': 'MN', '556': 'MN', '557': 'MN', '558': 'MN', '559': 'MN', '560': 'MN', '561': 'MN', '562': 'MN', '563': 'MN', '564': 'MN', '565': 'MN', '566': 'MN', '567': 'MN',
  '500': 'IA', '501': 'IA', '502': 'IA', '503': 'IA', '504': 'IA', '505': 'IA', '506': 'IA', '507': 'IA', '508': 'IA', '509': 'IA', '510': 'IA', '511': 'IA', '512': 'IA', '513': 'IA', '514': 'IA', '515': 'IA', '516': 'IA', '520': 'IA', '521': 'IA', '522': 'IA', '523': 'IA', '524': 'IA', '525': 'IA', '526': 'IA', '527': 'IA', '528': 'IA',
  '630': 'MO', '631': 'MO', '633': 'MO', '634': 'MO', '635': 'MO', '636': 'MO', '637': 'MO', '638': 'MO', '639': 'MO', '640': 'MO', '641': 'MO', '644': 'MO', '645': 'MO', '646': 'MO', '647': 'MO', '648': 'MO', '649': 'MO', '650': 'MO', '651': 'MO', '652': 'MO', '653': 'MO', '654': 'MO', '655': 'MO', '656': 'MO', '657': 'MO', '658': 'MO'
};

// Gradient colors for shop icons
const GRADIENTS = [
  'from-amber-600 to-orange-700',
  'from-blue-600 to-indigo-700',
  'from-purple-600 to-pink-600',
  'from-emerald-600 to-teal-700',
  'from-red-600 to-rose-700',
  'from-gray-700 to-gray-900',
  'from-cyan-600 to-blue-700',
  'from-fuchsia-600 to-purple-700',
  'from-lime-600 to-green-700',
  'from-orange-600 to-red-700'
];

// Popular cities for the index page
const POPULAR_CITIES = [
  { city: 'Seattle', state: 'WA', gradient: 'from-emerald-800 to-teal-900' },
  { city: 'Spokane', state: 'WA', gradient: 'from-blue-800 to-indigo-900' },
  { city: 'Chicago', state: 'IL', gradient: 'from-amber-800 to-orange-900' },
  { city: 'Portland', state: 'OR', gradient: 'from-purple-800 to-pink-900' },
  { city: 'Tacoma', state: 'WA', gradient: 'from-red-800 to-rose-900' },
  { city: 'Los Angeles', state: 'CA', gradient: 'from-gray-800 to-gray-950' },
  { city: 'Puyallup', state: 'WA', gradient: 'from-cyan-600 to-blue-700' },
  { city: 'Everett', state: 'WA', gradient: 'from-fuchsia-600 to-purple-700' },
  { city: 'Gig Harbor', state: 'WA', gradient: 'from-lime-600 to-green-700' },
  { city: 'Federal Way', state: 'WA', gradient: 'from-orange-600 to-red-700' }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function getStateFromZip(postalCode) {
  if (!postalCode) return 'unknown';
  const prefix = postalCode.toString().substring(0, 3);
  return ZIP_TO_STATE[prefix] || 'unknown';
}

function formatTime(minutes) {
  if (!minutes && minutes !== 0) return 'Hours vary';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  return mins === 0 ? `${displayHours} ${period}` : `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

function formatTimeRange(open, close) {
  if ((!open && open !== 0) || (!close && close !== 0)) return 'Hours vary';
  return `${formatTime(open)} – ${formatTime(close)}`;
}

function getGradient(index) {
  return GRADIENTS[index % GRADIENTS.length];
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================
// TEMPLATE FUNCTIONS
// ============================================

function getNavHTML() {
  return `
  <nav class="fixed top-0 left-0 right-0 z-50 bg-white/95 nav-blur border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/" class="flex items-center">
        <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe coffee" class="h-10">
      </a>
      <div class="hidden md:flex items-center gap-8 text-sm text-gray-600">
        <a href="/locations/" class="hover:text-black">Locations</a>
        <a href="/#features" class="hover:text-black">Features</a>
        <a href="/for-coffee-shops/" class="hover:text-black">For Coffee Shops</a>
      </div>
      <a href="https://get.joe.coffee" class="bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800">
        Get the App
      </a>
    </div>
  </nav>`;
}

function getFooterHTML(currentCity = '') {
  return `
  <footer class="site-footer">
    <div class="max-w-6xl mx-auto px-6 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" class="h-8 mb-4">
          <p class="text-gray-600 text-sm">The #1 app for indie coffee lovers. Skip the line, earn rewards, support local.</p>
        </div>
        <div>
          <h4 class="font-bold text-sm text-black mb-4">For Shops</h4>
          <ul class="space-y-2">
            <li><a href="/for-coffee-shops/#platform" class="footer-link">Platform</a></li>
            <li><a href="/for-coffee-shops/#loyalty" class="footer-link">Loyalty Program</a></li>
            <li><a href="/for-coffee-shops/#pricing" class="footer-link">Pricing</a></li>
            <li><a href="/for-coffee-shops/#join" class="footer-link">Join the Movement</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-sm text-black mb-4">Resources</h4>
          <ul class="space-y-2">
            <li><a href="/blog/" class="footer-link">Industry Blog</a></li>
            <li><a href="https://support.joe.coffee" class="footer-link">Support & FAQs</a></li>
            <li><a href="https://manage.joe.coffee/login" class="footer-link">Owner Login</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-sm text-black mb-4">Company</h4>
          <ul class="space-y-2">
            <li><a href="/for-coffee-shops/#about" class="footer-link">Mission & Values</a></li>
            <li><a href="/terms/" class="footer-link">Terms and Conditions</a></li>
            <li><a href="/privacy/" class="footer-link">Privacy Policy</a></li>
            <li><a href="/merchant-terms/" class="footer-link">Merchant Terms of Service</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="border-t border-gray-200">
      <div class="max-w-6xl mx-auto px-6 py-8">
        <h4 class="font-bold text-sm text-black mb-4 uppercase tracking-wide">Coffee Shops by City</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
          <a href="/locations/wa/seattle/" class="footer-link ${currentCity === 'Seattle' ? 'font-medium text-black' : ''}">Seattle</a>
          <a href="/locations/wa/spokane/" class="footer-link ${currentCity === 'Spokane' ? 'font-medium text-black' : ''}">Spokane</a>
          <a href="/locations/il/chicago/" class="footer-link ${currentCity === 'Chicago' ? 'font-medium text-black' : ''}">Chicago</a>
          <a href="/locations/wa/tacoma/" class="footer-link ${currentCity === 'Tacoma' ? 'font-medium text-black' : ''}">Tacoma</a>
          <a href="/locations/or/portland/" class="footer-link ${currentCity === 'Portland' ? 'font-medium text-black' : ''}">Portland</a>
          <a href="/locations/ca/los-angeles/" class="footer-link ${currentCity === 'Los Angeles' ? 'font-medium text-black' : ''}">Los Angeles</a>
          <a href="/locations/wa/puyallup/" class="footer-link ${currentCity === 'Puyallup' ? 'font-medium text-black' : ''}">Puyallup</a>
          <a href="/locations/tx/san-antonio/" class="footer-link ${currentCity === 'San Antonio' ? 'font-medium text-black' : ''}">San Antonio</a>
          <a href="/locations/wa/spokane-valley/" class="footer-link ${currentCity === 'Spokane Valley' ? 'font-medium text-black' : ''}">Spokane Valley</a>
          <a href="/locations/id/coeur-dalene/" class="footer-link ${currentCity === "Coeur d'Alene" ? 'font-medium text-black' : ''}">Coeur d'Alene</a>
          <a href="/locations/wa/everett/" class="footer-link ${currentCity === 'Everett' ? 'font-medium text-black' : ''}">Everett</a>
          <a href="/locations/wa/centralia/" class="footer-link ${currentCity === 'Centralia' ? 'font-medium text-black' : ''}">Centralia</a>
        </div>
        <a href="/locations/" class="text-black font-semibold text-sm hover:underline">View All Locations →</a>
      </div>
    </div>
    <div class="border-t border-gray-200">
      <div class="max-w-6xl mx-auto px-6 py-4 text-center text-gray-500 text-sm">
        © 2025 joe Coffee. All rights reserved. | Crafted with ❤️ for indie coffee
      </div>
    </div>
  </footer>`;
}

function getHeadHTML(title, description, canonicalUrl, extraMeta = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  
  <link rel="canonical" href="${canonicalUrl}">
  ${extraMeta}
  
  <link rel="icon" type="image/png" href="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
  
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .nav-blur { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .shop-card { background: white; border: 1px solid #e5e5e5; border-radius: 16px; overflow: hidden; transition: all 0.2s ease; }
    .shop-card:hover { border-color: #d4d4d4; box-shadow: 0 8px 30px rgba(0,0,0,0.08); transform: translateY(-2px); }
    .status-open { background: #dcfce7; color: #166534; }
    .status-closed { background: #f3f4f6; color: #6b7280; }
    .tag { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #f5f5f5; border-radius: 100px; font-size: 12px; color: #525252; }
    .filter-btn { padding: 8px 16px; border-radius: 100px; font-size: 14px; font-weight: 500; transition: all 0.15s; cursor: pointer; white-space: nowrap; }
    .filter-btn.active { background: #171717; color: white; }
    .filter-btn:not(.active) { background: #f5f5f5; color: #525252; }
    .filter-btn:not(.active):hover { background: #e5e5e5; }
    .site-footer { background: #F5F1E8; }
    .footer-link { color: #525252; text-decoration: none; font-size: 14px; }
    .footer-link:hover { color: #171717; }
    .state-card { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px; transition: all 0.2s ease; display: block; text-decoration: none; color: inherit; }
    .state-card:hover { border-color: #d4d4d4; box-shadow: 0 4px 20px rgba(0,0,0,0.06); transform: translateY(-2px); }
    .city-link { color: #525252; text-decoration: none; font-size: 14px; transition: color 0.15s; }
    .city-link:hover { color: #000; }
    .nearby-city { background: #f9fafb; border-radius: 12px; padding: 16px; text-align: center; transition: background 0.15s; }
    .nearby-city:hover { background: #f3f4f6; }
    .info-card { background: white; border: 1px solid #e5e5e5; border-radius: 16px; padding: 24px; }
    .order-btn { display: block; width: 100%; padding: 16px 24px; background: #000; color: #fff; text-align: center; border-radius: 12px; font-weight: 600; font-size: 16px; transition: background 0.15s; text-decoration: none; }
    .order-btn:hover { background: #333; }
    .other-shop { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; transition: all 0.15s; }
    .other-shop:hover { border-color: #d4d4d4; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
  </style>
</head>`;
}

// ============================================
// PAGE GENERATORS
// ============================================

function generateIndexPage(stateData, totalShops, totalCities) {
  const title = 'Find Coffee Shops Near You | joe coffee';
  const description = `Find independent coffee shops in ${totalCities}+ cities across the US. Order ahead, skip the line, earn rewards at ${totalShops}+ local cafes on joe.`;
  const canonicalUrl = 'https://joe.coffee/locations/';
  
  // Build state cards
  let stateCardsHTML = '';
  const sortedStates = Object.keys(stateData).sort((a, b) => stateData[b].shops.length - stateData[a].shops.length);
  
  // Filter out "unknown" state
  const validStates = sortedStates.filter(s => s !== 'unknown' && STATE_NAMES[s]);
  
  for (const stateCode of validStates.slice(0, 12)) {
    const state = stateData[stateCode];
    const stateName = STATE_NAMES[stateCode] || stateCode;
    const cities = Object.keys(state.cities).slice(0, 5);
    const moreCities = Object.keys(state.cities).length - 5;
    
    stateCardsHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/" class="state-card block">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-lg">${stateName}</h3>
            <span class="text-sm text-gray-500">${state.shops.length} shops</span>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            ${cities.join(', ')}${moreCities > 0 ? `, +${moreCities} more` : ''}
          </div>
        </a>`;
  }

  // Build popular cities - find cities case-insensitively
  let popularCitiesHTML = '';
  for (const pc of POPULAR_CITIES) {
    const stateCode = pc.state.toLowerCase();
    const citySlug = slugify(pc.city);
    
    // Find city case-insensitively
    let shopCount = 0;
    if (stateData[pc.state]?.cities) {
      const cityKey = Object.keys(stateData[pc.state].cities).find(
        c => c.toLowerCase() === pc.city.toLowerCase()
      );
      if (cityKey) {
        shopCount = stateData[pc.state].cities[cityKey].length;
      }
    }
    
    // Only show cities with shops
    if (shopCount > 0) {
      popularCitiesHTML += `
        <a href="/locations/${stateCode}/${citySlug}/" class="bg-black text-white rounded-2xl p-5 hover:bg-gray-800 transition-colors">
          <p class="font-bold text-lg">${pc.city}</p>
          <p class="text-gray-400 text-sm">${shopCount} shops</p>
        </a>`;
    }
  }

  const html = `${getHeadHTML(title, description, canonicalUrl)}
<body class="min-h-screen bg-white text-gray-900">
  ${getNavHTML()}

  <div class="pt-24 pb-4 border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <nav class="text-sm text-gray-500" aria-label="Breadcrumb">
        <a href="/" class="hover:text-black">Home</a>
        <span class="mx-2">›</span>
        <span class="text-gray-900 font-medium">Locations</span>
      </nav>
    </div>
  </div>

  <section class="py-12 bg-gradient-to-b from-gray-50 to-white">
    <div class="max-w-6xl mx-auto px-6">
      <div class="max-w-2xl">
        <h1 class="text-4xl md:text-5xl font-bold text-black mb-4">Find Coffee Shops Near You</h1>
        <p class="text-lg text-gray-600 mb-6">Discover ${totalShops}+ independent coffee shops across the US. Order ahead, skip the line, and earn rewards at local favorites.</p>
        <div class="flex flex-wrap gap-3">
          <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
            <span class="font-medium">${totalShops}+ Shops</span>
          </div>
          <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
            <span class="font-medium">${totalCities}+ Cities</span>
          </div>
          <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
            <span class="font-medium">${sortedStates.length} States</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="py-12 border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-2xl font-bold text-black mb-6">Popular Cities</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">${popularCitiesHTML}
      </div>
    </div>
  </section>

  <section class="py-12">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-2xl font-bold text-black mb-6">Browse by State</h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">${stateCardsHTML}
      </div>
    </div>
  </section>

  <section class="py-16 bg-black text-white">
    <div class="max-w-2xl mx-auto px-6 text-center">
      <h2 class="text-3xl font-bold mb-4">Ready to skip the line?</h2>
      <p class="text-gray-400 mb-8">Download joe and start earning rewards at ${totalShops}+ independent coffee shops.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="https://apps.apple.com/us/app/joe-coffee-order-ahead/id1437558382" class="bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-100">Download for iOS</a>
        <a href="https://play.google.com/store/apps/details?id=com.joecoffee.joecoffee" class="border border-white/30 text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10">Get on Android</a>
      </div>
    </div>
  </section>

  ${getFooterHTML()}
</body>
</html>`;

  return html;
}

function generateStatePage(stateCode, stateData) {
  const stateName = STATE_NAMES[stateCode] || stateCode;
  const shops = stateData.shops;
  const cities = stateData.cities;
  const cityCount = Object.keys(cities).length;
  
  const title = `Coffee Shops in ${stateName} | joe coffee`;
  const description = `Find ${shops.length} independent coffee shops in ${stateName}. Order ahead, skip the line, earn rewards at local cafes in ${cityCount} cities.`;
  const canonicalUrl = `https://joe.coffee/locations/${stateCode.toLowerCase()}/`;
  
  // Build city cards
  let cityCardsHTML = '';
  const sortedCities = Object.keys(cities).sort((a, b) => cities[b].length - cities[a].length);
  
  for (const city of sortedCities) {
    const cityShops = cities[city];
    const citySlug = slugify(city);
    
    cityCardsHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/" class="state-card block">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-lg">${city}</h3>
            <span class="text-sm text-gray-500">${cityShops.length} shops</span>
          </div>
        </a>`;
  }

  const html = `${getHeadHTML(title, description, canonicalUrl, `<meta name="geo.region" content="US-${stateCode}">`)}
<body class="min-h-screen bg-white text-gray-900">
  ${getNavHTML()}

  <div class="pt-24 pb-4 border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <nav class="text-sm text-gray-500">
        <a href="/" class="hover:text-black">Home</a>
        <span class="mx-2">›</span>
        <a href="/locations/" class="hover:text-black">Locations</a>
        <span class="mx-2">›</span>
        <span class="text-gray-900 font-medium">${stateName}</span>
      </nav>
    </div>
  </div>

  <section class="py-12 bg-gradient-to-b from-gray-50 to-white">
    <div class="max-w-6xl mx-auto px-6">
      <h1 class="text-4xl md:text-5xl font-bold text-black mb-4">Coffee Shops in ${stateName}</h1>
      <p class="text-lg text-gray-600 mb-6">Order ahead at ${shops.length} independent coffee shops across ${cityCount} cities in ${stateName}.</p>
    </div>
  </section>

  <section class="py-12">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-2xl font-bold text-black mb-6">Cities in ${stateName}</h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">${cityCardsHTML}
      </div>
    </div>
  </section>

  <section class="py-16 bg-black text-white">
    <div class="max-w-2xl mx-auto px-6 text-center">
      <h2 class="text-3xl font-bold mb-4">Ready to skip the line?</h2>
      <p class="text-gray-400 mb-8">Download joe and start earning rewards at coffee shops across ${stateName}.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="https://apps.apple.com/us/app/joe-coffee-order-ahead/id1437558382" class="bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-100">Download for iOS</a>
        <a href="https://play.google.com/store/apps/details?id=com.joecoffee.joecoffee" class="border border-white/30 text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10">Get on Android</a>
      </div>
    </div>
  </section>

  ${getFooterHTML()}
</body>
</html>`;

  return html;
}

function generateCityPage(stateCode, city, shops, allCitiesInState) {
  const stateName = STATE_NAMES[stateCode] || stateCode;
  const citySlug = slugify(city);
  
  const title = `Coffee Shops in ${city}, ${stateCode} | Order Ahead | joe coffee`;
  const description = `Discover ${shops.length} independent coffee shops in ${city}, ${stateCode}. Order ahead, skip the line, and earn rewards at local favorites.`;
  const canonicalUrl = `https://joe.coffee/locations/${stateCode.toLowerCase()}/${citySlug}/`;
  
  // Build shop cards
  let shopCardsHTML = '';
  shops.forEach((shop, index) => {
    const shopSlug = slugify(shop.name);
    const gradient = getGradient(index);
    const statusClass = shop.isOpen ? 'status-open' : 'status-closed';
    const statusText = shop.isOpen ? 'Open' : 'Closed';
    const hours = formatTimeRange(shop.open, shop.close);
    const waitTime = shop.isOpen ? `<span class="text-gray-300">•</span><span class="text-green-600 font-medium">~${shop.wait} min</span>` : '';
    
    const tags = ['Order Ahead', 'Rewards'];
    if (shop.curbsideAvailable) tags.push('🚗 Curbside');
    
    shopCardsHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/${shopSlug}/" class="shop-card" data-open="${shop.isOpen}" data-curbside="${shop.curbsideAvailable}" data-wait="${shop.wait}">
          <div class="p-5">
            <div class="flex items-start justify-between mb-3">
              <div class="w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center">
                <span class="text-white text-lg">☕</span>
              </div>
              <span class="${statusClass} text-xs font-medium px-2.5 py-1 rounded-full">${statusText}</span>
            </div>
            <h2 class="font-bold text-lg text-black mb-1">${shop.name}</h2>
            <p class="text-gray-500 text-sm mb-3">${shop.address}</p>
            <div class="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>${hours}</span>
              ${waitTime}
            </div>
            <div class="flex flex-wrap gap-2">
              ${tags.map(tag => `<span class="tag">${tag}</span>`).join('\n              ')}
            </div>
          </div>
        </a>`;
  });

  // Build nearby cities
  let nearbyCitiesHTML = '';
  const otherCities = Object.keys(allCitiesInState).filter(c => c !== city).slice(0, 6);
  for (const otherCity of otherCities) {
    const otherCitySlug = slugify(otherCity);
    const otherCityShops = allCitiesInState[otherCity];
    nearbyCitiesHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/${otherCitySlug}/" class="nearby-city">
          <p class="font-semibold text-black">${otherCity}</p>
          <p class="text-gray-500 text-sm">${otherCityShops.length} shops</p>
        </a>`;
  }

  const html = `${getHeadHTML(title, description, canonicalUrl, `<meta name="geo.region" content="US-${stateCode}"><meta name="geo.placename" content="${city}">`)}
<body class="min-h-screen bg-white text-gray-900">
  ${getNavHTML()}

  <div class="pt-24 pb-4 border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <nav class="text-sm text-gray-500">
        <a href="/" class="hover:text-black">Home</a>
        <span class="mx-2">›</span>
        <a href="/locations/" class="hover:text-black">Locations</a>
        <span class="mx-2">›</span>
        <a href="/locations/${stateCode.toLowerCase()}/" class="hover:text-black">${stateName}</a>
        <span class="mx-2">›</span>
        <span class="text-gray-900 font-medium">${city}</span>
      </nav>
    </div>
  </div>

  <section class="py-12 bg-gradient-to-b from-gray-50 to-white">
    <div class="max-w-6xl mx-auto px-6">
      <h1 class="text-4xl md:text-5xl font-bold text-black mb-4">Coffee Shops in ${city}</h1>
      <p class="text-lg text-gray-600 mb-6">Order ahead at ${shops.length} independent coffee shops in ${city}, ${stateCode}. Skip the line, earn rewards, support local.</p>
      <div class="flex flex-wrap gap-3">
        <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
          <span class="font-medium">${shops.length} Shops</span>
        </div>
        <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm">
          <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>
          <span class="font-medium">${shops.filter(s => s.isOpen).length} Open Now</span>
        </div>
      </div>
    </div>
  </section>

  <section class="sticky top-16 z-40 bg-white border-b border-gray-100 py-4">
    <div class="max-w-6xl mx-auto px-6">
      <div class="flex gap-2 overflow-x-auto pb-1">
        <button class="filter-btn active" data-filter="all">All Shops</button>
        <button class="filter-btn" data-filter="open">Open Now</button>
        <button class="filter-btn" data-filter="curbside">Curbside</button>
        <button class="filter-btn" data-filter="quick">Quick Pickup</button>
      </div>
    </div>
  </section>

  <main class="py-10">
    <div class="max-w-6xl mx-auto px-6">
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-5" id="shop-grid">${shopCardsHTML}
      </div>
    </div>
  </main>

  <section class="py-16 bg-gray-50 border-t border-gray-100">
    <div class="max-w-3xl mx-auto px-6">
      <h2 class="text-2xl font-bold text-black mb-4">About Coffee in ${city}</h2>
      <p class="text-gray-600">Discover the best independent coffee shops in ${city}, ${stateName}. With ${shops.length} local cafes on joe, you can skip the line and earn rewards at your favorite spots. Order ahead through the joe app and support local roasters.</p>
    </div>
  </section>

  ${nearbyCitiesHTML ? `
  <section class="py-12 border-t border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-xl font-bold text-black mb-6">Nearby Cities</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">${nearbyCitiesHTML}
      </div>
    </div>
  </section>` : ''}

  <section class="py-16 bg-black text-white">
    <div class="max-w-2xl mx-auto px-6 text-center">
      <h2 class="text-3xl font-bold mb-4">Ready to skip the line in ${city}?</h2>
      <p class="text-gray-400 mb-8">Download joe and start earning rewards at your favorite coffee shops.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="https://apps.apple.com/us/app/joe-coffee-order-ahead/id1437558382" class="bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-100">Download for iOS</a>
        <a href="https://play.google.com/store/apps/details?id=com.joecoffee.joecoffee" class="border border-white/30 text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10">Get on Android</a>
      </div>
    </div>
  </section>

  ${getFooterHTML(city)}

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const filterBtns = document.querySelectorAll('.filter-btn');
      const shopCards = document.querySelectorAll('.shop-card');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          const filter = this.dataset.filter;
          filterBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          shopCards.forEach(card => {
            const isOpen = card.dataset.open === 'true';
            const hasCurbside = card.dataset.curbside === 'true';
            const wait = parseInt(card.dataset.wait);
            let show = true;
            if (filter === 'open') show = isOpen;
            else if (filter === 'curbside') show = hasCurbside;
            else if (filter === 'quick') show = wait <= 10 && isOpen;
            card.style.display = show ? 'block' : 'none';
          });
        });
      });
    });
  </script>
</body>
</html>`;

  return html;
}

function generateShopPage(stateCode, city, shop, otherShops) {
  const stateName = STATE_NAMES[stateCode] || stateCode;
  const citySlug = slugify(city);
  const shopSlug = slugify(shop.name);
  const lat = shop.coords ? shop.coords[1] : 0;
  const lng = shop.coords ? shop.coords[0] : 0;
  
  const title = `${shop.name} - ${city}, ${stateCode} | Order Ahead | joe coffee`;
  const description = `Order ahead at ${shop.name} in ${city}, ${stateCode}. Skip the line, earn rewards. Located at ${shop.address}. ${shop.isOpen ? `Open now, ~${shop.wait} min wait.` : 'Currently closed.'}`;
  const canonicalUrl = `https://joe.coffee/locations/${stateCode.toLowerCase()}/${citySlug}/${shopSlug}/`;
  
  const hours = formatTimeRange(shop.open, shop.close);
  const statusClass = shop.isOpen ? 'status-open' : 'status-closed';
  const statusText = shop.isOpen ? 'Open' : 'Closed';
  
  const tags = ['Order Ahead', 'Rewards'];
  if (shop.curbsideAvailable) tags.push('🚗 Curbside');
  
  // Build other shops
  let otherShopsHTML = '';
  const nearbyShops = otherShops.filter(s => s.id !== shop.id).slice(0, 4);
  for (const other of nearbyShops) {
    const otherSlug = slugify(other.name);
    const otherStatus = other.isOpen ? 'status-open' : 'status-closed';
    const otherStatusText = other.isOpen ? 'Open' : 'Closed';
    
    otherShopsHTML += `
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/${otherSlug}/" class="other-shop">
          <h3 class="font-semibold text-black mb-1">${other.name}</h3>
          <p class="text-gray-500 text-sm mb-2">${other.address}</p>
          <div class="flex items-center gap-2">
            <span class="${otherStatus} text-xs font-medium px-2 py-0.5 rounded-full">${otherStatusText}</span>
            ${other.isOpen ? `<span class="text-gray-400 text-xs">~${other.wait} min</span>` : ''}
          </div>
        </a>`;
  }

  // Schema.org structured data
  const schemaJSON = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    "name": shop.name,
    "description": `Independent coffee shop in ${city}, ${stateName}. Order ahead with joe to skip the line and earn rewards.`,
    "url": canonicalUrl,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": shop.address,
      "addressLocality": city,
      "addressRegion": stateCode,
      "postalCode": shop.postalCode,
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": lat,
      "longitude": lng
    },
    "potentialAction": {
      "@type": "OrderAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `https://shop.joe.coffee/${shopSlug}`,
        "actionPlatform": ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"]
      }
    }
  });

  const extraMeta = `
  <meta name="geo.region" content="US-${stateCode}">
  <meta name="geo.placename" content="${city}">
  <meta name="geo.position" content="${lat};${lng}">
  <script type="application/ld+json">${schemaJSON}</script>`;

  const html = `${getHeadHTML(title, description, canonicalUrl, extraMeta)}
<body class="min-h-screen bg-gray-50 text-gray-900">
  ${getNavHTML()}

  <div class="pt-24 pb-4 bg-white border-b border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <nav class="text-sm text-gray-500 flex flex-wrap gap-2">
        <a href="/" class="hover:text-black">Home</a><span class="text-gray-300">›</span>
        <a href="/locations/" class="hover:text-black">Locations</a><span class="text-gray-300">›</span>
        <a href="/locations/${stateCode.toLowerCase()}/" class="hover:text-black">${stateName}</a><span class="text-gray-300">›</span>
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/" class="hover:text-black">${city}</a><span class="text-gray-300">›</span>
        <span class="text-gray-900 font-medium">${shop.name}</span>
      </nav>
    </div>
  </div>

  <main class="py-8">
    <div class="max-w-6xl mx-auto px-6">
      <div class="grid lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-6">
          <div class="info-card">
            <div class="flex items-start gap-5">
              <div class="w-20 h-20 bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span class="text-white text-3xl">☕</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 class="text-2xl md:text-3xl font-bold text-black">${shop.name}</h1>
                  <span class="${statusClass} text-xs font-medium px-3 py-1 rounded-full">${statusText}</span>
                </div>
                <p class="text-gray-600 mb-4">Independent coffee shop in ${city}</p>
                <div class="flex flex-wrap gap-2">
                  ${tags.map(tag => `<span class="tag">${tag}</span>`).join('\n                  ')}
                </div>
              </div>
            </div>
          </div>

          <div class="info-card">
            <h2 class="font-bold text-lg mb-4">Hours & Availability</h2>
            <div class="grid sm:grid-cols-2 gap-6">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <p class="font-medium text-black">Today's Hours</p>
                  <p class="text-gray-600">${hours}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 ${shop.isOpen ? 'bg-green-50' : 'bg-gray-100'} rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5 ${shop.isOpen ? 'text-green-600' : 'text-gray-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <div>
                  <p class="font-medium text-black">Estimated Wait</p>
                  <p class="${shop.isOpen ? 'text-green-600 font-medium' : 'text-gray-500'}">~${shop.wait} minutes</p>
                </div>
              </div>
            </div>
          </div>

          <div class="info-card">
            <h2 class="font-bold text-lg mb-4">Location</h2>
            <div class="flex items-start gap-3 mb-4">
              <div class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                </svg>
              </div>
              <div>
                <p class="font-medium text-black">${shop.address}</p>
                <p class="text-gray-600">${city}, ${stateCode} ${shop.postalCode}</p>
                <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" class="text-black font-medium text-sm hover:underline mt-1 inline-block">Get Directions →</a>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-1">
          <div class="info-card sticky top-24">
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </div>
              <h3 class="font-bold text-xl mb-2">Order Ahead</h3>
              <p class="text-gray-600 text-sm mb-4">Skip the line and earn rewards on every order</p>
              ${shop.isOpen ? `<div class="flex items-center justify-center gap-2 text-green-600 font-medium mb-6">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
                Ready in ~${shop.wait} min
              </div>` : '<p class="text-gray-500 mb-6">Currently closed</p>'}
            </div>
            <a href="https://shop.joe.coffee/${shopSlug}" class="order-btn mb-4">Order Now</a>
            <div class="text-center">
              <p class="text-gray-500 text-sm mb-3">Or download the app</p>
              <div class="flex gap-3 justify-center">
                <a href="https://apps.apple.com/us/app/joe-coffee-order-ahead/id1437558382" class="text-sm text-gray-600 hover:text-black">iOS</a>
                <span class="text-gray-300">|</span>
                <a href="https://play.google.com/store/apps/details?id=com.joecoffee.joecoffee" class="text-sm text-gray-600 hover:text-black">Android</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  ${otherShopsHTML ? `
  <section class="py-12 bg-white border-t border-gray-100">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-xl font-bold text-black mb-6">More Coffee Shops in ${city}</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">${otherShopsHTML}
      </div>
      <div class="text-center mt-6">
        <a href="/locations/${stateCode.toLowerCase()}/${citySlug}/" class="text-black font-semibold hover:underline">View All ${otherShops.length} ${city} Shops →</a>
      </div>
    </div>
  </section>` : ''}

  ${getFooterHTML(city)}
</body>
</html>`;

  return html;
}

// ============================================
// MAIN EXECUTION
// ============================================

function main() {
  console.log('🚀 Starting location page generation...\n');
  
  // Load shop data
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ Data file not found: ${DATA_FILE}`);
    process.exit(1);
  }
  
  const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const shops = rawData.data || rawData;
  
  console.log(`📦 Loaded ${shops.length} shops from ${DATA_FILE}`);
  
  // Filter published shops only
  const publishedShops = shops.filter(s => s.published !== false);
  console.log(`✅ ${publishedShops.length} published shops\n`);
  
  // Organize by state -> city
  const stateData = {};
  
  for (const shop of publishedShops) {
    const stateCode = getStateFromZip(shop.postalCode);
    // Normalize city name - trim whitespace and standardize casing
    const city = (shop.city || 'Unknown').trim();
    
    if (!stateData[stateCode]) {
      stateData[stateCode] = { shops: [], cities: {} };
    }
    
    stateData[stateCode].shops.push(shop);
    
    if (!stateData[stateCode].cities[city]) {
      stateData[stateCode].cities[city] = [];
    }
    stateData[stateCode].cities[city].push(shop);
  }
  
  // Count totals
  const totalShops = publishedShops.length;
  let totalCities = 0;
  for (const state of Object.values(stateData)) {
    totalCities += Object.keys(state.cities).length;
  }
  
  console.log(`📍 Organized into ${Object.keys(stateData).length} states, ${totalCities} cities\n`);
  
  // Clean output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  ensureDir(OUTPUT_DIR);
  
  let pagesGenerated = 0;
  
  // Generate index page
  console.log('📄 Generating locations index...');
  const indexHTML = generateIndexPage(stateData, totalShops, totalCities);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexHTML);
  pagesGenerated++;
  
  // Generate state and city pages
  for (const [stateCode, state] of Object.entries(stateData)) {
    const stateDir = path.join(OUTPUT_DIR, stateCode.toLowerCase());
    ensureDir(stateDir);
    
    // State page
    console.log(`📄 Generating ${stateCode} state page...`);
    const stateHTML = generateStatePage(stateCode, state);
    fs.writeFileSync(path.join(stateDir, 'index.html'), stateHTML);
    pagesGenerated++;
    
    // City pages
    for (const [city, cityShops] of Object.entries(state.cities)) {
      const citySlug = slugify(city);
      const cityDir = path.join(stateDir, citySlug);
      ensureDir(cityDir);
      
      // City page
      console.log(`📄 Generating ${city}, ${stateCode} (${cityShops.length} shops)...`);
      const cityHTML = generateCityPage(stateCode, city, cityShops, state.cities);
      fs.writeFileSync(path.join(cityDir, 'index.html'), cityHTML);
      pagesGenerated++;
      
      // Shop pages
      for (const shop of cityShops) {
        const shopSlug = slugify(shop.name);
        const shopDir = path.join(cityDir, shopSlug);
        ensureDir(shopDir);
        
        const shopHTML = generateShopPage(stateCode, city, shop, cityShops);
        fs.writeFileSync(path.join(shopDir, 'index.html'), shopHTML);
        pagesGenerated++;
      }
    }
  }
  
  console.log(`\n✨ Done! Generated ${pagesGenerated} pages.`);
}

main();
