// ============================================
// COMPANIES MODULE - Full Detail View
// ============================================

const Companies = {
  map: null,
  markers: [],
  currentCompany: null,

  ALLOWED_PIPELINES: [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  ],

  async render(params = {}) {
    if (params.id) {
      await this.showDetail(params.id);
      return;
    }
    await this.loadData();
    this.setupTabs();
    this.setupFilters();
    this.renderList();
  },

  async loadData() {
    try {
      const { data: deals } = await db
        .from('deals')
        .select('company_id')
        .in('pipeline_id', this.ALLOWED_PIPELINES)
        .not('company_id', 'is', null);

      const companyIds = [...new Set((deals || []).map(d => d.company_id).filter(Boolean))];

      if (companyIds.length === 0) {
        Store.data.companies = [];
        return;
      }

      const { data } = await db
        .from('companies')
        .select('*')
        .in('id', companyIds)
        .order('created_at', { ascending: false });

      if (data) Store.data.companies = data;
    } catch (err) {
      console.error('Error loading companies:', err);
    }
  },

  setupTabs() {
    const tabs = document.querySelectorAll('#page-companies .tab-btn');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const view = tab.dataset.view;
        document.getElementById('companies-list-view')?.classList.toggle('hidden', view !== 'list');
        document.getElementById('companies-map-view')?.classList.toggle('hidden', view !== 'map');
        if (view === 'map') this.renderMap();
      };
    });
  },

  setupFilters() {
    const icpFilter = document.getElementById('companies-icp-filter');
    const stateFilter = document.getElementById('companies-state-filter');
    const searchInput = document.getElementById('companies-search');

    if (icpFilter) icpFilter.onchange = () => this.renderList();
    if (stateFilter) stateFilter.onchange = () => this.renderList();
    if (searchInput) searchInput.oninput = UI.debounce(() => this.renderList(), 300);
  },

  renderList() {
    const container = document.getElementById('companies-list-view');
    if (!container) return;

    let companies = Store.data.companies || [];

    const icp = document.getElementById('companies-icp-filter')?.value;
    const state = document.getElementById('companies-state-filter')?.value;
    const search = document.getElementById('companies-search')?.value?.toLowerCase();

    if (icp) companies = companies.filter(c => c.icp_type === icp);
    if (state) companies = companies.filter(c => c.state === state);
    if (search) companies = companies.filter(c => c.name?.toLowerCase().includes(search));

    if (companies.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏢</div>
          <h3>No companies found</h3>
          <p>Companies will appear here when linked to deals</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Company Name</th>
            <th>City</th>
            <th>State</th>
            <th>ICP Type</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          ${companies.map(company => `
            <tr onclick="Router.navigate('companies/${company.id}')" class="clickable-row">
              <td><strong>${UI.escapeHtml(company.name || 'Unnamed')}</strong></td>
              <td>${UI.escapeHtml(company.city || '-')}</td>
              <td>${UI.escapeHtml(company.state || '-')}</td>
              <td>${UI.escapeHtml(company.icp_type || '-')}</td>
              <td>${company.phone ? `<a href="tel:${company.phone}">${UI.formatPhone(company.phone)}</a>` : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  renderMap() {
    // Map rendering code
  },

  // ==========================================
  // COMPANY DETAIL PAGE
  // ==========================================

  async showDetail(companyId) {
    const { data: company } = await db
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (!company) {
      UI.toast('Company not found', 'error');
      Router.navigate('companies');
      return;
    }

    this.currentCompany = company;

    // Load related data
    const [dealsRes, contactsRes, activitiesRes] = await Promise.all([
      db.from('deals')
        .select('*, pipeline_stages(id,name,color), pipelines(id,name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      db.from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      db.from('activities')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    const deals = dealsRes.data || [];
    const contacts = contactsRes.data || [];
    const activities = activitiesRes.data || [];

    const page = document.getElementById('page-companies');
    page.innerHTML = this.buildDetailHTML(company, deals, contacts, activities);
    this.initDetailTabs();
    if (window.lucide) lucide.createIcons();
  },

  buildDetailHTML(company, deals, contacts, activities) {
    const totalDealValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const activeDeals = deals.filter(d => !['won', 'lost', 'churned'].includes(d.pipeline_stages?.stage_key));

    return `
      <div class="company-detail">
        <div class="company-header">
          <div class="company-header-left">
            <button class="btn btn-ghost" onclick="Router.navigate('companies')">
              <i data-lucide="arrow-left"></i> Back
            </button>
            <div class="company-title-section">
              <h1>${UI.escapeHtml(company.name)}</h1>
              <div class="company-location">
                ${company.city || ''}, ${company.state || ''}
                ${company.website ? `<a href="${company.website}" target="_blank" class="company-website"><i data-lucide="external-link"></i></a>` : ''}
              </div>
            </div>
          </div>
          <div class="company-header-right">
            <button class="btn btn-secondary" onclick="Companies.editCompany()">
              <i data-lucide="edit-2"></i> Edit
            </button>
            <button class="btn btn-primary" onclick="Companies.createDeal()">
              <i data-lucide="plus"></i> New Deal
            </button>
          </div>
        </div>

        <div class="company-stats">
          <div class="stat-card">
            <div class="stat-card-label">Total Deal Value</div>
            <div class="stat-card-value">$${totalDealValue.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">Active Deals</div>
            <div class="stat-card-value">${activeDeals.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">Contacts</div>
            <div class="stat-card-value">${contacts.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">ICP Type</div>
            <div class="stat-card-value">${company.icp_type || '-'}</div>
          </div>
        </div>

        <div class="company-tabs">
          <button class="company-tab active" data-tab="overview">Overview</button>
          <button class="company-tab" data-tab="deals">Deals (${deals.length})</button>
          <button class="company-tab" data-tab="contacts">Contacts (${contacts.length})</button>
          <button class="company-tab" data-tab="activity">Activity</button>
        </div>

        <div class="company-content">
          <div class="company-tab-content active" id="company-tab-overview">
            ${this.renderOverview(company, deals.slice(0, 3), contacts.slice(0, 3), activities.slice(0, 5))}
          </div>
          <div class="company-tab-content" id="company-tab-deals">
            ${this.renderDeals(deals)}
          </div>
          <div class="company-tab-content" id="company-tab-contacts">
            ${this.renderContacts(contacts)}
          </div>
          <div class="company-tab-content" id="company-tab-activity">
            ${this.renderActivity(activities)}
          </div>
        </div>
      </div>
    `;
  },

  initDetailTabs() {
    document.querySelectorAll('.company-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.company-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.company-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`company-tab-${tab.dataset.tab}`)?.classList.add('active');
      };
    });
  },

  renderOverview(company, deals, contacts, activities) {
    return `
      <div class="overview-grid">
        <div class="overview-main">
          <div class="card">
            <div class="card-header">
              <h3>Company Details</h3>
              <button class="btn btn-ghost btn-sm" onclick="Companies.editCompany()">
                <i data-lucide="edit-2"></i>
              </button>
            </div>
            <div class="card-body">
              <div class="detail-row"><label>Phone</label><span>${company.phone ? `<a href="tel:${company.phone}">${UI.formatPhone(company.phone)}</a>` : '-'}</span></div>
              <div class="detail-row"><label>Website</label><span>${company.website ? `<a href="${company.website}" target="_blank">${company.website}</a>` : '-'}</span></div>
              <div class="detail-row"><label>Address</label><span>${company.address || '-'}</span></div>
              <div class="detail-row"><label>City, State</label><span>${company.city || ''}, ${company.state || ''} ${company.zip || ''}</span></div>
              <div class="detail-row"><label>ICP Type</label><span>${company.icp_type || '-'}</span></div>
              <div class="detail-row"><label>Source</label><span>${company.source || '-'}</span></div>
              <div class="detail-row"><label>Created</label><span>${UI.formatDate(company.created_at)}</span></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3>Recent Activity</h3>
              <button class="btn btn-ghost btn-sm" onclick="Companies.logActivity()">
                <i data-lucide="plus"></i>
              </button>
            </div>
            <div class="card-body">
              ${activities.length 
                ? `<div class="activity-list">${activities.map(a => this.activityItem(a)).join('')}</div>`
                : '<p class="text-muted">No activity yet</p>'}
            </div>
          </div>
        </div>

        <div class="overview-sidebar">
          <div class="card">
            <div class="card-header">
              <h3>Active Deals</h3>
              <button class="btn btn-ghost btn-sm" onclick="Companies.createDeal()">
                <i data-lucide="plus"></i>
              </button>
            </div>
            <div class="card-body">
              ${deals.length ? deals.map(d => `
                <div class="mini-deal-card" onclick="Router.navigate('deals/${d.id}')">
                  <div class="mini-deal-name">${UI.escapeHtml(d.name)}</div>
                  <div class="mini-deal-meta">
                    <span class="stage-badge" style="background:${d.pipeline_stages?.color || '#6B7280'}">${d.pipeline_stages?.name || '-'}</span>
                    <span class="mini-deal-value">$${(d.value || 0).toLocaleString()}</span>
                  </div>
                </div>
              `).join('') : '<p class="text-muted">No deals</p>'}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3>Contacts</h3>
              <button class="btn btn-ghost btn-sm" onclick="Companies.addContact()">
                <i data-lucide="plus"></i>
              </button>
            </div>
            <div class="card-body">
              ${contacts.length ? contacts.map(c => `
                <div class="contact-card" onclick="Router.navigate('contacts/${c.id}')">
                  <div class="contact-avatar">${UI.getInitials(c.first_name, c.last_name)}</div>
                  <div class="contact-info">
                    <div class="contact-name">${c.first_name} ${c.last_name || ''}</div>
                    <div class="contact-title">${c.job_title || ''}</div>
                  </div>
                </div>
              `).join('') : '<p class="text-muted">No contacts</p>'}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderDeals(deals) {
    if (!deals.length) {
      return `
        <div class="empty-state">
          <p>No deals for this company</p>
          <button class="btn btn-primary" onclick="Companies.createDeal()">
            <i data-lucide="plus"></i> Create Deal
          </button>
        </div>
      `;
    }

    return `
      <div class="deals-header">
        <button class="btn btn-primary" onclick="Companies.createDeal()">
          <i data-lucide="plus"></i> New Deal
        </button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Deal Name</th>
            <th>Pipeline</th>
            <th>Stage</th>
            <th>Value</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${deals.map(d => `
            <tr onclick="Router.navigate('deals/${d.id}')" class="clickable-row">
              <td><strong>${UI.escapeHtml(d.name)}</strong></td>
              <td>${d.pipelines?.name || '-'}</td>
              <td><span class="stage-badge" style="background:${d.pipeline_stages?.color || '#6B7280'}">${d.pipeline_stages?.name || '-'}</span></td>
              <td>$${(d.value || 0).toLocaleString()}</td>
              <td>${UI.formatDate(d.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  renderContacts(contacts) {
    if (!contacts.length) {
      return `
        <div class="empty-state">
          <p>No contacts for this company</p>
          <button class="btn btn-primary" onclick="Companies.addContact()">
            <i data-lucide="plus"></i> Add Contact
          </button>
        </div>
      `;
    }

    return `
      <div class="contacts-header">
        <button class="btn btn-primary" onclick="Companies.addContact()">
          <i data-lucide="plus"></i> Add Contact
        </button>
      </div>
      <div class="contacts-grid">
        ${contacts.map(c => `
          <div class="contact-card-large" onclick="Router.navigate('contacts/${c.id}')">
            <div class="contact-avatar-large">${UI.getInitials(c.first_name, c.last_name)}</div>
            <div class="contact-details">
              <div class="contact-name">${c.first_name} ${c.last_name || ''}</div>
              <div class="contact-title">${c.job_title || ''}</div>
              <div class="contact-actions">
                ${c.email ? `<a href="mailto:${c.email}" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()"><i data-lucide="mail"></i></a>` : ''}
                ${c.phone ? `<a href="tel:${c.phone}" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()"><i data-lucide="phone"></i></a>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderActivity(activities) {
    return `
      <div class="activity-header">
        <button class="btn btn-primary" onclick="Companies.logActivity()">
          <i data-lucide="plus"></i> Log Activity
        </button>
      </div>
      <div class="activity-timeline">
        ${activities.length 
          ? activities.map(a => this.activityItem(a, true)).join('')
          : '<div class="empty-state"><p>No activity recorded</p></div>'}
      </div>
    `;
  },

  activityItem(a, detailed = false) {
    const icons = { call: 'phone', email: 'mail', meeting: 'calendar', note: 'file-text', sms: 'message-square' };
    return `
      <div class="activity-item">
        <div class="activity-icon ${a.activity_type}">
          <i data-lucide="${icons[a.activity_type] || 'activity'}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-header-text">
            <span class="activity-type">${a.activity_type?.replace(/_/g, ' ')}</span>
            <span class="activity-time">${UI.formatRelativeTime(a.created_at)}</span>
          </div>
          ${a.subject ? `<div class="activity-subject">${UI.escapeHtml(a.subject)}</div>` : ''}
          ${detailed && a.body ? `<div class="activity-body">${UI.escapeHtml(a.body)}</div>` : ''}
        </div>
      </div>
    `;
  },

  // ==========================================
  // ACTIONS
  // ==========================================

  createDeal() {
    if (!this.currentCompany) return;
    // Pre-fill company in new deal modal
    if (Deals.showNewDealModal) {
      Deals.showNewDealModal(this.currentCompany.id, this.currentCompany.name);
    }
  },

  addContact() {
    UI.toast('Contact picker coming soon');
  },

  editCompany() {
    UI.toast('Company editor coming soon');
  },

  logActivity() {
    if (!this.currentCompany) return;
    
    UI.modal({
      title: 'Log Activity',
      content: `
        <form id="company-activity-form">
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" name="activity_type">
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Subject</label>
            <input type="text" class="form-input" name="subject" placeholder="Brief summary...">
          </div>
          <div class="form-group">
            <label class="form-label">Details</label>
            <textarea class="form-textarea" name="body" rows="4" placeholder="Full details..."></textarea>
          </div>
        </form>
      `,
      onConfirm: async () => {
        const form = document.getElementById('company-activity-form');
        const data = Object.fromEntries(new FormData(form));
        
        await db.from('activities').insert({
          company_id: this.currentCompany.id,
          ...data
        });
        
        UI.toast('Activity logged');
        UI.closeModal();
        this.showDetail(this.currentCompany.id);
      }
    });
  }
};

window.Companies = Companies;
