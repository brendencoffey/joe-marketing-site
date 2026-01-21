// Netlify function to handle inbound calls with smart routing
// Place in: netlify/functions/twilio-inbound.js

const { createClient } = require('@supabase/supabase-js');

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

  // Try to look up the caller in the database
  let contact = null;
  let shop = null;
  let assignedRep = null;

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

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
          .select('twilio_number, forward_phone, whisper_message, available_start, available_end, timezone')
          .eq('email', assignedRep)
          .limit(1);

        if (teamMembers && teamMembers[0]) {
          const rep = teamMembers[0];
          
          // Check if rep is available (simple time check)
          const now = new Date();
          const currentHour = now.getHours();
          const startHour = rep.available_start ? parseInt(rep.available_start.split(':')[0]) : 9;
          const endHour = rep.available_end ? parseInt(rep.available_end.split(':')[0]) : 18;
          
          const isAvailable = currentHour >= startHour && currentHour < endHour;

          if (isAvailable && rep.forward_phone) {
            // Route to assigned rep
            const callerName = contact 
              ? `${contact.first_name} from ${shop?.name || 'a partner'}`
              : shop?.name || 'Unknown caller';
            
            const whisper = rep.whisper_message 
              ? rep.whisper_message.replace('{shop_name}', shop?.name || 'a partner').replace('{contact_name}', contact?.first_name || 'someone')
              : `joe call from ${callerName}. Press 1 to accept.`;

            twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we connect you to your account manager.</Say>
  <Dial callerId="${to}" record="record-from-answer-dual" timeout="20" action="${baseUrl}/.netlify/functions/twilio-dial-status?fallback=ivr">
    <Number url="${baseUrl}/.netlify/functions/twilio-twiml?type=whisper&amp;message=${encodeURIComponent(whisper)}">${rep.forward_phone}</Number>
  </Dial>
</Response>`;
            
            return { statusCode: 200, headers, body: twiml };
          }
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

  // Check if call center is open (simple schedule check)
  const now = new Date();
  const hour = now.getUTCHours();
  const day = now.getUTCDay();
  
  // Call center hours: Mon-Fri, 6am-6pm PT (14:00-02:00 UTC)
  // Simplified: weekdays, reasonable hours
  const isCallCenterOpen = day >= 1 && day <= 5 && hour >= 14 && hour <= 24;

  if (isCallCenterOpen) {
    // Route to call center queue (Hanna, Neyder, Juan)
    // In production, you'd use Twilio TaskRouter or a queue
    
    // For now, try to ring all support team members
    const supportNumbers = [
      process.env.SUPPORT_PHONE_1,
      process.env.SUPPORT_PHONE_2,
      process.env.SUPPORT_PHONE_3
    ].filter(Boolean);

    if (supportNumbers.length > 0) {
      const callerInfo = contact 
        ? `${contact.first_name} from ${shop?.name || 'unknown'}`
        : shop?.name || 'Unknown caller';

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling joe. Please hold while we connect you to our support team.</Say>
  <Dial callerId="${to}" record="record-from-answer-dual" timeout="30" action="${baseUrl}/.netlify/functions/twilio-dial-status?fallback=ivr">
    ${supportNumbers.map(num => `<Number url="${baseUrl}/.netlify/functions/twilio-twiml?type=whisper&amp;message=${encodeURIComponent(`Support call from ${callerInfo}. Press 1 to accept.`)}">${num}</Number>`).join('\n    ')}
  </Dial>
</Response>`;
    } else {
      // No support numbers configured, go to IVR
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${baseUrl}/.netlify/functions/twilio-twiml?type=ivr</Redirect>
</Response>`;
    }
  } else {
    // After hours - go to IVR
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${baseUrl}/.netlify/functions/twilio-twiml?type=ivr</Redirect>
</Response>`;
  }

  return {
    statusCode: 200,
    headers,
    body: twiml
  };
};
