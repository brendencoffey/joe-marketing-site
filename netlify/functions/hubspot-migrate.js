const { createClient } = require('@supabase/supabase-js');

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

async function hubspotFetch(endpoint, params = {}) {
  const url = new URL(`https://api.hubapi.com${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' }
  });
  return res.json();
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const results = { owners: 0, companies: 0, contacts: 0, deals: 0, notes: 0, errors: [] };

  try {
    // 1. Fetch and map owners to team members
    console.log('Fetching owners...');
    const ownersData = await hubspotFetch('/crm/v3/owners');
    const ownerMap = {};
    for (const owner of ownersData.results || []) {
      ownerMap[owner.id] = owner.email;
      const { error } = await supabase.from('team_members').upsert({
        email: owner.email,
        name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email,
        role: 'Sales',
        is_active: true,
        hubspot_owner_id: owner.id
      }, { onConflict: 'email' });
      if (!error) results.owners++;
    }

    // 2. Fetch companies
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
        const { data, error } = await supabase.from('companies').upsert({
          name: props.name || 'Unknown',
          phone: props.phone,
          city: props.city,
          state: props.state,
          website: props.website || props.domain,
          assigned_to: ownerMap[props.hubspot_owner_id] || null,
          hubspot_id: company.id
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

    // 4. Fetch deals with associations
    console.log('Fetching deals...');
    let hasMoreDeals = true;
    let dealAfter = undefined;
    while (hasMoreDeals) {
      const params = { limit: 100, properties: 'dealname,amount,dealstage,closedate,hubspot_owner_id,pipeline', associations: 'contacts,companies' };
      if (dealAfter) params.after = dealAfter;
      const dealsData = await hubspotFetch('/crm/v3/objects/deals', params);
      
      for (const deal of dealsData.results || []) {
        const props = deal.properties || {};
        const contactAssoc = deal.associations?.contacts?.results?.[0]?.id;
        const companyAssoc = deal.associations?.companies?.results?.[0]?.id;
        
        const { error } = await supabase.from('deals').upsert({
          name: props.dealname || 'Untitled Deal',
          amount: props.amount ? parseFloat(props.amount) : null,
          stage: mapDealStage(props.dealstage),
          close_date: props.closedate,
          assigned_to: ownerMap[props.hubspot_owner_id] || null,
          contact_id: contactAssoc ? contactMap[contactAssoc] : null,
          company_id: companyAssoc ? companyMap[companyAssoc] : null,
          hubspot_id: deal.id
        }, { onConflict: 'hubspot_id' });
        if (!error) results.deals++;
      }
      
      hasMoreDeals = dealsData.paging?.next?.after;
      dealAfter = dealsData.paging?.next?.after;
    }

    // 5. Fetch notes/engagements
    console.log('Fetching notes...');
    let hasMoreNotes = true;
    let noteAfter = undefined;
    while (hasMoreNotes) {
      const params = { limit: 100, properties: 'hs_timestamp,hs_note_body,hubspot_owner_id', associations: 'contacts,companies' };
      if (noteAfter) params.after = noteAfter;
      const notesData = await hubspotFetch('/crm/v3/objects/notes', params);
      
      for (const note of notesData.results || []) {
        const props = note.properties || {};
        const contactAssoc = note.associations?.contacts?.results?.[0]?.id;
        
        if (contactAssoc && contactMap[contactAssoc]) {
          const { error } = await supabase.from('activities').insert({
            contact_id: contactMap[contactAssoc],
            activity_type: 'note',
            notes: props.hs_note_body || '',
            team_member_email: ownerMap[props.hubspot_owner_id] || null,
            created_at: props.hs_timestamp,
            external_id: `hubspot_note_${note.id}`
          });
          if (!error) results.notes++;
        }
      }
      
      hasMoreNotes = notesData.paging?.next?.after;
      noteAfter = notesData.paging?.next?.after;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, results }) };
  } catch (error) {
    console.error('Migration error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, results }) };
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

function mapDealStage(hsStage) {
  const map = {
    'appointmentscheduled': 'appointment',
    'qualifiedtobuy': 'qualified',
    'presentationscheduled': 'presentation',
    'decisionmakerboughtin': 'contract',
    'contractsent': 'contract',
    'closedwon': 'closed_won',
    'closedlost': 'closed_lost'
  };
  return map[hsStage?.toLowerCase()] || 'appointment';
}
