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
  const batchSize = 20;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const results = { imported: 0, errors: [], nextCursor: null, complete: false };

  try {
    // Fetch HubSpot pipelines to get proper mapping
    const hsPipelines = await hubspotFetch('/crm/v3/pipelines/deals');
    const hsPipelineMap = {};
    const hsStageMap = {};
    for (const p of hsPipelines.results || []) {
      hsPipelineMap[p.id] = p.label.toLowerCase();
      for (const s of p.stages || []) {
        hsStageMap[s.id] = { stage: s.label, pipeline: p.label.toLowerCase() };
      }
    }
    console.log('HubSpot pipelines:', Object.keys(hsPipelineMap));
    console.log('HubSpot stages:', Object.keys(hsStageMap).length);

    // Fetch Supabase pipelines
    const { data: dbPipelines } = await supabase.from('pipelines').select('id, name');
    const { data: dbStages } = await supabase.from('pipeline_stages').select('id, pipeline_id, name, stage_key');
    
    // Map HubSpot pipeline names to Supabase pipeline IDs
    const pipelineNameToId = {};
    for (const p of dbPipelines || []) {
      const name = p.name.toLowerCase();
      pipelineNameToId[name] = p.id;
      // Also map partial matches
      if (name.includes('inbound')) pipelineNameToId['inbounds'] = p.id;
      if (name.includes('outbound')) pipelineNameToId['outbound sales leads'] = p.id;
      if (name.includes('onboarding')) pipelineNameToId['onboarding'] = p.id;
      if (name.includes('account')) pipelineNameToId['account management - growth'] = p.id;
    }
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
        
        // Get pipeline name from HubSpot pipeline ID
        const hsPipelineName = hsPipelineMap[props.pipeline] || 'inbounds';
        const pipelineId = pipelineNameToId[hsPipelineName] || defaultPipelineId;
        
        // Get stage from HubSpot stage ID
        const hsStageInfo = hsStageMap[props.dealstage];
        const stageKey = mapDealStage(hsStageInfo?.stage || props.dealstage, hsPipelineName, dbStages, pipelineId);
        
        const { error } = await supabase.from('deals').upsert({
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
        
        if (error) {
          console.error('Deal error:', props.dealname, error.message);
          results.errors.push(props.dealname + ': ' + error.message);
        } else {
          results.imported++;
        }
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

function mapDealStage(hsStageName, hsPipelineName, dbStages, pipelineId) {
  if (!hsStageName) return 'mql';
  
  const stageName = hsStageName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
  
  // Find matching stage in our database for this pipeline
  const pipelineStages = dbStages?.filter(s => s.pipeline_id === pipelineId) || [];
  
  // Try exact match on stage_key
  let match = pipelineStages.find(s => s.stage_key === stageName);
  if (match) return match.stage_key;
  
  // Try partial match on name
  match = pipelineStages.find(s => s.name.toLowerCase().includes(stageName) || stageName.includes(s.name.toLowerCase()));
  if (match) return match.stage_key;
  
  // Try mapping common variations
  const stageMap = {
    'marketing_qualified_leads': 'mql',
    'sales_qualified_lead': 'sql',
    'contacted_awaiting_response': 'contacted',
    'meeting_scheduled': 'meeting_scheduled',
    'awaiting_reg__launch_date': 'awaiting_launch',
    'handoff_to_onboarding': 'handoff',
    'launch_complete': 'launched',
    'nurtured__no_engagement': 'nurtured',
    'cold_leads': 'cold',
    'closed_lost': 'closed_lost',
    'waitlist': 'waitlist',
    'previous_partners': 'previous_partner',
    'new_prospects': 'new_prospect',
    'warm_leads': 'warm',
    'pos_warm_leads': 'pos_warm',
    'demo_completed': 'demo_completed',
    'registered_awaiting_completion': 'registered',
    'seattle_leads': 'seattle',
    'lost_not_interested': 'lost',
    'not_a_fit': 'not_fit',
    'digital_onboarding': 'digital_ob',
    'hardware__marketing_fulfillment': 'hardware',
    'team_onboarding': 'team_ob',
    'launch_incomplete': 'launch_incomplete',
    'past_30_days': 'past_30',
    '90_day_check_in': '90_day',
    'joe_point_of_sale': 'joe_pos',
    'strategic': 'strategic',
    'enhanced_600_or_less': 'enhanced',
    'basic': 'basic',
    'at_risk': 'at_risk',
    'dormant': 'dormant',
    'closed_lost_partners': 'closed_lost',
    'unmanaged_partners': 'unmanaged'
  };
  
  if (stageMap[stageName]) {
    match = pipelineStages.find(s => s.stage_key === stageMap[stageName]);
    if (match) return match.stage_key;
  }
  
  // Default to first stage in pipeline
  return pipelineStages[0]?.stage_key || 'mql';
}
