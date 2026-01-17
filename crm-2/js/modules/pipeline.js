// ============================================
// PIPELINE MODULE - Kanban Board
// ============================================

const Pipeline = {
  draggedDeal: null,
  
  // CRM 2.0 only uses these pipelines
  ALLOWED_PIPELINES: [
    '11111111-1111-1111-1111-111111111111', // Sales
    '22222222-2222-2222-2222-222222222222'  // Customer
  ],
  
  async render(params = {}) {
    await this.loadData();
    this.renderTabs();
    this.renderFilters();
    this.renderBoard();
  },
  
  async loadData() {
    // Load only allowed pipelines
    if (!Store.data.pipelines || Store.data.pipelines.length === 0) {
      const { data } = await db
        .from('pipelines')
        .select('*')
        .in('id', this.ALLOWED_PIPELINES)
        .eq('is_active', true)
        .order('sort_order');
      if (data) Store.data.pipelines = data;
    }
    
    // Load stages for allowed pipelines only
    if (!Store.data.stages || Store.data.stages.length === 0) {
      const { data } = await db
        .from('pipeline_stages')
        .select('*')
        .in('pipeline_id', this.ALLOWED_PIPELINES)
        .eq('is_active', true)
        .order('sort_order');
      if (data) Store.data.stages = data;
    }
    
    // Load deals for allowed pipelines only
    if (!Store.data.deals || Store.data.deals.length === 0) {
      const { data } = await db
        .from('deals')
        .select('*')
        .in('pipeline_id', this.ALLOWED_PIPELINES)
        .order('created_at', { ascending: false });
      if (data) Store.data.deals = data;
    }
    
    // Load team members
    if (!Store.data.teamMembers || Store.data.teamMembers.length === 0) {
      const { data } = await db.from('team_members').select('*').order('name');
      if (data) Store.data.teamMembers = data;
    }
    
    // Set default pipeline if not set
    if (!Store.ui.currentPipeline && Store.data.pipelines?.length > 0) {
      Store.ui.currentPipeline = Store.data.pipelines[0].id;
    }
    
    console.log('Pipeline data loaded:', {
      pipelines: Store.data.pipelines?.length,
      stages: Store.data.stages?.length,
      deals: Store.data.deals?.length
    });
  },
  
  renderTabs() {
    const container = document.getElementById('pipeline-tabs');
    if (!container) return;
    
    const pipelines = Store.data.pipelines || [];
    const currentPipeline = Store.ui.currentPipeline;
    
    if (pipelines.length === 0) {
      container.innerHTML = '<div class="text-muted">No pipelines found</div>';
      return;
    }
    
    container.innerHTML = pipelines.map(pipeline => `
      <button class="pipeline-tab ${pipeline.id === currentPipeline ? 'active' : ''}" 
              data-id="${pipeline.id}"
              onclick="Pipeline.switchPipeline('${pipeline.id}')">
        ${pipeline.name}
      </button>
    `).join('');
  },
  
  renderFilters() {
    const ownerFilter = document.getElementById('pipeline-owner-filter');
    const teamMembers = Store.data.teamMembers || [];
    
    if (ownerFilter) {
      ownerFilter.innerHTML = `
        <option value="">All Owners</option>
        ${teamMembers.map(tm => `
          <option value="${tm.email}">${tm.name}</option>
        `).join('')}
      `;
      ownerFilter.onchange = () => this.renderBoard();
    }
    
    const searchInput = document.getElementById('pipeline-search');
    if (searchInput) {
      searchInput.oninput = UI.debounce(() => this.renderBoard(), 300);
    }
  },
  
  renderBoard() {
    const container = document.getElementById('pipeline-board');
    if (!container) return;
    
    const currentPipeline = Store.ui.currentPipeline;
    
    if (!currentPipeline) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>No pipeline selected</h3>
          <p>Select a pipeline to view deals</p>
        </div>
      `;
      return;
    }
    
    const stages = (Store.data.stages || []).filter(s => s.pipeline_id === currentPipeline);
    const ownerFilter = document.getElementById('pipeline-owner-filter')?.value;
    const searchFilter = document.getElementById('pipeline-search')?.value?.toLowerCase();
    
    // Get filtered deals
    let deals = (Store.data.deals || []).filter(d => d.pipeline_id === currentPipeline);
    
    if (ownerFilter) {
      deals = deals.filter(d => d.assigned_to === ownerFilter || d.owner_email === ownerFilter);
    }
    
    if (searchFilter) {
      deals = deals.filter(d => 
        d.name?.toLowerCase().includes(searchFilter) ||
        d.company_name?.toLowerCase().includes(searchFilter)
      );
    }
    
    if (stages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>No stages found</h3>
          <p>Configure stages in Settings</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = stages.map(stage => {
      const stageDeals = deals.filter(d => d.stage_id === stage.id);
      const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      
      return `
        <div class="pipeline-column" data-stage-id="${stage.id}">
          <div class="pipeline-column-header">
            <div class="pipeline-column-title">
              <span class="dot" style="background: ${stage.color || '#666'}"></span>
              ${stage.name}
              <span class="count">${stageDeals.length}</span>
            </div>
            <div class="pipeline-column-value">$${totalValue.toLocaleString()}</div>
          </div>
          <div class="pipeline-column-body" 
               ondragover="Pipeline.onDragOver(event)" 
               ondrop="Pipeline.onDrop(event, '${stage.id}')">
            ${stageDeals.map(deal => this.renderDealCard(deal)).join('')}
          </div>
        </div>
      `;
    }).join('');
  },
  
  renderDealCard(deal) {
    return `
      <div class="deal-card" 
           draggable="true"
           data-deal-id="${deal.id}"
           ondragstart="Pipeline.onDragStart(event, '${deal.id}')"
           onclick="Pipeline.showDeal('${deal.id}')">
        <div class="deal-card-title">${deal.name || 'Unnamed Deal'}</div>
        <div class="deal-card-company">${deal.company_name || '-'}</div>
        <div class="deal-card-footer">
          <span class="deal-card-value">$${(deal.value || 0).toLocaleString()}</span>
          <span class="deal-card-owner">${deal.owner_email?.split('@')[0] || '-'}</span>
        </div>
      </div>
    `;
  },
  
  switchPipeline(pipelineId) {
    Store.ui.currentPipeline = pipelineId;
    this.renderTabs();
    this.renderBoard();
  },
  
  onDragStart(event, dealId) {
    this.draggedDeal = dealId;
    event.dataTransfer.effectAllowed = 'move';
  },
  
  onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  },
  
  async onDrop(event, stageId) {
    event.preventDefault();
    if (!this.draggedDeal) return;
    
    const dealId = this.draggedDeal;
    this.draggedDeal = null;
    
    // Update deal stage
    const { error } = await db
      .from('deals')
      .update({ stage_id: stageId })
      .eq('id', dealId);
    
    if (!error) {
      // Update local store
      const deal = Store.data.deals.find(d => d.id === dealId);
      if (deal) deal.stage_id = stageId;
      this.renderBoard();
    }
  },
  
  showDeal(dealId) {
    console.log('Show deal:', dealId);
    // TODO: Open deal modal
  }
};

window.Pipeline = Pipeline;
