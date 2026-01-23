// Netlify function to fetch call transcripts from Twilio
// SECURE VERSION - uses environment variables

const twilio = require('twilio');

// Initialize client with environment variables
const getClient = () => twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Verify environment variables
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio environment variables');
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'Server configuration error' }) 
    };
  }

  const params = event.queryStringParameters || {};
  // NOTE: twilio_sid and twilio_token removed - now using env vars
  const { call_sid } = params;

  if (!call_sid) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing call_sid parameter' })
    };
  }

  try {
    const client = getClient();

    // Get recordings for this call
    const recordings = await client.recordings.list({ callSid: call_sid });
    
    if (recordings.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          status: 'no_recording',
          transcript: null 
        })
      };
    }

    const recording = recordings[0];
    
    // Check if transcription exists
    const transcriptions = await client.transcriptions.list({ limit: 20 });
    const transcription = transcriptions.find(t => t.recordingSid === recording.sid);

    if (transcription) {
      // Fetch full transcription text
      const fullTranscription = await client.transcriptions(transcription.sid).fetch();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'complete',
          transcript: fullTranscription.transcriptionText,
          recording_url: `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`,
          duration: recording.duration
        })
      };
    }

    // If using Twilio Intelligence (better transcription)
    // Check for Twilio Intelligence transcript
    try {
      const intelligenceTranscripts = await client.intelligence.v2.transcripts.list({
        limit: 10
      });
      
      const matchingTranscript = intelligenceTranscripts.find(t => 
        t.channel && t.channel.participants && 
        t.channel.participants.some(p => p.callSid === call_sid)
      );

      if (matchingTranscript && matchingTranscript.status === 'completed') {
        // Fetch sentences
        const sentences = await client.intelligence.v2
          .transcripts(matchingTranscript.sid)
          .sentences
          .list();
        
        const fullText = sentences.map(s => s.transcript).join(' ');
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'complete',
            transcript: fullText,
            recording_url: `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`,
            duration: recording.duration
          })
        };
      }
    } catch (e) {
      // Twilio Intelligence might not be enabled
      console.log('Twilio Intelligence not available:', e.message);
    }

    // Transcription still processing
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'processing',
        transcript: null,
        recording_url: `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`,
        duration: recording.duration
      })
    };

  } catch (error) {
    console.error('Transcript fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        status: 'error'
      })
    };
  }
};
