const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

exports.handler = async (event) => {
    console.log('Inbound SMS webhook received');
    
    const params = new URLSearchParams(event.body);
    const from = params.get('From');
    const body = params.get('Body');
    const messageSid = params.get('MessageSid');

    if (!from || !body) {
        return { statusCode: 400, headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>' };
    }

    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

        const { data: conversationId } = await supabase.rpc('find_or_create_sms_conversation', { p_phone: from, p_direction: 'inbound' });

        await supabase.from('sms_messages').insert({
            conversation_id: conversationId,
            direction: 'inbound',
            body: body,
            twilio_sid: messageSid,
            twilio_status: 'received'
        });

        await supabase.rpc('auto_assign_sms_conversation', { p_conversation_id: conversationId });

        // Get conversation details
        const { data: convData } = await supabase.from('sms_conversation_list').select('*').eq('id', conversationId).single();

        // Log activity if linked to contact or company
        if (convData?.contact_id || convData?.company_id) {
            await supabase.from('activities').insert({
                contact_id: convData.contact_id || null,
                company_id: convData.company_id || null,
                shop_id: convData.company_id || null,
                activity_type: 'sms',
                outcome: 'received',
                notes: `Inbound SMS: ${body.substring(0, 500)}`,
                team_member_email: convData.assigned_to || null,
                team_member_name: null
            });
        }

        // Send email notifications
        const { data: teamMembers } = await supabase.from('team_members').select('email, name').eq('is_active', true);

        if (teamMembers?.length && process.env.RESEND_API_KEY) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const senderName = convData?.contact_first_name ? `${convData.contact_first_name} ${convData.contact_last_name || ''}`.trim() : convData?.company_name || from;

            for (const member of teamMembers) {
                try {
                    await resend.emails.send({
                        from: 'joe CRM <notifications@joe.coffee>',
                        to: member.email,
                        subject: `📱 New SMS from ${senderName}`,
                        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px;border-radius:12px 12px 0 0;"><h1 style="color:white;margin:0;font-size:20px;">New SMS Message</h1></div><div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;"><div style="background:white;padding:16px;border-radius:8px;margin-bottom:16px;"><div style="font-size:14px;color:#6b7280;margin-bottom:8px;"><strong>From:</strong> ${senderName}</div><div style="font-size:14px;color:#6b7280;margin-bottom:12px;"><strong>Phone:</strong> ${from}</div><div style="font-size:16px;color:#1a1a1a;line-height:1.5;padding:12px;background:#f3f4f6;border-radius:8px;">${body}</div></div><a href="https://joe.coffee/crm#sms-inbox" style="display:inline-block;background:#f59e0b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">View in CRM →</a></div></div>`
                    });
                } catch (e) { console.error('Email error:', e); }
            }
        }

        return { statusCode: 200, headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>' };

    } catch (error) {
        console.error('Error processing inbound SMS:', error);
        return { statusCode: 500, headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>' };
    }
};
