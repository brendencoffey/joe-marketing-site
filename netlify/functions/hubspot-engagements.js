const { createClient } = require('@supabase/supabase-js');

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_KEY;
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

  try {
    const { cursor, limit = 100 } = JSON.parse(event.body || '{}');

    // Build lookup maps for contacts and deals by hubspot_id
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, hubspot_id, shop_id')
      .not('hubspot_id', 'is', null);
    
    const { data: deals } = await supabase
      .from('deals')
      .select('id, hubspot_id, shop_id, contact_id')
      .not('hubspot_id', 'is', null);

    const contactMap = new Map(contacts?.map(c => [c.hubspot_id, { id: c.id, shop_id: c.shop_id }]) || []);
    const dealMap = new Map(deals?.map(d => [d.hubspot_id, { id: d.id, shop_id: d.shop_id, contact_id: d.contact_id }]) || []);

    // Use legacy Engagements API - works with basic CRM scopes
    let url = `https://api.hubapi.com/engagements/v1/engagements/paged?limit=${limit}`;
    if (cursor) url += `&offset=${cursor}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${HUBSPOT_TOKEN}` }
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`HubSpot API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const results = data.results || [];
    
    let imported = 0;
    let skipped = 0;
    let noMatch = 0;

    for (const item of results) {
      const engagement = item.engagement || {};
      const metadata = item.metadata || {};
      const associations = item.associations || {};
      
      const engagementType = engagement.type; // EMAIL, CALL, MEETING, NOTE, TASK
      
      // Skip tasks - we have our own task system
      if (engagementType === 'TASK') {
        skipped++;
        continue;
      }

      // Find linked contact/deal
      const contactIds = associations.contactIds || [];
      const dealIds = associations.dealIds || [];
      
      let contactId = null;
      let dealId = null;
      let shopId = null;

      // Match to our contacts
      for (const hsContactId of contactIds) {
        const match = contactMap.get(String(hsContactId));
        if (match) {
          contactId = match.id;
          shopId = match.shop_id;
          break;
        }
      }

      // Match to our deals
      for (const hsDealId of dealIds) {
        const match = dealMap.get(String(hsDealId));
        if (match) {
          dealId = match.id;
          shopId = shopId || match.shop_id;
          contactId = contactId || match.contact_id;
          break;
        }
      }

      // Skip if no matching contact or deal
      if (!contactId && !dealId) {
        noMatch++;
        continue;
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from('activities')
        .select('id')
        .eq('hubspot_id', String(engagement.id))
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Build activity record based on type
      let activityType, notes, outcome;
      const timestamp = engagement.timestamp ? new Date(engagement.timestamp).toISOString() : new Date().toISOString();

      switch (engagementType) {
        case 'EMAIL':
          activityType = 'email';
          const subject = metadata.subject || '(no subject)';
          const body = metadata.text || metadata.html || '';
          notes = `Subject: ${subject}\n\n${body}`.substring(0, 5000);
          outcome = metadata.direction === 'INCOMING' ? 'received' : 'sent';
          break;
          
        case 'CALL':
          activityType = 'call';
          notes = metadata.body || metadata.title || 'Call logged';
          if (metadata.durationMilliseconds) {
            notes += `\n\nDuration: ${Math.round(metadata.durationMilliseconds / 1000 / 60)} minutes`;
          }
          outcome = metadata.disposition || metadata.status || null;
          break;
          
        case 'MEETING':
          activityType = 'meeting';
          notes = `${metadata.title || 'Meeting'}\n\n${metadata.body || ''}`.trim();
          outcome = metadata.outcome || null;
          break;
          
        case 'NOTE':
          activityType = 'note';
          notes = metadata.body || '';
          outcome = null;
          break;
          
        default:
          skipped++;
          continue;
      }

      // Insert activity
      const { error } = await supabase.from('activities').insert({
        contact_id: contactId,
        deal_id: dealId,
        shop_id: shopId,
        activity_type: activityType,
        notes: notes.substring(0, 5000),
        outcome,
        hubspot_id: String(engagement.id),
        created_at: timestamp,
        team_member_email: engagement.ownerId ? `hubspot-${engagement.ownerId}` : null
      });

      if (error) {
        console.error('Insert error:', error);
        skipped++;
      } else {
        imported++;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        results: {
          fetched: results.length,
          imported,
          skipped,
          noMatch,
          hasMore: data.hasMore,
          nextCursor: data.offset || null
        }
      })
    };

  } catch (error) {
    console.error('Engagement import error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};