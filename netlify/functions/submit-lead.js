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

const INBOUNDS_PIPELINE_ID = 'fc9b8709-238f-4aaa-8f75-e873f259d50c';

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const data = JSON.parse(event.body);
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Process form fields
    const howHeard = Array.isArray(data.how_did_you_hear) 
      ? data.how_did_you_hear.join(', ') 
      : data.how_did_you_hear || null;
    
    const referralSource = data.was_referred === 'Yes' 
      ? (data.referred_by || 'Yes - not specified')
      : (data.was_referred || null);

    // Check for existing shop
    let existingShop = null;
    let wasNurtured = false;
    let previousSource = null;

    if (data.email) {
      const { data: byEmail } = await supabase
        .from('shops')
        .select('*')
        .ilike('email', data.email)
        .single();
      if (byEmail) existingShop = byEmail;
    }

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

    let shop, contact, deal;

    if (existingShop) {
      // UPDATE EXISTING SHOP
      previousSource = existingShop.source;
      wasNurtured = ['enriched', 'deal', 'hubspot'].includes(previousSource);

      const { data: updatedShop, error: updateError } = await supabase
        .from('shops')
        .update({
          source: 'inbound',
          lead_source: 'inbound_form',
          phone: data.phone || existingShop.phone,
          email: data.email || existingShop.email,
          contact_name: `${data.first_name} ${data.last_name}`.trim(),
          lifecycle_stage: 'lead',
          lead_score: Math.max(existingShop.lead_score || 0, 75),
          assigned_to: assignedTo,
          // ALL FORM FIELDS
          coffee_shop_type: data.coffee_shop_type || existingShop.coffee_shop_type,
          monthly_revenue: data.total_monthly_revenue || existingShop.monthly_revenue,
          num_locations: data.num_locations || existingShop.num_locations,
          current_pos: data.current_pos || existingShop.current_pos,
          target_launch_date: data.target_launch_date || existingShop.target_launch_date,
          how_heard: howHeard || existingShop.how_heard,
          referral_source: referralSource || existingShop.referral_source,
          notes: existingShop.notes 
            ? existingShop.notes + '\n\n--- INBOUND CONVERSION ---\n' + buildNotes(data)
            : buildNotes(data)
        })
        .eq('id', existingShop.id)
        .select()
        .single();

      if (updateError) throw updateError;
      shop = updatedShop;

      // Handle contact
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('shop_id', shop.id)
        .limit(1)
        .single();

      if (existingContact) {
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

      // Handle deal
      const { data: existingDeal } = await supabase
        .from('deals')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingDeal) {
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

      // Cancel nurture sequences
      const { data: activeEnrollments } = await supabase
        .from('sequence_enrollments')
        .select('id, sequence_id')
        .eq('shop_id', shop.id)
        .eq('status', 'active');

      if (activeEnrollments?.length > 0) {
        await supabase
          .from('sequence_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .in('id', activeEnrollments.map(e => e.id));
      }

      await supabase.from('activities').insert([{
        shop_id: shop.id,
        contact_id: contact?.id,
        deal_id: deal?.id,
        activity_type: 'form_submission',
        notes: `🎉 INBOUND CONVERSION!\nPrevious source: ${previousSource || 'unknown'}\nGUID: ${guid}`
      }]);

    } else {
      // CREATE NEW SHOP
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
          // ALL FORM FIELDS
          coffee_shop_type: data.coffee_shop_type,
          monthly_revenue: data.total_monthly_revenue,
          num_locations: data.num_locations,
          current_pos: data.current_pos,
          target_launch_date: data.target_launch_date,
          how_heard: howHeard,
          referral_source: referralSource,
          notes: buildNotes(data)
        }])
        .select()
        .single();

      if (shopError) throw shopError;
      shop = newShop;

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

      const { data: newDeal } = await supabase
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
      deal = newDeal;

      await supabase.from('activities').insert([{
        shop_id: shop.id,
        contact_id: contact?.id,
        deal_id: deal?.id,
        activity_type: 'form_submission',
        notes: `New inbound lead submitted via website form\nGUID: ${guid}`
      }]);
    }

    // Link website activity to shop/contact
    if (data.visitor_id && shop) {
      await supabase
        .from('website_activity')
        .update({ shop_id: shop.id, contact_id: contact?.id, email: data.email })
        .eq('visitor_id', data.visitor_id);
    }

    // Create follow-up task
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await supabase.from('tasks').insert([{
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

    // Send email notification
    const { data: teamMembers } = await supabase.from('team_members').select('email, name');
    const recipientEmails = teamMembers?.map(t => t.email).filter(Boolean) || ['brenden@joe.coffee'];

    const emailSubject = wasNurtured
      ? `🎉 NURTURE CONVERSION: ${data.coffee_shop} (${data.state}) → ${assignedName}`
      : `☕ New Inbound Lead: ${data.coffee_shop} (${data.state}) → ${assignedName}`;

    await resend.emails.send({
      from: 'joe CRM <notifications@joe.coffee>',
      to: recipientEmails,
      subject: emailSubject,
      html: buildEmailHtml(data, shop, guid, assignedName, territory, wasNurtured, previousSource, howHeard, referralSource)
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        guid,
        wasNurtured,
        previousSource,
        shopId: shop.id,
        dealId: deal?.id,
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
  if (data.num_locations) notes.push(`Locations: ${data.num_locations}`);
  if (data.current_pos) notes.push(`Current POS: ${data.current_pos}`);
  if (data.target_launch_date) notes.push(`Target Launch: ${data.target_launch_date}`);
  if (data.was_referred === 'Yes' && data.referred_by) notes.push(`Referred by: ${data.referred_by}`);
  if (data.how_did_you_hear?.length) notes.push(`How they heard: ${Array.isArray(data.how_did_you_hear) ? data.how_did_you_hear.join(', ') : data.how_did_you_hear}`);
  return notes.join('\n');
}

function buildEmailHtml(data, shop, guid, assignedName, territory, wasNurtured, previousSource, howHeard, referralSource) {
  const crmUrl = `https://joe.coffee/crm/#shop=${shop.id}`;
  const territoryLabel = territory === 'east' ? 'East Coast' : territory === 'midwest' ? 'Midwest/Central' : 'West Coast';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
        .header { background: ${wasNurtured ? '#059669' : '#1a1a1a'}; color: #fff; padding: 24px; text-align: center; }
        .content { padding: 24px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field { margin-bottom: 12px; }
        .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
        .value { font-size: 15px; color: #1a1a1a; font-weight: 500; }
        .btn { display: inline-block; background: #f59e0b; color: #1a1a1a; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size:32px">${wasNurtured ? '🎉' : '☕'}</div>
          <h1 style="margin:8px 0 0">${wasNurtured ? 'Nurture Conversion!' : 'New Inbound Lead!'}</h1>
        </div>
        <div class="content">
          ${wasNurtured ? `<div style="background:#d1fae5;padding:16px;border-radius:8px;margin-bottom:20px;text-align:center"><strong>Previously: ${previousSource}</strong> → Now: Inbound</div>` : ''}
          
          <div style="background:#fef3c7;padding:16px;border-radius:8px;margin-bottom:20px">
            <div class="label">Coffee Shop</div>
            <div style="font-size:20px;font-weight:600">${data.coffee_shop}</div>
          </div>
          
          <div style="background:#d1fae5;padding:16px;border-radius:8px;margin-bottom:20px">
            <div class="label">Assigned To (${territoryLabel})</div>
            <div style="font-size:18px;font-weight:600">👤 ${assignedName}</div>
          </div>
          
          <div class="grid">
            <div class="field"><div class="label">Contact</div><div class="value">${data.first_name} ${data.last_name}</div></div>
            <div class="field"><div class="label">Location</div><div class="value">${data.city}, ${data.state}</div></div>
            <div class="field"><div class="label">Email</div><div class="value">${data.email}</div></div>
            <div class="field"><div class="label">Phone</div><div class="value">${data.phone || '-'}</div></div>
            <div class="field"><div class="label">Type</div><div class="value">${data.coffee_shop_type || '-'}</div></div>
            <div class="field"><div class="label">Revenue</div><div class="value">${data.total_monthly_revenue || '-'}</div></div>
            <div class="field"><div class="label"># Locations</div><div class="value">${data.num_locations || '-'}</div></div>
            <div class="field"><div class="label">Current POS</div><div class="value">${data.current_pos || '-'}</div></div>
            <div class="field"><div class="label">Target Launch</div><div class="value">${data.target_launch_date || '-'}</div></div>
            <div class="field"><div class="label">How Heard</div><div class="value">${howHeard || '-'}</div></div>
          </div>
          
          ${referralSource ? `<div class="field" style="margin-top:16px"><div class="label">Referral</div><div class="value">${referralSource}</div></div>` : ''}
          
          <center style="margin-top:24px"><a href="${crmUrl}" class="btn">View in CRM →</a></center>
        </div>
      </div>
    </body>
    </html>
  `;
}
