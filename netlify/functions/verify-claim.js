/**
 * Submit Claim - Store pending claim and send verification email
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


  try {
    const data = JSON.parse(event.body || '{}');
    
    // Honeypot check - if filled, it's a bot
    if (data.website_url) {
      console.log('Honeypot triggered, rejecting submission');
      // Return success to not alert bots
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    const { shop_id, shop_name, first_name, last_name, email, phone, role, coffee_shop_type, current_pos } = data;

    // Validation
    if (!shop_id || !first_name || !last_name || !email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    // Check for existing pending claim
    const { data: existing } = await supabase
      .from('pending_claims')
      .select('id, verified_at')
      .eq('shop_id', shop_id)
      .eq('email', email.toLowerCase())
      .single();

    if (existing?.verified_at) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'This email has already claimed this listing' }) };
    }

    // Delete old pending claim if exists (they're re-submitting)
    if (existing) {
      await supabase.from('pending_claims').delete().eq('id', existing.id);
    }

    // Create pending claim
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
        current_pos
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    // Send verification email
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