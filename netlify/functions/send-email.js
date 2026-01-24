// netlify/functions/send-email.js
// Sends emails via Resend API

const RESEND_API_KEY = process.env.RESEND_API_KEY;

exports.handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { to, subject, body, html, dealId, companyId, contactId, shopId } = JSON.parse(event.body);
        
        // Accept either 'body' or 'html' parameter
        const emailContent = html || body;
        
        if (!to || !subject || !emailContent) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields: to, subject, body/html' })
            };
        }
        
        // If no API key configured, return a "logged only" response
        if (!RESEND_API_KEY) {
            console.log('Email logged (no API key):', { to, subject });
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: false, 
                    logged: true,
                    message: 'Email logged but not sent (API key not configured)' 
                })
            };
        }
        
        // Send via Resend API
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'joe CRM <crm@joe.coffee>',
                to: [to],
                subject: subject,
                html: html || body.replace(/\n/g, '<br>'),
                text: body || emailContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('Email sent successfully to:', to);
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: true, 
                    messageId: result.id,
                    message: 'Email sent successfully'
                })
            };
        } else {
            console.error('Resend API error:', result);
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: false, 
                    error: result.message || 'Failed to send email',
                    logged: true
                })
            };
        }
        
    } catch (error) {
        console.error('Email send error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message,
                logged: true 
            })
        };
    }
}
