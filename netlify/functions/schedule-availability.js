/**
 * Schedule Availability API
 * Returns available time slots for a team member based on their Google Calendar
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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { team_member_id, start_date, end_date, duration } = JSON.parse(event.body);

    if (!team_member_id || !start_date || !end_date) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Get team member (includes google_refresh_token)
    const { data: member } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', team_member_id)
      .single();

    if (!member) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team member not found' }) };
    }

    // Get their scheduling settings (or use defaults)
    const { data: settings } = await supabase
      .from('scheduling_settings')
      .select('*')
      .eq('team_member_id', team_member_id)
      .single();

    const schedulingSettings = settings || {
      available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      start_time: '09:00',
      end_time: '17:00',
      buffer_minutes: 0,
      min_notice_hours: 4
    };

    // Get existing bookings
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('team_member_id', team_member_id)
      .gte('start_time', start_date)
      .lte('start_time', end_date + 'T23:59:59')
      .eq('status', 'confirmed');

    // Get Google Calendar busy times if connected
    let googleBusyTimes = [];
    
    // Get Google tokens from api_keys table
    const { data: googleTokens } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_email', member.email)
      .eq('service', 'google')
      .single();
    
    if (googleTokens?.refresh_token) {
      try {
        googleBusyTimes = await getGoogleBusyTimes(googleTokens, start_date, end_date);
      } catch (err) {
        console.error('Google Calendar error:', err);
        // Continue without Google Calendar data
      }
    }

    // Generate available slots
    const availability = generateAvailableSlots({
      startDate: start_date,
      endDate: end_date,
      duration: duration || 30,
      settings: schedulingSettings,
      existingBookings: existingBookings || [],
      googleBusyTimes
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ availability })
    };

  } catch (err) {
    console.error('Availability error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

async function getGoogleBusyTimes(tokens, startDate, endDate) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  // Use refresh token to get access token
  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  });

  try {
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
  } catch (err) {
    console.error('Token refresh failed:', err);
    return [];
  }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Get free/busy info
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: new Date(startDate + 'T00:00:00').toISOString(),
      timeMax: new Date(endDate + 'T23:59:59').toISOString(),
      items: [{ id: 'primary' }]
    }
  });

  const busy = response.data.calendars?.primary?.busy || [];
  return busy.map(b => ({
    start: new Date(b.start),
    end: new Date(b.end)
  }));
}

function generateAvailableSlots({ startDate, endDate, duration, settings, existingBookings, googleBusyTimes }) {
  const availability = {};
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const minNotice = new Date(now.getTime() + (settings.min_notice_hours || 4) * 60 * 60 * 1000);

  // Parse working hours
  const [startHour, startMin] = (settings.start_time || '09:00').split(':').map(Number);
  const [endHour, endMin] = (settings.end_time || '17:00').split(':').map(Number);
  
  const slotDuration = duration || 30;
  const buffer = settings.buffer_minutes || 0;

  // Loop through each day
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayName = dayNames[d.getDay()];
    
    // Skip if not an available day
    if (!settings.available_days?.includes(dayName)) {
      continue;
    }

    const slots = [];
    
    // Generate slots for this day
    const dayStart = new Date(d);
    dayStart.setHours(startHour, startMin, 0, 0);
    
    const dayEnd = new Date(d);
    dayEnd.setHours(endHour, endMin, 0, 0);
    
    for (let slotStart = new Date(dayStart); slotStart < dayEnd; slotStart.setMinutes(slotStart.getMinutes() + 30)) {
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
      
      // Skip if slot end is past working hours
      if (slotEnd > dayEnd) continue;
      
      // Skip if before minimum notice time
      if (slotStart < minNotice) continue;
      
      // Check against existing bookings
      const hasBookingConflict = existingBookings.some(booking => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        return slotStart < bookingEnd && slotEnd > bookingStart;
      });
      
      if (hasBookingConflict) continue;
      
      // Check against Google Calendar
      const hasGoogleConflict = googleBusyTimes.some(busy => {
        return slotStart < busy.end && slotEnd > busy.start;
      });
      
      if (hasGoogleConflict) continue;
      
      // Add available slot
      const timeStr = slotStart.toTimeString().slice(0, 5);
      slots.push(timeStr);
    }
    
    if (slots.length > 0) {
      availability[dateStr] = slots;
    }
  }

  return availability;
}
