// ============================================
// COMPANIES MODULE - Customer Lifecycle Management
// ============================================

const Companies = {
    currentCompany: null,
    
    async render(params = {}) {
        if (params.id) {
            await this.showCompanyDetail(params.id);
            return;
        }
        await this.loadData();
        this.renderList();
    },
    
    async loadData() {
        // Simple query - use actual schema columns
        const { data, error } = await db
            .from('companies')
            .select('id, name, city, state, is_partner, health_score, website, phone, industry, lead_source, notes')
            .order('name')
            .limit(200);
        
        if (error) {
            console.error('Companies load error:', error);
        }
        if (data) Store.data.companies = data;
    },
    
    renderList() {
        const container = document.getElementById('page-companies');
        if (!container) return;
        
        const companies = Store.data.companies || [];
        
        container.innerHTML = `
            <div class="page-header">
                <h1>Companies</h1>
                <div class="header-actions">
                    <input type="text" class="search-input" id="company-search" placeholder="Search companies..." oninput="Companies.filterList()">
                    <select class="form-select" id="partner-filter" onchange="Companies.filterList()">
                        <option value="">All Companies</option>
                        <option value="partner">Partners</option>
                        <option value="prospect">Prospects</option>
                    </select>
                    <button class="btn btn-primary" onclick="Companies.showNewModal()">
                        <i data-lucide="plus"></i> New Company
                    </button>
                </div>
            </div>
            
            <div id="companies-list">
                ${this.renderTable(companies)}
            </div>
        `;
        
        if (window.lucide) lucide.createIcons();
    },
    
    renderTable(companies) {
        if (!companies.length) {
            return `<div class="empty-state">
                <div class="empty-icon">🏢</div>
                <h3>No companies found</h3>
                <p>Add your first company to get started</p>
            </div>`;
        }
        
        return `<table class="data-table">
            <thead>
                <tr>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Industry</th>
                    <th>Health</th>
                </tr>
            </thead>
            <tbody>
                ${companies.map(c => {
                    return `<tr onclick="Router.navigate('companies/${c.id}')" class="clickable-row">
                        <td>
                            <div class="company-cell">
                                <strong>${UI.escapeHtml(c.name || 'Unnamed')}</strong>
                                ${c.website ? `<a href="${c.website}" target="_blank" class="text-muted text-sm" onclick="event.stopPropagation()"><i data-lucide="external-link" style="width:12px;height:12px"></i></a>` : ''}
                            </div>
                        </td>
                        <td>${[c.city, c.state].filter(Boolean).join(', ') || '-'}</td>
                        <td>
                            <span class="badge" style="background:${c.is_partner ? '#10B981' : '#6B7280'}">
                                ${c.is_partner ? 'Partner' : 'Prospect'}
                            </span>
                        </td>
                        <td>${c.industry || '-'}</td>
                        <td>
                            <div class="health-indicator ${this.getHealthClass(c.health_score)}">
                                ${c.health_score || '-'}
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
    },
    
    getHealthClass(score) {
        if (!score) return '';
        if (score >= 80) return 'health-good';
        if (score >= 50) return 'health-warning';
        return 'health-danger';
    },
    
    filterList() {
        const search = document.getElementById('company-search')?.value?.toLowerCase() || '';
        const partnerFilter = document.getElementById('partner-filter')?.value || '';
        
        let filtered = Store.data.companies || [];
        
        if (search) {
            filtered = filtered.filter(c => 
                c.name?.toLowerCase().includes(search) ||
                c.city?.toLowerCase().includes(search) ||
                c.industry?.toLowerCase().includes(search)
            );
        }
        
        if (partnerFilter === 'partner') {
            filtered = filtered.filter(c => c.is_partner);
        } else if (partnerFilter === 'prospect') {
            filtered = filtered.filter(c => !c.is_partner);
        }
        
        document.getElementById('companies-list').innerHTML = this.renderTable(filtered);
        if (window.lucide) lucide.createIcons();
    },
    
    // ==========================================
    // COMPANY DETAIL PAGE
    // ==========================================
    
    async showCompanyDetail(companyId) {
        const { data: company, error } = await db.from('companies')
            .select('*')
            .eq('id', companyId)
            .single();
        
        if (!company || error) {
            UI.toast('Company not found', 'error');
            Router.navigate('companies');
            return;
        }
        
        this.currentCompany = company;
        
        // Load all related data in parallel - handle missing tables gracefully
        const [dealsRes, contactsRes, activitiesRes, tasksRes] = await Promise.all([
            db.from('deals')
                .select('*, pipeline_stages(id,name,color), pipelines(id,name)')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false }),
            db.from('company_contacts')
                .select('*, contacts(*)')
                .eq('company_id', companyId)
                .limit(20),
            db.from('activities')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(50),
            db.from('tasks')
                .select('*')
                .eq('company_id', companyId)
                .order('due_date')
                .limit(50)
        ]);
        
        // Support tickets - may not exist yet
        let tickets = [];
        try {
            const ticketsRes = await db.from('support_tickets')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(20);
            tickets = ticketsRes.data || [];
        } catch (e) {
            // Table doesn't exist yet - that's OK
        }
        
        const deals = dealsRes.data || [];
        const contacts = contactsRes.data || [];
        const activities = activitiesRes.data || [];
        const tasks = tasksRes.data || [];
        
        const page = document.getElementById('page-companies');
        page.innerHTML = this.buildDetailHTML(company, deals, contacts, activities, tasks, tickets);
        
        this.initTabs();
        if (window.lucide) lucide.createIcons();
    },
    
    buildDetailHTML(company, deals, contacts, activities, tasks, tickets) {
        const primaryContact = contacts.find(c => c.is_primary)?.contacts || contacts[0]?.contacts;
        const isCustomer = ['customer', 'partner'].includes(company.lifecycle_stage);
        const openTickets = tickets.filter(t => t.status !== 'closed');
        
        // Calculate metrics
        const salesDeals = deals.filter(d => d.pipelines?.name === 'Sales');
        const customerDeals = deals.filter(d => d.pipelines?.name === 'Customer Success');
        const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
        const wonDeals = deals.filter(d => d.pipeline_stages?.name === 'Won');
        
        return `<div class="company-detail">
            <div class="company-header">
                <div class="company-header-left">
                    <button class="btn btn-ghost" onclick="Router.navigate('companies')">
                        <i data-lucide="arrow-left"></i> Back
                    </button>
                    <div class="company-title-section">
                        <h1>${UI.escapeHtml(company.name)}</h1>
                        <div class="company-subtitle">
                            ${company.city || ''}, ${company.state || ''}
                            <span class="lifecycle-badge lifecycle-${company.lifecycle_stage || 'unknown'}">
                                ${company.lifecycle_stage || 'Unknown'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="company-header-right">
                    <select class="lifecycle-select" onchange="Companies.updateLifecycle(this.value)">
                        <option value="lead" ${company.lifecycle_stage === 'lead' ? 'selected' : ''}>Lead</option>
                        <option value="prospect" ${company.lifecycle_stage === 'prospect' ? 'selected' : ''}>Prospect</option>
                        <option value="customer" ${company.lifecycle_stage === 'customer' ? 'selected' : ''}>Customer</option>
                        <option value="partner" ${company.lifecycle_stage === 'partner' ? 'selected' : ''}>Partner</option>
                        <option value="churned" ${company.lifecycle_stage === 'churned' ? 'selected' : ''}>Churned</option>
                    </select>
                    <button class="btn btn-secondary" onclick="Companies.editCompany()">
                        <i data-lucide="edit-2"></i> Edit
                    </button>
                </div>
            </div>
            
            <!-- Stats Row -->
            <div class="stats-row">
                <div class="stat-card">
                    <span class="stat-label">Total Value</span>
                    <span class="stat-value">$${totalValue.toLocaleString()}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Deals</span>
                    <span class="stat-value">${deals.length}</span>
                    <span class="stat-detail">${wonDeals.length} won</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Health Score</span>
                    <span class="stat-value health-${this.getHealthClass(company.health_score)}">${company.health_score || '-'}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Open Tickets</span>
                    <span class="stat-value ${openTickets.length > 0 ? 'text-warning' : ''}">${openTickets.length}</span>
                </div>
            </div>
            
            <!-- Lifecycle Tabs -->
            <div class="lifecycle-tabs">
                <button class="lifecycle-tab active" data-tab="overview">
                    <i data-lucide="layout-dashboard"></i> Overview
                </button>
                <button class="lifecycle-tab" data-tab="sales">
                    <i data-lucide="trending-up"></i> Sales
                </button>
                <button class="lifecycle-tab" data-tab="onboarding">
                    <i data-lucide="rocket"></i> Onboarding
                </button>
                <button class="lifecycle-tab" data-tab="support">
                    <i data-lucide="headphones"></i> Support
                </button>
                <button class="lifecycle-tab" data-tab="success">
                    <i data-lucide="trophy"></i> Success
                </button>
            </div>
            
            <div class="company-content">
                <div class="lifecycle-tab-content active" id="tab-overview">
                    ${this.renderOverview(company, primaryContact, deals, activities.slice(0,5), tasks.slice(0,3))}
                </div>
                <div class="lifecycle-tab-content" id="tab-sales">
                    ${this.renderSalesTab(company, salesDeals, contacts, activities)}
                </div>
                <div class="lifecycle-tab-content" id="tab-onboarding">
                    ${this.renderOnboardingTab(company, customerDeals)}
                </div>
                <div class="lifecycle-tab-content" id="tab-support">
                    ${this.renderSupportTab(company, tickets)}
                </div>
                <div class="lifecycle-tab-content" id="tab-success">
                    ${this.renderSuccessTab(company, customerDeals)}
                </div>
            </div>
        </div>`;
    },
    
    initTabs() {
        document.querySelectorAll('.lifecycle-tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.lifecycle-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.lifecycle-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
                if (window.lucide) lucide.createIcons();
            };
        });
    },
    
    // ==========================================
    // TAB RENDERERS
    // ==========================================
    
    renderOverview(company, contact, deals, activities, tasks) {
        const contactEmail = contact?.email || company.email || '';
        
        return `<div class="overview-grid">
            <div class="overview-main">
                <div class="card">
                    <div class="card-header"><h3>Quick Actions</h3></div>
                    <div class="card-body">
                        <div class="quick-actions">
                            <button class="btn btn-primary" onclick="EmailActivity.showEmailComposer({companyId:'${company.id}',toEmail:'${contactEmail}'})">
                                <i data-lucide="mail"></i> Send Email
                            </button>
                            <button class="btn btn-secondary" onclick="EmailActivity.showLogActivityModal({companyId:'${company.id}',type:'call'})">
                                <i data-lucide="phone"></i> Log Call
                            </button>
                            <button class="btn btn-secondary" onclick="Deals.showNewDealModal('${company.id}','${UI.escapeHtml(company.name)}')">
                                <i data-lucide="plus-circle"></i> New Deal
                            </button>
                            <button class="btn btn-secondary" onclick="Companies.createTask()">
                                <i data-lucide="check-square"></i> Create Task
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3>Recent Activity</h3></div>
                    <div class="card-body">
                        ${activities.length ? `<div class="activity-list">${activities.map(a => this.activityItem(a)).join('')}</div>` : '<p class="text-muted">No activity yet</p>'}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3>Pending Tasks</h3></div>
                    <div class="card-body">
                        ${tasks.filter(t => t.status !== 'completed').length ? 
                            `<div class="task-list">${tasks.filter(t => t.status !== 'completed').map(t => this.taskItem(t)).join('')}</div>` : 
                            '<p class="text-muted">No pending tasks</p>'}
                    </div>
                </div>
            </div>
            
            <div class="overview-sidebar">
                <div class="card">
                    <div class="card-header">
                        <h3>Company Details</h3>
                        <button class="btn btn-ghost btn-sm" onclick="Companies.editCompany()"><i data-lucide="edit-2"></i></button>
                    </div>
                    <div class="card-body">
                        <div class="detail-row"><label>Phone</label><span>${company.phone || '-'}</span></div>
                        <div class="detail-row"><label>Email</label><span>${company.email || '-'}</span></div>
                        <div class="detail-row"><label>Website</label><span>${company.website ? `<a href="${company.website}" target="_blank">${company.website}</a>` : '-'}</span></div>
                        <div class="detail-row"><label>Industry</label><span>${company.industry || '-'}</span></div>
                        <div class="detail-row"><label>Size</label><span>${company.company_size || '-'}</span></div>
                        <div class="detail-row"><label>Lead Source</label><span>${company.lead_source || '-'}</span></div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3>Primary Contact</h3>
                        <button class="btn btn-ghost btn-sm" onclick="Companies.addContact()"><i data-lucide="plus"></i></button>
                    </div>
                    <div class="card-body">
                        ${contact ? `<div class="contact-card">
                            <div class="contact-avatar">${UI.getInitials(contact.first_name, contact.last_name)}</div>
                            <div class="contact-info">
                                <div class="contact-name">${contact.first_name} ${contact.last_name || ''}</div>
                                <div class="contact-title">${contact.job_title || ''}</div>
                                ${contact.email ? `<a href="mailto:${contact.email}">${contact.email}</a>` : ''}
                            </div>
                        </div>` : '<p class="text-muted">No contacts linked</p>'}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3>Active Deals</h3></div>
                    <div class="card-body">
                        ${deals.slice(0,3).length ? deals.slice(0,3).map(d => `
                            <div class="mini-deal-card" onclick="Router.navigate('deals/${d.id}')">
                                <div class="mini-deal-name">${UI.escapeHtml(d.name)}</div>
                                <span class="badge" style="background:${d.pipeline_stages?.color || '#6B7280'}">${d.pipeline_stages?.name || '-'}</span>
                                <span class="mini-deal-value">$${(d.value || 0).toLocaleString()}</span>
                            </div>
                        `).join('') : '<p class="text-muted">No active deals</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },
    
    renderSalesTab(company, deals, contacts, activities) {
        const salesActivities = activities.filter(a => ['call', 'email', 'meeting', 'demo'].includes(a.activity_type));
        
        return `<div class="sales-tab-content">
            <div class="sales-grid">
                <div class="sales-main">
                    <div class="card">
                        <div class="card-header">
                            <h3>Sales Deals</h3>
                            <button class="btn btn-primary btn-sm" onclick="Deals.showNewDealModal('${company.id}','${UI.escapeHtml(company.name)}')">
                                <i data-lucide="plus"></i> New Deal
                            </button>
                        </div>
                        <div class="card-body">
                            ${deals.length ? `<table class="data-table">
                                <thead><tr><th>Deal</th><th>Stage</th><th>Value</th><th>Expected Close</th></tr></thead>
                                <tbody>
                                    ${deals.map(d => `<tr onclick="Router.navigate('deals/${d.id}')" class="clickable-row">
                                        <td><strong>${UI.escapeHtml(d.name)}</strong></td>
                                        <td><span class="badge" style="background:${d.pipeline_stages?.color || '#6B7280'}">${d.pipeline_stages?.name || '-'}</span></td>
                                        <td>$${(d.value || 0).toLocaleString()}</td>
                                        <td>${d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : '-'}</td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>` : '<div class="empty-state"><p>No sales deals yet</p></div>'}
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>Sales Activity</h3></div>
                        <div class="card-body">
                            ${salesActivities.length ? `<div class="activity-timeline">${salesActivities.slice(0,10).map(a => this.activityItem(a, true)).join('')}</div>` : '<p class="text-muted">No sales activity logged</p>'}
                        </div>
                    </div>
                </div>
                
                <div class="sales-sidebar">
                    <div class="card">
                        <div class="card-header"><h3>Sales Notes</h3></div>
                        <div class="card-body">
                            <textarea class="form-textarea" rows="6" placeholder="Add sales notes..." 
                                onchange="Companies.updateField('sales_notes', this.value)">${company.sales_notes || ''}</textarea>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>Competitor Info</h3></div>
                        <div class="card-body">
                            <textarea class="form-textarea" rows="4" placeholder="Current POS, ordering platform, etc." 
                                onchange="Companies.updateField('competitor_info', this.value)">${company.competitor_info || ''}</textarea>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>Decision Makers</h3></div>
                        <div class="card-body">
                            ${contacts.map(dc => dc.contacts).filter(Boolean).map(c => `
                                <div class="mini-contact">
                                    <div class="avatar-sm">${UI.getInitials(c.first_name, c.last_name)}</div>
                                    <div>
                                        <div class="text-sm font-medium">${c.first_name} ${c.last_name || ''}</div>
                                        <div class="text-xs text-muted">${c.job_title || ''}</div>
                                    </div>
                                </div>
                            `).join('') || '<p class="text-muted">No contacts added</p>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },
    
    renderOnboardingTab(company, customerDeals) {
        const onboardingChecks = [
            ['kickoff_completed', 'Kickoff call completed', 'calendar'],
            ['menu_setup_completed', 'Menu setup completed', 'list'],
            ['hardware_ordered', 'Hardware ordered', 'package'],
            ['hardware_shipped', 'Hardware shipped', 'truck'],
            ['hardware_installed', 'Hardware installed', 'monitor'],
            ['training_scheduled', 'Training scheduled', 'calendar'],
            ['training_completed', 'Training completed', 'check-circle'],
            ['go_live_completed', 'Go-live completed', 'rocket']
        ];
        
        const completedCount = onboardingChecks.filter(([field]) => company[field]).length;
        const progress = Math.round((completedCount / onboardingChecks.length) * 100);
        
        return `<div class="onboarding-tab-content">
            <div class="onboarding-header">
                <div class="onboarding-progress-card">
                    <div class="progress-circle" style="--progress: ${progress}">
                        <span class="progress-value">${progress}%</span>
                    </div>
                    <div class="progress-info">
                        <h3>Onboarding Progress</h3>
                        <p>${completedCount} of ${onboardingChecks.length} steps completed</p>
                    </div>
                </div>
                
                <div class="onboarding-dates">
                    <div class="date-field">
                        <label>Expected Launch</label>
                        <input type="date" class="form-input" value="${company.expected_launch_date?.split('T')[0] || ''}"
                            onchange="Companies.updateField('expected_launch_date', this.value)">
                    </div>
                    <div class="date-field">
                        <label>Actual Launch</label>
                        <input type="date" class="form-input" value="${company.launched_at?.split('T')[0] || ''}"
                            onchange="Companies.updateField('launched_at', this.value)">
                    </div>
                </div>
            </div>
            
            <div class="onboarding-grid">
                <div class="card">
                    <div class="card-header"><h3>Launch Checklist</h3></div>
                    <div class="card-body">
                        <div class="checklist">
                            ${onboardingChecks.map(([field, label, icon]) => `
                                <label class="checklist-item ${company[field] ? 'completed' : ''}">
                                    <input type="checkbox" ${company[field] ? 'checked' : ''} 
                                        onchange="Companies.updateField('${field}', this.checked)">
                                    <i data-lucide="${icon}"></i>
                                    <span>${label}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3>Onboarding Notes</h3></div>
                    <div class="card-body">
                        <textarea class="form-textarea" rows="6" placeholder="Add onboarding notes, special requirements, etc."
                            onchange="Companies.updateField('onboarding_notes', this.value)">${company.onboarding_notes || ''}</textarea>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3>Hardware & Setup</h3></div>
                    <div class="card-body">
                        <div class="detail-row">
                            <label>Hardware Type</label>
                            <select class="form-select" onchange="Companies.updateField('hardware_type', this.value)">
                                <option value="">Select...</option>
                                <option value="tablet" ${company.hardware_type === 'tablet' ? 'selected' : ''}>Tablet</option>
                                <option value="kiosk" ${company.hardware_type === 'kiosk' ? 'selected' : ''}>Kiosk</option>
                                <option value="terminal" ${company.hardware_type === 'terminal' ? 'selected' : ''}>Terminal</option>
                                <option value="byod" ${company.hardware_type === 'byod' ? 'selected' : ''}>BYOD</option>
                            </select>
                        </div>
                        <div class="detail-row">
                            <label>Tracking #</label>
                            <input type="text" class="form-input" value="${company.hardware_tracking || ''}" 
                                placeholder="Shipping tracking number"
                                onchange="Companies.updateField('hardware_tracking', this.value)">
                        </div>
                        <div class="detail-row">
                            <label>Menu Items</label>
                            <span>${company.menu_item_count || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },
    
    renderSupportTab(company, tickets) {
        const openTickets = tickets.filter(t => t.status !== 'closed');
        const closedTickets = tickets.filter(t => t.status === 'closed');
        
        return `<div class="support-tab-content">
            <div class="support-header">
                <div class="support-stats">
                    <div class="stat-mini">
                        <span class="stat-mini-value">${openTickets.length}</span>
                        <span class="stat-mini-label">Open Tickets</span>
                    </div>
                    <div class="stat-mini">
                        <span class="stat-mini-value">${closedTickets.length}</span>
                        <span class="stat-mini-label">Resolved</span>
                    </div>
                    <div class="stat-mini">
                        <span class="stat-mini-value">${company.avg_response_time || '-'}</span>
                        <span class="stat-mini-label">Avg Response</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="Companies.createTicket()">
                    <i data-lucide="plus"></i> New Ticket
                </button>
            </div>
            
            <div class="support-grid">
                <div class="card">
                    <div class="card-header"><h3>Open Tickets</h3></div>
                    <div class="card-body">
                        ${openTickets.length ? `<div class="tickets-list">
                            ${openTickets.map(t => this.ticketItem(t)).join('')}
                        </div>` : `<div class="empty-state">
                            <i data-lucide="check-circle" style="width:48px;height:48px;color:#10B981"></i>
                            <p>No open tickets!</p>
                        </div>`}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3>Support Notes</h3></div>
                    <div class="card-body">
                        <textarea class="form-textarea" rows="4" placeholder="Known issues, special handling instructions..."
                            onchange="Companies.updateField('support_notes', this.value)">${company.support_notes || ''}</textarea>
                    </div>
                </div>
                
                <div class="card zendesk-placeholder">
                    <div class="card-header">
                        <h3>Zendesk Integration</h3>
                        <span class="badge badge-gray">Coming Soon</span>
                    </div>
                    <div class="card-body">
                        <div class="integration-placeholder">
                            <i data-lucide="headphones"></i>
                            <p>Zendesk tickets will sync here automatically</p>
                            <button class="btn btn-secondary btn-sm" disabled>Connect Zendesk</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },
    
    renderSuccessTab(company, customerDeals) {
        const healthScore = company.health_score || 0;
        const healthClass = healthScore >= 80 ? 'good' : healthScore >= 50 ? 'warning' : 'danger';
        
        return `<div class="success-tab-content">
            <div class="success-header">
                <div class="health-score-card">
                    <div class="health-score-circle health-${healthClass}">
                        <span class="health-value">${healthScore}</span>
                    </div>
                    <div class="health-info">
                        <h3>Health Score</h3>
                        <p class="health-status health-${healthClass}">
                            ${healthScore >= 80 ? 'Healthy' : healthScore >= 50 ? 'Needs Attention' : 'At Risk'}
                        </p>
                    </div>
                </div>
                
                <div class="success-actions">
                    <button class="btn btn-secondary" onclick="Companies.calculateHealth()">
                        <i data-lucide="refresh-cw"></i> Recalculate
                    </button>
                    <button class="btn btn-secondary" onclick="EmailActivity.showLogActivityModal({companyId:'${company.id}',type:'meeting'})">
                        <i data-lucide="calendar"></i> Schedule Check-in
                    </button>
                </div>
            </div>
            
            <div class="success-grid">
                <div class="card">
                    <div class="card-header"><h3>Key Dates</h3></div>
                    <div class="card-body">
                        <div class="detail-row">
                            <label>Launched</label>
                            <span>${company.launched_at ? new Date(company.launched_at).toLocaleDateString() : '-'}</span>
                        </div>
                        <div class="detail-row">
                            <label>30-Day Check-in</label>
                            <input type="date" class="form-input" value="${company.thirty_day_at?.split('T')[0] || ''}"
                                onchange="Companies.updateField('thirty_day_at', this.value)">
                        </div>
                        <div class="detail-row">
                            <label>90-Day Check-in</label>
                            <input type="date" class="form-input" value="${company.ninety_day_at?.split('T')[0] || ''}"
                                onchange="Companies.updateField('ninety_day_at', this.value)">
                        </div>
                        <div class="detail-row">
                            <label>Annual Review</label>
                            <input type="date" class="form-input" value="${company.annual_review_at?.split('T')[0] || ''}"
                                onchange="Companies.updateField('annual_review_at', this.value)">
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3>Success Notes</h3></div>
                    <div class="card-body">
                        <textarea class="form-textarea" rows="6" placeholder="Customer feedback, wins, concerns..."
                            onchange="Companies.updateField('success_notes', this.value)">${company.success_notes || ''}</textarea>
                    </div>
                </div>
                
                <div class="card stripe-placeholder">
                    <div class="card-header">
                        <h3>Revenue Metrics</h3>
                        <span class="badge badge-gray">Stripe Integration Coming</span>
                    </div>
                    <div class="card-body">
                        <div class="integration-placeholder">
                            <i data-lucide="credit-card"></i>
                            <p>MRR, transaction volume, and payment metrics will sync from Stripe</p>
                            <button class="btn btn-secondary btn-sm" disabled>Connect Stripe</button>
                        </div>
                    </div>
                </div>
                
                <div class="card looker-placeholder">
                    <div class="card-header">
                        <h3>Analytics Dashboard</h3>
                        <span class="badge badge-gray">Looker Integration Coming</span>
                    </div>
                    <div class="card-body">
                        <div class="integration-placeholder">
                            <i data-lucide="bar-chart-2"></i>
                            <p>Order volume, customer engagement, and usage metrics from Looker</p>
                            <button class="btn btn-secondary btn-sm" disabled>Connect Looker</button>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3>Expansion Opportunities</h3></div>
                    <div class="card-body">
                        <div class="expansion-checklist">
                            <label class="checklist-item">
                                <input type="checkbox" ${company.upsell_loyalty ? 'checked' : ''} 
                                    onchange="Companies.updateField('upsell_loyalty', this.checked)">
                                <span>Loyalty Program</span>
                            </label>
                            <label class="checklist-item">
                                <input type="checkbox" ${company.upsell_kiosk ? 'checked' : ''} 
                                    onchange="Companies.updateField('upsell_kiosk', this.checked)">
                                <span>Self-Service Kiosk</span>
                            </label>
                            <label class="checklist-item">
                                <input type="checkbox" ${company.upsell_catering ? 'checked' : ''} 
                                    onchange="Companies.updateField('upsell_catering', this.checked)">
                                <span>Catering Module</span>
                            </label>
                            <label class="checklist-item">
                                <input type="checkbox" ${company.upsell_additional_locations ? 'checked' : ''} 
                                    onchange="Companies.updateField('upsell_additional_locations', this.checked)">
                                <span>Additional Locations</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },
    
    // ==========================================
    // HELPER RENDERERS
    // ==========================================
    
    activityItem(a, detailed = false) {
        const icons = { call: 'phone', email: 'mail', meeting: 'calendar', note: 'file-text', task: 'check-square', demo: 'monitor' };
        const colors = { call: '#10b981', email: '#3b82f6', meeting: '#8b5cf6', note: '#6b7280', task: '#f59e0b', demo: '#ec4899' };
        const icon = icons[a.activity_type] || 'activity';
        const color = colors[a.activity_type] || '#6b7280';
        
        return `<div class="activity-item">
            <div class="activity-icon" style="background:${color}20;color:${color}"><i data-lucide="${icon}"></i></div>
            <div class="activity-content">
                <div class="activity-header-text">
                    <span class="activity-type">${a.activity_type?.replace(/_/g,' ')}</span>
                    ${a.subject ? `<span class="activity-subject">${UI.escapeHtml(a.subject)}</span>` : ''}
                    <span class="activity-time">${UI.formatRelativeTime(a.created_at)}</span>
                </div>
                ${detailed && a.body ? `<div class="activity-body">${UI.escapeHtml(a.body).substring(0, 200)}...</div>` : ''}
            </div>
        </div>`;
    },
    
    taskItem(t) {
        const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
        return `<div class="task-item ${isOverdue ? 'overdue' : ''} ${t.status === 'completed' ? 'completed' : ''}">
            <input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} onchange="Companies.toggleTask('${t.id}', this.checked)">
            <div class="task-info">
                <div class="task-title">${UI.escapeHtml(t.title)}</div>
                <div class="task-meta">${t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : 'No due date'}</div>
            </div>
        </div>`;
    },
    
    ticketItem(t) {
        const priorityColors = { urgent: '#EF4444', high: '#F59E0B', normal: '#3B82F6', low: '#6B7280' };
        return `<div class="ticket-item">
            <div class="ticket-priority" style="background:${priorityColors[t.priority] || '#6B7280'}"></div>
            <div class="ticket-content">
                <div class="ticket-subject">${UI.escapeHtml(t.subject)}</div>
                <div class="ticket-meta">
                    <span class="badge badge-sm">${t.status}</span>
                    <span>${UI.formatRelativeTime(t.created_at)}</span>
                </div>
            </div>
        </div>`;
    },
    
    // ==========================================
    // ACTIONS
    // ==========================================
    
    async updateField(field, value) {
        if (!this.currentCompany) return;
        const { error } = await db.from('companies').update({ [field]: value }).eq('id', this.currentCompany.id);
        if (!error) {
            this.currentCompany[field] = value;
            UI.toast('Saved');
        } else {
            UI.toast('Error saving', 'error');
        }
    },
    
    async updateLifecycle(stage) {
        if (!this.currentCompany) return;
        await this.updateField('lifecycle_stage', stage);
        // Refresh to update UI
        this.showCompanyDetail(this.currentCompany.id);
    },
    
    async toggleTask(taskId, completed) {
        await db.from('tasks').update({
            status: completed ? 'completed' : 'pending',
            completed_at: completed ? new Date().toISOString() : null
        }).eq('id', taskId);
        UI.toast(completed ? 'Task completed' : 'Task reopened');
    },
    
    createTask() {
        UI.modal({
            title: 'Create Task',
            content: `<form id="task-form">
                <div class="form-group">
                    <label class="form-label">Title *</label>
                    <input type="text" class="form-input" name="title" required placeholder="Task title...">
                </div>
                <div class="form-group">
                    <label class="form-label">Due Date</label>
                    <input type="date" class="form-input" name="due_date">
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select class="form-select" name="priority">
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
            </form>`,
            onConfirm: async () => {
                const d = Object.fromEntries(new FormData(document.getElementById('task-form')));
                if (!d.title) { UI.toast('Title required', 'error'); return; }
                await db.from('tasks').insert({
                    company_id: this.currentCompany.id,
                    ...d,
                    status: 'pending'
                });
                UI.toast('Task created');
                UI.closeModal();
                this.showCompanyDetail(this.currentCompany.id);
            }
        });
    },
    
    createTicket() {
        UI.modal({
            title: 'Create Support Ticket',
            content: `<form id="ticket-form">
                <div class="form-group">
                    <label class="form-label">Subject *</label>
                    <input type="text" class="form-input" name="subject" required placeholder="Brief description...">
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select class="form-select" name="priority">
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                        <option value="low">Low</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea" name="description" rows="4" placeholder="Full details..."></textarea>
                </div>
            </form>`,
            onConfirm: async () => {
                const d = Object.fromEntries(new FormData(document.getElementById('ticket-form')));
                if (!d.subject) { UI.toast('Subject required', 'error'); return; }
                await db.from('support_tickets').insert({
                    company_id: this.currentCompany.id,
                    ...d,
                    status: 'open'
                });
                UI.toast('Ticket created');
                UI.closeModal();
                this.showCompanyDetail(this.currentCompany.id);
            }
        });
    },
    
    calculateHealth() {
        UI.toast('Health score calculation coming soon - will factor in activity, tickets, revenue');
    },
    
    showNewModal() {
        UI.modal({
            title: 'New Company',
            size: 'lg',
            content: `<form id="new-company-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Company Name *</label>
                        <input type="text" class="form-input" name="name" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lifecycle Stage</label>
                        <select class="form-select" name="lifecycle_stage">
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">City</label>
                        <input type="text" class="form-input" name="city">
                    </div>
                    <div class="form-group">
                        <label class="form-label">State</label>
                        <input type="text" class="form-input" name="state">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Phone</label>
                        <input type="tel" class="form-input" name="phone">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" name="email">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Website</label>
                    <input type="url" class="form-input" name="website" placeholder="https://...">
                </div>
            </form>`,
            onConfirm: async () => {
                const d = Object.fromEntries(new FormData(document.getElementById('new-company-form')));
                if (!d.name) { UI.toast('Name required', 'error'); return; }
                const { data, error } = await db.from('companies').insert(d).select().single();
                if (error) { UI.toast('Error: ' + error.message, 'error'); return; }
                UI.toast('Company created');
                UI.closeModal();
                Router.navigate(`companies/${data.id}`);
            }
        });
    },
    
    editCompany() {
        if (!this.currentCompany) return;
        const c = this.currentCompany;
        
        UI.modal({
            title: 'Edit Company',
            size: 'lg',
            content: `<form id="edit-company-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Company Name *</label>
                        <input type="text" class="form-input" name="name" value="${UI.escapeHtml(c.name || '')}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Industry</label>
                        <input type="text" class="form-input" name="industry" value="${c.industry || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">City</label>
                        <input type="text" class="form-input" name="city" value="${c.city || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">State</label>
                        <input type="text" class="form-input" name="state" value="${c.state || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Phone</label>
                        <input type="tel" class="form-input" name="phone" value="${c.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" name="email" value="${c.email || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Website</label>
                    <input type="url" class="form-input" name="website" value="${c.website || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Lead Source</label>
                    <select class="form-select" name="lead_source">
                        <option value="">Select...</option>
                        <option value="inbound" ${c.lead_source === 'inbound' ? 'selected' : ''}>Inbound</option>
                        <option value="outbound" ${c.lead_source === 'outbound' ? 'selected' : ''}>Outbound</option>
                        <option value="referral" ${c.lead_source === 'referral' ? 'selected' : ''}>Referral</option>
                        <option value="partner" ${c.lead_source === 'partner' ? 'selected' : ''}>Partner</option>
                        <option value="website" ${c.lead_source === 'website' ? 'selected' : ''}>Website</option>
                        <option value="claim_listing" ${c.lead_source === 'claim_listing' ? 'selected' : ''}>Claim Listing</option>
                    </select>
                </div>
            </form>`,
            onConfirm: async () => {
                const d = Object.fromEntries(new FormData(document.getElementById('edit-company-form')));
                if (!d.name) { UI.toast('Name required', 'error'); return; }
                const { error } = await db.from('companies').update(d).eq('id', c.id);
                if (error) { UI.toast('Error: ' + error.message, 'error'); return; }
                UI.toast('Company updated');
                UI.closeModal();
                this.showCompanyDetail(c.id);
            }
        });
    },
    
    addContact() {
        UI.toast('Contact picker coming soon');
    },

    showDetail(id) {
        this.showCompanyDetail(id);
    }
};

window.Companies = Companies;
