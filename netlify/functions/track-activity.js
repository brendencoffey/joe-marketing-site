/**
 * Track Activity - Netlify Function
 * Tracks user interactions and updates CRM records
 * 
 * Events:
 * - page_view
 * - click_website
 * - click_phone
 * - click_directions
 * - click_order
 * - click_claim
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
    const { shop_id, type, metadata = {} } = body;

    if (!shop_id || !type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'shop_id and type are required' })
      };
    }

    // Validate activity type
    const validTypes = [
      'page_view',
      'click_website',
      'click_phone',
      'click_directions',
      'click_order',
      'click_claim'
    ];

    if (!validTypes.includes(type)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid activity type' })
      };
    }

    // Get request metadata
    const requestHeaders = event.headers || {};
    const activityMetadata = {
      ...metadata,
      user_agent: requestHeaders['user-agent'],
      referer: requestHeaders['referer'],
      ip_hash: hashIP(requestHeaders['x-forwarded-for'] || requestHeaders['client-ip'])
    };

    // Insert activity (trigger will update analytics)
    const { error: activityError } = await supabase
      .from('website_activity')
      .insert({
        shop_id: shop_id,
        activity_type: type,
        metadata: activityMetadata
      });

    if (activityError) {
      console.error('Activity insert error:', activityError);
      throw activityError;
    }

    // If shop has a linked contact/company, update CRM
    if (type !== 'page_view') {
      await updateCRMRecords(shop_id, type);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('Track activity error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to track activity' })
    };
  }
};

async function updateCRMRecords(shopId, activityType) {
  try {
    // Get shop with linked CRM records
    const { data: shop } = await supabase
      .from('shops')
      .select('contact_id, company_id')
      .eq('id', shopId)
      .single();

    if (!shop) return;

    const activityDescriptions = {
      'click_website': 'Clicked website link on joe directory',
      'click_phone': 'Clicked phone number on joe directory',
      'click_directions': 'Requested directions on joe directory',
      'click_order': 'Clicked order button on joe directory',
      'click_claim': 'Clicked claim listing button'
    };

    // Update contact last activity
    if (shop.contact_id) {
      await supabase
        .from('contacts')
        .update({ 
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', shop.contact_id);
    }

    // Update company engagement (if we have a company)
    if (shop.company_id) {
      // Could increment an engagement counter here
    }

    // Create activity record in CRM activities table
    if (shop.contact_id || shop.company_id) {
      await supabase
        .from('activities')
        .insert({
          type: 'website_interaction',
          contact_id: shop.contact_id,
          company_id: shop.company_id,
          description: activityDescriptions[activityType] || activityType,
          metadata: {
            activity_type: activityType,
            shop_id: shopId,
            source: 'zillow_directory'
          }
        });
    }

  } catch (err) {
    console.error('CRM update error:', err);
    // Don't throw - we don't want to fail the tracking request
  }
}

function hashIP(ip) {
  if (!ip) return null;
  const crypto = require('crypto');
  return crypto.createHash('sha256')
    .update(ip.split(',')[0].trim())
    .digest('hex')
    .substring(0, 16);
}
