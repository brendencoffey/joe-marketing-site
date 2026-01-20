// ============================================
// CONTACTS MODULE - Full Detail View
// ============================================

const Contacts = {
  currentContact: null,

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
    this.setupFilters();
    this.renderList();
  },

  async loadData() {
    try {
      // Get contacts linked to deals in our pipelines
      const { data: dealContacts } = await db
        .from('deal_contacts')
        .select('contact_id, deals!inner(pipeline_id)')
        .in('deals.pipeline_id', this.ALLOWED_PIPELINES);

      const contactIds = [...new Set((dealContacts || []).map(dc => dc.contact_id).filter(Boolean))];

      if (contactIds.length === 0) {
        // Fallback: get contacts from companies that have deals
        const { data: deals } = await db
          .from('deals')
          .select('company_id')
          .in('pipeline_id', this.ALLOWED_PIPELINES)
          .not('company_id', 'is', null);

        const companyIds = [...new Set((deals || []).map(d => d.company_id).filter(Boolean))];

        if (companyIds.length > 0) {
          const { data } = await db
            .from('contacts')
            .select('*, companies(id,name)')
            .in('company_id', companyIds)
            .order('created_at', { ascending: false })
            .limit(200);

          Store.data.contacts = data || [];
          return;
        }

        Store.data.contacts = [];
        return;
      }

      const { data } = await db
        .from('contacts')
        .select('*, companies(id,name)')
        .in('id', contactIds)
        .order('created_at', { ascending: false })
        .limit(200);

      Store.data.contacts = data || [];
    } catch (err) {
      console.error('Error loading contacts:', err);
    }
  },

  setupFilters() {
    const searchInput = document.getElementById('contacts-search');
    if (searchInput) {
      searchInput.oninput = UI.debounce(() => this.renderList(), 300);
    }
  },

  renderList() {
    const container = document.getElementById('contacts-table');
    if (!container) return;

    let contacts = Store.data.contacts || [];

    const search = document.getElementById('contacts-search')?.value?.toLowerCase();
    if (search) {
      contacts = contacts.filter(c =>
        c.first_name?.toLowerCase().includes(search) ||
        c.last_name?.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.companies?.name?.toLowerCase().includes(search)
      );
    }

    if (contacts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <h3>No contacts found</h3>
          <p>Contacts will appear here when linked to deals</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Company</th>
            <th>Title</th>
          </tr>
        </thead>
        <tbody>
          ${contacts.map(contact => `
            <tr onclick="Router.navigate('contacts/${contact.id}')" class="clickable-row">
              <td>
                <div class="contact-cell">
                  <div class="contact-avatar-sm">${UI.getInitials(contact.first_name, contact.last_name)}</div>
                  <strong>${UI.escapeHtml(contact.first_name || '')} ${UI.escapeHtml(contact.last_name || '')}</strong>
                </div>
              </td>
              <td>${contact.email ? `<a href="mailto:${contact.email}" onclick="event.stopPropagation()">${contact.email}</a>` : '-'}</td>
              <td>${contact.phone ? `<a href="tel:${contact.phone}" onclick="event.stopPropagation()">${UI.formatPhone(contact.phone)}</a>` : '-'}</td>
              <td>${contact.companies?.name ? `<a href="#companies/${contact.company_id}" onclick="event.stopPropagation()">${UI.escapeHtml(contact.companies.name)}</a>` : '-'}</td>
              <td>${UI.escapeHtml(contact.job_title || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  // ==========================================
  // CONTACT DETAIL PAGE
  // ==========================================

  async showDetail(contactId) {
    const { data: contact } = await db
      .from('contacts')
      .select('*, companies(id,name,city,state)')
      .eq('id', contactId)
      .single();

    if (!contact) {
      UI.toast('Contact not found', 'error');
      Router.navigate('contacts');
      return;
    }

    this.currentContact = contact;

    // Load related data
    const [dealsRes, activitiesRes, tasksRes] = await Promise.all([
      db.from('deal_contacts')
        .select('*, deals(*, pipeline_stages(id,name,color), pipelines(id,name))')
        .eq('contact_id', contactId),
      db.from('activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(20),
      db.from('tasks')
        .select('*')
        .eq('contact_id', contactId)
        .order('due_date')
    ]);

    const dealContacts = dealsRes.data || [];
    const deals = dealContacts.map(dc => dc.deals).filter(Boolean);
    const activities = activitiesRes.data || [];
    const tasks = tasksRes.data || [];

    const page = document.getElementById('page-contacts');
    page.innerHTML = this.buildDetailHTML(contact, deals, activities, tasks);
    this.initDetailTabs();
    if (window.lucide) lucide.createIcons();
  },

  buildDetailHTML(contact, deals, activities, tasks) {
    const pendingTasks = tasks.filter(t => t.status !== 'completed');

    return `
      <div class="contact-detail">
        <div class="contact-header">
          <div class="contact-header-left">
            <button class="btn btn-ghost" onclick="Router.navigate('contacts')">
              <i data-lucide="arrow-left"></i> Back
            </button>
            <div class="contact-avatar-xl">${UI.getInitials(contact.first_name, contact.last_name)}</div>
            <div class="contact-title-section">
              <h1>${contact.first_name} ${contact.last_name || ''}</h1>
              <div class="contact-subtitle">
                ${contact.job_title || ''}
                ${contact.companies ? `at <a href="#companies/${contact.companies.id}">${UI.escapeHtml(contact.companies.name)}</a>` : ''}
              </div>
            </div>
          </div>
          <div class="contact-header-right">
            <div class="contact-quick-actions">
              ${contact.email ? `<a href="mailto:${contact.email}" class="btn btn-secondary"><i data-lucide="mail"></i> Email</a>` : ''}
              ${contact.phone ? `<a href="tel:${contact.phone}" class="btn btn-secondary"><i data-lucide="phone"></i> Call</a>` : ''}
              <button class="btn btn-primary" onclick="Contacts.editContact()">
                <i data-lucide="edit-2"></i> Edit
              </button>
            </div>
          </div>
        </div>

        <div class="contact-tabs">
          <button class="contact-tab active" data-tab="overview">Overview</button>
          <button class="contact-tab" data-tab="deals">Deals (${deals.length})</button>
          <button class="contact-tab" data-tab="activity">Activity</button>
          <button class="contact-tab" data-tab="tasks">Tasks (${pendingTasks.length})</button>
        </div>

        <div class="contact-content">
          <div class="contact-tab-content active" id="contact-tab-overview">
            ${this.renderOverview(contact, deals, activities.slice(0, 5), pendingTasks.slice(0, 3))}
          </div>
          <div class="contact-tab-content" id="contact-tab-deals">
            ${this.renderDeals(deals)}
          </div>
          <div class="contact-tab-content" id="contact-tab-activity">
            ${this.renderActivity(activities)}
          </div>
          <div class="contact-tab-content" id="contact-tab-tasks">
            ${this.renderTasks(tasks)}
          </div>
        </div>
      </div>
    `;
  },

  initDetailTabs() {
    document.querySelectorAll('.contact-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.contact-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.contact-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`contact-tab-${tab.dataset.tab}`)?.classList.add('active');
      };
    });
  },

  renderOverview(contact, deals, activities, tasks) {
    return `
      <div class="overview-grid">
        <div class="overview-main">
          <div class="card">
            <div class="card-header"><h3>Contact Information</h3></div>
            <div class="card-body">
              <div class="detail-row"><label>Email</label><span>${contact.email ? `<a href="mailto:${contact.email}">${contact.email}</a>` : '-'}</span></div>
              <div class="detail-row"><label>Phone</label><span>${contact.phone ? `<a href="tel:${contact.phone}">${UI.formatPhone(contact.phone)}</a>` : '-'}</span></div>
              <div class="detail-row"><label>Title</label><span>${contact.job_title || '-'}</span></div>
              <div class="detail-row"><label>Company</label><span>${contact.companies ? `<a href="#companies/${contact.companies.id}">${UI.escapeHtml(contact.companies.name)}</a>` : '-'}</span></div>
              <div class="detail-row"><label>Location</label><span>${contact.companies?.city || ''}, ${contact.companies?.state || ''}</span></div>
              <div class="detail-row"><label>Created</label><span>${UI.formatDate(contact.created_at)}</span></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3>Recent Activity</h3>
              <button class="btn btn-ghost btn-sm" onclick="Contacts.logActivity()"><i data-lucide="plus"></i></button>
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
            <div class="card-header"><h3>Quick Actions</h3></div>
            <div class="card-body">
              <div class="quick-actions">
                <button class="btn btn-secondary" onclick="Contacts.logActivity('email')"><i data-lucide="mail"></i> Log Email</button>
                <button class="btn btn-secondary" onclick="Contacts.logActivity('call')"><i data-lucide="phone"></i> Log Call</button>
                <button class="btn btn-secondary" onclick="Contacts.logActivity('note')"><i data-lucide="file-text"></i> Add Note</button>
                <button class="btn btn-secondary" onclick="Contacts.createTask()"><i data-lucide="check-square"></i> Create Task</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Associated Deals</h3></div>
            <div class="card-body">
              ${deals.length ? deals.slice(0, 3).map(d => `
                <div class="mini-deal-card" onclick="Router.navigate('deals/${d.id}')">
                  <div class="mini-deal-name">${UI.escapeHtml(d.name)}</div>
                  <div class="mini-deal-meta">
                    <span class="stage-badge" style="background:${d.pipeline_stages?.color || '#6B7280'}">${d.pipeline_stages?.name || '-'}</span>
                  </div>
                </div>
              `).join('') : '<p class="text-muted">No deals</p>'}
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Pending Tasks</h3></div>
            <div class="card-body">
              ${tasks.length ? tasks.map(t => `
                <div class="task-item">
                  <input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} onchange="Contacts.completeTask('${t.id}', this.checked)">
                  <div class="task-info">
                    <div class="task-title">${UI.escapeHtml(t.title)}</div>
                    <div class="task-meta">${t.due_date ? `Due ${UI.formatDate(t.due_date)}` : 'No due date'}</div>
                  </div>
                </div>
              `).join('') : '<p class="text-muted">No tasks</p>'}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderDeals(deals) {
    if (!deals.length) {
      return `<div class="empty-state"><p>No deals associated with this contact</p></div>`;
    }

    return `
      <table class="data-table">
        <thead>
          <tr><th>Deal Name</th><th>Pipeline</th><th>Stage</th><th>Value</th></tr>
        </thead>
        <tbody>
          ${deals.map(d => `
            <tr onclick="Router.navigate('deals/${d.id}')" class="clickable-row">
              <td><strong>${UI.escapeHtml(d.name)}</strong></td>
              <td>${d.pipelines?.name || '-'}</td>
              <td><span class="stage-badge" style="background:${d.pipeline_stages?.color || '#6B7280'}">${d.pipeline_stages?.name || '-'}</span></td>
              <td>$${(d.value || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  renderActivity(activities) {
    return `
      <div class="activity-header">
        <button class="btn btn-primary" onclick="Contacts.logActivity()"><i data-lucide="plus"></i> Log Activity</button>
      </div>
      <div class="activity-timeline">
        ${activities.length
          ? activities.map(a => this.activityItem(a, true)).join('')
          : '<div class="empty-state"><p>No activity recorded</p></div>'}
      </div>
    `;
  },

  renderTasks(tasks) {
    const pending = tasks.filter(t => t.status !== 'completed');
    const completed = tasks.filter(t => t.status === 'completed');

    return `
      <div class="tasks-header">
        <button class="btn btn-primary" onclick="Contacts.createTask()"><i data-lucide="plus"></i> Create Task</button>
      </div>
      <div class="tasks-section">
        <h4>Pending (${pending.length})</h4>
        ${pending.length ? `<div class="task-list">${pending.map(t => this.taskItem(t)).join('')}</div>` : '<p class="text-muted">No pending tasks</p>'}
      </div>
      <div class="tasks-section">
        <h4>Completed (${completed.length})</h4>
        ${completed.length ? `<div class="task-list completed">${completed.map(t => this.taskItem(t)).join('')}</div>` : '<p class="text-muted">None</p>'}
      </div>
    `;
  },

  activityItem(a, detailed = false) {
    const icons = { call: 'phone', email: 'mail', meeting: 'calendar', note: 'file-text', sms: 'message-square' };
    return `
      <div class="activity-item">
        <div class="activity-icon ${a.activity_type}"><i data-lucide="${icons[a.activity_type] || 'activity'}"></i></div>
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

  taskItem(t) {
    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
    return `
      <div class="task-item ${t.priority === 'high' ? 'high-priority' : ''}">
        <input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} onchange="Contacts.completeTask('${t.id}', this.checked)">
        <div class="task-info">
          <div class="task-title">${UI.escapeHtml(t.title)}</div>
          <div class="task-meta ${isOverdue ? 'overdue' : ''}">${t.due_date ? `Due ${UI.formatDate(t.due_date)}` : 'No due date'}</div>
        </div>
      </div>
    `;
  },

  // ==========================================
  // ACTIONS
  // ==========================================

  logActivity(type = 'note') {
    if (!this.currentContact) return;

    UI.modal({
      title: 'Log Activity',
      content: `
        <form id="contact-activity-form">
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" name="activity_type">
              <option value="note" ${type === 'note' ? 'selected' : ''}>Note</option>
              <option value="call" ${type === 'call' ? 'selected' : ''}>Call</option>
              <option value="email" ${type === 'email' ? 'selected' : ''}>Email</option>
              <option value="meeting" ${type === 'meeting' ? 'selected' : ''}>Meeting</option>
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
        const form = document.getElementById('contact-activity-form');
        const data = Object.fromEntries(new FormData(form));

        await db.from('activities').insert({
          contact_id: this.currentContact.id,
          company_id: this.currentContact.company_id,
          ...data
        });

        UI.toast('Activity logged');
        UI.closeModal();
        this.showDetail(this.currentContact.id);
      }
    });
  },

  createTask() {
    if (!this.currentContact) return;

    UI.modal({
      title: 'Create Task',
      content: `
        <form id="contact-task-form">
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
            </select>
          </div>
        </form>
      `,
      onConfirm: async () => {
        const form = document.getElementById('contact-task-form');
        const data = Object.fromEntries(new FormData(form));

        if (!data.title) {
          UI.toast('Task title is required', 'error');
          return;
        }

        await db.from('tasks').insert({
          contact_id: this.currentContact.id,
          company_id: this.currentContact.company_id,
          ...data,
          status: 'pending'
        });

        UI.toast('Task created');
        UI.closeModal();
        this.showDetail(this.currentContact.id);
      }
    });
  },

  async completeTask(taskId, done) {
    await db.from('tasks').update({
      status: done ? 'completed' : 'pending',
      completed_at: done ? new Date().toISOString() : null
    }).eq('id', taskId);

    UI.toast(done ? 'Task completed' : 'Task reopened');
    if (this.currentContact) {
      this.showDetail(this.currentContact.id);
    }
  },

  editContact() {
    UI.toast('Contact editor coming soon');
  }
};

window.Contacts = Contacts;
