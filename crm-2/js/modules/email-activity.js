// ==========================================
// EMAIL & ACTIVITY MODULE
// Handles email sending, activity logging, timeline display
// ==========================================

const EmailActivity = {
    
    // ==========================================
    // EMAIL COMPOSER
    // ==========================================
    
    showEmailComposer(options = {}) {
        const { dealId, companyId, contactId, shopId, toEmail, toName, subject = '', body = '' } = options;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'email-composer-modal';
        modal.innerHTML = `
            <div class="modal email-composer-modal">
                <div class="modal-header">
                    <h2><i data-lucide="mail"></i> Compose Email</h2>
                    <button class="btn-icon" onclick="EmailActivity.closeComposer()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="email-form">
                        <div class="form-row">
                            <label>To</label>
                            <input type="email" id="email-to" value="${toEmail || ''}" placeholder="recipient@email.com" required>
                        </div>
                        <div class="form-row">
                            <label>Subject</label>
                            <input type="text" id="email-subject" value="${subject}" placeholder="Email subject..." required>
                        </div>
                        <div class="form-row">
                            <label>Message</label>
                            <textarea id="email-body" rows="12" placeholder="Write your message...">${body}</textarea>
                        </div>
                        <div class="email-templates">
                            <span class="template-label">Templates:</span>
                            <button class="template-btn" onclick="EmailActivity.insertTemplate('intro')">Intro</button>
                            <button class="template-btn" onclick="EmailActivity.insertTemplate('followup')">Follow-up</button>
                            <button class="template-btn" onclick="EmailActivity.insertTemplate('demo')">Demo Request</button>
                            <button class="template-btn" onclick="EmailActivity.insertTemplate('pricing')">Pricing</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="EmailActivity.closeComposer()">Cancel</button>
                    <button class="btn btn-primary" onclick="EmailActivity.sendEmail('${dealId || ''}', '${companyId || ''}', '${contactId || ''}', '${shopId || ''}')">
                        <i data-lucide="send"></i> Send Email
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        if (window.lucide) lucide.createIcons();
        
        // Focus on appropriate field
        if (!toEmail) {
            document.getElementById('email-to').focus();
        } else if (!subject) {
            document.getElementById('email-subject').focus();
        } else {
            document.getElementById('email-body').focus();
        }
    },
    
    closeComposer() {
        const modal = document.getElementById('email-composer-modal');
        if (modal) modal.remove();
    },
    
    insertTemplate(type) {
        const templates = {
            intro: `Hi {{name}},

I hope this email finds you well! I'm reaching out from joe - we help independent coffee shops increase revenue through mobile ordering and customer loyalty.

I noticed {{shop_name}} and thought you might be interested in learning how other shops in your area have increased their average ticket by 23% with our platform.

Would you be open to a quick 15-minute call this week to see if joe might be a fit?

Best,
{{sender_name}}`,
            
            followup: `Hi {{name}},

I wanted to follow up on my previous email about joe's mobile ordering platform.

I know you're busy running {{shop_name}}, so I'll keep this brief - would a quick 10-minute demo work for you this week?

If now isn't the right time, just let me know and I'll check back in a few months.

Best,
{{sender_name}}`,
            
            demo: `Hi {{name}},

Thanks for your interest in joe! I'd love to show you how our platform works and answer any questions you have.

Here are a few times that work for a demo:
- [Time option 1]
- [Time option 2]
- [Time option 3]

Or feel free to book directly here: [calendar link]

Looking forward to connecting!

Best,
{{sender_name}}`,
            
            pricing: `Hi {{name}},

Thanks for asking about pricing! Here's a quick overview:

**joe Mobile Ordering**
- 0% commission on orders
- $99/month flat fee
- Includes loyalty program, customer data, and marketing tools

**joe Complete (POS + Mobile)**
- Full POS system + mobile ordering
- $199/month
- Free hardware with annual commitment

Happy to jump on a call to discuss which option makes sense for {{shop_name}}.

Best,
{{sender_name}}`
        };
        
        const bodyField = document.getElementById('email-body');
        if (bodyField && templates[type]) {
            bodyField.value = templates[type];
        }
    },
    
    async sendEmail(dealId, companyId, contactId, shopId) {
        const toEmail = document.getElementById('email-to').value;
        const subject = document.getElementById('email-subject').value;
        const body = document.getElementById('email-body').value;
        
        if (!toEmail || !subject || !body) {
            UI.showToast('Please fill in all fields', 'error');
            return;
        }
        
        // Show sending state
        const sendBtn = document.querySelector('#email-composer-modal .btn-primary');
        const originalText = sendBtn.innerHTML;
        sendBtn.innerHTML = '<i data-lucide="loader"></i> Sending...';
        sendBtn.disabled = true;
        if (window.lucide) lucide.createIcons();
        
        try {
            // Call Netlify function to send email
            const response = await fetch('/.netlify/functions/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: toEmail,
                    subject: subject,
                    body: body,
                    dealId,
                    companyId,
                    contactId,
                    shopId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Log activity
                await this.logActivity({
                    type: 'email',
                    subject: subject,
                    body: body,
                    dealId,
                    companyId,
                    contactId,
                    shopId,
                    outcome: 'sent'
                });
                
                UI.showToast('Email sent successfully!', 'success');
                this.closeComposer();
                
                // Refresh activity timeline if visible
                if (typeof Deals !== 'undefined' && Deals.currentDeal) {
                    Deals.loadActivities(Deals.currentDeal.id);
                }
            } else {
                throw new Error(result.error || 'Failed to send email');
            }
        } catch (error) {
            console.error('Error sending email:', error);
            
            // For now, still log the email as an activity (manual send)
            await this.logActivity({
                type: 'email',
                subject: subject,
                body: body,
                dealId,
                companyId,
                contactId,
                shopId,
                outcome: 'logged'
            });
            
            UI.showToast('Email logged (send manually via your email client)', 'info');
            this.closeComposer();
        }
        
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
    },
    
    // ==========================================
    // ACTIVITY LOGGING
    // ==========================================
    
    showLogActivityModal(options = {}) {
        const { dealId, companyId, contactId, shopId, type = 'note' } = options;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'log-activity-modal';
        modal.innerHTML = `
            <div class="modal log-activity-modal">
                <div class="modal-header">
                    <h2><i data-lucide="plus-circle"></i> Log Activity</h2>
                    <button class="btn-icon" onclick="EmailActivity.closeActivityModal()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="activity-type-tabs">
                        <button class="activity-type-btn ${type === 'note' ? 'active' : ''}" data-type="note" onclick="EmailActivity.switchActivityType('note')">
                            <i data-lucide="file-text"></i> Note
                        </button>
                        <button class="activity-type-btn ${type === 'call' ? 'active' : ''}" data-type="call" onclick="EmailActivity.switchActivityType('call')">
                            <i data-lucide="phone"></i> Call
                        </button>
                        <button class="activity-type-btn ${type === 'meeting' ? 'active' : ''}" data-type="meeting" onclick="EmailActivity.switchActivityType('meeting')">
                            <i data-lucide="calendar"></i> Meeting
                        </button>
                        <button class="activity-type-btn ${type === 'task' ? 'active' : ''}" data-type="task" onclick="EmailActivity.switchActivityType('task')">
                            <i data-lucide="check-square"></i> Task
                        </button>
                    </div>
                    
                    <div class="activity-form">
                        <div class="form-row" id="activity-subject-row">
                            <label>Subject</label>
                            <input type="text" id="activity-subject" placeholder="Brief summary...">
                        </div>
                        
                        <div class="form-row" id="activity-outcome-row" style="display:none;">
                            <label>Outcome</label>
                            <select id="activity-outcome">
                                <option value="">Select outcome...</option>
                                <option value="connected">Connected</option>
                                <option value="left_voicemail">Left Voicemail</option>
                                <option value="no_answer">No Answer</option>
                                <option value="busy">Busy</option>
                                <option value="wrong_number">Wrong Number</option>
                                <option value="follow_up">Follow-up Needed</option>
                                <option value="not_interested">Not Interested</option>
                                <option value="interested">Interested</option>
                            </select>
                        </div>
                        
                        <div class="form-row">
                            <label>Notes</label>
                            <textarea id="activity-notes" rows="6" placeholder="Add details..."></textarea>
                        </div>
                        
                        <div class="form-row" id="activity-followup-row">
                            <label>Follow-up Date</label>
                            <input type="date" id="activity-followup">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="EmailActivity.closeActivityModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="EmailActivity.saveActivity('${dealId || ''}', '${companyId || ''}', '${contactId || ''}', '${shopId || ''}')">
                        <i data-lucide="save"></i> Save Activity
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        if (window.lucide) lucide.createIcons();
        this.switchActivityType(type);
    },
    
    closeActivityModal() {
        const modal = document.getElementById('log-activity-modal');
        if (modal) modal.remove();
    },
    
    switchActivityType(type) {
        // Update active button
        document.querySelectorAll('.activity-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        
        // Show/hide outcome for calls
        const outcomeRow = document.getElementById('activity-outcome-row');
        if (outcomeRow) {
            outcomeRow.style.display = type === 'call' ? 'block' : 'none';
        }
        
        // Update subject placeholder
        const subjectField = document.getElementById('activity-subject');
        if (subjectField) {
            const placeholders = {
                note: 'Note title...',
                call: 'Call with...',
                meeting: 'Meeting about...',
                task: 'Task description...'
            };
            subjectField.placeholder = placeholders[type] || 'Subject...';
        }
        
        // Store selected type
        document.getElementById('log-activity-modal').dataset.activityType = type;
    },
    
    async saveActivity(dealId, companyId, contactId, shopId) {
        const modal = document.getElementById('log-activity-modal');
        const type = modal?.dataset.activityType || 'note';
        const subject = document.getElementById('activity-subject').value;
        const notes = document.getElementById('activity-notes').value;
        const outcome = document.getElementById('activity-outcome')?.value;
        const followupDate = document.getElementById('activity-followup')?.value;
        
        if (!notes && !subject) {
            UI.showToast('Please add some content', 'error');
            return;
        }
        
        try {
            await this.logActivity({
                type,
                subject,
                body: notes,
                outcome,
                followupDate,
                dealId,
                companyId,
                contactId,
                shopId
            });
            
            UI.showToast('Activity logged!', 'success');
            this.closeActivityModal();
            
            // Refresh timeline
            if (typeof Deals !== 'undefined' && Deals.currentDeal) {
                Deals.loadActivities(Deals.currentDeal.id);
            }
            if (typeof Companies !== 'undefined' && Companies.currentCompany) {
                Companies.loadActivities(Companies.currentCompany.id);
            }
        } catch (error) {
            console.error('Error saving activity:', error);
            UI.showToast('Failed to save activity', 'error');
        }
    },
    
    async logActivity(data) {
        const { type, subject, body, outcome, followupDate, dealId, companyId, contactId, shopId } = data;
        
        const session = await db.auth.getSession();
        const userEmail = session?.data?.session?.user?.email || 'unknown';
        
        const { error } = await db.from('activities').insert({
            activity_type: type,
            subject: subject || null,
            notes: body || null,
            body: body || null,
            outcome: outcome || null,
            follow_up_date: followupDate || null,
            deal_id: dealId || null,
            company_id: companyId || null,
            contact_id: contactId || null,
            shop_id: shopId || null,
            team_member_email: userEmail,
            team_member_name: userEmail.split('@')[0],
            created_at: new Date().toISOString()
        });
        
        if (error) throw error;
    },
    
    // ==========================================
    // ACTIVITY TIMELINE
    // ==========================================
    
    async loadActivities(options = {}) {
        const { dealId, companyId, contactId, shopId, limit = 50 } = options;
        
        let query = db.from('activities').select('*');
        
        if (dealId) query = query.eq('deal_id', dealId);
        if (companyId) query = query.eq('company_id', companyId);
        if (contactId) query = query.eq('contact_id', contactId);
        if (shopId) query = query.eq('shop_id', shopId);
        
        query = query.order('created_at', { ascending: false }).limit(limit);
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Error loading activities:', error);
            return [];
        }
        
        return data || [];
    },
    
    renderActivityTimeline(activities, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="empty-timeline">
                    <i data-lucide="inbox"></i>
                    <p>No activity yet</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }
        
        container.innerHTML = `
            <div class="activity-timeline">
                ${activities.map(activity => this.renderActivityItem(activity)).join('')}
            </div>
        `;
        
        if (window.lucide) lucide.createIcons();
    },
    
    renderActivityItem(activity) {
        const icons = {
            email: 'mail',
            call: 'phone',
            meeting: 'calendar',
            note: 'file-text',
            task: 'check-square'
        };
        
        const colors = {
            email: '#3b82f6',
            call: '#10b981',
            meeting: '#8b5cf6',
            note: '#6b7280',
            task: '#f59e0b'
        };
        
        const icon = icons[activity.activity_type] || 'circle';
        const color = colors[activity.activity_type] || '#6b7280';
        const date = new Date(activity.created_at);
        const timeAgo = this.getTimeAgo(date);
        
        return `
            <div class="activity-item">
                <div class="activity-icon" style="background: ${color}20; color: ${color}">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-header">
                        <span class="activity-type">${activity.activity_type}</span>
                        ${activity.subject ? `<span class="activity-subject">${activity.subject}</span>` : ''}
                        <span class="activity-time">${timeAgo}</span>
                    </div>
                    ${activity.notes || activity.body ? `
                        <div class="activity-body">${(activity.notes || activity.body).substring(0, 200)}${(activity.notes || activity.body).length > 200 ? '...' : ''}</div>
                    ` : ''}
                    ${activity.outcome ? `<span class="activity-outcome">${activity.outcome.replace(/_/g, ' ')}</span>` : ''}
                    <div class="activity-meta">
                        <span>${activity.team_member_name || activity.team_member_email || 'System'}</span>
                        <span>${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
            </div>
        `;
    },
    
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
        if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
        return date.toLocaleDateString();
    },
    
    // ==========================================
    // QUICK ACTIONS BAR
    // ==========================================
    
    renderQuickActions(options = {}) {
        const { dealId, companyId, contactId, shopId, toEmail } = options;
        
        return `
            <div class="quick-actions-bar">
                <button class="quick-action-btn" onclick="EmailActivity.showEmailComposer({dealId:'${dealId||''}',companyId:'${companyId||''}',contactId:'${contactId||''}',shopId:'${shopId||''}',toEmail:'${toEmail||''}'})">
                    <i data-lucide="mail"></i> Email
                </button>
                <button class="quick-action-btn" onclick="EmailActivity.showLogActivityModal({dealId:'${dealId||''}',companyId:'${companyId||''}',contactId:'${contactId||''}',shopId:'${shopId||''}',type:'call'})">
                    <i data-lucide="phone"></i> Log Call
                </button>
                <button class="quick-action-btn" onclick="EmailActivity.showLogActivityModal({dealId:'${dealId||''}',companyId:'${companyId||''}',contactId:'${contactId||''}',shopId:'${shopId||''}',type:'note'})">
                    <i data-lucide="file-text"></i> Note
                </button>
                <button class="quick-action-btn" onclick="EmailActivity.showLogActivityModal({dealId:'${dealId||''}',companyId:'${companyId||''}',contactId:'${contactId||''}',shopId:'${shopId||''}',type:'meeting'})">
                    <i data-lucide="calendar"></i> Meeting
                </button>
                <button class="quick-action-btn" onclick="EmailActivity.showLogActivityModal({dealId:'${dealId||''}',companyId:'${companyId||''}',contactId:'${contactId||''}',shopId:'${shopId||''}',type:'task'})">
                    <i data-lucide="check-square"></i> Task
                </button>
            </div>
        `;
    }
};

// Make globally available
window.EmailActivity = EmailActivity;
