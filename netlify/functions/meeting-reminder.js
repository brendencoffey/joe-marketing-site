/**
 * Meeting Reminder - Scheduled Function
 * Runs every minute, sends reminders for meetings starting in 10 minutes
 * 
 * Add to netlify.toml:
 * [functions."meeting-reminder"]
 * schedule = "* * * * *"
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  console.log('Running meeting reminder check...');

  try {
    // Find meetings starting in 9-11 minutes (window to catch the 10-min mark)
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + 9 * 60000); // 9 minutes from now
    const reminderWindowEnd = new Date(now.getTime() + 11 * 60000);   // 11 minutes from now

    const { data: upcomingBookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        team_members!bookings_team_member_id_fkey (
          id, name, email
        ),
        meeting_types!bookings_meeting_type_id_fkey (
          id, name, duration_minutes
        )
      `)
      .eq('status', 'confirmed')
      .eq('reminder_sent', false)
      .gte('start_time', reminderWindowStart.toISOString())
      .lte('start_time', reminderWindowEnd.toISOString());

    if (error) {
      console.error('Error fetching bookings:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
    }

    if (!upcomingBookings || upcomingBookings.length === 0) {
      console.log('No meetings need reminders right now');
      return { statusCode: 200, body: JSON.stringify({ message: 'No reminders needed' }) };
    }

    console.log(`Found ${upcomingBookings.length} meetings needing reminders`);

    const baseUrl = process.env.URL || 'https://joe.coffee';

    for (const booking of upcomingBookings) {
      const member = booking.team_members;
      const meetingType = booking.meeting_types;
      const startTime = new Date(booking.start_time);

      const formattedTime = startTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles'
      });

      const rescheduleUrl = `${baseUrl}/schedule/reschedule?token=${booking.reschedule_token}`;

      // Reminder email to booker
      const cancelUrl = `${baseUrl}/schedule/cancel?token=${booking.reschedule_token}`;
      const calendarUrl = `${baseUrl}/schedule/${member.email?.split('@')[0] || 'team'}`;
      
      const bookerReminderHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #000; color: #fff; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">⏰ Your meeting starts in 10 minutes!</h1>
          </div>
          <div style="background: #fff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
              <h2 style="margin: 0 0 16px; font-size: 18px;">${meetingType.name}</h2>
              <p style="margin: 0 0 8px; color: #666;">
                <strong>🕐 Time:</strong> ${formattedTime}
              </p>
              <p style="margin: 0 0 8px; color: #666;">
                <strong>👤 With:</strong> ${member.name || member.email}
              </p>
              ${booking.meet_link ? `
              <p style="margin: 16px 0 0;">
                <a href="${booking.meet_link}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  📹 Join Meeting Now
                </a>
              </p>
              ` : ''}
            </div>
            
            <p style="color: #666; font-size: 14px; margin: 0;">
              Can't make it? <a href="${rescheduleUrl}" style="color: #000; font-weight: 500;">Reschedule</a> or <a href="${cancelUrl}" style="color: #000; font-weight: 500;">Cancel</a>
            </p>
            <p style="color: #666; font-size: 14px; margin: 8px 0 0;">
              <a href="${calendarUrl}" style="color: #666;">View calendar</a>
            </p>
          </div>
          <div style="text-align: center; padding: 16px; color: #999; font-size: 12px;">
            Powered by <a href="https://joe.coffee" style="color: #666;">joe</a>
          </div>
        </div>
      `;

      // Reminder email to team member
      const memberReminderHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #000; color: #fff; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">⏰ Meeting in 10 minutes!</h1>
          </div>
          <div style="background: #fff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
              <h2 style="margin: 0 0 16px; font-size: 18px;">${meetingType.name}</h2>
              <p style="margin: 0 0 8px; color: #666;">
                <strong>🕐 Time:</strong> ${formattedTime}
              </p>
              <p style="margin: 0 0 8px; color: #666;">
                <strong>👤 Guest:</strong> ${booking.booker_name}
              </p>
              <p style="margin: 0 0 8px; color: #666;">
                <strong>📧 Email:</strong> ${booking.booker_email}
              </p>
              ${booking.booker_phone ? `
              <p style="margin: 0 0 8px; color: #666;">
                <strong>📱 Phone:</strong> ${booking.booker_phone}
              </p>
              ` : ''}
              ${booking.meet_link ? `
              <p style="margin: 16px 0 0;">
                <a href="${booking.meet_link}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  📹 Join Meeting Now
                </a>
              </p>
              ` : ''}
              <p style="color: #666; font-size: 14px; margin-top: 16px;">
              Need to change? <a href="${rescheduleUrl}" style="color: #000; font-weight: 500;">Reschedule</a> or <a href="${cancelUrl}" style="color: #000; font-weight: 500;">Cancel</a>
            </p>
            </div>
          </div>
        </div>
      `;

      try {
        // Send reminder to booker
        await fetch(`${baseUrl}/.netlify/functions/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: booking.booker_email,
            subject: `⏰ Reminder: ${meetingType.name} starts in 10 minutes`,
            html: bookerReminderHtml
          })
        });

        // Send reminder to team member
        await fetch(`${baseUrl}/.netlify/functions/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: member.email,
            subject: `⏰ Reminder: ${meetingType.name} with ${booking.booker_name} in 10 minutes`,
            html: memberReminderHtml
          })
        });

        // Mark reminder as sent
        await supabase
          .from('bookings')
          .update({ reminder_sent: true })
          .eq('id', booking.id);

        console.log(`Sent reminders for booking ${booking.id}`);
      } catch (emailError) {
        console.error(`Failed to send reminder for booking ${booking.id}:`, emailError);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Sent reminders for ${upcomingBookings.length} meetings` 
      })
    };

  } catch (err) {
    console.error('Meeting reminder error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
