const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// State to territory mapping
const STATE_TERRITORIES = {
  // East Coast - Kayla
  'ME': 'east', 'NH': 'east', 'VT': 'east', 'MA': 'east', 'RI': 'east', 'CT': 'east',
  'NY': 'east', 'NJ': 'east', 'PA': 'east', 'DE': 'east', 'MD': 'east', 'DC': 'east',
  'VA': 'east', 'WV': 'east', 'NC': 'east', 'SC': 'east', 'GA': 'east', 'FL': 'east',
  // Midwest/Central - Ally
  'OH': 'midwest', 'IN': 'midwest', 'IL': 'midwest', 'MI': 'midwest', 'WI': 'midwest',
  'MN': 'midwest', 'IA': 'midwest', 'MO': 'midwest', 'ND': 'midwest', 'SD': 'midwest',
  'NE': 'midwest', 'KS': 'midwest', 'OK': 'midwest', 'TX': 'midwest', 'LA': 'midwest',
  'AR': 'midwest', 'KY': 'midwest', 'TN': 'midwest', 'MS': 'midwest', 'AL': 'midwest',
  // West Coast - Allison
  'WA': 'west', 'OR': 'west', 'CA': 'west', 'NV': 'west', 'AZ': 'west', 'UT': 'west',
  'CO': 'west', 'NM': 'west', 'ID': 'west', 'MT': 'west', 'WY': 'west', 'AK': 'west', 'HI': 'west'
};

// Pipeline IDs - update these to match your actual IDs
const INBOUNDS_PIPELINE_ID = 'fc9b8709-238f-4aaa-8f75-e873f259d50c'; // Update if different

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
      process.env.SUPABASE_SERVICE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Generate submission GUID
    const guid = crypto.randomUUID();

    // Determine territory and assigned rep
    const territory = STATE_TERRITORIES[data.state] || 'west';
    const { data: salesRep } = await supabase
      .from('team_members')
      .select('email, name')
      .eq('territory', territory)
      .eq('role', 'sales')
      .single();
    
    const assignedTo = salesRep?.email || 'brenden@joe.coffee';
    const assignedName = salesRep?.name || 'Brenden';

    // ============================================
    // CHECK IF SHOP ALREADY EXISTS (from nurture/enrichment)
    // ============================================
    let existingShop = null;
    let wasNurtured = false;
    let previousSource = null;

    // Try to match by email first
    if (data.email) {
      const { data: byEmail } = await supabase
        .from('shops')
        .select('*')
        .ilike('email', data.email)
        .single();
      if (byEmail) existingShop = byEmail;
    }

    // Try to match by phone
    if (!existingShop && data.phone) {
      const cleanPhone = data.phone.replace(/\D/g, '');
      const { data: byPhone } = await supabase
        .from('shops')
        .select('*')
        .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${data.phone}%`)
        .limit(1)
        .single();
      if (byPhone) existingShop = byPhone;
    }

    // Try to match by name + city + state
    if (!existingShop && data.coffee_shop && data.city && data.state) {
      const { data: byName } = await supabase
        .from('shops')
        .select('*')
        .ilike('name', data.coffee_shop)
        .ilike('city', data.city)
        .eq('state', data.state)
        .limit(1)
        .single();
      if (byName) existingShop = byName;
    }

    let shop;
    let contact;
    let deal;

    if (existingShop) {
      // ============================================
      // EXISTING SHOP - UPDATE & CONVERT FROM NURTURE
      // ============================================
      previousSource = existingShop.source;
      wasNurtured = ['enriched', 'deal', 'hubspot'].includes(previousSource);

      // Update shop with new info and mark as inbound
      const { data: updatedShop, error: updateError } = await supabase
        .from('shops')
        .update({
          source: 'inbound',
          lead_source: 'inbound_form',
          phone: data.phone || existingShop.phone,
          email: data.email || existingShop.email,
          contact_name: `${data.first_name} ${data.last_name}`.trim(),
          lifecycle_stage: 'lead',
          lead_score: Math.max(existingShop.lead_score || 0, 75), // Boost score
          assigned_to: assignedTo,
          notes: existingShop.notes 
            ? existingShop.notes + '\n\n--- INBOUND CONVERSION ---\n' + buildNotes(data)
            : buildNotes(data),
          coffee_shop_type: data.coffee_shop_type || existingShop.coffee_shop_type,
          monthly_revenue: data.total_monthly_revenue || existingShop.monthly_revenue
        })
        .eq('id', existingShop.id)
        .select()
        .single();

      if (updateError) throw updateError;
      shop = updatedShop;

      // Check for existing contact or create new
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('shop_id', shop.id)
        .limit(1)
        .single();

      if (existingContact) {
        // Update existing contact
        const { data: updatedContact } = await supabase
          .from('contacts')
          .update({
            email: data.email || existingContact.email,
            phone: data.phone || existingContact.phone,
            first_name: data.first_name || existingContact.first_name,
            last_name: data.last_name || existingContact.last_name,
            lifecycle_stage: 'lead',
            lead_source: 'inbound_form'
          })
          .eq('id', existingContact.id)
          .select()
          .single();
        contact = updatedContact;
      } else {
        // Create new contact
        const { data: newContact } = await supabase
          .from('contacts')
          .insert([{
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: data.phone,
            shop_id: shop.id,
            lifecycle_stage: 'lead',
            lead_source: 'inbound_form',
            assigned_to: assignedTo
          }])
          .select()
          .single();
        contact = newContact;
      }

      // Check for existing deal or create new
      const { data: existingDeal } = await supabase
        .from('deals')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingDeal) {
        // Update existing deal - move to MQL in Inbounds pipeline
        const { data: updatedDeal } = await supabase
          .from('deals')
          .update({
            pipeline_id: INBOUNDS_PIPELINE_ID,
            stage: 'MQL',
            contact_id: contact?.id,
            assigned_to: assignedTo,
            notes: existingDeal.notes 
              ? existingDeal.notes + '\n\n--- INBOUND CONVERSION ---\nConverted via website form'
              : 'Converted via website form\nGUID: ' + guid
          })
          .eq('id', existingDeal.id)
          .select()
          .single();
        deal = updatedDeal;
      } else {
        // Create new deal
        const { data: newDeal } = await supabase
          .from('deals')
          .insert([{
            name: `${data.coffee_shop} - Inbound Lead`,
            shop_id: shop.id,
            contact_id: contact?.id,
            pipeline_id: INBOUNDS_PIPELINE_ID,
            stage: 'MQL',
            assigned_to: assignedTo,
            notes: `Converted from ${previousSource || 'unknown'} via website form\nGUID: ${guid}`
          }])
          .select()
          .single();
        deal = newDeal;
      }

      // ============================================
      // CANCEL ACTIVE NURTURE SEQUENCES
      // ============================================
      const { data: activeEnrollments } = await supabase
        .from('sequence_enrollments')
        .select('id, sequence_id')
        .eq('shop_id', shop.id)
        .eq('status', 'active');

      if (activeEnrollments && activeEnrollments.length > 0) {
        await supabase
          .from('sequence_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .in('id', activeEnrollments.map(e => e.id));

        // Log activity for each cancelled enrollment
        for (const enrollment of activeEnrollments) {
          const { data: seq } = await supabase
            .from('sequences')
            .select('name')
            .eq('id', enrollment.sequence_id)
            .single();
          
          await supabase
            .from('activities')
            .insert([{
              shop_id: shop.id,
              contact_id: contact?.id,
              deal_id: deal?.id,
              activity_type: 'sequence_completed',
              notes: `Nurture sequence "${seq?.name || 'Unknown'}" completed - converted to inbound lead`
            }]);
        }
      }

      // Log conversion activity
      await supabase
        .from('activities')
        .insert([{
          shop_id: shop.id,
          contact_id: contact?.id,
          deal_id: deal?.id,
          activity_type: 'form_submission',
          notes: `🎉 INBOUND CONVERSION!\nPrevious source: ${previousSource || 'unknown'}\nConverted via website form\nGUID: ${guid}`
        }]);

    } else {
      // ============================================
      // NEW SHOP - CREATE FROM SCRATCH
      // ============================================
      const { data: newShop, error: shopError } = await supabase
        .from('shops')
        .insert([{
          name: data.coffee_shop,
          city: data.city,
          state: data.state,
          phone: data.phone,
          email: data.email,
          contact_name: `${data.first_name} ${data.last_name}`.trim(),
          lifecycle_stage: 'lead',
          source: 'inbound',
          lead_source: 'inbound_form',
          lead_score: 50,
          assigned_to: assignedTo,
          coffee_shop_type: data.coffee_shop_type,
          monthly_revenue: data.total_monthly_revenue,
          notes: buildNotes(data)
        }])
        .select()
        .single();

      if (shopError) throw shopError;
      shop = newShop;

      // Create contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert([{
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          shop_id: shop.id,
          lifecycle_stage: 'lead',
          lead_source: 'inbound_form',
          assigned_to: assignedTo
        }])
        .select()
        .single();

      if (contactError) console.error('Contact error:', contactError);
      contact = newContact;

      // Create deal
      const { data: newDeal, error: dealError } = await supabase
        .from('deals')
        .insert([{
          name: `${data.coffee_shop} - Inbound Lead`,
          shop_id: shop.id,
          contact_id: contact?.id,
          pipeline_id: INBOUNDS_PIPELINE_ID,
          stage: 'MQL',
          assigned_to: assignedTo,
          notes: `Submitted via website form\nGUID: ${guid}`
        }])
        .select()
        .single();

      if (dealError) console.error('Deal error:', dealError);
      deal = newDeal;

      // Log activity
      await supabase
        .from('activities')
        .insert([{
          shop_id: shop.id,
          contact_id: contact?.id,
          deal_id: deal?.id,
          activity_type: 'form_submission',
          notes: `New inbound lead submitted via website form\nGUID: ${guid}`
        }]);
    }

    // ============================================
    // CREATE FOLLOW-UP TASK
    // ============================================
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await supabase
      .from('tasks')
      .insert([{
        title: `Follow up with ${data.first_name} from ${data.coffee_shop}${wasNurtured ? ' (CONVERTED!)' : ''}`,
        task_type: 'call',
        due_date: tomorrow.toISOString().split('T')[0],
        contact_id: contact?.id,
        deal_id: deal?.id,
        shop_id: shop.id,
        assigned_to: assignedTo,
        status: 'not_started',
        priority: wasNurtured ? 'high' : 'medium',
        notes: wasNurtured 
          ? `🎉 CONVERTED FROM NURTURE! Previously ${previousSource}. Follow up ASAP!`
          : 'New inbound lead - follow up within 24 hours'
      }]);

    // ============================================
    // SEND EMAIL NOTIFICATION
    // ============================================
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('email, name');

    const recipientEmails = teamMembers?.map(t => t.email).filter(Boolean) || ['brenden@joe.coffee'];

    const emailSubject = wasNurtured
      ? `🎉 NURTURE CONVERSION: ${data.coffee_shop} (${data.state}) → ${assignedName}`
      : `☕ New Inbound Lead: ${data.coffee_shop} (${data.state}) → ${assignedName}`;

    const emailHtml = buildEmailHtml(data, shop, guid, assignedName, territory, wasNurtured, previousSource);
    
    await resend.emails.send({
      from: 'joe CRM <notifications@joe.coffee>',
      to: recipientEmails,
      subject: emailSubject,
      html: emailHtml
    });

    // Return success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        guid,
        wasNurtured,
        previousSource,
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

function buildEmailHtml(data, shop, guid, assignedName, territory, wasNurtured, previousSource) {
  const crmUrl = `https://joe.coffee/crm/#shop=${shop.id}`;
  const territoryLabel = territory === 'east' ? 'East Coast' : territory === 'midwest' ? 'Midwest/Central' : 'West Coast';
  
  const conversionBanner = wasNurtured ? `
    <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 8px;">
      <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
      <div style="font-size: 20px; font-weight: 700;">NURTURE CONVERSION!</div>
      <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Previously: ${previousSource || 'unknown'} → Now: Inbound Lead</div>
    </div>
  ` : '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: ${wasNurtured ? '#059669' : '#1a1a1a'}; color: #fff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .emoji { font-size: 32px; margin-bottom: 8px; }
        .content { padding: 24px; }
        .field { margin-bottom: 16px; }
        .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .value { font-size: 16px; color: #1a1a1a; font-weight: 500; }
        .highlight { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; }
        .highlight-label { font-size: 12px; color: #92400e; text-transform: uppercase; margin-bottom: 4px; }
        .highlight-value { font-size: 18px; color: #1a1a1a; font-weight: 600; }
        .assigned { background: #d1fae5; padding: 16px; border-radius: 8px; margin: 20px 0; }
        .assigned-label { font-size: 12px; color: #065f46; text-transform: uppercase; margin-bottom: 4px; }
        .assigned-value { font-size: 18px; color: #1a1a1a; font-weight: 600; }
        .btn { display: inline-block; background: #f59e0b; color: #1a1a1a; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
        .footer { background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 13px; color: #6b7280; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="emoji">${wasNurtured ? '🎉' : '☕'}</div>
          <h1>${wasNurtured ? 'Nurture Conversion!' : 'New Inbound Lead!'}</h1>
        </div>
        <div class="content">
          ${conversionBanner}
          
          <div class="highlight">
            <div class="highlight-label">Coffee Shop</div>
            <div class="highlight-value">${data.coffee_shop}</div>
          </div>
          
          <div class="assigned">
            <div class="assigned-label">Assigned To (${territoryLabel})</div>
            <div class="assigned-value">👤 ${assignedName}</div>
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
          ${wasNurtured 
            ? `🎉 This lead converted from a nurture campaign! Follow up immediately.`
            : `This lead was submitted via the joe.coffee website. Follow up within 24 hours for best results!`
          }
        </div>
      </div>
    </body>
    </html>
  `;
}
