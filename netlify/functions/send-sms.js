const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    
    // Check env vars FIRST
    const envCheck = {
        TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER: !!process.env.TWILIO_PHONE_NUMBER,
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY
    };
    
    console.log('Environment check:', envCheck);
    
    const missing = Object.entries(envCheck).filter(([k,v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
        console.error('Missing env vars:', missing);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: 'Server config error', missing: missing }) 
        };
    }
    
    try {
        const { to, body, conversationId, sentBy, sentByName } = JSON.parse(event.body);
        console.log('Sending SMS to:', to, 'body length:', body?.length);
        
        if (!to || !body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing: to, body' }) };
        }
        
        const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const message = await twilio.messages.create({
            body: body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to,
            statusCallback: `${process.env.URL || 'https://joe.coffee'}/.netlify/functions/twilio-status-webhook`
        });
        
        console.log('Twilio message sent:', message.sid);
        
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        let convId = conversationId;
        
        if (!convId) {
            const { data } = await supabase.rpc('find_or_create_sms_conversation', { p_phone: to, p_direction: 'outbound' });
            convId = data;
        }
        
        if (convId) {
            await supabase.from('sms_messages').insert({
                conversation_id: convId,
                direction: 'outbound',
                body: body,
                sent_by: sentBy || null,
                sent_by_name: sentByName || null,
                twilio_sid: message.sid,
                twilio_status: message.status
            });
        }
        
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, messageSid: message.sid, conversationId: convId }) };
    } catch (error) {
        console.error('Error sending SMS:', error.message);
        console.error('Error stack:', error.stack);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send SMS', details: error.message }) };
    }
};
