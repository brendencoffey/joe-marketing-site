const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const data = JSON.parse(event.body);
    
    // Initialize clients
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY // Use service key for server-side
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Generate submission GUID
    const guid = crypto.randomUUID();

    // 1. Create shop record
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert([{
        name: data.coffee_shop,
        city: data.city,
        state: data.state,
        phone: data.phone,
        contact_name: `${data.first_name} ${data.last_name}`.trim(),
        lifecycle_stage: 'lead',
        pipeline_stage: 'new',
        lead_score: 50,
        lead_source: 'inbound',
        assigned_to: data.assigned_to || 'brenden@joe.coffee',
        notes: buildNotes(data)
      }])
      .select()
      .single();

    if (shopError) throw shopError;

    // 2. Create contact record
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert([{
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        shop_id: shop.id,
        lifecycle_stage: 'lead',
        lead_source: 'inbound_form',
        assigned_to: data.assigned_to || 'brenden@joe.coffee'
      }])
      .select()
      .single();

    if (contactError) console.error('Contact error:', contactError);

    // 3. Create deal record
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert([{
        name: `${data.coffee_shop} - Inbound Lead`,
        shop_id: shop.id,
        contact_id: contact?.id,
        stage: 'new_lead',
        assigned_to: data.assigned_to || 'brenden@joe.coffee',
        notes: `Submitted via website form\nGUID: ${guid}`
      }])
      .select()
      .single();

    if (dealError) console.error('Deal error:', dealError);

    // 4. Create follow-up task
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await supabase
      .from('tasks')
      .insert([{
        title: `Follow up with ${data.first_name} from ${data.coffee_shop}`,
        task_type: 'call',
        due_date: tomorrow.toISOString().split('T')[0],
        contact_id: contact?.id,
        deal_id: deal?.id,
        assigned_to: data.assigned_to || 'brenden@joe.coffee',
        status: 'not_started',
        notes: 'Inbound lead - follow up within 24 hours'
      }]);

    // 5. Get team members for notification
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('email, name');

    const recipientEmails = teamMembers?.map(t => t.email).filter(Boolean) || ['brenden@joe.coffee'];

    // 6. Send email notification
    const emailHtml = buildEmailHtml(data, shop, guid);
    
    await resend.emails.send({
      from: 'joe CRM <notifications@joe.coffee>',
      to: recipientEmails,
      subject: `☕ New Inbound Lead: ${data.coffee_shop}`,
      html: emailHtml
    });

    // Return success with redirect URL
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        guid,
        redirectUrl: `/thank-you/?submissionGuid=${guid}`
      })
    };

  } catch (error) {
    console.error('Submit lead error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function buildNotes(data) {
  let notes = [];
  if (data.coffee_shop_type) notes.push(`Type: ${data.coffee_shop_type}`);
  if (data.total_monthly_revenue) notes.push(`Revenue: ${data.total_monthly_revenue}`);
  if (data.target_launch_date) notes.push(`Target Launch: ${data.target_launch_date}`);
  if (data.was_referred === 'Yes' && data.referred_by) notes.push(`Referred by: ${data.referred_by}`);
  if (data.how_did_you_hear?.length) notes.push(`How they heard: ${data.how_did_you_hear.join(', ')}`);
  return notes.join('\n');
}

function buildEmailHtml(data, shop, guid) {
  const crmUrl = `https://joe.coffee/crm/#shop=${shop.id}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #1a1a1a; color: #fff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .emoji { font-size: 32px; margin-bottom: 8px; }
        .content { padding: 24px; }
        .field { margin-bottom: 16px; }
        .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .value { font-size: 16px; color: #1a1a1a; font-weight: 500; }
        .highlight { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; }
        .highlight-label { font-size: 12px; color: #92400e; text-transform: uppercase; margin-bottom: 4px; }
        .highlight-value { font-size: 18px; color: #1a1a1a; font-weight: 600; }
        .btn { display: inline-block; background: #f59e0b; color: #1a1a1a; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
        .footer { background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 13px; color: #6b7280; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="emoji">☕</div>
          <h1>New Inbound Lead!</h1>
        </div>
        <div class="content">
          <div class="highlight">
            <div class="highlight-label">Coffee Shop</div>
            <div class="highlight-value">${data.coffee_shop}</div>
          </div>
          
          <div class="grid">
            <div class="field">
              <div class="label">Contact</div>
              <div class="value">${data.first_name} ${data.last_name}</div>
            </div>
            <div class="field">
              <div class="label">Location</div>
              <div class="value">${data.city}, ${data.state}</div>
            </div>
            <div class="field">
              <div class="label">Email</div>
              <div class="value">${data.email}</div>
            </div>
            <div class="field">
              <div class="label">Phone</div>
              <div class="value">${data.phone || 'Not provided'}</div>
            </div>
            <div class="field">
              <div class="label">Shop Type</div>
              <div class="value">${data.coffee_shop_type || 'Not specified'}</div>
            </div>
            <div class="field">
              <div class="label">Monthly Revenue</div>
              <div class="value">${data.total_monthly_revenue || 'Not specified'}</div>
            </div>
          </div>
          
          ${data.target_launch_date ? `
          <div class="field">
            <div class="label">Target Launch Date</div>
            <div class="value">${data.target_launch_date}</div>
          </div>
          ` : ''}
          
          ${data.was_referred === 'Yes' ? `
          <div class="field">
            <div class="label">Referred By</div>
            <div class="value">${data.referred_by || 'Not specified'}</div>
          </div>
          ` : ''}
          
          ${data.how_did_you_hear?.length ? `
          <div class="field">
            <div class="label">How They Heard About Us</div>
            <div class="value">${data.how_did_you_hear.join(', ')}</div>
          </div>
          ` : ''}
          
          <center>
            <a href="${crmUrl}" class="btn">View in CRM →</a>
          </center>
        </div>
        <div class="footer">
          This lead was submitted via the joe.coffee website.<br>
          Follow up within 24 hours for best results!
        </div>
      </div>
    </body>
    </html>
  `;
}
