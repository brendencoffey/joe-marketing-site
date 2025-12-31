const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const params = new URLSearchParams(event.body);
    const messageSid = params.get('MessageSid');
    const messageStatus = params.get('MessageStatus');

    if (!messageSid) return { statusCode: 400, body: 'Missing MessageSid' };

    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        await supabase.from('sms_messages').update({ twilio_status: messageStatus }).eq('twilio_sid', messageSid);
        return { statusCode: 200, body: 'OK' };
    } catch (error) {
        console.error('Status webhook error:', error);
        return { statusCode: 500, body: 'Error' };
    }
};
