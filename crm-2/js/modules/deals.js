// ============================================
// DEALS MODULE
// ============================================

const Deals = {
  render(params = {}) {
    this.renderFilters();
    this.renderTable();
  },
  
  renderFilters() {
    const container = document.getElementById('page-deals').querySelector('.page-header');
    
    // Add filters if not present
    if (!document.getElementById('deals-filters')) {
      const filtersHtml = `
        <div id="deals-filters" class="page-filters" style="margin-top: 1rem;">
          <input type="text" id="deals-search" class="form-input" placeholder="Search deals..." style="width: 250px;">
          <select id="deals-pipeline-filter" class="form-select">
            <option value="">All Pipelines</option>
            ${Store.data.pipelines.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
          <select id="deals-stage-filter" class="form-select">
            <option value="">All Stages</option>
          </select>
          <select id="deals-owner-filter" class="form-select">
            <option value="">All Owners</option>
            ${Store.data.teamMembers.map(tm => `<option value="${tm.email}">${tm.name}</option>`).join('')}
          </select>
        </div>
      `;
      container.insertAdjacentHTML('afterend', filtersHtml);
      
      // Event listeners
      document.getElementById('deals-search').oninput = UI.debounce(() => this.renderTable(), 300);
      document.getElementById('deals-pipeline-filter').onchange = () => {
        this.updateStageFilter();
        this.renderTable();
      };
      document.getElementById('deals-stage-filter').onchange = () => this.renderTable();
      document.getElementById('deals-owner-filter').onchange = () => this.renderTable();
    }
  },
  
  updateStageFilter() {
    const pipelineId = document.getElementById('deals-pipeline-filter').value;
    const stageFilter = document.getElementById('deals-stage-filter');
    
    let stages = Store.data.stages;
    if (pipelineId) {
      stages = stages.filter(s => s.pipeline_id === pipelineId);
    }
    
    stageFilter.innerHTML = `
      <option value="">All Stages</option>
      ${stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
    `;
  },
  
  renderTable() {
    const container = document.getElementById('page-deals');
    let tableContainer = container.querySelector('.data-table');
    
    if (!tableContainer) {
      tableContainer = document.createElement('div');
      tableContainer.className = 'data-table';
      container.appendChild(tableContainer);
    }
    
    // Get filters
    const search = document.getElementById('deals-search')?.value?.toLowerCase() || '';
    const pipelineFilter = document.getElementById('deals-pipeline-filter')?.value || '';
    const stageFilter = document.getElementById('deals-stage-filter')?.value || '';
    const ownerFilter = document.getElementById('deals-owner-filter')?.value || '';
    
    // Filter deals
    let deals = Store.data.deals;
    
    if (search) {
      deals = deals.filter(d => 
        d.name?.toLowerCase().includes(search) ||
        d.companies?.name?.toLowerCase().includes(search)
      );
    }
    if (pipelineFilter) {
      deals = deals.filter(d => d.pipeline_id === pipelineFilter);
    }
    if (stageFilter) {
      deals = deals.filter(d => d.stage_id === stageFilter);
    }
    if (ownerFilter) {
      deals = deals.filter(d => d.assigned_to === ownerFilter);
    }
    
    if (deals.length === 0) {
      tableContainer.innerHTML = UI.emptyState('💼', 'No deals found', 'Create a deal to get started');
      return;
    }
    
    tableContainer.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Deal</th>
            <th>Company</th>
            <th>Stage</th>
            <th>Value</th>
            <th>Owner</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${deals.map(deal => {
            const stage = Store.getStageById(deal.stage_id);
            const owner = Store.getTeamMemberByEmail(deal.assigned_to);
            
            return `
              <tr onclick="Deals.showDetail('${deal.id}')">
                <td>
                  <div class="font-medium">${UI.escapeHtml(deal.name)}</div>
                </td>
                <td>${UI.escapeHtml(deal.companies?.name || '-')}</td>
                <td>
                  <span class="badge" style="background: ${stage?.color}20; color: ${stage?.color}">
                    ${stage?.name || 'Unknown'}
                  </span>
                </td>
                <td>${deal.value ? UI.formatCurrency(deal.value) : '-'}</td>
                <td>${owner?.name || 'Unassigned'}</td>
                <td>${UI.formatDate(deal.created_at)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },
  
  showCreateModal(companyId = null) {
    const modal = UI.modal({
      title: 'Create Deal',
      content: this.getFormHtml(),
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="save">Create Deal</button>
      `
    });
    
    // Pre-fill company if provided
    if (companyId) {
      const company = Store.getCompanyById(companyId);
      if (company) {
        modal.element.querySelector('[name="company_id"]').value = companyId;
        modal.element.querySelector('[name="name"]').value = company.name;
      }
    }
    
    // Setup pipeline/stage cascade
    const pipelineSelect = modal.element.querySelector('[name="pipeline_id"]');
    const stageSelect = modal.element.querySelector('[name="stage_id"]');
    
    pipelineSelect.onchange = () => {
      const stages = Store.getStagesByPipeline(pipelineSelect.value);
      stageSelect.innerHTML = stages.map(s => 
        `<option value="${s.id}">${s.name}</option>`
      ).join('');
    };
    pipelineSelect.dispatchEvent(new Event('change'));
    
    // Handle save
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="save"]').onclick = async () => {
      const form = modal.element.querySelector('form');
      const formData = new FormData(form);
      
      const deal = {
        name: formData.get('name'),
        pipeline_id: formData.get('pipeline_id'),
        stage_id: formData.get('stage_id'),
        company_id: formData.get('company_id') || null,
        contact_id: formData.get('contact_id') || null,
        value: formData.get('value') ? parseFloat(formData.get('value')) : null,
        assigned_to: formData.get('assigned_to') || Store.teamMember?.email,
        source: formData.get('source') || 'manual',
        close_date: formData.get('close_date') || null
      };
      
      try {
        await API.createDeal(deal);
        UI.toast('Deal created!', 'success');
        modal.close();
        this.renderTable();
        Pipeline.renderBoard();
      } catch (error) {
        console.error('Error creating deal:', error);
        UI.toast('Error creating deal', 'error');
      }
    };
  },
  
  getFormHtml(deal = null) {
    const pipelines = Store.data.pipelines;
    const teamMembers = Store.data.teamMembers;
    const companies = Store.data.companies;
    
    return `
      <form class="form">
        <div class="form-group">
          <label class="form-label">Deal Name *</label>
          <input type="text" name="name" class="form-input" required 
                 value="${deal?.name || ''}" placeholder="e.g., Blue Bottle - POS Implementation">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Pipeline *</label>
            <select name="pipeline_id" class="form-select" required>
              ${pipelines.map(p => `
                <option value="${p.id}" ${deal?.pipeline_id === p.id ? 'selected' : ''}>
                  ${p.name}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Stage *</label>
            <select name="stage_id" class="form-select" required>
              <!-- Populated dynamically -->
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Company</label>
            <select name="company_id" class="form-select">
              <option value="">Select company...</option>
              ${companies.slice(0, 100).map(c => `
                <option value="${c.id}" ${deal?.company_id === c.id ? 'selected' : ''}>
                  ${UI.escapeHtml(c.name)}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Value</label>
            <input type="number" name="value" class="form-input" 
                   value="${deal?.value || ''}" placeholder="0">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Owner</label>
            <select name="assigned_to" class="form-select">
              ${teamMembers.map(tm => `
                <option value="${tm.email}" ${deal?.assigned_to === tm.email || (!deal && tm.email === Store.teamMember?.email) ? 'selected' : ''}>
                  ${tm.name}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Expected Close</label>
            <input type="date" name="close_date" class="form-input" 
                   value="${deal?.close_date?.split('T')[0] || ''}">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Source</label>
          <select name="source" class="form-select">
            <option value="manual">Manual Entry</option>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
            <option value="referral">Referral</option>
            <option value="claim_listing">Claim Listing</option>
            <option value="get_started">Get Started Form</option>
          </select>
        </div>
      </form>
    `;
  },
  
  async showDetail(dealId) {
    const deal = Store.getDealById(dealId);
    if (!deal) {
      UI.toast('Deal not found', 'error');
      return;
    }
    
    const stage = Store.getStageById(deal.stage_id);
    const pipeline = Store.getPipelineById(deal.pipeline_id);
    const owner = Store.getTeamMemberByEmail(deal.assigned_to);
    
    // Get deal activities
    const activities = Store.data.activities.filter(a => a.deal_id === dealId);
    const tasks = Store.data.tasks.filter(t => t.deal_id === dealId);
    
    const modal = UI.modal({
      title: deal.name,
      size: 'modal-lg',
      content: `
        <div class="deal-detail">
          <div class="deal-detail-main">
            <!-- Header -->
            <div class="deal-header">
              <div class="deal-stage-badge" style="background: ${stage?.color}20; color: ${stage?.color}">
                ${stage?.name || 'Unknown'}
              </div>
              <span class="text-gray-500">${pipeline?.name || 'Unknown Pipeline'}</span>
            </div>
            
            <!-- Quick Info -->
            <div class="deal-quick-info">
              <div class="info-item">
                <span class="info-label">Value</span>
                <span class="info-value">${deal.value ? UI.formatCurrency(deal.value) : '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Owner</span>
                <span class="info-value">${owner?.name || 'Unassigned'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Company</span>
                <span class="info-value">${UI.escapeHtml(deal.companies?.name || '-')}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Created</span>
                <span class="info-value">${UI.formatDate(deal.created_at)}</span>
              </div>
            </div>
            
            <!-- Tabs -->
            <div class="deal-tabs">
              <button class="tab-btn active" data-tab="activity">Activity</button>
              <button class="tab-btn" data-tab="tasks">Tasks (${tasks.length})</button>
              <button class="tab-btn" data-tab="details">Details</button>
            </div>
            
            <!-- Activity Tab -->
            <div class="tab-content active" data-tab="activity">
              <div class="activity-composer">
                <select id="activity-type" class="form-select" style="width: auto;">
                  <option value="note">📝 Note</option>
                  <option value="email">📧 Email</option>
                  <option value="call">📞 Call</option>
                  <option value="meeting">🗓️ Meeting</option>
                </select>
                <input type="text" id="activity-input" class="form-input" placeholder="Add a note...">
                <button class="btn btn-primary" onclick="Deals.addActivity('${dealId}')">Add</button>
              </div>
              
              <div class="activity-list">
                ${activities.length === 0 ? '<p class="text-gray-400 text-center p-4">No activity yet</p>' : 
                  activities.map(a => `
                    <div class="activity-item">
                      <div class="activity-icon ${a.activity_type}">
                        ${a.activity_type === 'email' ? '📧' : 
                          a.activity_type === 'call' ? '📞' : 
                          a.activity_type === 'meeting' ? '🗓️' : 
                          a.activity_type === 'stage_change' ? '🔄' : '📝'}
                      </div>
                      <div class="activity-content">
                        <div class="activity-text">${UI.escapeHtml(a.notes || a.activity_type)}</div>
                        <div class="activity-time">${UI.formatRelativeTime(a.created_at)}</div>
                      </div>
                    </div>
                  `).join('')
                }
              </div>
            </div>
            
            <!-- Tasks Tab -->
            <div class="tab-content" data-tab="tasks">
              <button class="btn btn-secondary btn-sm mb-4" onclick="Tasks.showCreateModal('${dealId}')">+ Add Task</button>
              <div class="tasks-list">
                ${tasks.length === 0 ? '<p class="text-gray-400 text-center p-4">No tasks</p>' : 
                  tasks.map(t => `
                    <div class="task-item ${t.status === 'completed' ? 'completed' : ''}">
                      <div class="task-checkbox ${t.status === 'completed' ? 'checked' : ''}" 
                           onclick="Tasks.toggle('${t.id}')"></div>
                      <div class="task-content">
                        <div class="task-title">${UI.escapeHtml(t.title)}</div>
                        <div class="task-meta">
                          ${t.due_date ? `<span class="task-due">${UI.formatDate(t.due_date)}</span>` : ''}
                        </div>
                      </div>
                    </div>
                  `).join('')
                }
              </div>
            </div>
            
            <!-- Details Tab -->
            <div class="tab-content" data-tab="details">
              ${this.getFormHtml(deal)}
              <button class="btn btn-primary mt-4" onclick="Deals.update('${dealId}')">Save Changes</button>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="Deals.deleteDeal('${dealId}')">Delete</button>
        <button class="btn btn-secondary" data-action="close">Close</button>
      `
    });
    
    // Setup tabs
    modal.element.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        modal.element.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        modal.element.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        modal.element.querySelector(`.tab-content[data-tab="${btn.dataset.tab}"]`).classList.add('active');
      };
    });
    
    modal.element.querySelector('[data-action="close"]').onclick = () => modal.close();
    
    // Store modal reference for refresh
    this.currentModal = modal;
    this.currentDealId = dealId;
  },
  
  async addActivity(dealId) {
    const typeSelect = document.getElementById('activity-type');
    const input = document.getElementById('activity-input');
    
    if (!input.value.trim()) return;
    
    try {
      await API.createActivity({
        deal_id: dealId,
        activity_type: typeSelect.value,
        notes: input.value.trim(),
        created_by: Store.teamMember?.id
      });
      
      input.value = '';
      UI.toast('Activity added!', 'success');
      
      // Refresh modal
      if (this.currentModal && this.currentDealId === dealId) {
        this.currentModal.close();
        this.showDetail(dealId);
      }
    } catch (error) {
      console.error('Error adding activity:', error);
      UI.toast('Error adding activity', 'error');
    }
  },
  
  async update(dealId) {
    const form = document.querySelector('.deal-detail form');
    const formData = new FormData(form);
    
    const updates = {
      name: formData.get('name'),
      pipeline_id: formData.get('pipeline_id'),
      stage_id: formData.get('stage_id'),
      company_id: formData.get('company_id') || null,
      value: formData.get('value') ? parseFloat(formData.get('value')) : null,
      assigned_to: formData.get('assigned_to'),
      close_date: formData.get('close_date') || null
    };
    
    try {
      await API.updateDeal(dealId, updates);
      UI.toast('Deal updated!', 'success');
      this.renderTable();
      Pipeline.renderBoard();
    } catch (error) {
      console.error('Error updating deal:', error);
      UI.toast('Error updating deal', 'error');
    }
  },
  
  async deleteDeal(dealId) {
    UI.confirm('Are you sure you want to delete this deal?', async () => {
      try {
        await API.deleteDeal(dealId);
        UI.toast('Deal deleted', 'success');
        if (this.currentModal) this.currentModal.close();
        this.renderTable();
        Pipeline.renderBoard();
      } catch (error) {
        console.error('Error deleting deal:', error);
        UI.toast('Error deleting deal', 'error');
      }
    });
  }
};

// Add some CSS for deal detail
const dealStyles = document.createElement('style');
dealStyles.textContent = `
  .deal-detail { padding: var(--space-2); }
  .deal-header { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
  .deal-stage-badge { padding: 0.25rem 0.75rem; border-radius: var(--radius-full); font-weight: 500; font-size: 0.875rem; }
  .deal-quick-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-6); padding: var(--space-4); background: var(--gray-50); border-radius: var(--radius-lg); }
  .info-item { display: flex; flex-direction: column; }
  .info-label { font-size: 0.75rem; color: var(--gray-500); margin-bottom: var(--space-1); }
  .info-value { font-weight: 500; }
  .deal-tabs { display: flex; gap: var(--space-2); border-bottom: 1px solid var(--gray-200); margin-bottom: var(--space-4); }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  .activity-composer { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
  .activity-composer .form-input { flex: 1; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
`;
document.head.appendChild(dealStyles);

// Export
window.Deals = Deals;
