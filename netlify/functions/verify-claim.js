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

    // Update the shop
    await supabase
      .from('shops')
      .update({ 
        verification_status: 'pending',
        icp_type: claim.coffee_shop_type?.toLowerCase().replace(/[^a-z]/g, '_') || null,
        current_pos: claim.current_pos
      })
      .eq('id', claim.shop_id);

    // Update contact if exists
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', claim.email)
      .single();

    if (existingContact) {
      await supabase
        .from('contacts')
        .update({
          first_name: claim.first_name,
          last_name: claim.last_name,
          phone: claim.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingContact.id);

      // Link contact to shop
      await supabase
        .from('shops')
        .update({ contact_id: existingContact.id })
        .eq('id', claim.shop_id);
    }

    // Move deal from claim_unverified to claim_new
    if (claim.deal_id) {
      await supabase
        .from('deals')
        .update({
          stage: 'claim_new',
          metadata: {
            role: claim.role,
            coffee_shop_type: claim.coffee_shop_type,
            current_pos: claim.current_pos,
            submitted_at: claim.created_at,
            verified_at: new Date().toISOString()
          }
        })
        .eq('id', claim.deal_id);
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
