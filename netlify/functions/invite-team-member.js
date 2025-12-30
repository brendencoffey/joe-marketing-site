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

    // Send invite email
    const { error: emailError } = await resend.emails.send({
      from: 'joe CRM <notifications@joe.coffee>',
      to: email,
      subject: `☕ You're invited to joe CRM`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
            .container { max-width: 500px; margin: 0 auto; padding: 40px 20px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo img { height: 50px; }
            .card { background: #f9fafb; border-radius: 12px; padding: 30px; text-align: center; }
            h1 { font-size: 24px; margin-bottom: 16px; }
            p { color: #6b7280; margin-bottom: 20px; }
            .btn { display: inline-block; background: #f59e0b; color: #1a1a1a; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
            .footer { text-align: center; margin-top: 30px; font-size: 13px; color: #9ca3af; }
            .role-badge { display: inline-block; background: #e5e7eb; padding: 4px 12px; border-radius: 20px; font-size: 13px; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <img src="https://4591743.fs1.hubspotusercontent-na1.net/hubfs/4591743/Black.png" alt="joe">
            </div>
            <div class="card">
              <h1>Welcome to the team, ${name.split(' ')[0]}! 👋</h1>
              <p>${invited_by ? `<strong>${invited_by}</strong> has invited you` : "You've been invited"} to join joe CRM — our partner growth console.</p>
              <p class="role-badge">${role === 'admin' ? '👑 Admin' : role === 'manager' ? '📊 Manager' : '💼 Sales'}${territory ? ` • ${territory.charAt(0).toUpperCase() + territory.slice(1)} Territory` : ''}</p>
              <br><br>
              <a href="https://joe.coffee/crm/" class="btn">Sign in to joe CRM →</a>
              <p style="margin-top: 20px; font-size: 13px;">Use your <strong>${email}</strong> Google account to sign in.</p>
            </div>
            <div class="footer">
              joe — Empowering independent coffee shops<br>
              <a href="https://joe.coffee" style="color: #f59e0b;">joe.coffee</a>
            </div>
          </div>
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
