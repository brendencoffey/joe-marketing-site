/**
 * Static Pages Sitemap
 * URL: /sitemaps/static.xml
 * 
 * Lists all static marketing pages, blog posts, testimonials
 */

exports.handler = async (event) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Define all static pages
  const pages = [
    // Main pages
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/locations/', priority: '0.9', changefreq: 'daily' },
    { url: '/for-coffee-shops/', priority: '0.9', changefreq: 'weekly' },
    { url: '/about/', priority: '0.8', changefreq: 'monthly' },
    { url: '/pricing/', priority: '0.8', changefreq: 'weekly' },
    { url: '/rewards/', priority: '0.7', changefreq: 'monthly' },
    { url: '/gift-cards/', priority: '0.7', changefreq: 'monthly' },
    { url: '/contact/', priority: '0.6', changefreq: 'monthly' },
    { url: '/terms/', priority: '0.4', changefreq: 'yearly' },
    { url: '/privacy/', priority: '0.4', changefreq: 'yearly' },
    { url: '/merchant-terms/', priority: '0.4', changefreq: 'yearly' },
    
    // Blog
    { url: '/blog/', priority: '0.8', changefreq: 'daily' },
    
    // Testimonials
    { url: '/testimonials/', priority: '0.8', changefreq: 'weekly' },
    { url: '/testimonials/tropical-express-growth/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/paradox-coffee-community/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/caffe-ladro-18-locations/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/wandering-bean-growth/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/zero-tolerance-costs-brand/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/coffeehouse-brookside-square/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/soul-good-mobile-loyalty/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/surfers-coffee-workflow/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/maple-moose-differentiate/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/catalinas-coffee-growth/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/buffalo-grove-growth/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/sips-coffee-revenue/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/kalona-coffee-workflow/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/farmhouse-coffee-doubles/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/issaquah-coffee-mobile/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/vail-coffee-stop/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/asensio-coffee-simplified/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/momentum-coffee/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/urban-coffee-lounge/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/honu-coffee-acquisition/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/momentum-coffee-ticket/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/indaba-coffee-journey/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/willamette-coffee-house/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/left-hand-coffee/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/hot-shot-sisters/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/cafe-red-community/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/thomas-hammer-mentorship/', priority: '0.6', changefreq: 'monthly' },
    { url: '/testimonials/coffee-cabana-square/', priority: '0.6', changefreq: 'monthly' },
    
    // Blog posts
    { url: '/blog/posts/letter-from-the-founders/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/stripe-holiday-payment-guide/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/understanding-todays-outage/', priority: '0.5', changefreq: 'yearly' },
    { url: '/blog/posts/joe-coffee-podcast-highlights/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/joe-kiosk-experience-anthem-coffee/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/reimagining-coffee-regenerative-systems/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/barista-reaction-switch-to-joe/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/loyalty-marketing-smarter-growth/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/coffee-shop-profit-killers/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/collaboration-over-competition/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/maxwell-mooney-coffee-shop-blueprint/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/owners-baristas-product-planning/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/coffee-shop-os-demo/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/3-biggest-challenges-coffee-shops/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/building-in-public-positioning/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/shifting-paradigms-coffee-shops/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/conscious-entrepreneurship/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/campfire-coffee-community/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/building-in-public-podcast-hardware/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/coffee-community-interview-series/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/joe-rewards-most-rewarding/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/joe-gift-cards-personal-experience/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/joe-verizon-partnership/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/level-up-coffee-shop-loyalty/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/unlocking-loyalty-industry-leaders/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/coffee-shop-kds-system/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/ultimate-guide-choosing-pos/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/promo-codes-vs-gift-cards/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/barista-moments-shift/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/seasonal-sales-menu-features/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/chai-coffee-shop-growth/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/economic-realities-infographic/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/survey-rising-costs-indie-coffee/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/when-promote-seasonal-drinks/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/keep-coffee-local-week-1/', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog/posts/keep-coffee-local-week-2/', priority: '0.6', changefreq: 'monthly' },
    
    // Marketplace
    { url: '/marketplace/', priority: '0.7', changefreq: 'daily' },
  ];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const page of pages) {
    xml += `  <url>
    <loc>https://joe.coffee${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  xml += `</urlset>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    },
    body: xml
  };
};
