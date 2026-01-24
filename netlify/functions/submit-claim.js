/**
 * Submit Claim - Store pending claim, create deal, send verification & notification emails
 */
const { isRateLimited, getClientIP } = require('./rate-limiter');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);
const NOTIFY_EMAILS = ['ally@joe.coffee', 'mario@joe.coffee', 'brenden@joe.coffee'];
const NOTIFY_EMAILS = ['ally@joe.coffee', 'mario@joe.coffee', 'brenden@joe.coffee'];

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

  const ip = getClientIP(event);
  if (isRateLimited(ip, 3, 60000)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please wait.' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    
    if (data.website_url) {
      console.log('Honeypot triggered, rejecting submission');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    const { shop_id, shop_name, first_name, last_name, email, phone, role, coffee_shop_type, current_pos } = data;

    if (!shop_id || !first_name || !last_name || !email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const { data: existing } = await supabase
      .from('pending_claims')
      .select('id, verified_at, deal_id')
      .eq('shop_id', shop_id)
      .eq('email', email.toLowerCase())
      .single();

    if (existing?.verified_at) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'This email has already claimed this listing' }) };
    }

    if (existing) {
      if (existing.deal_id) {
        await supabase.from('deals').delete().eq('id', existing.deal_id);
      }
      await supabase.from('pending_claims').delete().eq('id', existing.id);
    }

    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('name', 'Claim Listing')
      .single();

    let contact;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingContact) {
      contact = existingContact;
      await supabase
        .from('contacts')
        .update({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
    } else {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.toLowerCase().trim(),
          phone,
          lead_source: 'Claim Listing',
          lifecycle_stage: 'lead'
        })
        .select()
        .single();
      contact = newContact;
    }

    let dealId = null;
    if (pipeline && contact) {
      const { data: deal } = await supabase
        .from('deals')
        .insert({
          name: `${shop_name} - Claim`,
          contact_id: contact.id,
          pipeline_id: pipeline.id,
          stage: 'claim_unverified',
          shop_id: shop_id,
          metadata: {
            role,
            coffee_shop_type,
            current_pos,
            submitted_at: new Date().toISOString()
          }
        })
        .select()
        .single();
      dealId = deal?.id;

      // Create follow-up task
      if (deal) {
        await supabase.from('tasks').insert({
          title: `Follow up: ${shop_name} claim (unverified)`,
          description: `New claim submission from ${first_name} ${last_name} (${email}). Awaiting email verification.`,
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          deal_id: deal.id,
          contact_id: contact.id,
          status: 'pending'
        });
      }
    }

    const { data: claim, error: insertError } = await supabase
      .from('pending_claims')
      .insert({
        shop_id,
        shop_name,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.toLowerCase().trim(),
        phone,
        role,
        coffee_shop_type,
        current_pos,
        deal_id: dealId
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    // Send verification email to claimant
    const verifyUrl = `https://joe.coffee/.netlify/functions/verify-claim?token=${claim.verification_token}`;
    
    await resend.emails.send({
      from: 'joe <verify@joe.coffee>',
      to: email.toLowerCase().trim(),
      subject: `Verify your claim for ${shop_name}`,
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
          
          <h1 style="font-size: 24px; margin-bottom: 20px;">Verify Your Claim</h1>
          
          <p>Hi ${first_name},</p>
          
          <p>Thanks for claiming <strong>${shop_name}</strong> on joe! Click the button below to verify your email and complete your claim.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Verify My Claim</a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">This link expires in 48 hours. If you didn't request this, you can ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 14px;">
            Once verified, our team will review your claim and reach out within 1-2 business days.
          </p>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
            joe · The platform for independent coffee<br>
            <a href="https://joe.coffee" style="color: #9ca3af;">joe.coffee</a>
          </p>
        </body>
        </html>
      `
    });

    // Send notification to team (unverified - lower priority)
    const dealUrl = dealId ? `https://joe.coffee/crm/#deal-${dealId}` : 'https://joe.coffee/crm/';
    
    await resend.emails.send({
      from: 'joe CRM <notifications@joe.coffee>',
      to: NOTIFY_EMAILS,
      subject: `📋 New Claim (Unverified): ${shop_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f3f4f6; border-left: 4px solid #9ca3af; padding: 16px; margin-bottom: 20px;">
            <strong style="color: #6b7280;">⏳ AWAITING VERIFICATION</strong>
          </div>
          
          <h2 style="margin: 0 0 16px;">New Claim Submission</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Shop:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${shop_name}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Contact:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${first_name} ${last_name}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Email:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${phone || 'Not provided'}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Role:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${role || 'Not specified'}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Shop Type:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${coffee_shop_type || 'Not specified'}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Current POS:</strong></td><td style="padding: 8px 0;">${current_pos || 'Not specified'}</td></tr>
          </table>
          
          <p style="color: #6b7280; font-size: 14px;">Verification email has been sent. You'll receive another notification when they verify.</p>
          
          <a href="${dealUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View in CRM →</a>
        </body>
        </html>
      `
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Check your email to verify your claim!' 
      })
    };

  } catch (err) {
    console.error('Submit claim error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
