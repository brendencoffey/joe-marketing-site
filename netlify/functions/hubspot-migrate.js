const { createClient } = require('@supabase/supabase-js');

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

async function hubspotFetch(endpoint, params = {}) {
  const url = new URL(`https://api.hubapi.com${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${text.slice(0,200)}`);
  }
  return res.json();
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (!HUBSPOT_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'HUBSPOT_TOKEN not configured' }) };
  }

  const body = JSON.parse(event.body || '{}');
  const importType = body.type || 'owners';
  const cursor = body.cursor || null;
  const batchSize = 20; // Smaller batches to avoid timeout

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const results = { imported: 0, errors: [], nextCursor: null, complete: false };

  try {
    // Fetch pipelines from Supabase
    const { data: dbPipelines } = await supabase.from('pipelines').select('id, name');
    const { data: dbStages } = await supabase.from('pipeline_stages').select('id, pipeline_id, name, stage_key');
    
    const pipelineMap = {};
    (dbPipelines || []).forEach(p => {
      const name = p.name.toLowerCase();
      if (name.includes('inbound')) pipelineMap['inbounds'] = p.id;
      if (name.includes('outbound')) pipelineMap['outbound sales leads'] = p.id;
      if (name.includes('onboarding')) pipelineMap['onboarding'] = p.id;
      if (name.includes('account')) pipelineMap['account management - growth'] = p.id;
    });
    const defaultPipelineId = dbPipelines?.[0]?.id;

    // Get owner map
    const { data: teamMembers } = await supabase.from('team_members').select('email, hubspot_owner_id');
    const ownerMap = {};
    (teamMembers || []).forEach(t => { if(t.hubspot_owner_id) ownerMap[t.hubspot_owner_id] = t.email; });

    // Get company map
    const { data: existingShops } = await supabase.from('shops').select('id, hubspot_id');
    const companyMap = {};
    (existingShops || []).forEach(s => { if(s.hubspot_id) companyMap[s.hubspot_id] = s.id; });

    // Get contact map
    const { data: existingContacts } = await supabase.from('contacts').select('id, hubspot_id');
    const contactMap = {};
    (existingContacts || []).forEach(c => { if(c.hubspot_id) contactMap[c.hubspot_id] = c.id; });

    if (importType === 'owners') {
      console.log('Fetching owners...');
      const ownersData = await hubspotFetch('/crm/v3/owners');
      for (const owner of ownersData.results || []) {
        ownerMap[owner.id] = owner.email;
        await supabase.from('team_members').upsert({
          email: owner.email,
          name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email,
          role: 'sales',
          is_active: true,
          hubspot_owner_id: owner.id
        }, { onConflict: 'email' });
        results.imported++;
      }
      results.complete = true;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, type: 'owners', results }) };
    }

    if (importType === 'companies') {
      console.log('Fetching companies batch...');
      const params = { limit: batchSize, properties: 'name,domain,phone,city,state,website,hubspot_owner_id' };
      if (cursor) params.after = cursor;
      const data = await hubspotFetch('/crm/v3/objects/companies', params);
      
      for (const company of data.results || []) {
        const props = company.properties || {};
        await supabase.from('shops').upsert({
          name: props.name || 'Unknown',
          phone: props.phone || null,
          city: props.city || null,
          state: props.state || null,
          website: props.website || props.domain || null,
          assigned_to: ownerMap[props.hubspot_owner_id] || null,
          hubspot_id: company.id,
          lifecycle_stage: 'lead'
        }, { onConflict: 'hubspot_id' });
        results.imported++;
      }
      
      results.nextCursor = data.paging?.next?.after || null;
      results.complete = !results.nextCursor;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, type: 'companies', results }) };
    }

    if (importType === 'contacts') {
      console.log('Fetching contacts batch...');
      const params = { limit: batchSize, properties: 'firstname,lastname,email,phone,jobtitle,lifecyclestage,hubspot_owner_id', associations: 'companies' };
      if (cursor) params.after = cursor;
      const data = await hubspotFetch('/crm/v3/objects/contacts', params);
      
      for (const contact of data.results || []) {
        const props = contact.properties || {};
        const companyAssoc = contact.associations?.companies?.results?.[0]?.id;
        
        await supabase.from('contacts').upsert({
          first_name: props.firstname || '',
          last_name: props.lastname || '',
          email: props.email || null,
          phone: props.phone || null,
          job_title: props.jobtitle || null,
          lifecycle_stage: mapLifecycleStage(props.lifecyclestage),
          assigned_to: ownerMap[props.hubspot_owner_id] || null,
          company_id: companyAssoc ? companyMap[companyAssoc] : null,
          hubspot_id: contact.id
        }, { onConflict: 'hubspot_id' });
        results.imported++;
      }
      
      results.nextCursor = data.paging?.next?.after || null;
      results.complete = !results.nextCursor;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, type: 'contacts', results }) };
    }

    if (importType === 'deals') {
      console.log('Fetching deals batch...');
      const dealProps = 'dealname,amount,dealstage,closedate,hubspot_owner_id,pipeline,type_of_coffee_shop,monthly_shop_revenue,market_segment,quantity,sales_outreach,how_did_you_hear_about_us_,account_type,ob_sub_stage';
      const params = { limit: batchSize, properties: dealProps, associations: 'contacts,companies' };
      if (cursor) params.after = cursor;
      const data = await hubspotFetch('/crm/v3/objects/deals', params);
      
      for (const deal of data.results || []) {
        const props = deal.properties || {};
        const contactAssoc = deal.associations?.contacts?.results?.[0]?.id;
        const companyAssoc = deal.associations?.companies?.results?.[0]?.id;
        
        const hsPipeline = (props.pipeline || '').toLowerCase();
        const pipelineId = pipelineMap[hsPipeline] || defaultPipelineId;
        const stageKey = mapDealStage(props.dealstage, hsPipeline, dbStages, pipelineId);
        
        await supabase.from('deals').upsert({
          name: props.dealname || 'Untitled Deal',
          amount: props.amount ? parseFloat(props.amount) : null,
          pipeline_id: pipelineId,
          stage: stageKey,
          close_date: props.closedate || null,
          assigned_to: ownerMap[props.hubspot_owner_id] || null,
          contact_id: contactAssoc ? contactMap[contactAssoc] : null,
          company_id: companyAssoc ? companyMap[companyAssoc] : null,
          shop_id: companyAssoc ? companyMap[companyAssoc] : null,
          hubspot_id: deal.id,
          coffee_shop_type: props.type_of_coffee_shop || null,
          monthly_revenue: props.monthly_shop_revenue || null,
          market_segment: props.market_segment || null,
          quantity: props.quantity ? parseInt(props.quantity) : null,
          sales_outreach: props.sales_outreach || null,
          how_heard: props.how_did_you_hear_about_us_ || null,
          account_type: props.account_type || null,
          ob_sub_stage: props.ob_sub_stage || null
        }, { onConflict: 'hubspot_id' });
        results.imported++;
      }
      
      results.nextCursor = data.paging?.next?.after || null;
      results.complete = !results.nextCursor;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, type: 'deals', results }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, results }) };
  } catch (error) {
    console.error('Migration error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, results }) };
  }
};

function mapLifecycleStage(hsStage) {
  const map = { 'subscriber': 'lead', 'lead': 'lead', 'marketingqualifiedlead': 'mql', 'salesqualifiedlead': 'sql', 'opportunity': 'opportunity', 'customer': 'customer' };
  return map[hsStage?.toLowerCase()] || 'lead';
}

function mapDealStage(hsStage, hsPipeline, dbStages, pipelineId) {
  const stage = (hsStage || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const stageMaps = {
    'inbounds': { 'marketingqualifiedleads': 'mql', 'salesqualifiedlead': 'sql', 'contactedawaitingresponse': 'contacted', 'meetingscheduled': 'meeting_scheduled', 'awaitingreglaunchdate': 'awaiting_launch', 'handofftoonboarding': 'handoff', 'launchcomplete': 'launched', 'nurturednoengagement': 'nurtured', 'coldleads': 'cold', 'closedlost': 'closed_lost', 'waitlist': 'waitlist', 'previouspartners': 'previous_partner' },
    'outbound sales leads': { 'newprospects': 'new_prospect', 'warmleads': 'warm', 'poswarmleads': 'pos_warm', 'meetingscheduled': 'meeting_scheduled', 'democompleted': 'demo_completed', 'registeredawaitingcompletion': 'registered', 'seattleleads': 'seattle', 'lostnotinterested': 'lost', 'notafit': 'not_fit', 'coldleads': 'cold' },
    'onboarding': { 'digitalonboarding': 'digital_ob', 'hardwaremarketingfulfillment': 'hardware', 'teamonboarding': 'team_ob', 'launchcomplete': 'launch_complete', 'launchincomplete': 'launch_incomplete' },
    'account management - growth': { 'past30days': 'past_30', '90daycheckin': '90_day', 'joepos': 'joe_pos', 'strategic': 'strategic', 'enhanced600orless': 'enhanced', 'basic': 'basic', 'atrisk': 'at_risk', 'dormant': 'dormant', 'closedlostpartners': 'closed_lost', 'unmanagedpartners': 'unmanaged' }
  };
  const stageMap = stageMaps[hsPipeline] || stageMaps['inbounds'];
  if (stageMap[stage]) return stageMap[stage];
  const pipelineStages = dbStages?.filter(s => s.pipeline_id === pipelineId) || [];
  return pipelineStages[0]?.stage_key || 'mql';
}
