/**
 * Submit Claim - Handles "Claim This Listing" form submissions
 * Routes to Claim Listing pipeline
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CLAIM_PIPELINE_ID = '5bbc92dc-0120-4942-86cf-1754529df76a';
const DEFAULT_STAGE = 'MQL';

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

    // 1. Check if contact exists
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
          title: data.role,
          updated_at: now
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
          email: data.email,
          phone: data.phone,
          title: data.role,
          source: 'claim-listing',
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

    // 2. Update the shop with claim info
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .update({
        contact_id: contact.id,
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
        updated_at: now,
        last_activity_at: now
      })
      .eq('id', data.shop_id)
      .select()
      .single();

    if (shopError) {
      console.error('Shop update error:', shopError);
      throw new Error('Failed to update shop');
    }

    // 3. Create a deal in the Claim Listing pipeline
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        name: `Claim: ${shop.name}`,
        pipeline_id: CLAIM_PIPELINE_ID,
        stage: DEFAULT_STAGE,
        company_id: shop.id,
        contact_id: contact.id,
        source: 'claim-listing',
        metadata: {
          shop_id: shop.id,
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
    }

    // 4. Log activity
    await supabase.from('activities').insert({
      type: 'claim_submitted',
      shop_id: shop.id,
      contact_id: contact.id,
      deal_id: deal?.id,
      description: `Listing claimed by ${contactName} (${data.role}) - ${data.coffee_shop_type}, POS: ${data.current_pos}`,
      metadata: {
        email: data.email,
        phone: data.phone,
        role: data.role,
        coffee_shop_type: data.coffee_shop_type,
        current_pos: data.current_pos
      },
      created_at: now
    }).catch(() => {});

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Claim submitted successfully',
        shop_id: shop.id,
        contact_id: contact.id,
        deal_id: deal?.id
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