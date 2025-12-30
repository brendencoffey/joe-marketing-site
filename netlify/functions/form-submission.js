// netlify/functions/form-submission.js
// Handles inbound form submissions from joe.coffee/for-coffee-shops

const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

// Polyfill fetch for Supabase
global.fetch = fetch;

const SUPABASE_URL = 'https://jkowvlicgmahpvdszxbw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb3d2bGljZ21haHB2ZHN6eGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUzMzA2ODAsImV4cCI6MjA1MDkwNjY4MH0.aum4nkLxAyTN4dxFWHRFMGRJnJBO2JBjeW4SAKS2m0Q';

// Default assignee
const DEFAULT_ASSIGNEE = 'brenden@joe.coffee';

// Region-based assignment
const REGION_ASSIGNMENTS = {
  'WA': 'brenden@joe.coffee',
  'OR': 'brenden@joe.coffee',
  'CA': 'brenden@joe.coffee',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    let data;
    const contentType = event.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      data = JSON.parse(event.body);
    } else {
      try {
        data = JSON.parse(event.body);
      } catch {
        data = Object.fromEntries(new URLSearchParams(event.body));
      }
    }

    console.log('Form submission received:', JSON.stringify(data, null, 2));

    const formData = {
      companyName: data.coffee_shop || data.company_name || 'Unknown Shop',
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      email: data.email || '',
      phone: data.phone || data.mobile_phone || '',
      city: data.city || '',
      state: data.state || '',
      shopType: data.coffee_shop_type || '',
      monthlyRevenue: data.total_monthly_revenue || '',
      targetLaunchDate: data.target_launch_date || '',
      wasReferred: data.was_referred || '',
      referral: data.referred_by || '',
      howDidYouHear: data.how_did_you_hear || '',
      website: data.website || ''
    };

    const stateCode = formData.state.length === 2 ? formData.state.toUpperCase() : formData.state;
    const assignedTo = REGION_ASSIGNMENTS[stateCode] || DEFAULT_ASSIGNEE;

    // 1. Create Shop
    console.log('Creating shop...');
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert([{
        name: formData.companyName,
        city: formData.city,
        state: stateCode,
        phone: formData.phone,
        email: formData.email,
        website: formData.website,
        lifecycle_stage: 'lead',
        pipeline_stage: 'new',
        lead_score: 75,
        assigned_to: assignedTo,
        contact_name: `${formData.firstName} ${formData.lastName}`.trim(),
        notes: `Shop Type: ${formData.shopType}\nMonthly Revenue: ${formData.monthlyRevenue}\nTarget Launch: ${formData.targetLaunchDate}\nSource: ${formData.howDidYouHear}`
      }])
      .select()
      .single();

    if (shopError) throw new Error(`Shop: ${shopError.message}`);
    console.log('Created shop:', shop.id);

    // 2. Create Contact
    console.log('Creating contact...');
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert([{
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        company_id: shop.id,
        lifecycle_stage: 'lead',
        lead_status: 'new',
        lead_source: 'inbound',
        assigned_to: assignedTo
      }])
      .select()
      .single();

    if (contactError) throw new Error(`Contact: ${contactError.message}`);
    console.log('Created contact:', contact.id);

    // 3. Create Deal
    console.log('Creating deal...');
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert([{
        name: `${formData.companyName} Deal`,
        company_id: shop.id,
        contact_id: contact.id,
        stage: 'new_lead',
        assigned_to: assignedTo,
        notes: `Inbound submission\nTarget: ${formData.targetLaunchDate}\nType: ${formData.shopType}\nRevenue: ${formData.monthlyRevenue}`
      }])
      .select()
      .single();

    if (dealError) throw new Error(`Deal: ${dealError.message}`);
    console.log('Created deal:', deal.id);

    // 4. Activity (non-critical)
    await supabase.from('activities').insert([{
      contact_id: contact.id,
      shop_id: shop.id,
      deal_id: deal.id,
      activity_type: 'note',
      notes: `📥 INBOUND: ${formData.companyName} - ${formData.firstName} ${formData.lastName} (${formData.email})`,
      team_member_email: 'system',
      team_member_name: 'Form'
    }]).catch(() => {});

    // 5. Task (non-critical)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await supabase.from('tasks').insert([{
      title: `Follow up: ${formData.companyName}`,
      due_date: tomorrow.toISOString().split('T')[0],
      contact_id: contact.id,
      deal_id: deal.id,
      assigned_to: assignedTo
    }]).catch(() => {});

    const guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        redirect_url: `https://joe.coffee/thank-you/?submissionGuid=${guid}`,
        data: { shop_id: shop.id, contact_id: contact.id, deal_id: deal.id }
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
