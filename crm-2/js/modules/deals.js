// ============================================
// DEALS MODULE - Full Implementation
// ============================================

const Deals = {
  ALLOWED_PIPELINES: [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  ],
  
  currentDeal: null,

  async render(params = {}) {
    if (params.id) {
      await this.showDealDetail(params.id);
      return;
    }
    await this.loadData();
    this.renderFilters();
    this.renderList();
  },
  
  async loadData() {
    const { data } = await db
      .from('deals')
      .select('*, companies(id,name,city,state), pipeline_stages(id,name,color), pipelines(id,name)')
      .in('pipeline_id', this.ALLOWED_PIPELINES)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (data) Store.data.deals = data;
    
    if (!Store.data.stages?.length) {
      const { data: stages } = await db
        .from('pipeline_stages')
        .select('*')
        .in('pipeline_id', this.ALLOWED_PIPELINES)
        .eq('is_active', true)
        .order('sort_order');
      if (stages) Store.data.stages = stages;
    }
    
    if (!Store.data.teamMembers?.length) {
      const { data: team } = await db.from('team_members').select('*').eq('is_active', true);
      if (team) Store.data.teamMembers = team;
    }
  },
  
  renderFilters() {
    const stageFilter = document.getElementById('deals-stage-filter');
    const ownerFilter = document.getElementById('deals-owner-filter');
    
    if (stageFilter) {
      stageFilter.innerHTML = `<option value="">All Stages</option>
        ${(Store.data.stages || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}`;
      stageFilter.onchange = () => this.renderList();
    }
    
    if (ownerFilter) {
      ownerFilter.innerHTML = `<option value="">All Owners</option>
        ${(Store.data.teamMembers || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}`;
      ownerFilter.onchange = () => this.renderList();
    }
    
    const search = document.getElementById('deals-search');
    if (search) search.oninput = UI.debounce(() => this.renderList(), 300);
  },
  
  renderList() {
    const container = document.getElementById('deals-list');
    if (!container) return;
    
    let deals = Store.data.deals || [];
    const stage = document.getElementById('deals-stage-filter')?.value;
    const owner = document.getElementById('deals-owner-filter')?.value;
    const search = document.getElementById('deals-search')?.value?.toLowerCase();
    
    if (stage) deals = deals.filter(d => d.stage_id === stage);
    if (owner) deals = deals.filter(d => d.owner_id === owner);
    if (search) deals = deals.filter(d => 
      d.name?.toLowerCase().includes(search) || d.companies?.name?.toLowerCase().includes(search));
    
    if (!deals.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">💼</div>
        <h3>No deals found</h3><p>Create a new deal to get started</p></div>`;
      return;
    }
    
    container.innerHTML = `<table class="data-table"><thead><tr>
      <th>Deal Name</th><th>Company</th><th>Value</th><th>Stage</th><th>Owner</th><th>Created</th>
    </tr></thead><tbody>
      ${deals.map(d => `<tr onclick="Deals.showDealDetail('${d.id}')" class="clickable-row">
        <td><strong>${UI.escapeHtml(d.name || 'Unnamed')}</strong></td>
        <td>${UI.escapeHtml(d.companies?.name || '-')}</td>
        <td>$${(d.value || 0).toLocaleString()}</td>
        <td><span class="stage-badge" style="background:${d.pipeline_stages?.color || '#6B7280'}">${UI.escapeHtml(d.pipeline_stages?.name || '-')}</span></td>
        <td>${Store.data.teamMembers?.find(t => t.id === d.owner_id)?.name?.split(' ')[0] || '-'}</td>
        <td>${d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}</td>
      </tr>`).join('')}
    </tbody></table>`;
  },
  
  async showDealDetail(dealId) {
    const { data: deal } = await db.from('deals')
      .select('*, companies(id,name,city,state,website,phone), pipeline_stages(id,name,color,pipeline_id), pipelines(id,name,slug)')
      .eq('id', dealId).single();
    
    if (!deal) { UI.toast('Deal not found', 'error'); Router.navigate('deals'); return; }
    this.currentDeal = deal;
    
    const [contactsRes, activitiesRes, tasksRes, stagesRes] = await Promise.all([
      db.from('deal_contacts').select('*, contacts(*)').eq('deal_id', dealId),
      db.from('activities').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }).limit(50),
      db.from('tasks').select('*').eq('deal_id', dealId).order('due_date'),
      db.from('pipeline_stages').select('*').eq('pipeline_id', deal.pipeline_id).order('sort_order')
    ]);
    
    const contacts = contactsRes.data || [];
    const activities = activitiesRes.data || [];
    const tasks = tasksRes.data || [];
    const stages = stagesRes.data || [];
    
    const page = document.getElementById('page-deals');
    page.innerHTML = this.buildDetailHTML(deal, contacts, activities, tasks, stages);
    this.initTabs();
    if (window.lucide) lucide.createIcons();
  },
  
  buildDetailHTML(deal, contacts, activities, tasks, stages) {
    const primaryContact = contacts.find(c => c.is_primary)?.contacts || contacts[0]?.contacts;
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    const isCustomer = deal.pipelines?.slug === 'customer';
    
    return `<div class="deal-detail">
      <div class="deal-header">
        <div class="deal-header-left">
          <button class="btn btn-ghost" onclick="Router.navigate('deals')"><i data-lucide="arrow-left"></i> Back</button>
          <div class="deal-title-section">
            <h1>${UI.escapeHtml(deal.name)}</h1>
            <div class="deal-company">${deal.companies ? 
              `<a href="#companies/${deal.companies.id}">${UI.escapeHtml(deal.companies.name)}</a>
               <span class="text-muted">${deal.companies.city || ''}, ${deal.companies.state || ''}</span>` : 
              '<span class="text-muted">No company</span>'}</div>
          </div>
        </div>
        <div class="deal-header-right">
          <div class="deal-value">$${(deal.value || 0).toLocaleString()}</div>
          <select class="stage-select" onchange="Deals.changeStage(this.value)">
            ${stages.map(s => `<option value="${s.id}" ${s.id === deal.stage_id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div class="stage-progress">
        ${stages.map((s, i) => {
          const curr = s.id === deal.stage_id;
          const past = stages.findIndex(st => st.id === deal.stage_id) > i;
          return `<div class="stage-step ${curr ? 'current' : ''} ${past ? 'completed' : ''}" 
                       style="--stage-color:${s.color}" onclick="Deals.changeStage('${s.id}')">
            <div class="stage-dot"></div><span>${s.name}</span></div>`;
        }).join('')}
      </div>
      
      <div class="deal-tabs">
        <button class="deal-tab active" data-tab="overview">Overview</button>
        <button class="deal-tab" data-tab="activity">Activity</button>
        <button class="deal-tab" data-tab="tasks">Tasks (${pendingTasks.length})</button>
        <button class="deal-tab" data-tab="contacts">Contacts (${contacts.length})</button>
        ${isCustomer ? 
          '<button class="deal-tab" data-tab="onboarding">Onboarding</button><button class="deal-tab" data-tab="success">Success</button>' : 
          '<button class="deal-tab" data-tab="sales">Sales</button>'}
      </div>
      
      <div class="deal-content">
        <div class="deal-tab-content active" id="tab-overview">${this.renderOverview(deal, primaryContact, activities.slice(0,5), pendingTasks.slice(0,3))}</div>
        <div class="deal-tab-content" id="tab-activity">${this.renderActivity(activities)}</div>
        <div class="deal-tab-content" id="tab-tasks">${this.renderTasks(tasks)}</div>
        <div class="deal-tab-content" id="tab-contacts">${this.renderContacts(contacts)}</div>
        ${isCustomer ? 
          `<div class="deal-tab-content" id="tab-onboarding">${this.renderOnboarding(deal)}</div>
           <div class="deal-tab-content" id="tab-success">${this.renderSuccess(deal)}</div>` : 
          `<div class="deal-tab-content" id="tab-sales">${this.renderSales(deal)}</div>`}
      </div>
    </div>`;
  },
  
  initTabs() {
    document.querySelectorAll('.deal-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.deal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.deal-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
      };
    });
  },
  
  renderOverview(deal, contact, activities, tasks) {
    return `<div class="overview-grid">
      <div class="overview-main">
        <div class="card"><div class="card-header"><h3>Quick Actions</h3></div>
          <div class="card-body"><div class="quick-actions">
            <button class="btn btn-secondary" onclick="Deals.logActivity('call')"><i data-lucide="phone"></i> Log Call</button>
            <button class="btn btn-secondary" onclick="Deals.logActivity('email')"><i data-lucide="mail"></i> Log Email</button>
            <button class="btn btn-secondary" onclick="Deals.logActivity('note')"><i data-lucide="file-text"></i> Add Note</button>
            <button class="btn btn-secondary" onclick="Deals.createTask()"><i data-lucide="check-square"></i> Create Task</button>
            <button class="btn btn-secondary" onclick="Deals.scheduleMeeting()"><i data-lucide="calendar"></i> Schedule</button>
          </div></div>
        </div>
        <div class="card"><div class="card-header"><h3>Recent Activity</h3></div>
          <div class="card-body">${activities.length ? 
            `<div class="activity-list">${activities.map(a => this.activityItem(a)).join('')}</div>` : 
            '<p class="text-muted">No activity yet</p>'}</div>
        </div>
        <div class="card"><div class="card-header"><h3>Pending Tasks</h3></div>
          <div class="card-body">${tasks.length ? 
            `<div class="task-list">${tasks.map(t => this.taskItem(t)).join('')}</div>` : 
            '<p class="text-muted">No pending tasks</p>'}</div>
        </div>
      </div>
      <div class="overview-sidebar">
        <div class="card"><div class="card-header"><h3>Details</h3>
          <button class="btn btn-ghost btn-sm" onclick="Deals.editDeal()"><i data-lucide="edit-2"></i></button></div>
          <div class="card-body">
            <div class="detail-row"><label>Pipeline</label><span>${deal.pipelines?.name || '-'}</span></div>
            <div class="detail-row"><label>Value</label><span>$${(deal.value||0).toLocaleString()}</span></div>
            <div class="detail-row"><label>Expected Close</label><span>${deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '-'}</span></div>
            <div class="detail-row"><label>Source</label><span>${deal.source || '-'}</span></div>
            <div class="detail-row"><label>Created</label><span>${new Date(deal.created_at).toLocaleDateString()}</span></div>
            <div class="detail-row"><label>Owner</label><span>${Store.data.teamMembers?.find(t=>t.id===deal.owner_id)?.name || '-'}</span></div>
          </div>
        </div>
        <div class="card"><div class="card-header"><h3>Primary Contact</h3>
          <button class="btn btn-ghost btn-sm" onclick="Deals.addContact()"><i data-lucide="plus"></i></button></div>
          <div class="card-body">${contact ? 
            `<div class="contact-card"><div class="contact-avatar">${UI.getInitials(contact.first_name, contact.last_name)}</div>
              <div class="contact-info"><div class="contact-name">${contact.first_name} ${contact.last_name||''}</div>
              <div class="contact-title">${contact.job_title||''}</div>
              ${contact.email ? `<a href="mailto:${contact.email}">${contact.email}</a>` : ''}
              ${contact.phone ? `<a href="tel:${contact.phone}">${contact.phone}</a>` : ''}</div></div>` : 
            '<p class="text-muted">No contacts</p>'}</div>
        </div>
      </div>
    </div>`;
  },
  
  renderActivity(activities) {
    return `<div class="activity-header">
      <select class="form-select" onchange="Deals.filterActivities(this.value)">
        <option value="">All Types</option><option value="call">Calls</option>
        <option value="email">Emails</option><option value="meeting">Meetings</option><option value="note">Notes</option>
      </select>
      <button class="btn btn-primary" onclick="Deals.logActivity()"><i data-lucide="plus"></i> Log Activity</button>
    </div>
    <div class="activity-timeline">${activities.length ? 
      activities.map(a => this.activityItem(a, true)).join('') : 
      '<div class="empty-state"><p>No activity recorded</p></div>'}</div>`;
  },
  
  activityItem(a, detailed = false) {
    const icons = { call: 'phone', email: 'mail', meeting: 'calendar', note: 'file-text', stage_change: 'git-branch' };
    return `<div class="activity-item" data-type="${a.activity_type}">
      <div class="activity-icon"><i data-lucide="${icons[a.activity_type?.split('_')[0]] || 'activity'}"></i></div>
      <div class="activity-content">
        <div class="activity-header"><span class="activity-type">${a.activity_type?.replace(/_/g,' ')}</span>
          <span class="activity-time">${UI.formatRelativeTime(a.created_at)}</span></div>
        ${a.subject ? `<div class="activity-subject">${UI.escapeHtml(a.subject)}</div>` : ''}
        ${detailed && a.body ? `<div class="activity-body">${UI.escapeHtml(a.body)}</div>` : ''}
      </div>
    </div>`;
  },
  
  renderTasks(tasks) {
    const pending = tasks.filter(t => t.status !== 'completed');
    const completed = tasks.filter(t => t.status === 'completed');
    return `<div class="tasks-header">
      <button class="btn btn-primary" onclick="Deals.createTask()"><i data-lucide="plus"></i> Create Task</button>
    </div>
    <div class="tasks-section"><h4>Pending (${pending.length})</h4>
      ${pending.length ? `<div class="task-list">${pending.map(t => this.taskItem(t)).join('')}</div>` : '<p class="text-muted">None</p>'}
    </div>
    <div class="tasks-section"><h4>Completed (${completed.length})</h4>
      ${completed.length ? `<div class="task-list completed">${completed.map(t => this.taskItem(t)).join('')}</div>` : '<p class="text-muted">None</p>'}
    </div>`;
  },
  
  taskItem(t) {
    return `<div class="task-item ${t.priority==='high'||t.priority==='urgent'?'high-priority':''} ${t.status==='completed'?'completed':''}">
      <input type="checkbox" ${t.status==='completed'?'checked':''} onchange="Deals.completeTask('${t.id}',this.checked)">
      <div class="task-info"><div class="task-title">${UI.escapeHtml(t.title)}</div>
        <div class="task-meta">${t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : 'No due date'}</div>
      </div>
    </div>`;
  },
  
  renderContacts(contacts) {
    return `<div class="contacts-header">
      <button class="btn btn-primary" onclick="Deals.addContact()"><i data-lucide="plus"></i> Add Contact</button>
    </div>
    ${contacts.length ? `<div class="contacts-grid">${contacts.map(dc => {
      const c = dc.contacts; if (!c) return '';
      return `<div class="contact-card-large">
        <div class="contact-avatar-large">${UI.getInitials(c.first_name, c.last_name)}</div>
        <div class="contact-details"><div class="contact-name">${c.first_name} ${c.last_name||''}</div>
          <div class="contact-title">${c.job_title||''}</div>
          <div class="contact-role">${dc.role||'Contact'} ${dc.is_primary?'(Primary)':''}</div>
          <div class="contact-actions">
            ${c.email ? `<a href="mailto:${c.email}" class="btn btn-ghost btn-sm"><i data-lucide="mail"></i></a>` : ''}
            ${c.phone ? `<a href="tel:${c.phone}" class="btn btn-ghost btn-sm"><i data-lucide="phone"></i></a>` : ''}
          </div>
        </div>
      </div>`;
    }).join('')}</div>` : '<div class="empty-state"><p>No contacts linked</p></div>'}`;
  },
  
  renderSales(deal) {
    return `<div class="sales-content">
      <div class="card"><div class="card-header"><h3>ICP Fit</h3></div>
        <div class="card-body"><div class="icp-score"><span class="score-value">${deal.icp_fit_score||0}/3</span></div></div></div>
      <div class="card"><div class="card-header"><h3>Notes</h3></div>
        <div class="card-body"><textarea class="form-textarea" onchange="Deals.updateField('notes',this.value)">${deal.notes||''}</textarea></div></div>
      <div class="card"><div class="card-header"><h3>Lost Reason</h3></div>
        <div class="card-body"><select class="form-select" onchange="Deals.updateField('lost_reason',this.value)">
          <option value="">Select...</option>
          <option value="price" ${deal.lost_reason==='price'?'selected':''}>Price</option>
          <option value="competitor" ${deal.lost_reason==='competitor'?'selected':''}>Competitor</option>
          <option value="timing" ${deal.lost_reason==='timing'?'selected':''}>Timing</option>
          <option value="no_need" ${deal.lost_reason==='no_need'?'selected':''}>No Need</option>
          <option value="no_response" ${deal.lost_reason==='no_response'?'selected':''}>No Response</option>
        </select></div></div>
    </div>`;
  },
  
  renderOnboarding(deal) {
    const checks = [
      ['kickoff_completed', 'Kickoff call completed'],
      ['menu_setup_completed', 'Menu setup completed'],
      ['hardware_shipped', 'Hardware shipped'],
      ['hardware_installed', 'Hardware installed'],
      ['training_completed', 'Training completed'],
      ['go_live_completed', 'Go-live completed']
    ];
    return `<div class="onboarding-content">
      <div class="card"><div class="card-header"><h3>Checklist</h3></div>
        <div class="card-body"><div class="checklist">
          ${checks.map(([f,l]) => `<label class="checklist-item">
            <input type="checkbox" ${deal[f]?'checked':''} onchange="Deals.updateField('${f}',this.checked)"><span>${l}</span>
          </label>`).join('')}
        </div></div></div>
      <div class="card"><div class="card-header"><h3>Launch Date</h3></div>
        <div class="card-body"><input type="date" class="form-input" value="${deal.launched_at||''}" 
          onchange="Deals.updateField('launched_at',this.value)"></div></div>
    </div>`;
  },
  
  renderSuccess(deal) {
    return `<div class="success-content">
      <div class="card"><div class="card-header"><h3>Health Score</h3></div>
        <div class="card-body"><div class="health-score"><span class="score-circle">${deal.health_score||0}</span></div></div></div>
      <div class="card"><div class="card-header"><h3>Key Dates</h3></div>
        <div class="card-body">
          <div class="detail-row"><label>Launched</label><span>${deal.launched_at ? new Date(deal.launched_at).toLocaleDateString() : '-'}</span></div>
          <div class="detail-row"><label>30-Day</label><span>${deal.thirty_day_at ? new Date(deal.thirty_day_at).toLocaleDateString() : '-'}</span></div>
          <div class="detail-row"><label>90-Day</label><span>${deal.ninety_day_at ? new Date(deal.ninety_day_at).toLocaleDateString() : '-'}</span></div>
        </div></div>
      <div class="card"><div class="card-header"><h3>Notes</h3></div>
        <div class="card-body"><textarea class="form-textarea" onchange="Deals.updateField('success_notes',this.value)">${deal.success_notes||''}</textarea></div></div>
    </div>`;
  },
  
  // Actions
  async changeStage(stageId) {
    if (!this.currentDeal || this.currentDeal.stage_id === stageId) return;
    const { error } = await db.from('deals').update({ stage_id: stageId }).eq('id', this.currentDeal.id);
    if (!error) { UI.toast('Stage updated'); this.showDealDetail(this.currentDeal.id); }
    else UI.toast('Error', 'error');
  },
  
  async updateField(field, value) {
    if (!this.currentDeal) return;
    const { error } = await db.from('deals').update({ [field]: value }).eq('id', this.currentDeal.id);
    if (!error) this.currentDeal[field] = value;
  },
  
  async completeTask(id, done) {
    await db.from('tasks').update({ status: done ? 'completed' : 'pending', completed_at: done ? new Date().toISOString() : null }).eq('id', id);
    UI.toast(done ? 'Task completed' : 'Task reopened');
  },
  
  logActivity(type = 'note') {
    UI.modal({
      title: 'Log Activity',
      content: `<form id="activity-form">
        <div class="form-group"><label>Type</label>
          <select class="form-select" name="activity_type">
            <option value="note" ${type==='note'?'selected':''}>Note</option>
            <option value="call" ${type==='call'?'selected':''}>Call</option>
            <option value="email" ${type==='email'?'selected':''}>Email</option>
            <option value="meeting" ${type==='meeting'?'selected':''}>Meeting</option>
          </select></div>
        <div class="form-group"><label>Subject</label><input type="text" class="form-input" name="subject"></div>
        <div class="form-group"><label>Details</label><textarea class="form-textarea" name="body" rows="4"></textarea></div>
      </form>`,
      onConfirm: async () => {
        const d = Object.fromEntries(new FormData(document.getElementById('activity-form')));
        await db.from('activities').insert({ deal_id: this.currentDeal.id, company_id: this.currentDeal.company_id, ...d });
        UI.toast('Activity logged'); this.showDealDetail(this.currentDeal.id);
      }
    });
  },
  
  createTask() {
    UI.modal({
      title: 'Create Task',
      content: `<form id="task-form">
        <div class="form-group"><label>Title</label><input type="text" class="form-input" name="title" required></div>
        <div class="form-group"><label>Due Date</label><input type="date" class="form-input" name="due_date"></div>
        <div class="form-group"><label>Priority</label>
          <select class="form-select" name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
        <div class="form-group"><label>Description</label><textarea class="form-textarea" name="description" rows="3"></textarea></div>
      </form>`,
      onConfirm: async () => {
        const d = Object.fromEntries(new FormData(document.getElementById('task-form')));
        await db.from('tasks').insert({ deal_id: this.currentDeal.id, company_id: this.currentDeal.company_id, ...d, status: 'pending' });
        UI.toast('Task created'); this.showDealDetail(this.currentDeal.id);
      }
    });
  },
  
  filterActivities(type) {
    document.querySelectorAll('.activity-item').forEach(el => {
      el.style.display = !type || el.dataset.type?.includes(type) ? '' : 'none';
    });
  },
  
  scheduleMeeting() { UI.toast('Meeting scheduling coming soon'); },
  addContact() { UI.toast('Contact picker coming soon'); },
  editDeal() { UI.toast('Deal editor coming soon'); }
};

window.Deals = Deals;
