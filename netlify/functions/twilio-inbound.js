// Netlify function to handle inbound calls with smart routing
// Place in: netlify/functions/twilio-inbound.js
//
// Routing Logic:
// 1. Known partner calling → Route to assigned rep first
// 2. M-F 4am-7pm PT → Support queue (Hanna, Neyder, Juan)
// 3. Sat/Sun 4am-7pm PT → On-call rotation person
// 4. After hours (7pm-4am PT) → Voicemail + SMS alert

const { createClient } = require('@supabase/supabase-js');

// Business hours: 4am - 7pm Pacific
const BUSINESS_START_HOUR = 4;
const BUSINESS_END_HOUR = 19;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'text/xml',
    'Access-Control-Allow-Origin': '*'
  };

  // Parse Twilio webhook data
  const params = new URLSearchParams(event.body || '');
  const from = params.get('From');
  const to = params.get('To');
  const callSid = params.get('CallSid');

  console.log('Inbound call:', { from, to, callSid });

  const baseUrl = process.env.URL || 'https://joe.coffee';
  let twiml = '';

  // Initialize Supabase
  const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

  // Try to look up the caller in the database
  let contact = null;
  let shop = null;
  let assignedRep = null;
  let assignedRepInfo = null;

  if (supabase) {
    try {
      const cleanPhone = from.replace(/[^\d]/g, '');

      // Find contact by phone
      const { data: contacts } = await supabase
        .from('contacts')
        .select(`
          id, first_name, last_name, company_id, assigned_to,
          companies:company_id (id, name, assigned_to)
        `)
        .or(`phone.ilike.%${cleanPhone.slice(-10)}%,mobile.ilike.%${cleanPhone.slice(-10)}%`)
        .limit(1);

      if (contacts && contacts[0]) {
        contact = contacts[0];
        shop = contact.companies;
        assignedRep = contact.assigned_to || shop?.assigned_to;
      }

      // If no contact, try to find shop directly
      if (!shop) {
        const { data: shops } = await supabase
          .from('companies')
          .select('id, name, assigned_to')
          .ilike('phone', `%${cleanPhone.slice(-10)}%`)
          .limit(1);

        if (shops && shops[0]) {
          shop = shops[0];
          assignedRep = shop.assigned_to;
        }
      }

      // If we have an assigned rep, get their phone settings
      if (assignedRep) {
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('email, name, twilio_number, forward_phone, whisper_message, schedule, timezone')
          .eq('email', assignedRep)
          .limit(1);

        if (teamMembers && teamMembers[0]) {
          assignedRepInfo = teamMembers[0];
        }
      }

      // Log the incoming call
      await supabase.from('activities').insert([{
        activity_type: 'call',
        activity_category: 'support',
        contact_id: contact?.id || null,
        shop_id: shop?.id || null,
        phone: from,
        direction: 'inbound',
        notes: `📞 Incoming call from ${from}${contact ? ` (${contact.first_name} ${contact.last_name})` : ''}${shop ? ` - ${shop.name}` : ''}`
      }]);

    } catch (err) {
      console.error('Error looking up caller:', err);
    }
  }

  // Get current time in Pacific
  const now = new Date();
  const ptOptions = { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false };
  const ptHour = parseInt(now.toLocaleString('en-US', ptOptions));
  const ptDay = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).getDay();
  
  const isWeekend = ptDay === 0 || ptDay === 6;
  const isBusinessHours = ptHour >= BUSINESS_START_HOUR && ptHour < BUSINESS_END_HOUR;

  console.log(`Time check: PT hour=${ptHour}, day=${ptDay}, isWeekend=${isWeekend}, isBusinessHours=${isBusinessHours}`);

  // Build caller info for whisper messages
  const callerName = contact 
    ? `${contact.first_name} from ${shop?.name || 'a partner'}`
    : shop?.name || 'Unknown caller';

  // RULE 1: Known partner with assigned rep who's available
  if (assignedRepInfo && isRepAvailable(assignedRepInfo, now)) {
    console.log(`Routing to assigned rep: ${assignedRepInfo.email}`);
    
    const whisper = (assignedRepInfo.whisper_message || 'joe call from {shop_name}. Press 1 to accept.')
      .replace('{shop_name}', shop?.name || 'a partner')
      .replace('{contact_name}', contact?.first_name || 'someone');

    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we connect you to your account manager.</Say>
  <Dial callerId="${to}" record="record-from-answer-dual" timeout="20" action="${baseUrl}/.netlify/functions/twilio-twiml?type=dial-fallback&amp;fallback=support">
    <Number url="${baseUrl}/.netlify/functions/twilio-twiml?type=whisper&amp;message=${encodeURIComponent(whisper)}">${assignedRepInfo.forward_phone}</Number>
  </Dial>
</Response>`;
    
    return { statusCode: 200, headers, body: twiml };
  }

  // RULE 2: Weekday business hours - support queue
  if (!isWeekend && isBusinessHours) {
    console.log('Routing to support queue (M-F business hours)');
    
    // Get support team members who are available
    const supportTeam = await getAvailableSupportTeam(supabase, now);
    
    if (supportTeam.length > 0) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling joe. Please hold while we connect you to our support team.</Say>
  <Dial callerId="${to}" record="record-from-answer-dual" timeout="30" action="${baseUrl}/.netlify/functions/twilio-twiml?type=dial-fallback&amp;fallback=voicemail">
    ${supportTeam.map(rep => `<Number url="${baseUrl}/.netlify/functions/twilio-twiml?type=whisper&amp;message=${encodeURIComponent(`Support call from ${callerName}. Press 1 to accept.`)}">${rep.forward_phone}</Number>`).join('\n    ')}
  </Dial>
</Response>`;
    } else {
      // No one available, go to voicemail
      twiml = getVoicemailTwiml(baseUrl, 'support', callerName);
    }
    
    return { statusCode: 200, headers, body: twiml };
  }

  // RULE 3: Weekend business hours - on-call rotation
  if (isWeekend && isBusinessHours) {
    console.log('Routing to weekend on-call');
    
    const onCallPerson = await getWeekendOnCall(supabase, now);
    
    if (onCallPerson && onCallPerson.forward_phone) {
      const whisper = `Weekend support call from ${callerName}. Press 1 to accept.`;
      
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling joe. Please hold while we connect you to our weekend support.</Say>
  <Dial callerId="${to}" record="record-from-answer-dual" timeout="25" action="${baseUrl}/.netlify/functions/twilio-twiml?type=dial-fallback&amp;fallback=voicemail">
    <Number url="${baseUrl}/.netlify/functions/twilio-twiml?type=whisper&amp;message=${encodeURIComponent(whisper)}">${onCallPerson.forward_phone}</Number>
  </Dial>
</Response>`;
    } else {
      // No weekend on-call configured
      twiml = getVoicemailTwiml(baseUrl, 'support', callerName);
    }
    
    return { statusCode: 200, headers, body: twiml };
  }

  // RULE 4: After hours - voicemail + alert
  console.log('After hours - sending to voicemail');
  
  // Send SMS alert to on-call person or support team
  if (supabase) {
    await sendAfterHoursAlert(supabase, from, callerName, shop);
  }
  
  twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling joe. Our support team is currently unavailable. Our hours are Monday through Friday, 4 AM to 7 PM Pacific time, and weekends 4 AM to 7 PM Pacific. Please leave a message and we'll return your call as soon as possible.</Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="${baseUrl}/.netlify/functions/twilio-voicemail" playBeep="true" />
  <Say voice="alice">We didn't receive your message. Goodbye.</Say>
</Response>`;

  return { statusCode: 200, headers, body: twiml };
};

// Helper: Check if a rep is available based on their schedule
function isRepAvailable(rep, now) {
  if (!rep.forward_phone) return false;
  
  const schedule = rep.schedule;
  if (!schedule) return false;
  
  const tz = rep.timezone || 'America/Los_Angeles';
  const repTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = dayNames[repTime.getDay()];
  
  const daySchedule = schedule[today];
  if (!daySchedule || !daySchedule.enabled) return false;
  
  const currentMins = repTime.getHours() * 60 + repTime.getMinutes();
  const [startH, startM] = daySchedule.start.split(':').map(Number);
  const [endH, endM] = daySchedule.end.split(':').map(Number);
  
  return currentMins >= (startH * 60 + startM) && currentMins <= (endH * 60 + endM);
}

// Helper: Get available support team members
async function getAvailableSupportTeam(supabase, now) {
  if (!supabase) return [];
  
  try {
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('email, name, forward_phone, schedule, timezone')
      .eq('role', 'support');
    
    if (!teamMembers) return [];
    
    return teamMembers.filter(m => m.forward_phone && isRepAvailable(m, now));
  } catch (err) {
    console.error('Error getting support team:', err);
    return [];
  }
}

// Helper: Get weekend on-call person from rotation
async function getWeekendOnCall(supabase, now) {
  if (!supabase) return null;
  
  try {
    // Check oncall_schedule table for current week's on-call
    const { data: schedules } = await supabase
      .from('oncall_schedule')
      .select('primary_email, backup_email')
      .lte('week_start', now.toISOString().split('T')[0])
      .order('week_start', { ascending: false })
      .limit(1);
    
    if (schedules && schedules[0]) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('email, name, forward_phone, schedule, timezone')
        .eq('email', schedules[0].primary_email)
        .single();
      
      return teamMember;
    }
    
    // Fallback: just get first available support person
    const supportTeam = await getAvailableSupportTeam(supabase, now);
    return supportTeam[0] || null;
    
  } catch (err) {
    console.error('Error getting weekend on-call:', err);
    return null;
  }
}

// Helper: Generate voicemail TwiML
function getVoicemailTwiml(baseUrl, type, callerName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">All of our team members are currently busy. Please leave a message after the beep and we'll return your call as soon as possible.</Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="${baseUrl}/.netlify/functions/twilio-voicemail?type=${type}&amp;caller=${encodeURIComponent(callerName)}" playBeep="true" />
  <Say voice="alice">We didn't receive your message. Goodbye.</Say>
</Response>`;
}

// Helper: Send SMS alert for after-hours calls
async function sendAfterHoursAlert(supabase, callerPhone, callerName, shop) {
  try {
    // Get team members to alert (support team + assigned rep)
    const { data: supportTeam } = await supabase
      .from('team_members')
      .select('email, name, forward_phone')
      .eq('role', 'support');
    
    // For now just log - you'd integrate with Twilio SMS here
    console.log('After hours alert:', {
      caller: callerPhone,
      callerName,
      shop: shop?.name,
      alertTo: supportTeam?.map(t => t.email)
    });
    
    // TODO: Actually send SMS via Twilio
    // const twilioClient = require('twilio')(accountSid, authToken);
    // for (const member of supportTeam) {
    //   if (member.forward_phone) {
    //     await twilioClient.messages.create({
    //       body: `📞 Missed call from ${callerName} (${callerPhone})${shop ? ` - ${shop.name}` : ''}. Left voicemail.`,
    //       from: process.env.TWILIO_PHONE,
    //       to: member.forward_phone
    //     });
    //   }
    // }
    
  } catch (err) {
    console.error('Error sending after hours alert:', err);
  }
}
