// netlify/functions/form-submission.js
// Handles inbound form submissions from joe.coffee/for-coffee-shops

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL = 'https://jkowvlicgmahpvdszxbw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb3d2bGljZ21haHB2ZHN6eGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUzMzA2ODAsImV4cCI6MjA1MDkwNjY4MH0.aum4nkLxAyTN4dxFWHRFMGRJnJBO2JBjeW4SAKS2m0Q';

// Email service (Resend) - add your API key in Netlify env vars
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

// Default assignee
const DEFAULT_ASSIGNEE = 'brenden@joe.coffee';

// Region-based assignment
const REGION_ASSIGNMENTS = {
  'WA': 'brenden@joe.coffee',
  'OR': 'brenden@joe.coffee',
  'CA': 'brenden@joe.coffee',
  'AK': 'brenden@joe.coffee',
  'HI': 'brenden@joe.coffee',
  'MT': 'brenden@joe.coffee',
  'ID': 'brenden@joe.coffee',
  'WY': 'brenden@joe.coffee',
  'CO': 'brenden@joe.coffee',
  'UT': 'brenden@joe.coffee',
  'NV': 'brenden@joe.coffee',
  'AZ': 'brenden@joe.coffee',
  'NM': 'brenden@joe.coffee',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Parse form data
    let data;
    const contentType = event.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      data = JSON.parse(event.body);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      data = Object.fromEntries(new URLSearchParams(event.body));
    } else {
      try {
        data = JSON.parse(event.body);
      } catch {
        data = Object.fromEntries(new URLSearchParams(event.body));
      }
    }

    console.log('Form submission received:', JSON.stringify(data, null, 2));

    // Extract and normalize fields
    const formData = {
      companyName: data.coffee_shop || data.company_name || data.shop_name || 'Unknown Shop',
      firstName: data.first_name || data.firstName || '',
      lastName: data.last_name || data.lastName || '',
      email: data.email || '',
      phone: data.phone || data.mobile_phone || '',
      city: data.city || '',
      state: data.state || '',
      shopType: data.coffee_shop_type || data.shop_type || '',
      monthlyRevenue: data.total_monthly_revenue || data.monthly_revenue || '',
      targetLaunchDate: data.target_launch_date || data.launch_date || '',
      wasReferred: data.was_referred || '',
      referral: data.referred_by || data.referral || '',
      howDidYouHear: data.how_did_you_hear || data.hear_about_us || '',
      website: data.website || ''
    };

    // Determine assignee based on region
    const stateCode = getStateCode(formData.state);
    const assignedTo = REGION_ASSIGNMENTS[stateCode] || DEFAULT_ASSIGNEE;

    // 1. Create Company (shops table)
    console.log('Creating shop...');
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert([{
        name: formData.companyName,
        city: formData.city,
        state: stateCode || formData.state,
        phone: formData.phone,
        email: formData.email,
        website: formData.website,
        lifecycle_stage: 'lead',
        pipeline_stage: 'new',
        lead_score: 75,
        assigned_to: assignedTo,
        contact_name: `${formData.firstName} ${formData.lastName}`.trim(),
        notes: buildNotes(formData)
      }])
      .select()
      .single();

    if (shopError) {
      console.error('Error creating shop:', shopError);
      throw new Error(`Failed to create shop: ${shopError.message}`);
    }
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

    if (contactError) {
      console.error('Error creating contact:', contactError);
      throw new Error(`Failed to create contact: ${contactError.message}`);
    }
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
        notes: `Inbound form submission\nTarget launch: ${formData.targetLaunchDate || 'Not specified'}\nShop type: ${formData.shopType || 'Not specified'}\nMonthly revenue: ${formData.monthlyRevenue || 'Not specified'}`
      }])
      .select()
      .single();

    if (dealError) {
      console.error('Error creating deal:', dealError);
      throw new Error(`Failed to create deal: ${dealError.message}`);
    }
    console.log('Created deal:', deal.id);

    // 4. Create Activity (non-critical)
    try {
      await supabase
        .from('activities')
        .insert([{
          contact_id: contact.id,
          shop_id: shop.id,
          deal_id: deal.id,
          activity_type: 'note',
          notes: `📥 INBOUND FORM SUBMISSION\n\nShop: ${formData.companyName}\nContact: ${formData.firstName} ${formData.lastName}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nCity: ${formData.city}, ${formData.state}\n\nShop Type: ${formData.shopType}\nMonthly Revenue: ${formData.monthlyRevenue}\nTarget Launch: ${formData.targetLaunchDate}\nReferred: ${formData.wasReferred}\nReferral: ${formData.referral}\nHow they heard: ${formData.howDidYouHear}`,
          team_member_email: 'system',
          team_member_name: 'Form Submission'
        }]);
      console.log('Created activity');
    } catch (e) {
      console.error('Activity creation failed (non-critical):', e.message);
    }

    // 5. Create Task (non-critical)
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      await supabase
        .from('tasks')
        .insert([{
          title: `Follow up with ${formData.companyName} - Inbound Lead`,
          due_date: tomorrow.toISOString().split('T')[0],
          contact_id: contact.id,
          deal_id: deal.id,
          assigned_to: assignedTo,
          notes: `New inbound lead from website form.\nContact: ${formData.firstName} ${formData.lastName}\nPhone: ${formData.phone}\nEmail: ${formData.email}`
        }]);
      console.log('Created task');
    } catch (e) {
      console.error('Task creation failed (non-critical):', e.message);
    }

    // 6. Send email notification (non-critical)
    if (RESEND_API_KEY) {
      try {
        await sendNotificationEmail(assignedTo, formData, deal.id);
        console.log('Sent notification email');
      } catch (e) {
        console.error('Email notification failed (non-critical):', e.message);
      }
    } else {
      console.log('No RESEND_API_KEY set, skipping email notification');
    }

    // Generate submission GUID for thank-you page
    const submissionGuid = generateGuid();

    // Return success with redirect URL
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Form submitted successfully',
        redirect_url: `https://joe.coffee/thank-you/?submissionGuid=${submissionGuid}`,
        data: {
          shop_id: shop.id,
          contact_id: contact.id,
          deal_id: deal.id,
          assigned_to: assignedTo,
          submission_guid: submissionGuid
        }
      })
    };

  } catch (error) {
    console.error('Form submission error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

// Helper: Generate GUID
function generateGuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper: Build notes from form data
function buildNotes(formData) {
  const notes = [];
  if (formData.shopType) notes.push(`Shop Type: ${formData.shopType}`);
  if (formData.monthlyRevenue) notes.push(`Monthly Revenue: ${formData.monthlyRevenue}`);
  if (formData.targetLaunchDate) notes.push(`Target Launch: ${formData.targetLaunchDate}`);
  if (formData.wasReferred === 'Yes' && formData.referral) notes.push(`Referral: ${formData.referral}`);
  if (formData.howDidYouHear) notes.push(`Source: ${formData.howDidYouHear}`);
  return notes.join('\n');
}

// Helper: Convert state name to code
function getStateCode(state) {
  if (!state) return '';
  if (state.length === 2) return state.toUpperCase();
  
  const states = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC'
  };
  
  return states[state.toLowerCase()] || state;
}

// Helper: Send notification email via Resend using https module
function sendNotificationEmail(toEmail, formData, dealId) {
  return new Promise((resolve, reject) => {
    const emailData = JSON.stringify({
      from: 'joe CRM <notifications@joe.coffee>',
      to: toEmail,
      subject: `🔥 New Inbound Lead: ${formData.companyName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a1a; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">☕ New Lead from Website</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2 style="color: #1a1a1a; margin-top: 0;">${formData.companyName}</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Contact:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formData.firstName} ${formData.lastName}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="mailto:${formData.email}">${formData.email}</a></td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="tel:${formData.phone}">${formData.phone}</a></td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Location:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formData.city}, ${formData.state}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Shop Type:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formData.shopType || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Monthly Revenue:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formData.monthlyRevenue || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0;"><strong>How they heard:</strong></td><td style="padding: 8px 0;">${formData.howDidYouHear || 'Not specified'}</td></tr>
            </table>
            <div style="margin-top: 20px; text-align: center;">
              <a href="https://joe.coffee/crm/" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in CRM →</a>
            </div>
          </div>
        </div>
      `
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Resend API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(emailData);
    req.end();
  });
}
