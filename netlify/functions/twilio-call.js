// Netlify function for Twilio outbound calls
// SECURE VERSION - uses environment variables

const twilio = require('twilio');

// Initialize client with environment variables
const getClient = () => twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Verify environment variables
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error('Missing Twilio environment variables');
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'Server configuration error' }) 
      };
    }

    const body = JSON.parse(event.body);
    // NOTE: twilio_sid and twilio_token removed from destructuring - now using env vars
    const { action, to, from, forward_to, record, caller_name, shop_name, call_sid } = body;

    const client = getClient();

    // End call action
    if (action === 'end' && call_sid) {
      try {
        const call = await client.calls(call_sid).update({ status: 'completed' });
        
        // Get recordings for this call
        const recordings = await client.recordings.list({ callSid: call_sid, limit: 1 });
        const recordingUrl = recordings.length > 0 
          ? `https://api.twilio.com${recordings[0].uri.replace('.json', '.mp3')}`
          : null;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            call_status: call.status,
            recording_url: recordingUrl
          })
        };
      } catch (err) {
        console.error('Error ending call:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    // Make new call
    if (!to || !from) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Missing to or from phone number' }) 
      };
    }

    // Clean phone numbers
    const cleanTo = to.replace(/[^\d+]/g, '');
    const cleanFrom = from.replace(/[^\d+]/g, '');

    // Build TwiML for the call
    // If forward_to is provided, we call the rep first, then connect to the customer
    let twimlUrl;
    const baseUrl = process.env.URL || 'https://joe.coffee'; // Your Netlify site URL
    
    if (forward_to) {
      // Forward to cell phone first (rep answers), then connect to customer
      const cleanForward = forward_to.replace(/[^\d+]/g, '');
      const whisper = encodeURIComponent(`joe call from ${shop_name || 'a partner'}. Press 1 to accept.`);
      twimlUrl = `${baseUrl}/.netlify/functions/twilio-twiml?type=forward&to=${encodeURIComponent(cleanTo)}&whisper=${whisper}`;
      
      // Call the rep's cell first
      const call = await client.calls.create({
        url: twimlUrl,
        to: cleanForward,
        from: cleanFrom,
        record: record !== false,
        recordingStatusCallback: `${baseUrl}/.netlify/functions/twilio-recording-status`,
        statusCallback: `${baseUrl}/.netlify/functions/twilio-call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          call_sid: call.sid,
          status: call.status,
          direction: 'outbound',
          to: cleanForward,
          final_to: cleanTo
        })
      };
    } else {
      // Direct browser call - use Twilio Client (needs more setup)
      // For now, fallback to simple outbound call
      twimlUrl = `${baseUrl}/.netlify/functions/twilio-twiml?type=direct&caller=${encodeURIComponent(caller_name || 'joe')}`;
      
      const call = await client.calls.create({
        url: twimlUrl,
        to: cleanTo,
        from: cleanFrom,
        record: record !== false,
        recordingStatusCallback: `${baseUrl}/.netlify/functions/twilio-recording-status`,
        statusCallback: `${baseUrl}/.netlify/functions/twilio-call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          call_sid: call.sid,
          status: call.status,
          direction: 'outbound',
          to: cleanTo
        })
      };
    }

  } catch (error) {
    console.error('Twilio call error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Failed to make call',
        code: error.code
      })
    };
  }
};
