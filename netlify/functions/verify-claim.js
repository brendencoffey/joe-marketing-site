/**
 * Verify Claim - Handle email verification link click
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const NOTIFY_EMAILS = ['ally@joe.coffee', 'mario@joe.coffee', 'brenden@joe.coffee'];

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
      
      // Update the task
      await supabase
        .from('tasks')
        .update({
          title: `🔥 Follow up: ${claim.shop_name} (VERIFIED)`,
          description: `Email verified! ${claim.first_name} ${claim.last_name} (${claim.email}) confirmed ownership. Ready for outreach.`,
          due_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        })
        .eq('deal_id', claim.deal_id);
    }

    // Send HIGH PRIORITY notification to team
    const dealUrl = claim.deal_id ? `https://joe.coffee/crm/#deal-${claim.deal_id}` : 'https://joe.coffee/crm/';
    
    await resend.emails.send({
      from: 'joe CRM <notifications@joe.coffee>',
      to: NOTIFY_EMAILS,
      subject: `🔥 VERIFIED CLAIM: ${claim.shop_name} - Ready for Outreach!`,
      html: `
        <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dcfce7; border-left: 4px solid #22c55e; padding: 16px; margin-bottom: 20px;">
            <strong style="color: #16a34a;">✅ EMAIL VERIFIED - HIGH PRIORITY</strong>
          </div>
          <h2>🔥 ${claim.shop_name}</h2>
          <p style="color: #16a34a; font-weight: 600;">Owner confirmed - reach out ASAP!</p>
          <p><strong>Contact:</strong> ${claim.first_name} ${claim.last_name}</p>
          <p><strong>Email:</strong> ${claim.email}</p>
          <p><strong>Phone:</strong> ${claim.phone || 'Not provided'}</p>
          <p><strong>Role:</strong> ${claim.role || 'Not specified'}</p>
          <p><strong>Shop Type:</strong> ${claim.coffee_shop_type || 'Not specified'}</p>
          <p><strong>Current POS:</strong> ${claim.current_pos || 'Not specified'}</p>
          <a href="${dealUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none;">View Deal in CRM →</a>
        </body>
      `
    });

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