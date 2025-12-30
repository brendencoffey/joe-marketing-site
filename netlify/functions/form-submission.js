// netlify/functions/form-submission.js
// Uses direct HTTPS calls instead of Supabase client to avoid DNS issues

const https = require('https');

const SUPABASE_URL = 'jkowvlicgmahpvdszxbw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb3d2bGljZ21haHB2ZHN6eGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUzMzA2ODAsImV4cCI6MjA1MDkwNjY4MH0.aum4nkLxAyTN4dxFWHRFMGRJnJBO2JBjeW4SAKS2m0Q';
const DEFAULT_ASSIGNEE = 'brenden@joe.coffee';

// Helper: Make Supabase REST API call
function supabaseRequest(method, table, data, returnData = true) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: SUPABASE_URL,
      port: 443,
      path: `/rest/v1/${table}${returnData ? '?select=*' : ''}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': returnData ? 'return=representation' : 'return=minimal',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = body ? JSON.parse(body) : null;
            resolve(Array.isArray(parsed) ? parsed[0] : parsed);
          } catch {
            resolve(body);
          }
        } else {
          reject(new Error(`Supabase ${table}: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
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
    const data = JSON.parse(event.body);
    console.log('Form submission:', JSON.stringify(data, null, 2));

    const formData = {
      companyName: data.coffee_shop || 'Unknown Shop',
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      email: data.email || '',
      phone: data.phone || '',
      city: data.city || '',
      state: data.state || '',
      shopType: data.coffee_shop_type || '',
      monthlyRevenue: data.total_monthly_revenue || '',
      targetLaunchDate: data.target_launch_date || '',
      howDidYouHear: data.how_did_you_hear || ''
    };

    // 1. Create Shop
    console.log('Creating shop...');
    const shop = await supabaseRequest('POST', 'shops', {
      name: formData.companyName,
      city: formData.city,
      state: formData.state,
      phone: formData.phone,
      email: formData.email,
      lifecycle_stage: 'lead',
      pipeline_stage: 'new',
      lead_score: 75,
      assigned_to: DEFAULT_ASSIGNEE,
      contact_name: `${formData.firstName} ${formData.lastName}`.trim(),
      notes: `Type: ${formData.shopType}\nRevenue: ${formData.monthlyRevenue}\nLaunch: ${formData.targetLaunchDate}\nSource: ${formData.howDidYouHear}`
    });
    console.log('Shop created:', shop.id);

    // 2. Create Contact
    console.log('Creating contact...');
    const contact = await supabaseRequest('POST', 'contacts', {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      company_id: shop.id,
      lifecycle_stage: 'lead',
      lead_status: 'new',
      lead_source: 'inbound',
      assigned_to: DEFAULT_ASSIGNEE
    });
    console.log('Contact created:', contact.id);

    // 3. Create Deal
    console.log('Creating deal...');
    const deal = await supabaseRequest('POST', 'deals', {
      name: `${formData.companyName} Deal`,
      company_id: shop.id,
      contact_id: contact.id,
      stage: 'new_lead',
      assigned_to: DEFAULT_ASSIGNEE,
      notes: `Inbound: ${formData.shopType}, ${formData.monthlyRevenue}`
    });
    console.log('Deal created:', deal.id);

    // 4. Activity (non-critical)
    try {
      await supabaseRequest('POST', 'activities', {
        contact_id: contact.id,
        shop_id: shop.id,
        deal_id: deal.id,
        activity_type: 'note',
        notes: `📥 INBOUND: ${formData.companyName}`,
        team_member_email: 'system',
        team_member_name: 'Form'
      }, false);
    } catch (e) { console.log('Activity skipped:', e.message); }

    // 5. Task (non-critical)
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await supabaseRequest('POST', 'tasks', {
        title: `Follow up: ${formData.companyName}`,
        due_date: tomorrow.toISOString().split('T')[0],
        contact_id: contact.id,
        deal_id: deal.id,
        assigned_to: DEFAULT_ASSIGNEE
      }, false);
    } catch (e) { console.log('Task skipped:', e.message); }

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
