/**
 * Claim Listing - Netlify Function
 * Processes claim submissions and integrates with CRM
 * 
 * Creates:
 * 1. Contact (or updates existing by email)
 * 2. Company (linked to enriched_shop)
 * 3. Deal in Claim Listing pipeline
 * 4. Assigns to sales rep by territory
 * 5. Triggers welcome email via Resend
 */

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Territory assignments
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

// Pipeline ID for Claim Listing
const CLAIM_PIPELINE_ID = '5bbc92dc-0120-4942-86cf-1754529df76a';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { shop_id, shop_name, first_name, last_name, email, phone, role } = body;

    // Validate required fields
    if (!shop_id || !email || !first_name || !last_name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // 1. Get the shop details
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Shop not found' })
      };
    }

    // 2. Determine territory owner
    const stateCode = (shop.state_code || '').toUpperCase();
    const owner = getOwnerByState(stateCode);

    // 3. Find or create Contact
    let contact;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (existingContact) {
      // Update existing contact
      const { data: updated } = await supabase
        .from('contacts')
        .update({
          first_name: first_name || existingContact.first_name,
          last_name: last_name || existingContact.last_name,
          phone: phone || existingContact.phone,
          job_title: role || existingContact.job_title,
          lead_source: 'claim_listing',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingContact.id)
        .select()
        .single();
      contact = updated || existingContact;
    } else {
      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name,
          last_name,
          email: email.toLowerCase(),
          phone,
          job_title: role,
          lifecycle_stage: 'lead',
          lead_status: 'new',
          lead_source: 'claim_listing',
          owner_id: owner.email
        })
        .select()
        .single();

      if (contactError) throw contactError;
      contact = newContact;
    }

    // 4. Find or create Company (linked to enriched_shop)
    let company;
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('shop_id', shop_id)
      .single();

    if (existingCompany) {
      company = existingCompany;
      // Link contact to company if not already
      await supabase
        .from('contacts')
        .update({ company_id: company.id })
        .eq('id', contact.id);
    } else {
      // Create company from shop data
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: shop.name,
          address: shop.address,
          city: shop.city,
          state: shop.state,
          zip: shop.zip,
          phone: shop.phone || phone,
          website: shop.website,
          shop_id: shop_id,
          google_place_id: shop.google_place_id,
          source: 'claim_listing',
          owner_id: owner.email
        })
        .select()
        .single();

      if (companyError) throw companyError;
      company = newCompany;

      // Link contact to company
      await supabase
        .from('contacts')
        .update({ company_id: company.id })
        .eq('id', contact.id);
    }

    // 5. Get first stage of Claim Listing pipeline
    const { data: stages } = await supabase
      .from('pipeline_stages')
      .select('id, name')
      .eq('pipeline_id', CLAIM_PIPELINE_ID)
      .order('position', { ascending: true })
      .limit(1);

    const firstStageId = stages?.[0]?.id;

    // 6. Create Deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        name: `Claim: ${shop.name}`,
        pipeline_id: CLAIM_PIPELINE_ID,
        stage_id: firstStageId,
        contact_id: contact.id,
        company_id: company.id,
        shop_id: company.id, // Legacy field
        shop_id: shop_id,
        owner_id: owner.email,
        deal_type: 'new_business',
        lead_source: 'claim_listing',
        notes: `Claimed via website by ${first_name} ${last_name} (${role})`
      })
      .select()
      .single();

    if (dealError) throw dealError;

    // 7. Update shop claim status
    await supabase
      .from('shops')
      .update({
        claim_status: 'pending',
        contact_id: contact.id,
        company_id: company.id
      })
      .eq('id', shop_id);

    // 8. Track activity
    await supabase.from('website_activity').insert({
      shop_id: shop_id,
      activity_type: 'claim_submitted',
      metadata: {
        contact_id: contact.id,
        company_id: company.id,
        deal_id: deal.id,
        role
      }
    });

    // 9. Create activity record in CRM
    await supabase.from('activities').insert({
      type: 'form_submission',
      contact_id: contact.id,
      company_id: company.id,
      deal_id: deal.id,
      description: `Claim listing form submitted for ${shop.name}`,
      metadata: { role, shop_id }
    });

    // 10. Send welcome email via Resend
    try {
      await resend.emails.send({
        from: `${owner.name} <${owner.email}>`,
        to: email,
        subject: `Thanks for claiming ${shop.name} on joe!`,
        html: getWelcomeEmail(first_name, shop.name, owner)
      });
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      // Don't fail the request if email fails
    }

    // 11. Notify sales rep (internal)
    try {
      await resend.emails.send({
        from: 'joe CRM <crm@joe.coffee>',
        to: [owner.email, 'thrive@joe.coffee'],
        subject: `🎉 New Claim: ${shop.name}`,
        html: getNotificationEmail(shop, contact, deal)
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
        contact_id: contact.id,
        company_id: company.id,
        deal_id: deal.id
      })
    };

  } catch (err) {
    console.error('Claim listing error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process claim' })
    };
  }
};

function getOwnerByState(stateCode) {
  for (const [region, data] of Object.entries(TERRITORY_ASSIGNMENTS)) {
    if (data.states.includes(stateCode)) {
      return { email: data.owner, name: data.name };
    }
  }
  // Default to west coast
  return { email: TERRITORY_ASSIGNMENTS.west.owner, name: TERRITORY_ASSIGNMENTS.west.name };
}

function getWelcomeEmail(firstName, shopName, owner) {
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
    .cta { display: inline-block; background: #000; color: #fff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
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

function getNotificationEmail(shop, contact, deal) {
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
      <div class="value">${contact.job_title || 'Not specified'}</div>
    </div>
    
    <a href="https://joe.coffee/crm/deals/${deal.id}" class="btn">View in CRM →</a>
  </div>
</body>
</html>
`;
}
