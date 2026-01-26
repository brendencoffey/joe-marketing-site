/**
 * Schedule Book API
 * Creates a booking, adds to Google Calendar with Meet link, sends confirmation emails
 */

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const crypto = require('crypto');

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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { team_member_id, meeting_type_id, date, time, booker } = JSON.parse(event.body);

    if (!team_member_id || !meeting_type_id || !date || !time || !booker) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Get team member
    const { data: member } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', team_member_id)
      .single();

    if (!member) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team member not found' }) };
    }

    // Get meeting type
    const { data: meetingType } = await supabase
      .from('meeting_types')
      .select('*')
      .eq('id', meeting_type_id)
      .single();

    if (!meetingType) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Meeting type not found' }) };
    }

    // Calculate start and end times
    // Store as UTC for database, use local strings for Google Calendar
    const startTime = new Date(`${date}T${time}:00-08:00`); // Pacific to UTC
    const endTime = new Date(startTime.getTime() + meetingType.duration_minutes * 60000);

    // Check if slot is still available (prevent double booking)
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('team_member_id', team_member_id)
      .eq('start_time', startTime.toISOString())
      .eq('status', 'confirmed')
      .single();

    if (existingBooking) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'This time slot is no longer available' }) };
    }
    // Generate reschedule token
    const rescheduleToken = crypto.randomBytes(32).toString('hex');

    // Create Google Calendar event with Meet link
    let googleEventId = null;
    let meetLink = null;

    // Get Google tokens from api_keys table
    const { data: googleTokens } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_email', member.email)
      .eq('service', 'google')
      .single();

    if (googleTokens?.refresh_token) {
      try {
        // Calculate end time string for Google Calendar (local time)
        const [hours, mins] = time.split(':').map(Number);
        const totalMins = hours * 60 + mins + meetingType.duration_minutes;
        const endHours = Math.floor(totalMins / 60) % 24;
        const endMins = totalMins % 60;
        const endTimeLocal = `${date}T${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
        const startTimeLocal = `${date}T${time}:00`;
        
        const result = await createGoogleCalendarEvent(googleTokens, {
          summary: `${meetingType.name} - ${booker.firstName} ${booker.lastName}`,
          description: `Meeting booked via joe scheduling

Guest: ${booker.firstName} ${booker.lastName}
Email: ${booker.email}
Phone: ${booker.phone || 'N/A'}

Notes: ${booker.notes || 'None'}

─────────────────────────
Need to reschedule or cancel?
${process.env.URL || 'https://joe.coffee'}/schedule/reschedule?token=${rescheduleToken}`,
          startTime: startTimeLocal,
          endTime: endTimeLocal,
          attendeeEmail: booker.email,
          attendeeName: `${booker.firstName} ${booker.lastName}`
        });
        
        googleEventId = result.eventId;
        meetLink = result.meetLink;
      } catch (err) {
        console.error('Google Calendar error:', err);
        // Continue without Google Calendar - booking still succeeds
      }
    }

    // Create or get contact
    let contactId = null;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', booker.email.toLowerCase())
      .single();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert([{
          first_name: booker.firstName,
          last_name: booker.lastName,
          email: booker.email.toLowerCase(),
          phone: booker.phone,
          source: 'scheduling'
        }])
        .select()
        .single();
      contactId = newContact?.id;
    }

    // Create booking record
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        team_member_id,
        meeting_type_id,
        contact_id: contactId,
        booker_name: `${booker.firstName} ${booker.lastName}`,
        booker_email: booker.email,
        booker_phone: booker.phone,
        booker_notes: booker.notes,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: meetingType.duration_minutes,
        google_event_id: googleEventId,
        meet_link: meetLink,
        status: 'confirmed',
        reschedule_token: rescheduleToken,
        reminder_sent: false
      }])
      .select()
      .single();

    if (bookingError) {
      console.error('Booking insert error:', bookingError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create booking' }) };
    }

    // Create activity record
    await supabase.from('activities').insert([{
      contact_id: contactId,
      activity_type: 'meeting_booked',
      team_member_email: member.email,
      team_member_name: member.name,
      notes: `📅 ${meetingType.name} scheduled for ${startTime.toLocaleString()}\n${meetLink ? `Meet: ${meetLink}` : ''}`
    }]);

    // Send confirmation emails
    await sendConfirmationEmails({
      member,
      booker,
      meetingType,
      date,
      time,
      startTime,
      endTime,
      meetLink,
      bookingId: booking.id,
      rescheduleToken
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        booking_id: booking.id,
        meet_link: meetLink,
        google_event_id: googleEventId
      })
    };

  } catch (err) {
    console.error('Booking error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

async function createGoogleCalendarEvent(tokens, eventData) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  // Use refresh token to get access token
  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  });

  // Get fresh access token
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);
  
  // Update stored access token
  await supabase
    .from('api_keys')
    .update({
      access_token: credentials.access_token,
      expires_at: new Date(credentials.expiry_date).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_email', tokens.user_email)
    .eq('service', 'google');

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.startTime,
        timeZone: 'America/Los_Angeles'
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: 'America/Los_Angeles'
      },
      attendees: [
        { email: eventData.attendeeEmail, displayName: eventData.attendeeName }
      ],
      conferenceData: {
        createRequest: {
          requestId: `joe-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 10 }
        ]
      }
    }
  });

  return {
    eventId: event.data.id,
    meetLink: event.data.hangoutLink || event.data.conferenceData?.entryPoints?.[0]?.uri
  };
}

async function sendConfirmationEmails({ member, booker, meetingType, date, time, startTime, endTime, meetLink, bookingId, rescheduleToken }) {
  const baseUrl = process.env.URL || 'https://joe.coffee';
  const rescheduleUrl = `${baseUrl}/schedule/reschedule?token=${rescheduleToken}`;

  // Format times from the original date and time strings (already in Pacific)
  const [year, month, day] = date.split('-').map(Number);
  const [hours, mins] = time.split(':').map(Number);
  
  const formatDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date(year, month - 1, day);
    return `${days[d.getDay()]}, ${months[month - 1]} ${day}, ${year}`;
  };
  
  const formatTime = (h, m) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Calculate end time
  const totalMins = hours * 60 + mins + meetingType.duration_minutes;
  const endHours = Math.floor(totalMins / 60) % 24;
  const endMins = totalMins % 60;

  const formattedDate = formatDate();
  const formattedTime = formatTime(hours, mins);
  const formattedEndTime = formatTime(endHours, endMins);

  // Get member photo from team_members table
  const memberPhoto = member.photo_url || member.picture;
  const memberInitials = (member.name || member.email).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Email to booker
  const bookerEmailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; color: #fff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">✓ Your meeting is confirmed!</h1>
      </div>
      <div style="background: #fff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 18px;">${meetingType.name}</h2>
          <p style="margin: 0 0 8px; color: #666;">
            <strong>📅 Date:</strong> ${formattedDate}
          </p>
          <p style="margin: 0 0 8px; color: #666;">
            <strong>🕐 Time:</strong> ${formattedTime} - ${formattedEndTime} (Pacific)
          </p>
          <div style="margin: 16px 0 8px; display: flex; align-items: center;">
            <strong style="color: #666;">👤 With:</strong>
            <span style="margin-left: 8px;">${member.name || member.email}</span>
          </div>
          ${meetLink ? `
          <p style="margin: 20px 0 0; text-align: center;">
            <a href="${meetLink}" style="display: inline-block; background: #000; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              📹 Join with Google Meet
            </a>
          </p>
          ` : ''}
        </div>
        
        <div style="border-top: 1px solid #e5e5e5; padding-top: 20px; text-align: center;">
          <p style="color: #666; font-size: 14px; margin: 0 0 12px;">
            Need to make changes?
          </p>
          <a href="${rescheduleUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;">
            Reschedule or Cancel
          </a>
        </div>
      </div>
      <div style="text-align: center; padding: 16px; color: #999; font-size: 12px;">
        Powered by <a href="https://joe.coffee" style="color: #666;">joe</a>
      </div>
    </div>
  `;

  // Email to team member
  const memberEmailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #10b981; color: #fff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📅 New Meeting Booked!</h1>
      </div>
      <div style="background: #fff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; font-size: 18px;">${meetingType.name}</h2>
          <p style="margin: 0 0 8px; color: #666;">
            <strong>📅 Date:</strong> ${formattedDate}
          </p>
          <p style="margin: 0 0 8px; color: #666;">
            <strong>🕐 Time:</strong> ${formattedTime} - ${formattedEndTime} (Pacific)
          </p>
          <p style="margin: 0 0 8px; color: #666;">
            <strong>👤 Guest:</strong> ${booker.firstName} ${booker.lastName}
          </p>
          <p style="margin: 0 0 8px; color: #666;">
            <strong>📧 Email:</strong> <a href="mailto:${booker.email}" style="color: #000;">${booker.email}</a>
          </p>
          ${booker.phone ? `
          <p style="margin: 0 0 8px; color: #666;">
            <strong>📱 Phone:</strong> <a href="tel:${booker.phone}" style="color: #000;">${booker.phone}</a>
          </p>
          ` : ''}
          ${booker.notes ? `
          <div style="margin: 16px 0 0; padding-top: 16px; border-top: 1px solid #e5e5e5;">
            <strong style="color: #666;">📝 Notes:</strong>
            <p style="color: #333; margin: 8px 0 0;">${booker.notes}</p>
          </div>
          ` : ''}
          
          ${meetLink ? `
          <p style="margin: 20px 0 0; text-align: center;">
            <a href="${meetLink}" style="display: inline-block; background: #000; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              📹 Join with Google Meet
            </a>
          </p>
          ` : ''}
        </div>
        
        <p style="margin: 0; text-align: center;">
          <a href="https://joe.coffee/crm" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View in CRM →</a>
        </p>
      </div>
    </div>
  `;

  // Send emails via your email service
  try {
    // Email to booker
    await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: booker.email,
        subject: `Confirmed: ${meetingType.name} with ${member.name || member.email}`,
        html: bookerEmailHtml
      })
    });

    // Email to team member
    await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: member.email,
        subject: `📅 New booking: ${meetingType.name} with ${booker.firstName} ${booker.lastName}`,
        html: memberEmailHtml
      })
    });
  } catch (err) {
    console.error('Email send error:', err);
    // Don't fail the booking if emails fail
  }
}
