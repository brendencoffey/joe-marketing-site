// Netlify function to handle voicemail transcriptions from Twilio
// Place in: netlify/functions/twilio-voicemail.js

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'text/xml',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Parse Twilio webhook data
  const params = new URLSearchParams(event.body || '');
  
  const transcriptionText = params.get('TranscriptionText');
  const transcriptionStatus = params.get('TranscriptionStatus');
  const recordingUrl = params.get('RecordingUrl');
  const recordingSid = params.get('RecordingSid');
  const callSid = params.get('CallSid');
  const from = params.get('From');
  const to = params.get('To');
  const duration = params.get('RecordingDuration');

  console.log('Voicemail received:', {
    from,
    to,
    duration,
    transcriptionStatus,
    hasTranscript: !!transcriptionText
  });

  // Save to Supabase if configured
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      // Try to match the phone number to a contact
      const cleanPhone = from.replace(/[^\d]/g, '');
      
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, company_id')
        .or(`phone.ilike.%${cleanPhone.slice(-10)}%,mobile.ilike.%${cleanPhone.slice(-10)}%`)
        .limit(1);

      const contact = contacts && contacts[0];

      // Try to match to a shop
      const { data: shops } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('phone', `%${cleanPhone.slice(-10)}%`)
        .limit(1);

      const shop = shops && shops[0];

      // Create activity record for the voicemail
      const activityData = {
        activity_type: 'voicemail',
        activity_category: 'support', // Default to support for voicemails
        contact_id: contact?.id || null,
        shop_id: contact?.company_id || shop?.id || null,
        phone: from,
        notes: `📩 Voicemail from ${from}\nDuration: ${duration}s\n\n${transcriptionText || '(No transcript available)'}`,
        transcript: transcriptionText || null,
        recording_url: recordingUrl,
        audio_url: recordingUrl ? `${recordingUrl}.mp3` : null,
        duration_seconds: parseInt(duration) || 0,
        direction: 'inbound',
        outcome: 'voicemail'
      };

      const { data: activity, error } = await supabase
        .from('activities')
        .insert([activityData])
        .select()
        .single();

      if (error) {
        console.error('Error saving voicemail activity:', error);
      } else {
        console.log('Voicemail activity saved:', activity.id);

        // Create a task for follow-up
        const taskData = {
          title: `Follow up on voicemail from ${contact ? `${contact.first_name} ${contact.last_name}` : from}`,
          contact_id: contact?.id || null,
          shop_id: contact?.company_id || shop?.id || null,
          status: 'pending',
          priority: 'high',
          due_date: new Date().toISOString().split('T')[0], // Due today
          notes: `Voicemail transcript: ${transcriptionText || 'No transcript available'}`
        };

        await supabase.from('tasks').insert([taskData]);
      }

      // Send email notification to team (optional)
      // You could integrate with SendGrid, Mailgun, etc. here

    } catch (err) {
      console.error('Error processing voicemail:', err);
    }
  }

  // Return empty TwiML response
  return {
    statusCode: 200,
    headers,
    body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
  };
};
