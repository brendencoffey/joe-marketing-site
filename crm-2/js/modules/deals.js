// ============================================
// DEALS MODULE
// ============================================

const Deals = {
  async render(params = {}) {
    await this.loadData();
    this.setupFilters();
    this.renderTable();
  },
  
  async loadData() {
    // Load pipelines
    if (!Store.data.pipelines || Store.data.pipelines.length === 0) {
      const { data } = await db.from('pipelines').select('*').eq('is_active', true).order('sort_order');
      if (data) Store.data.pipelines = data;
    }
    
    // Load stages
    if (!Store.data.stages || Store.data.stages.length === 0) {
      const { data } = await db.from('pipeline_stages').select('*').eq('is_active', true).order('sort_order');
      if (data) Store.data.stages = data;
    }
    
    // Load deals
    if (!Store.data.deals || Store.data.deals.length === 0) {
      try {
        const { data, error } = await db
          .from('deals')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (data) {
          Store.data.deals = data;
          console.log('Loaded deals:', data.length);
        }
        if (error) console.error('Error loading deals:', error);
      } catch (err) {
        console.error('Error loading deals:', err);
      }
    }
  },
  
  setupFilters() {
    const pipelineFilter = document.getElementById('deals-pipeline-filter');
    const stageFilter = document.getElementById('deals-stage-filter');
    const ownerFilter = document.getElementById('deals-owner-filter');
    const searchInput = document.getElementById('deals-search');
    
    // Populate pipeline filter
    if (pipelineFilter && Store.data.pipelines) {
      pipelineFilter.innerHTML = '<option value="">All Pipelines</option>' +
        Store.data.pipelines.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
    
    // Populate stage filter
    if (stageFilter && Store.data.stages) {
      stageFilter.innerHTML = '<option value="">All Stages</option>' +
        Store.data.stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
    
    // Populate owner filter
    if (ownerFilter && Store.data.teamMembers) {
      ownerFilter.innerHTML = '<option value="">All Owners</option>' +
        Store.data.teamMembers.map(tm => `<option value="${tm.email}">${tm.name}</option>`).join('');
    }
    
    // Event listeners
    if (pipelineFilter) pipelineFilter.onchange = () => this.renderTable();
    if (stageFilter) stageFilter.onchange = () => this.renderTable();
    if (ownerFilter) ownerFilter.onchange = () => this.renderTable();
    if (searchInput) searchInput.oninput = UI.debounce(() => this.renderTable(), 300);
  },
  
  renderTable() {
    const container = document.getElementById('deals-table');
    if (!container) return;
    
    let deals = Store.data.deals || [];
    
    // Apply filters
    const pipelineId = document.getElementById('deals-pipeline-filter')?.value;
    const stageId = document.getElementById('deals-stage-filter')?.value;
    const owner = document.getElementById('deals-owner-filter')?.value;
    const search = document.getElementById('deals-search')?.value?.toLowerCase();
    
    if (pipelineId) deals = deals.filter(d => d.pipeline_id === pipelineId);
    if (stageId) deals = deals.filter(d => d.stage_id === stageId);
    if (owner) deals = deals.filter(d => d.owner_email === owner);
    if (search) deals = deals.filter(d => d.name?.toLowerCase().includes(search));
    
    if (deals.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💰</div>
          <h3>No deals found</h3>
          <p>Create your first deal to get started</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Deal Name</th>
            <th>Company</th>
            <th>Value</th>
            <th>Stage</th>
            <th>Owner</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${deals.map(deal => `
            <tr onclick="Deals.showDetail('${deal.id}')" style="cursor:pointer">
              <td><strong>${deal.name || 'Unnamed'}</strong></td>
              <td>${deal.company_name || '-'}</td>
              <td>$${(deal.value || 0).toLocaleString()}</td>
              <td><span class="badge">${this.getStageName(deal.stage_id)}</span></td>
              <td>${deal.owner_email || '-'}</td>
              <td>${deal.created_at ? new Date(deal.created_at).toLocaleDateString() : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },
  
  getStageName(stageId) {
    const stage = Store.data.stages?.find(s => s.id === stageId);
    return stage?.name || 'Unknown';
  },
  
  showDetail(id) {
    console.log('Show deal detail:', id);
  }
};

window.Deals = Deals;
