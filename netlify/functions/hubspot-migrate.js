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
    throw new Error(`HubSpot API error ${res.status}: ${text}`);
  }
  return res.json();
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (!HUBSPOT_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'HUBSPOT_TOKEN not configured' }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const results = { owners: 0, companies: 0, contacts: 0, deals: 0, notes: 0, errors: [] };

  try {
    // Fetch pipelines from Supabase to map HubSpot pipelines
    const { data: dbPipelines } = await supabase.from('pipelines').select('id, name');
    const { data: dbStages } = await supabase.from('pipeline_stages').select('id, pipeline_id, name, stage_key');
    
    // Map pipeline names to IDs
    const pipelineMap = {
      'inbounds': dbPipelines?.find(p => p.name.toLowerCase().includes('inbound'))?.id,
      'outbound sales leads': dbPipelines?.find(p => p.name.toLowerCase().includes('outbound'))?.id,
      'onboarding': dbPipelines?.find(p => p.name.toLowerCase().includes('onboarding'))?.id,
      'account management - growth': dbPipelines?.find(p => p.name.toLowerCase().includes('account'))?.id,
      'ecommerce pipeline': dbPipelines?.find(p => p.name.toLowerCase().includes('ecommerce'))?.id
    };
    const defaultPipelineId = dbPipelines?.[0]?.id;

    // 1. Fetch and map owners to team members
    console.log('Fetching owners...');
    const ownersData = await hubspotFetch('/crm/v3/owners');
    const ownerMap = {};
    for (const owner of ownersData.results || []) {
      ownerMap[owner.id] = owner.email;
      const { error } = await supabase.from('team_members').upsert({
        email: owner.email,
        name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email,
        role: 'sales',
        is_active: true,
        hubspot_owner_id: owner.id
      }, { onConflict: 'email' });
      if (!error) results.owners++;
      else results.errors.push(`Owner ${owner.email}: ${error.message}`);
    }

    // 2. Fetch companies -> shops
    console.log('Fetching companies...');
    const companyMap = {};
    let hasMoreCompanies = true;
    let companyAfter = undefined;
    while (hasMoreCompanies) {
      const params = { limit: 100, properties: 'name,domain,phone,city,state,industry,website,hubspot_owner_id' };
      if (companyAfter) params.after = companyAfter;
      const companiesData = await hubspotFetch('/crm/v3/objects/companies', params);
      
      for (const company of companiesData.results || []) {
        const props = company.properties || {};
        const { data, error } = await supabase.from('shops').upsert({
          name: props.name || 'Unknown',
          phone: props.phone,
          city: props.city,
          state: props.state,
          website: props.website || props.domain,
          assigned_to: ownerMap[props.hubspot_owner_id] || null,
          hubspot_id: company.id,
          lifecycle_stage: 'lead'
        }, { onConflict: 'hubspot_id' }).select().single();
        if (data) companyMap[company.id] = data.id;
        if (!error) results.companies++;
      }
      
      hasMoreCompanies = companiesData.paging?.next?.after;
      companyAfter = companiesData.paging?.next?.after;
    }

    // 3. Fetch contacts with company associations
    console.log('Fetching contacts...');
    const contactMap = {};
    let hasMoreContacts = true;
    let contactAfter = undefined;
    while (hasMoreContacts) {
      const params = { limit: 100, properties: 'firstname,lastname,email,phone,jobtitle,lifecyclestage,hubspot_owner_id,hs_lead_status', associations: 'companies' };
      if (contactAfter) params.after = contactAfter;
      const contactsData = await hubspotFetch('/crm/v3/objects/contacts', params);
      
      for (const contact of contactsData.results || []) {
        const props = contact.properties || {};
        const companyAssoc = contact.associations?.companies?.results?.[0]?.id;
        
        const { data, error } = await supabase.from('contacts').upsert({
          first_name: props.firstname || '',
          last_name: props.lastname || '',
          email: props.email,
          phone: props.phone,
          job_title: props.jobtitle,
          lifecycle_stage: mapLifecycleStage(props.lifecyclestage),
          lead_status: props.hs_lead_status,
          assigned_to: ownerMap[props.hubspot_owner_id] || null,
          company_id: companyAssoc ? companyMap[companyAssoc] : null,
          hubspot_id: contact.id
        }, { onConflict: 'hubspot_id' }).select().single();
        if (data) contactMap[contact.id] = data.id;
        if (!error) results.contacts++;
      }
      
      hasMoreContacts = contactsData.paging?.next?.after;
      contactAfter = contactsData.paging?.next?.after;
    }

    // 4. Fetch deals with all properties
    console.log('Fetching deals...');
    let hasMoreDeals = true;
    let dealAfter = undefined;
    const dealProperties = [
      'dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id', 'pipeline',
      'type_of_coffee_shop', 'monthly_shop_revenue', 'market_segment', 'quantity',
      'sales_outreach', 'how_did_you_hear_about_us_', 'account_type', 'sales_representative',
      'scheduled_launch_date', 'actual_launch_date', 'launch_representative', 'waitlist_reason',
      'merchant_company_id', 'merchant_store_id', 'joe_product', 'square_integration',
      'revenue_based_tiering', 'pgc_assigned', 'ob_sub_stage', 'city', 'state'
    ].join(',');
    
    while (hasMoreDeals) {
      const params = { limit: 100, properties: dealProperties, associations: 'contacts,companies' };
      if (dealAfter) params.after = dealAfter;
      const dealsData = await hubspotFetch('/crm/v3/objects/deals', params);
      
      for (const deal of dealsData.results || []) {
        const props = deal.properties || {};
        const contactAssoc = deal.associations?.contacts?.results?.[0]?.id;
        const companyAssoc = deal.associations?.companies?.results?.[0]?.id;
        
        // Map HubSpot pipeline to Supabase pipeline_id
        const hsPipeline = (props.pipeline || '').toLowerCase();
        const pipelineId = pipelineMap[hsPipeline] || defaultPipelineId;
        const stageKey = mapDealStage(props.dealstage, props.pipeline, dbStages, pipelineId);
        
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
          sales_rep: props.sales_representative || null,
          scheduled_launch_date: props.scheduled_launch_date || null,
          actual_launch_date: props.actual_launch_date || null,
          launch_rep: props.launch_representative || null,
          waitlist_reason: props.waitlist_reason || null,
          ob_sub_stage: props.ob_sub_stage || null,
          merchant_company_id: props.merchant_company_id || null,
          merchant_store_id: props.merchant_store_id || null,
          joe_product: props.joe_product || null,
          square_integration: props.square_integration === 'true' || props.square_integration === true,
          revenue_tiering: props.revenue_based_tiering || null,
          pgc_assigned: props.pgc_assigned || null
        }, { onConflict: 'hubspot_id' });
        if (!error) results.deals++;
        else results.errors.push(`Deal ${props.dealname}: ${error.message}`);
      }
      
      hasMoreDeals = dealsData.paging?.next?.after;
      dealAfter = dealsData.paging?.next?.after;
    }

    // 5. Fetch notes/engagements
    console.log('Fetching notes...');
    let hasMoreNotes = true;
    let noteAfter = undefined;
    while (hasMoreNotes) {
      const params = { limit: 100, properties: 'hs_timestamp,hs_note_body,hubspot_owner_id', associations: 'contacts,companies,deals' };
      if (noteAfter) params.after = noteAfter;
      const notesData = await hubspotFetch('/crm/v3/objects/notes', params);
      
      for (const note of notesData.results || []) {
        const props = note.properties || {};
        const contactAssoc = note.associations?.contacts?.results?.[0]?.id;
        const companyAssoc = note.associations?.companies?.results?.[0]?.id;
        
        if (props.hs_note_body) {
          const { error } = await supabase.from('activities').upsert({
            contact_id: contactAssoc ? contactMap[contactAssoc] : null,
            company_id: companyAssoc ? companyMap[companyAssoc] : null,
            activity_type: 'note',
            notes: props.hs_note_body || '',
            team_member_email: ownerMap[props.hubspot_owner_id] || null,
            created_at: props.hs_timestamp || new Date().toISOString(),
            hubspot_id: note.id
          }, { onConflict: 'hubspot_id' });
          if (!error) results.notes++;
        }
      }
      
      hasMoreNotes = notesData.paging?.next?.after;
      noteAfter = notesData.paging?.next?.after;
    }

    console.log('Migration complete:', results);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, results }) };
  } catch (error) {
    console.error('Migration error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, stack: error.stack, results }) };
  }
};

function mapLifecycleStage(hsStage) {
  const map = {
    'subscriber': 'lead',
    'lead': 'lead', 
    'marketingqualifiedlead': 'mql',
    'salesqualifiedlead': 'sql',
    'opportunity': 'opportunity',
    'customer': 'customer',
    'evangelist': 'customer',
    'other': 'lead'
  };
  return map[hsStage?.toLowerCase()] || 'lead';
}

function mapDealStage(hsStage, hsPipeline, dbStages, pipelineId) {
  const stage = (hsStage || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Stage mappings by pipeline
  const stageMaps = {
    'inbounds': {
      'marketingqualifiedleads': 'mql',
      'salesqualifiedlead': 'sql',
      'contactedawaitingresponse': 'contacted',
      'meetingscheduled': 'meeting_scheduled',
      'awaitingreglaunchdate': 'awaiting_launch',
      'handofftoonboarding': 'handoff',
      'launchcomplete': 'launched',
      'nurturednoengagement': 'nurtured',
      'coldleads': 'cold',
      'closedlost': 'closed_lost',
      'waitlist': 'waitlist',
      'previouspartners': 'previous_partner'
    },
    'outbound sales leads': {
      'newprospects': 'new_prospect',
      'warmleads': 'warm',
      'poswarmleads': 'pos_warm',
      'meetingscheduled': 'meeting_scheduled',
      'democompleted': 'demo_completed',
      'registeredawaitingcompletion': 'registered',
      'seattleleads': 'seattle',
      'lostnotinterested': 'lost',
      'notafit': 'not_fit',
      'coldleads': 'cold'
    },
    'onboarding': {
      'digitalonboarding': 'digital_ob',
      'hardwaremarketingfulfillment': 'hardware',
      'teamonboarding': 'team_ob',
      'launchcomplete': 'launch_complete',
      'launchincomplete': 'launch_incomplete'
    },
    'account management - growth': {
      'past30days': 'past_30',
      '90daycheckin': '90_day',
      'joepos': 'joe_pos',
      'strategic': 'strategic',
      'enhanced600orless': 'enhanced',
      'basic': 'basic',
      'atrisk': 'at_risk',
      'dormant': 'dormant',
      'closedlostpartners': 'closed_lost',
      'unmanagedpartners': 'unmanaged'
    }
  };
  
  const pipelineName = (hsPipeline || '').toLowerCase();
  const stageMap = stageMaps[pipelineName] || stageMaps['inbounds'];
  const mappedStage = stageMap[stage];
  
  if (mappedStage) return mappedStage;
  
  // Try to find a matching stage in the pipeline
  const pipelineStages = dbStages?.filter(s => s.pipeline_id === pipelineId) || [];
  const matchingStage = pipelineStages.find(s => 
    s.stage_key.toLowerCase() === stage || 
    s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === stage
  );
  
  return matchingStage?.stage_key || pipelineStages[0]?.stage_key || 'new_lead';
}
