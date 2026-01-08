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

    // Generate visitor ID hash from IP + user agent
    const visitorId = hashVisitor(ip, userAgent);

    // Insert activity
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

    // Update CRM if contact or shop linked
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
    
    // Get contact from shop if not provided
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

      await supabase.from('activities').insert({
        activity_type: 'website_interaction',
        contact_id: cid,
        shop_id: shopId,
        subject: descriptions[`${eventType}:${subtype}`] || `${eventType} on joe directory`,
        notes: JSON.stringify({ event_type: eventType, subtype })
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
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 24);
}