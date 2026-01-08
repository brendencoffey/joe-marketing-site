/**
 * Track Activity - Universal tracking for all pages
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { 
      shop_id, 
      contact_id,
      event_type,
      activity_subtype,
      page_url,
      page_title,
      metadata = {} 
    } = body;

    const requestHeaders = event.headers || {};
    const ip = requestHeaders['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const userAgent = requestHeaders['user-agent'] || '';
    const referer = requestHeaders['referer'] || body.referrer || '';

    const visitorId = hashVisitor(ip, userAgent);

    const { error } = await supabase
      .from('website_activity')
      .insert({
        shop_id: shop_id || null,
        contact_id: contact_id || null,
        event_type: event_type || 'page_view',
        activity_subtype: activity_subtype || null,
        page_url,
        page_title,
        visitor_id: visitorId,
        ip_address: hashIP(ip),
        user_agent: userAgent,
        referrer: referer,
        metadata
      });

    if (error) {
      console.error('Track error:', error);
      throw error;
    }

    if ((shop_id || contact_id) && event_type !== 'page_view') {
      await updateCRM(shop_id, contact_id, event_type, activity_subtype);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Track activity error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed' }) };
  }
};

async function updateCRM(shopId, contactId, eventType, subtype) {
  try {
    let cid = contactId;
    
    if (!cid && shopId) {
      const { data: shop } = await supabase
        .from('shops')
        .select('contact_id, name')
        .eq('id', shopId)
        .single();
      cid = shop?.contact_id;
    }

    if (cid) {
      await supabase
        .from('contacts')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', cid);

      const descriptions = {
        'click:directions': 'Clicked directions on joe directory',
        'click:phone': 'Clicked phone on joe directory',
        'click:website': 'Clicked website on joe directory',
        'click:upvote_button': 'Clicked upvote button',
        'form_submit:upvote': 'Submitted order ahead request',
        'form_submit:claim': 'Submitted claim listing'
      };

      const key = eventType + ':' + subtype;
      const subject = descriptions[key] || (eventType + ' on joe directory');

      await supabase.from('activities').insert({
        activity_type: 'website_interaction',
        contact_id: cid,
        shop_id: shopId,
        subject: subject,
        notes: JSON.stringify({ event_type: eventType, subtype: subtype }),
        team_member_email: 'thrive@joe.coffee'
      });
    }
  } catch (err) {
    console.error('CRM update error:', err);
  }
}

function hashIP(ip) {
  if (!ip || ip === 'unknown') return null;
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

function hashVisitor(ip, ua) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip + ':' + ua).digest('hex').substring(0, 24);
}
