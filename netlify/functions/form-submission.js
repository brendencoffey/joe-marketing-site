// netlify/functions/form-submission.js
// Handles inbound form submissions from joe.coffee/for-coffee-shops

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jkowvlicgmahpvdszxbw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb3d2bGljZ21haHB2ZHN6eGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUzMzA2ODAsImV4cCI6MjA1MDkwNjY4MH0.aum4nkLxAyTN4dxFWHRFMGRJnJBO2JBjeW4SAKS2m0Q';

// Email service (Resend) - you'll need to add your API key
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

// Default assignee - change this or implement round-robin later
const DEFAULT_ASSIGNEE = 'brenden@joe.coffee';

// Region-based assignment (for future use)
const REGION_ASSIGNMENTS = {
  // West Coast
  'WA': 'brenden@joe.coffee',
  'OR': 'brenden@joe.coffee',
  'CA': 'brenden@joe.coffee',
  'AK': 'brenden@joe.coffee',
  'HI': 'brenden@joe.coffee',
  // Mountain
  'MT': 'brenden@joe.coffee',
  'ID': 'brenden@joe.coffee',
  'WY': 'brenden@joe.coffee',
  'CO': 'brenden@joe.coffee',
  'UT': 'brenden@joe.coffee',
  'NV': 'brenden@joe.coffee',
  'AZ': 'brenden@joe.coffee',
  'NM': 'brenden@joe.coffee',
  // Add more regions/team members as needed
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
    // Parse form data (handles both JSON and form-urlencoded)
    let data;
    const contentType = event.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      data = JSON.parse(event.body);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      data = Object.fromEntries(new URLSearchParams(event.body));
    } else {
      // Try JSON first, fall back to form-urlencoded
      try {
        data = JSON.parse(event.body);
      } catch {
        data = Object.fromEntries(new URLSearchParams(event.body));
      }
    }

    console.log('Form submission received:', data);

    // Extract fields (matching the form screenshot)
    const {
      coffee_shop,
      company_name,
      shop_name,
      first_name,
      last_name,
      email,
      phone,
      mobile_phone,
      city,
      state,
      coffee_shop_type,
      shop_type,
      monthly_revenue,
      total_monthly_revenue,
      target_launch_date,
      launch_date,
      referral,
      referred_by,
      how_did_you_hear,
      hear_about_us,
      website
    } = data;

    // Normalize field names (forms might use different names)
    const formData = {
      companyName: coffee_shop || company_name || shop_name || 'Unknown Shop',
      firstName: first_name || data.firstName || '',
      lastName: last_name || data.lastName || '',
      email: email || data.email || '',
      phone: phone || mobile_phone || data.phone || '',
      city: city || data.city || '',
      state: state || data.state || '',
      shopType: coffee_shop_type || shop_type || '',
      monthlyRevenue: monthly_revenue || total_monthly_revenue || '',
      targetLaunchDate: target_launch_date || launch_date || '',
      referral: referral || referred_by || '',
      howDidYouHear: how_did_you_hear || hear_about_us || '',
      website: website || ''
    };

    // Determine assignee based on region (or use default)
    const stateCode = getStateCode(formData.state);
    const assignedTo = REGION_ASSIGNMENTS[stateCode] || DEFAULT_ASSIGNEE;

    // 1. Create Company (in shops table)
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
        lead_score: 75, // Inbound leads get higher score
        assigned_to: assignedTo,
        contact_name: `${formData.firstName} ${formData.lastName}`.trim(),
        notes: buildNotes(formData)
      }])
      .select()
      .single();

    if (shopError) {
      console.error('Error creating shop:', shopError);
      throw shopError;
    }

    console.log('Created shop:', shop.id);

    // 2. Create Contact
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
      throw contactError;
    }

    console.log('Created contact:', contact.id);

    // 3. Create Deal
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
      throw dealError;
    }

    console.log('Created deal:', deal.id);

    // 4. Create Activity to log the submission
    const { error: activityError } = await supabase
      .from('activities')
      .insert([{
        contact_id: contact.id,
        shop_id: shop.id,
        deal_id: deal.id,
        activity_type: 'note',
        notes: `📥 INBOUND FORM SUBMISSION\n\nShop: ${formData.companyName}\nContact: ${formData.firstName} ${formData.lastName}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nCity: ${formData.city}, ${formData.state}\n\nShop Type: ${formData.shopType}\nMonthly Revenue: ${formData.monthlyRevenue}\nTarget Launch: ${formData.targetLaunchDate}\nReferral: ${formData.referral}\nHow they heard: ${formData.howDidYouHear}`,
        team_member_email: 'system',
        team_member_name: 'Form Submission'
      }]);

    if (activityError) {
      console.error('Error creating activity:', activityError);
      // Don't throw - this is non-critical
    }

    // 5. Create a Task for follow-up
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { error: taskError } = await supabase
      .from('tasks')
      .insert([{
        title: `Follow up with ${formData.companyName} - Inbound Lead`,
        due_date: tomorrow.toISOString().split('T')[0],
        contact_id: contact.id,
        deal_id: deal.id,
        assigned_to: assignedTo,
        notes: `New inbound lead from website form.\nContact: ${formData.firstName} ${formData.lastName}\nPhone: ${formData.phone}\nEmail: ${formData.email}`
      }]);

    if (taskError) {
      console.error('Error creating task:', taskError);
      // Don't throw - this is non-critical
    }

    // 6. Send email notification to assignee
    if (RESEND_API_KEY) {
      await sendNotificationEmail(assignedTo, formData, deal.id);
    } else {
      console.log('No RESEND_API_KEY set, skipping email notification');
    }

    // Return success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Form submitted successfully',
        data: {
          shop_id: shop.id,
          contact_id: contact.id,
          deal_id: deal.id,
          assigned_to: assignedTo
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

// Helper: Build notes from form data
function buildNotes(formData) {
  const notes = [];
  if (formData.shopType) notes.push(`Shop Type: ${formData.shopType}`);
  if (formData.monthlyRevenue) notes.push(`Monthly Revenue: ${formData.monthlyRevenue}`);
  if (formData.targetLaunchDate) notes.push(`Target Launch: ${formData.targetLaunchDate}`);
  if (formData.referral && formData.referral !== 'No') notes.push(`Referral: ${formData.referral}`);
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

// Helper: Send notification email via Resend
async function sendNotificationEmail(toEmail, formData, dealId) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
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
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Contact:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formData.firstName} ${formData.lastName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="mailto:${formData.email}">${formData.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="tel:${formData.phone}">${formData.phone}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Location:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formData.city}, ${formData.state}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Shop Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formData.shopType || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Monthly Revenue:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formData.monthlyRevenue || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Target Launch:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formData.targetLaunchDate || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>How they heard:</strong></td>
                  <td style="padding: 8px 0;">${formData.howDidYouHear || 'Not specified'}</td>
                </tr>
              </table>
              
              <div style="margin-top: 20px; text-align: center;">
                <a href="https://joe.coffee/crm/#deal-${dealId}" 
                   style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  View Deal in CRM →
                </a>
              </div>
            </div>
            
            <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
              A follow-up task has been created for tomorrow.
            </div>
          </div>
        `
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend error:', error);
    } else {
      console.log('Notification email sent to:', toEmail);
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
