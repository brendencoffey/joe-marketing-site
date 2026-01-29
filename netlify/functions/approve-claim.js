/**
 * Approve Claim - Called when PGC clicks "Verify Ownership"
 * - Creates shop_owners record if needed
 * - Creates shop_owner_access to link owner to shop
 * - Sends welcome email with login instructions
 */
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { shop_id, deal_id } = JSON.parse(event.body || '{}');

    if (!shop_id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing shop_id' }) };
    }

    // Get the pending claim for this shop
    const { data: claim } = await supabase
      .from('pending_claims')
      .select('*')
      .eq('shop_id', shop_id)
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(1)
      .single();

    if (!claim) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No verified claim found for this shop' }) };
    }

    // Get shop details
    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .single();

    if (!shop) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Shop not found' }) };
    }

    // 1. Update shop verification status
    await supabase
      .from('shops')
      .update({
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        owner_email: claim.email
      })
      .eq('id', shop_id);

    // 2. Create or find shop_owners record
    let owner;
    const { data: existingOwner } = await supabase
      .from('shop_owners')
      .select('*')
      .eq('email', claim.email.toLowerCase())
      .single();

    if (existingOwner) {
      owner = existingOwner;
    } else {
      const { data: newOwner } = await supabase
        .from('shop_owners')
        .insert({
          email: claim.email.toLowerCase(),
          name: `${claim.first_name} ${claim.last_name}`.trim(),
          phone: claim.phone
        })
        .select()
        .single();
      owner = newOwner;
    }

    // 3. Create shop_owner_access link (if not exists)
    if (owner) {
      const { data: existingAccess } = await supabase
        .from('shop_owner_access')
        .select('id')
        .eq('owner_id', owner.id)
        .eq('shop_id', shop_id)
        .single();

      if (!existingAccess) {
        await supabase
          .from('shop_owner_access')
          .insert({
            owner_id: owner.id,
            shop_id: shop_id,
            role: claim.role || 'owner'
          });
      }
    }

    // 4. Update deal stage if provided
    if (deal_id) {
      await supabase
        .from('deals')
        .update({
          stage: 'claimed',
          metadata: {
            approved_at: new Date().toISOString()
          }
        })
        .eq('id', deal_id);
    }

    // 5. Update pending_claims to mark as approved
    await supabase
      .from('pending_claims')
      .update({ approved_at: new Date().toISOString() })
      .eq('id', claim.id);

    // 6. Generate shop slug for login link
    const shopSlug = shop.slug || shop.id;

    // 7. Send welcome email
    await resend.emails.send({
      from: 'joe <hello@joe.coffee>',
      to: claim.email,
      subject: `🎉 You're approved! Manage ${shop.name} on joe`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://joe.coffee/images/logo.png" alt="joe" style="height: 40px;">
          </div>
          
          <h1 style="font-size: 24px; margin-bottom: 20px;">Welcome to joe! 🎉</h1>
          
          <p>Hi ${claim.first_name},</p>
          
          <p>Great news — your claim for <strong>${shop.name}</strong> has been verified! You now have access to your free owner dashboard.</p>
          
          <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px; font-size: 16px;">What you can do:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
              <li>View page analytics (views, clicks, directions)</li>
              <li>Edit your listing info (hours, photos, description)</li>
              <li>See customers who want to be notified when you launch online ordering</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://joe.coffee/owner/" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to My Dashboard →</a>
          </div>
          
          <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px;"><strong>🔑 How to log in:</strong> Click the button above and sign in with the Google account for <strong>${claim.email}</strong>. This should be the same email you use for your Google Business Profile.</p>
          </div>
          
          <p>Your listing is live at:<br>
          <a href="https://joe.coffee/locations/${shopSlug}/" style="color: #2563eb;">joe.coffee/locations/${shopSlug}</a></p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 14px;">
            Questions? Reply to this email — we're here to help!
          </p>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
            joe · The platform for independent coffee<br>
            <a href="https://joe.coffee" style="color: #9ca3af;">joe.coffee</a>
          </p>
        </body>
        </html>
      `
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Claim approved and welcome email sent!',
        owner_id: owner?.id
      })
    };

  } catch (err) {
    console.error('Approve claim error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
