/**
 * Submit Claim - Handles "Claim This Listing" form submissions
 * Routes to Claim Listing pipeline
 * 
 * Flow:
 * 1. Create/update Contact
 * 2. Create/find Company (linked to Shop)
 * 3. Create Deal in Claim Listing pipeline
 * 4. Update Shop with claim status
 * 5. Log activity
 * 6. Send emails (confirmation + internal notification)
 */

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const CLAIM_PIPELINE_ID = '5bbc92dc-0120-4942-86cf-1754529df76a';
const DEFAULT_STAGE = 'MQL';

// Territory assignments for lead routing
const TERRITORY_ASSIGNMENTS = {
  east: {
    states: ['CT', 'DE', 'FL', 'GA', 'MA', 'MD', 'ME', 'NC', 'NH', 'NJ', 'NY', 'PA', 'RI', 'SC', 'VA', 'VT', 'WV', 'DC'],
    owner: 'kayla@joe.coffee',
    name: 'Kayla Ortiz'
  },
  midwest: {
    states: ['IA', 'IL', 'IN', 'KS', 'KY', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'OK', 'SD', 'TN', 'TX', 'WI'],
    owner: 'ally@joe.coffee',
    name: 'Ally Jones'
  },
  west: {
    states: ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NM', 'NV', 'OR', 'UT', 'WA', 'WY'],
    owner: 'allison@joe.coffee',
    name: 'Allison Taylor'
  }
};

function getOwnerByState(stateCode) {
  const state = (stateCode || '').toUpperCase();
  for (const [region, data] of Object.entries(TERRITORY_ASSIGNMENTS)) {
    if (data.states.includes(state)) {
      return { email: data.owner, name: data.name };
    }
  }
  // Default to west coast
  return { email: TERRITORY_ASSIGNMENTS.west.owner, name: TERRITORY_ASSIGNMENTS.west.name };
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
    
    const required = ['shop_id', 'first_name', 'last_name', 'email', 'phone', 'role', 'coffee_shop_type', 'current_pos'];
    for (const field of required) {
      if (!data[field]) {
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: `Missing required field: ${field}` }) 
        };
      }
    }

    const now = new Date().toISOString();
    const contactName = `${data.first_name} ${data.last_name}`.trim();

    // 0. Get the shop first (we need it for territory assignment and company creation)
    const { data: shop, error: shopFetchError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', data.shop_id)
      .single();

    if (shopFetchError || !shop) {
      console.error('Shop fetch error:', shopFetchError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Shop not found' })
      };
    }

    // Determine territory owner
    const owner = getOwnerByState(shop.state_code);

    // 1. Create or update Contact
    let contact;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .ilike('email', data.email)
      .single();

    if (existingContact) {
      const { data: updated } = await supabase
        .from('contacts')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          job_title: data.role,
          updated_at: now,
          shop_id: data.shop_id,
          owner_id: owner.email
        })
        .eq('id', existingContact.id)
        .select()
        .single();
      contact = updated || existingContact;
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email.toLowerCase(),
          phone: data.phone,
          job_title: data.role,
          source: 'claim-listing',
          shop_id: data.shop_id,
          owner_id: owner.email,
          lifecycle_stage: 'lead',
          lead_status: 'new',
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (contactError) {
        console.error('Contact creation error:', contactError);
        throw new Error('Failed to create contact');
      }
      contact = newContact;
    }

    // 2. Find or create Company (linked to shop)
    let company;
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('shop_id', data.shop_id)
      .single();

    if (existingCompany) {
      company = existingCompany;
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: shop.name,
          address: shop.address,
          city: shop.city,
          state: shop.state,
          zip: shop.zip,
          phone: shop.phone || data.phone,
          website: shop.website,
          shop_id: data.shop_id,
          google_place_id: shop.google_place_id,
          source: 'claim-listing',
          owner_id: owner.email,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (companyError) {
        console.error('Company creation error:', companyError);
        throw new Error('Failed to create company');
      }
      company = newCompany;
    }

    // Link contact to company
    await supabase
      .from('contacts')
      .update({ company_id: company.id })
      .eq('id', contact.id);

    // 3. Get MQL stage ID from pipeline
    const { data: stages } = await supabase
      .from('pipeline_stages')
      .select('id, name')
      .eq('pipeline_id', CLAIM_PIPELINE_ID)
      .order('position', { ascending: true })
      .limit(1);

    const stageId = stages?.[0]?.id;

    // 4. Create Deal in Claim Listing pipeline
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        name: `Claim: ${shop.name}`,
        pipeline_id: CLAIM_PIPELINE_ID,
        stage_id: stageId,
        stage: DEFAULT_STAGE,
        company_id: company.id,
        contact_id: contact.id,
        shop_id: data.shop_id,
        source: 'claim-listing',
        owner_id: owner.email,
        metadata: {
          shop_name: shop.name,
          shop_city: shop.city,
          shop_state: shop.state,
          claimant_name: contactName,
          claimant_email: data.email,
          claimant_phone: data.phone,
          claimant_role: data.role,
          coffee_shop_type: data.coffee_shop_type,
          current_pos: data.current_pos,
          claimed_at: now
        },
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (dealError) {
      console.error('Deal creation error:', dealError);
      throw new Error('Failed to create deal');
    }

    // 5. Update shop with claim status
    await supabase
      .from('shops')
      .update({
        contact_id: contact.id,
        company_id: company.id,
        contact_name: contactName,
        contact_title: data.role,
        email: data.email,
        phone: data.phone,
        coffee_shop_type: data.coffee_shop_type,
        current_pos: data.current_pos,
        claim_status: 'pending',
        source: 'claim-listing',
        pipeline_stage: DEFAULT_STAGE,
        lifecycle_stage: 'lead',
        lead_source: 'claim-listing',
        owner_id: owner.email,
        updated_at: now,
        last_activity_at: now
      })
      .eq('id', data.shop_id);

    // 6. Log activity
    await supabase.from('activities').insert({
      type: 'claim_submitted',
      shop_id: data.shop_id,
      contact_id: contact.id,
      company_id: company.id,
      deal_id: deal.id,
      description: `Listing claimed by ${contactName} (${data.role}) - ${data.coffee_shop_type}, POS: ${data.current_pos}`,
      metadata: {
        email: data.email,
        phone: data.phone,
        role: data.role,
        coffee_shop_type: data.coffee_shop_type,
        current_pos: data.current_pos
      },
      created_at: now
    });

    // 7. Send confirmation email to claimant
    try {
      await resend.emails.send({
        from: `${owner.name} <${owner.email}>`,
        to: data.email,
        subject: `Thanks for claiming ${shop.name} on joe!`,
        html: getConfirmationEmail(data.first_name, shop.name, owner)
      });
    } catch (emailErr) {
      console.error('Confirmation email error:', emailErr);
    }

    // 8. Send internal notification to sales rep + thrive
    try {
      await resend.emails.send({
        from: 'joe CRM <crm@joe.coffee>',
        to: [owner.email, 'thrive@joe.coffee'],
        subject: `🎉 New Claim: ${shop.name}`,
        html: getNotificationEmail(shop, contact, deal, data)
      });
    } catch (emailErr) {
      console.error('Notification email error:', emailErr);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Claim submitted successfully',
        shop_id: data.shop_id,
        contact_id: contact.id,
        company_id: company.id,
        deal_id: deal.id
      })
    };

  } catch (error) {
    console.error('Submit claim error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
};

function getConfirmationEmail(firstName, shopName, owner) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { margin-bottom: 30px; }
    h1 { font-size: 24px; margin-bottom: 20px; }
    p { margin-bottom: 16px; color: #4B5563; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 14px; color: #6B7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe" height="32">
    </div>
    
    <h1>Thanks for claiming ${shopName}!</h1>
    
    <p>Hi ${firstName},</p>
    
    <p>We're excited that you're interested in connecting ${shopName} with the joe community of indie coffee lovers.</p>
    
    <p>Here's what happens next:</p>
    
    <ol style="color: #4B5563; margin-bottom: 20px;">
      <li>I'll review your claim within 1-2 business days</li>
      <li>We'll reach out to verify your ownership</li>
      <li>Once verified, you can update your listing</li>
      <li>Optionally, explore joe's mobile ordering & rewards platform</li>
    </ol>
    
    <p>In the meantime, your coffee shop is already being discovered by coffee lovers in your area through joe's location directory.</p>
    
    <p>Have questions? Just reply to this email - I'm here to help!</p>
    
    <p>
      Cheers,<br>
      <strong>${owner.name}</strong><br>
      joe Coffee
    </p>
    
    <div class="footer">
      <p>joe Coffee | <a href="https://joe.coffee">joe.coffee</a></p>
    </div>
  </div>
</body>
</html>
`;
}

function getNotificationEmail(shop, contact, deal, formData) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 20px; }
    .card { background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .label { font-size: 12px; color: #6B7280; text-transform: uppercase; }
    .value { font-size: 16px; font-weight: 500; margin-bottom: 12px; }
    .btn { display: inline-block; background: #000; color: #fff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎉 New Claim Listing Submission</h1>
    
    <div class="card">
      <div class="label">Shop</div>
      <div class="value">${shop.name}</div>
      
      <div class="label">Location</div>
      <div class="value">${shop.city}, ${shop.state}</div>
      
      <div class="label">Contact</div>
      <div class="value">${contact.first_name} ${contact.last_name}</div>
      
      <div class="label">Email</div>
      <div class="value">${contact.email}</div>
      
      <div class="label">Phone</div>
      <div class="value">${contact.phone || 'Not provided'}</div>
      
      <div class="label">Role</div>
      <div class="value">${formData.role || 'Not specified'}</div>
      
      <div class="label">Shop Type</div>
      <div class="value">${formData.coffee_shop_type || 'Not specified'}</div>
      
      <div class="label">Current POS</div>
      <div class="value">${formData.current_pos || 'Not specified'}</div>
    </div>
    
    <a href="https://joe.coffee/crm/deals/${deal.id}" class="btn">View Deal in CRM →</a>
  </div>
</body>
</html>
`;
}