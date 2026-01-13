/**
 * Verify Claim - Handle email verification link click
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;

  if (!token) {
    return redirect('https://joe.coffee/claim-error/?message=Invalid+verification+link');
  }

  try {
    const { data: claim, error } = await supabase
      .from('pending_claims')
      .select('*')
      .eq('verification_token', token)
      .single();

    if (error || !claim) {
      return redirect('https://joe.coffee/claim-error/?message=Invalid+or+expired+link');
    }

    if (claim.verified_at) {
      return redirect('https://joe.coffee/claim-verified/');
    }

    if (new Date(claim.expires_at) < new Date()) {
      return redirect('https://joe.coffee/claim-error/?message=Link+expired');
    }

    // Mark as verified
    await supabase
      .from('pending_claims')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', claim.id);

    // After marking pending_claim as verified, update the shop
    await supabase
      .from('shops')
      .update({ 
      verification_status: 'pending',
      icp_type: claim.coffee_shop_type?.toLowerCase().replace(/[^a-z]/g, '_') || null,
      current_pos: claim.current_pos
  })
  .eq('id', claim.shop_id);

    // Create or find contact
    let contact;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', claim.email)
      .single();

    if (existingContact) {
      contact = existingContact;
      await supabase
        .from('contacts')
        .update({
          first_name: claim.first_name,
          last_name: claim.last_name,
          phone: claim.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
    } else {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          first_name: claim.first_name,
          last_name: claim.last_name,
          email: claim.email,
          phone: claim.phone,
          lead_source: 'Claim Listing',
          lifecycle_stage: 'lead'
        })
        .select()
        .single();
      contact = newContact;
    }

    // Link contact to shop
    if (contact) {
      await supabase
        .from('shops')
        .update({ contact_id: contact.id })
        .eq('id', claim.shop_id);
    }

    // Create deal in Claim Listing pipeline
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('name', 'Claim Listing')
      .single();

    if (pipeline && contact) {
      cawait supabase
        .from('deals')
        .insert({
          name: `${claim.shop_name} - Claim`,
          contact_id: contact.id,
          pipeline_id: pipeline.id,
          stage: 'email_verified',
          shop_id: claim.shop_id,
          metadata: {
            role: claim.role,
            coffee_shop_type: claim.coffee_shop_type,
            current_pos: claim.current_pos,
            verified_at: new Date().toISOString()
          }
        });
    }

    return redirect('https://joe.coffee/claim-verified/');

  } catch (err) {
    console.error('Verify claim error:', err);
    return redirect('https://joe.coffee/claim-error/?message=Something+went+wrong');
  }
};

function redirect(url) {
  return {
    statusCode: 302,
    headers: { Location: url },
    body: ''
  };
}