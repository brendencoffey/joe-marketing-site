/**
 * Schedule Reschedule API
 * Handles viewing reschedule page and updating booking time
 */

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const params = event.queryStringParameters || {};

  // GET - Fetch booking details for reschedule page
  if (event.httpMethod === 'GET') {
    const { token } = params;
    
    if (!token) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing token' }) };
    }

    console.log('Looking for token:', token);
    
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, start_time, end_time, booker_name, booker_email, status,
        team_members (
          id, name, email
        ),
        meeting_types (
          id, name, duration_minutes, color
        )
      `)
      .eq('reschedule_token', token)
      .single();
    
    console.log('Query error:', error);
    console.log('Booking found:', booking ? 'yes' : 'no');
    
    if (error || !booking) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found or link expired', debug: error?.message }) };
    }

    if (booking.status === 'cancelled') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'This booking has been cancelled' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        booking: {
          id: booking.id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          booker_name: booking.booker_name,
          status: booking.status
        },
        team_member: booking.team_members,
        meeting_type: booking.meeting_types
      })
    };
  }

  // POST - Update booking to new time
  if (event.httpMethod === 'POST') {
    try {
      const { token, new_date, new_time } = JSON.parse(event.body);

      if (!token || !new_date || !new_time) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
      }

      // Get current booking
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          *,
          team_members(*),
          meeting_types (*)
        `)
        .eq('reschedule_token', token)
        .single();

      if (fetchError || !booking) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
      }

      if (booking.status === 'cancelled') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot reschedule a cancelled booking' }) };
      }

      const member = booking.team_members;
      const meetingType = booking.meeting_types;

      // Calculate new times
      const newStartTime = new Date(`${new_date}T${new_time}:00`);
      const newEndTime = new Date(newStartTime.getTime() + meetingType.duration_minutes * 60000);

      // Check if new slot is available
      const { data: conflict } = await supabase
        .from('bookings')
        .select('id')
        .eq('team_member_id', booking.team_member_id)
        .eq('status', 'confirmed')
        .neq('id', booking.id)
        .gte('start_time', newStartTime.toISOString())
        .lt('start_time', newEndTime.toISOString())
        .single();

      if (conflict) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'This time slot is not available' }) };
      }

      const oldStartTime = new Date(booking.start_time);

      // Update Google Calendar event if exists
      if (booking.google_event_id) {
        try {
          await updateGoogleCalendarEvent(member.email, booking.google_event_id, {
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString()
          });
        } catch (err) {
          console.error('Google Calendar update error:', err);
        }
      }

      // Generate new reschedule token
      const newRescheduleToken = require('crypto').randomBytes(32).toString('hex');

     // Update booking
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          reschedule_token: newRescheduleToken,
          reminder_sent: false
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error('Update error:', updateError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to update booking', debug: updateError.message }) };
      }

      // Send reschedule confirmation emails
      await sendRescheduleEmails({
        member,
        bookerName: booking.booker_name,
        bookerEmail: booking.booker_email,
        meetingType,
        oldStartTime,
        newStartTime,
        newEndTime,
        meetLink: booking.meet_link,
        rescheduleToken: newRescheduleToken
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          new_start_time: newStartTime.toISOString(),
          new_end_time: newEndTime.toISOString()
        })
      };

    } catch (err) {
      console.error('Reschedule error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
    }
  }

  // DELETE - Cancel booking
  if (event.httpMethod === 'DELETE') {
    const { token } = params;
    
    if (!token) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing token' }) };
    }

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        *,
        team_members (*),
        meeting_types (*)
      `)
      .eq('reschedule_token', token)
      .single();

    if (fetchError || !booking) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
    }

    // Cancel Google Calendar event
    if (booking.google_event_id) {
      try {
        await cancelGoogleCalendarEvent(booking.team_members.email, booking.google_event_id);
      } catch (err) {
        console.error('Google Calendar cancel error:', err);
      }
    }

    // Update booking status
    await supabase
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', booking.id);

    // Send cancellation emails
    await sendCancellationEmails({
      member: booking.team_members,
      bookerName: booking.booker_name,
      bookerEmail: booking.booker_email,
      meetingType: booking.meeting_types,
      startTime: new Date(booking.start_time)
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Booking cancelled' })
    };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};

async function updateGoogleCalendarEvent(memberEmail, eventId, { startTime, endTime }) {
  // Get Google tokens from api_keys table
  const { data: tokens } = await supabase
    .from('api_keys')
    .select('*')
    .eq('user_email', memberEmail)
    .eq('service', 'google')
    .single();

  if (!tokens?.refresh_token) return;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.patch({
    calendarId: 'primary',
    eventId: eventId,
    sendUpdates: 'all',
    requestBody: {
      start: { dateTime: startTime, timeZone: 'America/Los_Angeles' },
      end: { dateTime: endTime, timeZone: 'America/Los_Angeles' }
    }
  });
}

async function cancelGoogleCalendarEvent(memberEmail, eventId) {
  // Get Google tokens from api_keys table
  const { data: tokens } = await supabase
    .from('api_keys')
    .select('*')
    .eq('user_email', memberEmail)
    .eq('service', 'google')
    .single();

  if (!tokens?.refresh_token) return;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
    sendUpdates: 'all'
  });
}

async function sendRescheduleEmails({ member, bookerName, bookerEmail, meetingType, oldStartTime, newStartTime, newEndTime, meetLink, rescheduleToken }) {
  const baseUrl = process.env.URL || 'https://joe.coffee';
  const rescheduleUrl = `${baseUrl}/schedule/reschedule?token=${rescheduleToken}`;

  const formatDate = (date) => date.toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
  });
  const formatTime = (date) => date.toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' 
  });

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #3b82f6; color: #fff; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">📅 Meeting Rescheduled</h1>
      </div>
      <div style="background: #fff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #666; margin: 0 0 16px;">Your meeting has been rescheduled:</p>
        
        <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 16px; text-decoration: line-through; color: #999;">
          <strong>Previous:</strong> ${formatDate(oldStartTime)} at ${formatTime(oldStartTime)}
        </div>
        
        <div style="background: #f0fdf4; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 18px;">${meetingType.name}</h2>
          <p style="margin: 0 0 8px; color: #666;">
            <strong>📅 New Date:</strong> ${formatDate(newStartTime)}
          </p>
          <p style="margin: 0 0 8px; color: #666;">
            <strong>🕐 New Time:</strong> ${formatTime(newStartTime)} - ${formatTime(newEndTime)}
          </p>
          ${meetLink ? `
          <p style="margin: 16px 0 0;">
            <a href="${meetLink}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              📹 Join with Google Meet
            </a>
          </p>
          ` : ''}
        </div>
        
        <p style="color: #666; font-size: 14px; margin: 0;">
          Need to change again? <a href="${rescheduleUrl}" style="color: #000; font-weight: 500;">Reschedule meeting</a>
        </p>
      </div>
    </div>
  `;

  try {
    await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: bookerEmail,
        subject: `Rescheduled: ${meetingType.name} with ${member.name || member.email}`,
        html: emailHtml
      })
    });

    await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: member.email,
        subject: `Rescheduled: ${meetingType.name} with ${bookerName}`,
        html: emailHtml.replace('Your meeting has been', `${bookerName} has rescheduled their meeting`)
      })
    });
  } catch (err) {
    console.error('Reschedule email error:', err);
  }
}

async function sendCancellationEmails({ member, bookerName, bookerEmail, meetingType, startTime }) {
  const baseUrl = process.env.URL || 'https://joe.coffee';

  const formatDate = (date) => date.toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric' 
  });
  const formatTime = (date) => date.toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' 
  });

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ef4444; color: #fff; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">Meeting Cancelled</h1>
      </div>
      <div style="background: #fff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 18px; text-decoration: line-through; color: #999;">${meetingType.name}</h2>
          <p style="margin: 0 0 8px; color: #999;">
            ${formatDate(startTime)} at ${formatTime(startTime)}
          </p>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Want to book a new time? <a href="${baseUrl}/schedule/${member.slug}" style="color: #000; font-weight: 500;">Schedule again</a>
        </p>
      </div>
    </div>
  `;

  try {
    await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: bookerEmail,
        subject: `Cancelled: ${meetingType.name}`,
        html: emailHtml
      })
    });

    await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: member.email,
        subject: `Cancelled: ${meetingType.name} with ${bookerName}`,
        html: emailHtml.replace('Meeting Cancelled', `${bookerName} cancelled their meeting`)
      })
    });
  } catch (err) {
    console.error('Cancellation email error:', err);
  }
}
