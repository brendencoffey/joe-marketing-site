/**
 * Send Engagement Email - Scheduled Function
 * Sends weekly engagement reports to shops with activity
 * 
 * Called by: Supabase cron job or external scheduler
 * Uses: Resend.com for email delivery
 */

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Territory assignments for personalized sender
const TERRITORY_ASSIGNMENTS = {
  east: {
    states: ['CT', 'DE', 'FL', 'GA', 'MA', 'MD', 'ME', 'NC', 'NH', 'NJ', 'NY', 'PA', 'RI', 'SC', 'VA', 'VT', 'WV', 'DC'],
    owner: 'kayla@joe.coffee',
    name: 'Kayla Ortiz',
    title: 'Partnership Manager, East Coast'
  },
  midwest: {
    states: ['IA', 'IL', 'IN', 'KS', 'KY', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'OK', 'SD', 'TN', 'TX', 'WI'],
    owner: 'ally@joe.coffee',
    name: 'Ally Jones',
    title: 'Partnership Manager, Central Region'
  },
  west: {
    states: ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NM', 'NV', 'OR', 'UT', 'WA', 'WY'],
    owner: 'allison@joe.coffee',
    name: 'Allison Taylor',
    title: 'Partnership Manager, West Coast'
  }
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // Allow manual trigger or scheduled execution
  const { shop_id, test_mode } = event.queryStringParameters || {};
  
  try {
    let shopsToEmail = [];

    if (shop_id) {
      // Single shop (for testing or manual trigger)
      const { data: shop } = await supabase
        .from('shops')
        .select('*, contacts(*)')
        .eq('id', shop_id)
        .single();
      
      if (shop) shopsToEmail = [shop];
    } else {
      // Get all non-partner shops with activity in the last 7 days
      // that have a contact with email and haven't been emailed this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: shopsWithActivity } = await supabase
        .from('shop_analytics')
        .select(`
          shop_id,
          total_page_views,
          total_website_clicks,
          total_phone_clicks,
          total_direction_clicks,
          engagement_score,
          shops!inner(
            id, name, city, state, state_code, slug, city_slug,
            is_partner, partner_id,
            contact_id,
            contacts(id, email, first_name, last_name)
          )
        `)
        .gt('engagement_score', 0)
        .gte('updated_at', oneWeekAgo.toISOString());

      // Filter to non-partners with valid contact email
      shopsToEmail = shopsWithActivity
        ?.filter(s => {
          const shop = s.shops;
          return !shop.is_partner && 
                 !shop.partner_id && 
                 shop.contacts?.email;
        })
        .map(s => ({
          ...s.shops,
          analytics: {
            page_views: s.total_page_views,
            website_clicks: s.total_website_clicks,
            phone_clicks: s.total_phone_clicks,
            direction_clicks: s.total_direction_clicks,
            engagement_score: s.engagement_score
          }
        })) || [];
    }

    if (shopsToEmail.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'No shops to email', count: 0 })
      };
    }

    // Get analytics for each shop if not already included
    const results = [];
    
    for (const shop of shopsToEmail) {
      try {
        // Get analytics if not included
        let analytics = shop.analytics;
        if (!analytics) {
          const { data: shopAnalytics } = await supabase
            .from('shop_analytics')
            .select('*')
            .eq('shop_id', shop.id)
            .single();
          
          analytics = shopAnalytics ? {
            page_views: shopAnalytics.total_page_views,
            website_clicks: shopAnalytics.total_website_clicks,
            phone_clicks: shopAnalytics.total_phone_clicks,
            direction_clicks: shopAnalytics.total_direction_clicks,
            engagement_score: shopAnalytics.engagement_score
          } : { page_views: 0, website_clicks: 0, phone_clicks: 0, direction_clicks: 0 };
        }

        // Skip if no meaningful activity
        if (analytics.page_views < 5) continue;

        // Get contact
        let contact = shop.contacts;
        if (!contact && shop.contact_id) {
          const { data: c } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', shop.contact_id)
            .single();
          contact = c;
        }

        if (!contact?.email) continue;

        // Get territory owner
        const owner = getOwnerByState(shop.state_code);
        
        // Build shop URL
        const shopUrl = `https://joe.coffee/locations/${shop.state_code?.toLowerCase()}/${shop.city_slug}/${shop.slug}/`;

        // Send email
        if (!test_mode) {
          await resend.emails.send({
            from: `${owner.name} <${owner.email}>`,
            to: contact.email,
            subject: `Your coffee shop got ${analytics.page_views} views this week on joe ☕`,
            html: getEngagementEmailHtml({
              firstName: contact.first_name || 'there',
              shopName: shop.name,
              city: shop.city,
              analytics,
              shopUrl,
              owner
            })
          });

          // Log email sent
          await supabase.from('activities').insert({
            type: 'email_sent',
            contact_id: contact.id,
            company_id: shop.company_id,
            description: `Weekly engagement report sent: ${analytics.page_views} views`,
            metadata: {
              email_type: 'engagement_report',
              analytics,
              shop_id: shop.id
            }
          });
        }

        results.push({
          shop_id: shop.id,
          shop_name: shop.name,
          email: contact.email,
          analytics,
          status: 'sent'
        });

      } catch (emailErr) {
        console.error(`Failed to email ${shop.name}:`, emailErr);
        results.push({
          shop_id: shop.id,
          shop_name: shop.name,
          status: 'failed',
          error: emailErr.message
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Processed ${results.length} shops`,
        results: test_mode ? results : results.length
      })
    };

  } catch (err) {
    console.error('Engagement email error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send engagement emails' })
    };
  }
};

function getOwnerByState(stateCode) {
  const code = (stateCode || '').toUpperCase();
  for (const [region, data] of Object.entries(TERRITORY_ASSIGNMENTS)) {
    if (data.states.includes(code)) {
      return { email: data.owner, name: data.name, title: data.title };
    }
  }
  return TERRITORY_ASSIGNMENTS.west;
}

function getEngagementEmailHtml({ firstName, shopName, city, analytics, shopUrl, owner }) {
  const { page_views, website_clicks, phone_clicks, direction_clicks } = analytics;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1F2937;
      margin: 0;
      padding: 0;
      background: #F9FAFB;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: #FFFFFF;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .logo {
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: #111827;
    }
    .subtitle {
      color: #6B7280;
      margin-bottom: 24px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 24px 0;
    }
    .stat-card {
      background: #F9FAFB;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-number {
      font-size: 32px;
      font-weight: 700;
      color: #111827;
    }
    .stat-label {
      font-size: 14px;
      color: #6B7280;
      margin-top: 4px;
    }
    .highlight {
      background: linear-gradient(135deg, #000 0%, #374151 100%);
      color: #FFFFFF;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .highlight p {
      margin: 0 0 16px 0;
      opacity: 0.9;
    }
    .btn {
      display: inline-block;
      background: #FFFFFF;
      color: #111827 !important;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
    }
    .btn:hover {
      background: #F3F4F6;
    }
    p {
      margin: 0 0 16px 0;
      color: #4B5563;
    }
    .signature {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #E5E7EB;
    }
    .signature p {
      margin: 0;
    }
    .signature .name {
      font-weight: 600;
      color: #111827;
    }
    .signature .title {
      font-size: 14px;
      color: #6B7280;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #E5E7EB;
      font-size: 12px;
      color: #9CA3AF;
      text-align: center;
    }
    .footer a {
      color: #6B7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" height="32">
      </div>
      
      <h1>Your coffee shop got ${page_views} views this week! ☕</h1>
      <p class="subtitle">Here's how ${shopName} is performing on joe</p>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${page_views}</div>
          <div class="stat-label">Page Views</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${direction_clicks}</div>
          <div class="stat-label">Direction Requests</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${website_clicks}</div>
          <div class="stat-label">Website Clicks</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${phone_clicks}</div>
          <div class="stat-label">Phone Taps</div>
        </div>
      </div>
      
      <p>People in ${city} are looking for great coffee - and finding you on joe's coffee directory.</p>
      
      <div class="highlight">
        <p>Want to capture even more customers? joe partners see <strong>3x more engagement</strong> with mobile ordering and rewards.</p>
        <a href="https://joe.coffee/for-coffee-shops/?utm_source=engagement_email&utm_medium=email&utm_campaign=weekly_report" class="btn">Learn About joe for Shops →</a>
      </div>
      
      <p>You can view and update your listing anytime at:<br>
      <a href="${shopUrl}" style="color: #2563EB;">${shopUrl}</a></p>
      
      <div class="signature">
        <p class="name">${owner.name}</p>
        <p class="title">${owner.title}</p>
        <p class="title">joe Coffee</p>
      </div>
      
      <div class="footer">
        <p>You're receiving this because ${shopName} is listed on <a href="https://joe.coffee/locations/">joe's coffee directory</a>.</p>
        <p><a href="https://joe.coffee/unsubscribe?email={{email}}">Unsubscribe</a> from these emails</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}
