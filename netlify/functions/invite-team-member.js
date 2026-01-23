const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { email, name, role, territory, invited_by } = JSON.parse(event.body);

    if (!email || !name) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Email and name required' }) 
      };
    }

    // Check if already a team member
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Team member already exists' }) 
      };
    }

    // Add to team_members table
    const { data: member, error: insertError } = await supabase
      .from('team_members')
      .insert([{ 
        email, 
        name, 
        role: role || 'sales', 
        territory: territory || null,
        invited_by,
        invited_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Failed to add team member' }) 
      };
    }

    // Role display mapping
    const roleDisplay = {
      'admin': '👑 Admin',
      'pom': '🚀 Partner Onboarding Manager',
      'psm': '🛟 Partner Support Manager',
      'sales': '✨ Partner Growth Consultant',
      'default': '✨ Partner Experience Strategist'
    };
    const roleText = roleDisplay[role] || roleDisplay['default'];
    const territoryText = territory ? ` • ${territory.charAt(0).toUpperCase() + territory.slice(1)} Territory` : '';

    // Send invite email with black buttons and white text
    const { error: emailError } = await resend.emails.send({
      from: 'joe CRM <notifications@joe.coffee>',
      to: email,
      subject: `☕ You're invited to joe CRM`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f3f4f6;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="500" style="margin: 0 auto; max-width: 500px;">
                  
                  <!-- Logo -->
                  <tr>
                    <td style="text-align: center; padding-bottom: 30px;">
                      <img src="https://joe.coffee/images/joe-logo-black.png" alt="joe" width="80" height="auto" style="display: block; margin: 0 auto;">
                    </td>
                  </tr>
                  
                  <!-- Main Card -->
                  <tr>
                    <td style="background: #ffffff; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                      
                      <h1 style="font-size: 26px; font-weight: 700; margin: 0 0 16px 0; color: #1a1a1a;">
                        Welcome to the team, ${name.split(' ')[0]}! 👋
                      </h1>
                      
                      <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 16px;">
                        ${invited_by ? `<strong style="color: #1a1a1a;">${invited_by}</strong> has invited you` : "You've been invited"} to join joe CRM — our partner growth console.
                      </p>
                      
                      <p style="display: inline-block; background: #f3f4f6; padding: 8px 16px; border-radius: 20px; font-size: 14px; color: #4b5563; margin: 0 0 32px 0;">
                        ${roleText}${territoryText}
                      </p>
                      
                      <br><br>
                      
                      <!-- CTA Button - Black with White Text -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                        <tr>
                          <td style="border-radius: 8px; background: #000000;">
                            <a href="https://joe.coffee/crm/" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                              Sign in to joe CRM →
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0 0 0; font-size: 14px; color: #9ca3af;">
                        Use your <strong style="color: #6b7280;">${email}</strong> Google account to sign in.
                      </p>
                      
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="text-align: center; padding-top: 30px;">
                      <p style="font-size: 13px; color: #9ca3af; margin: 0;">
                        joe — Empowering independent coffee shops
                      </p>
                      <p style="margin: 8px 0 0 0;">
                        <a href="https://joe.coffee" style="color: #1a1a1a; font-size: 13px; font-weight: 500; text-decoration: none;">joe.coffee</a>
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    if (emailError) {
      console.error('Email error:', emailError);
      // Don't fail - member was added, just log email error
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        member,
        emailSent: !emailError 
      })
    };

  } catch (err) {
    console.error('Error:', err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Server error' }) 
    };
  }
};
