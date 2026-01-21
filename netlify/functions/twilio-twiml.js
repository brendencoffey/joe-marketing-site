// Netlify function to generate TwiML for Twilio calls
// Place in: netlify/functions/twilio-twiml.js

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'text/xml',
    'Access-Control-Allow-Origin': '*'
  };

  const params = event.queryStringParameters || {};
  const { type, to, whisper, caller } = params;

  let twiml = '';

  if (type === 'forward') {
    // Call forwarding with whisper
    // Rep hears whisper, presses 1 to accept, then connected to customer
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/.netlify/functions/twilio-twiml?type=connect&amp;to=${encodeURIComponent(to)}" method="POST">
    <Say voice="alice">${whisper ? decodeURIComponent(whisper) : 'Incoming call. Press 1 to accept.'}</Say>
  </Gather>
  <Say voice="alice">No response received. Goodbye.</Say>
  <Hangup/>
</Response>`;
  } else if (type === 'connect') {
    // Connect to the customer after rep accepts
    const customerNumber = decodeURIComponent(to);
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you now.</Say>
  <Dial callerId="${process.env.TWILIO_PHONE || '+12062088338'}" record="record-from-answer-dual">
    <Number>${customerNumber}</Number>
  </Dial>
</Response>`;
  } else if (type === 'direct') {
    // Direct outbound call
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call.</Say>
  <Dial record="record-from-answer-dual">
    <Client>${caller || 'agent'}</Client>
  </Dial>
</Response>`;
  } else if (type === 'ivr') {
    // IVR menu for inbound calls
    const baseUrl = process.env.URL || 'https://joe.coffee';
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${baseUrl}/.netlify/functions/twilio-twiml?type=ivr-route" method="POST">
    <Say voice="alice">
      Thanks for calling joe! 
      For sales, press 1.
      For support, press 2.
      For partner success, press 3.
      To leave a message, press 0.
    </Say>
  </Gather>
  <Say voice="alice">We didn't receive any input. Goodbye.</Say>
  <Hangup/>
</Response>`;
  } else if (type === 'ivr-route') {
    // Route based on IVR selection
    const digit = event.body ? new URLSearchParams(event.body).get('Digits') : '0';
    const baseUrl = process.env.URL || 'https://joe.coffee';
    
    const routes = {
      '1': { name: 'Sales', queue: 'sales' },
      '2': { name: 'Support', queue: 'support' },
      '3': { name: 'Partner Success', queue: 'success' },
      '0': { name: 'Voicemail', queue: 'voicemail' }
    };
    
    const route = routes[digit] || routes['0'];
    
    if (route.queue === 'voicemail') {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please leave a message after the tone. Press any key when finished.</Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="${baseUrl}/.netlify/functions/twilio-voicemail"/>
  <Say voice="alice">Thank you for your message. Goodbye.</Say>
  <Hangup/>
</Response>`;
    } else {
      // Queue the call (you'd set up actual queues in Twilio)
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to ${route.name}. Please hold.</Say>
  <Enqueue workflowSid="${process.env.TWILIO_WORKFLOW_SID || 'default'}">${route.queue}</Enqueue>
  <Say voice="alice">All agents are busy. Please leave a message.</Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="${baseUrl}/.netlify/functions/twilio-voicemail"/>
</Response>`;
    }
  } else if (type === 'voicemail') {
    // Simple voicemail
    const baseUrl = process.env.URL || 'https://joe.coffee';
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">You've reached joe. Please leave a message after the tone, and we'll get back to you as soon as possible.</Say>
  <Record maxLength="180" transcribe="true" transcribeCallback="${baseUrl}/.netlify/functions/twilio-voicemail"/>
  <Say voice="alice">Thank you. Goodbye.</Say>
  <Hangup/>
</Response>`;
  } else {
    // Default response
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello, this is joe coffee. Please hold while we connect you.</Say>
  <Pause length="2"/>
</Response>`;
  }

  return {
    statusCode: 200,
    headers,
    body: twiml
  };
};
