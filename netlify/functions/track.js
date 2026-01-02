const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { event: eventType, page, title, visitorId, email, referrer, metadata } = data;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Try to identify the visitor
    let shop = null;
    let contact = null;

    // If email provided (from form, cookie, or URL param), try to match
    if (email) {
      // Try to find contact by email
      const { data: contactMatch } = await supabase
        .from('contacts')
        .select('*, shops(*)')
        .ilike('email', email)
        .limit(1)
        .single();

      if (contactMatch) {
        contact = contactMatch;
        shop = contactMatch.shops;
      }

      // Also try shop email
      if (!shop) {
        const { data: shopMatch } = await supabase
          .from('shops')
          .select('*')
          .ilike('email', email)
          .limit(1)
          .single();
        
        if (shopMatch) shop = shopMatch;
      }
    }

    // Calculate score boost based on event type
    let scoreBoost = 0;
    let activityType = 'page_view';
    let activityNotes = '';

    switch (eventType) {
      case 'page_view':
        scoreBoost = 1;
        activityType = 'page_view';
        activityNotes = `Viewed: ${title || page}`;
        break;
      case 'blog_read':
        scoreBoost = 3;
        activityType = 'blog_read';
        activityNotes = `Read blog: ${title || page}`;
        break;
      case 'testimonial_view':
        scoreBoost = 5;
        activityType = 'testimonial_view';
        activityNotes = `Viewed testimonial: ${title || page}`;
        break;
      case 'pricing_view':
        scoreBoost = 10;
        activityType = 'pricing_view';
        activityNotes = `Viewed pricing page`;
        break;
      case 'demo_request':
        scoreBoost = 25;
        activityType = 'demo_request';
        activityNotes = `Requested demo`;
        break;
      case 'scroll_depth':
        // Engagement signal - read most of page
        if (metadata?.depth >= 75) {
          scoreBoost = 2;
          activityType = 'deep_engagement';
          activityNotes = `Deep engagement (${metadata.depth}% scroll): ${title || page}`;
        }
        break;
      case 'time_on_page':
        // Spent significant time on page
        if (metadata?.seconds >= 60) {
          scoreBoost = 2;
          activityType = 'time_engagement';
          activityNotes = `Extended time (${Math.round(metadata.seconds/60)}min): ${title || page}`;
        }
        break;
      case 'cta_click':
        scoreBoost = 5;
        activityType = 'cta_click';
        activityNotes = `Clicked CTA: ${metadata?.cta || 'unknown'} on ${page}`;
        break;
      default:
        activityNotes = `${eventType}: ${page}`;
    }

    // Log to website_activity table (create if tracking unknown visitors too)
    const activityRecord = {
      visitor_id: visitorId,
      email: email || null,
      shop_id: shop?.id || null,
      contact_id: contact?.id || null,
      event_type: eventType,
      page_url: page,
      page_title: title,
      referrer: referrer,
      metadata: metadata || {},
      score_boost: scoreBoost,
      ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'],
      user_agent: event.headers['user-agent']
    };

    const { error: activityError } = await supabase
      .from('website_activity')
      .insert([activityRecord]);

    if (activityError) {
      console.error('Activity log error:', activityError);
      // Don't fail - table might not exist yet
    }

    // If we identified a shop, update lead score and log CRM activity
    if (shop && scoreBoost > 0) {
      // Update lead score
      const newScore = Math.min((shop.lead_score || 0) + scoreBoost, 100);
      await supabase
        .from('shops')
        .update({ 
          lead_score: newScore,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', shop.id);

      // Log to activities table (visible in CRM)
      await supabase
        .from('activities')
        .insert([{
          shop_id: shop.id,
          contact_id: contact?.id,
          activity_type: activityType,
          notes: `🌐 Website: ${activityNotes}\nScore: +${scoreBoost} (now ${newScore})`
        }]);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        identified: !!shop,
        scoreBoost 
      })
    };

  } catch (error) {
    console.error('Track error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
