const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    
    try {
        const { to, body, conversationId, sentBy, sentByName } = JSON.parse(event.body);
        if (!to || !body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing: to, body' }) };
        
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        
        const message = await client.messages.create({
            body: body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });
        
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
            
            // Get conversation details for activity logging
            const { data: convData } = await supabase.from('sms_conversation_list').select('*').eq('id', convId).single();
            
            // Log activity if linked to contact or company
            if (convData?.contact_id || convData?.company_id) {
                await supabase.from('activities').insert({
                    contact_id: convData.contact_id || null,
                    company_id: convData.company_id || null,
                    shop_id: convData.company_id || null,
                    activity_type: 'sms',
                    outcome: 'sent',
                    notes: `Outbound SMS: ${body.substring(0, 500)}`,
                    team_member_email: sentBy || null,
                    team_member_name: sentByName || null
                });
            }
        }
        
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, messageSid: message.sid, status: message.status }) };
    } catch (error) {
        console.error('SMS Error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
