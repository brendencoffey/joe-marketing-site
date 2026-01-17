// ============================================
// PIPELINE MODULE - Kanban Board
// ============================================

const Pipeline = {
  draggedDeal: null,
  
  render(params = {}) {
    this.renderTabs();
    this.renderFilters();
    this.renderBoard();
  },
  
  renderTabs() {
    const container = document.getElementById('pipeline-tabs');
    const pipelines = Store.data.pipelines;
    const currentPipeline = Store.ui.currentPipeline;
    
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
    const teamMembers = Store.data.teamMembers;
    
    ownerFilter.innerHTML = `
      <option value="">All Owners</option>
      ${teamMembers.map(tm => `
        <option value="${tm.email}">${tm.name}</option>
      `).join('')}
    `;
    
    ownerFilter.onchange = () => this.renderBoard();
    
    const searchInput = document.getElementById('pipeline-search');
    searchInput.oninput = UI.debounce(() => this.renderBoard(), 300);
  },
  
  renderBoard() {
    const container = document.getElementById('pipeline-board');
    const currentPipeline = Store.ui.currentPipeline;
    
    if (!currentPipeline) {
      container.innerHTML = UI.emptyState('📋', 'No pipeline selected', 'Select a pipeline to view deals');
      return;
    }
    
    const stages = Store.getStagesByPipeline(currentPipeline);
    const ownerFilter = document.getElementById('pipeline-owner-filter').value;
    const searchFilter = document.getElementById('pipeline-search').value.toLowerCase();
    
    // Get filtered deals
    let deals = Store.getDealsByPipeline(currentPipeline);
    
    if (ownerFilter) {
      deals = deals.filter(d => d.assigned_to === ownerFilter);
    }
    
    if (searchFilter) {
      deals = deals.filter(d => 
        d.name?.toLowerCase().includes(searchFilter) ||
        d.companies?.name?.toLowerCase().includes(searchFilter)
      );
    }
    
    container.innerHTML = stages.map(stage => {
      const stageDeals = deals.filter(d => d.stage_id === stage.id);
      const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      
      return `
        <div class="pipeline-column" data-stage-id="${stage.id}">
          <div class="pipeline-column-header">
            <div class="pipeline-column-title">
              <span class="dot" style="background: ${stage.color}"></span>
              <span>${stage.name}</span>
              <span class="pipeline-column-count">${stageDeals.length}</span>
            </div>
            ${totalValue > 0 ? `
              <span class="text-sm text-gray-500">${UI.formatCurrency(totalValue)}</span>
            ` : ''}
          </div>
          <div class="pipeline-column-cards" 
               ondragover="Pipeline.handleDragOver(event)"
               ondrop="Pipeline.handleDrop(event, '${stage.id}')">
            ${stageDeals.map(deal => this.renderDealCard(deal)).join('')}
          </div>
        </div>
      `;
    }).join('');
  },
  
  renderDealCard(deal) {
    const stage = Store.getStageById(deal.stage_id);
    const owner = Store.getTeamMemberByEmail(deal.assigned_to);
    
    // Calculate days in stage
    const daysInStage = deal.stage_changed_at 
      ? Math.floor((new Date() - new Date(deal.stage_changed_at)) / 86400000)
      : Math.floor((new Date() - new Date(deal.created_at)) / 86400000);
    
    return `
      <div class="deal-card" 
           draggable="true"
           data-deal-id="${deal.id}"
           ondragstart="Pipeline.handleDragStart(event, '${deal.id}')"
           ondragend="Pipeline.handleDragEnd(event)"
           onclick="Deals.showDetail('${deal.id}')">
        <div class="deal-card-header">
          <div class="deal-card-title">${UI.escapeHtml(deal.name)}</div>
          ${deal.value ? `
            <div class="deal-card-value">${UI.formatCurrency(deal.value)}</div>
          ` : ''}
        </div>
        <div class="deal-card-company">
          ${UI.escapeHtml(deal.companies?.name || 'No company')}
        </div>
        <div class="deal-card-footer">
          <div class="deal-card-owner">
            ${owner ? `
              <img src="${owner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.name)}&size=20&background=F97316&color=fff`}" alt="${owner.name}">
              <span>${owner.name.split(' ')[0]}</span>
            ` : '<span class="text-gray-400">Unassigned</span>'}
          </div>
          <div class="deal-card-days">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            ${daysInStage}d
          </div>
        </div>
      </div>
    `;
  },
  
  switchPipeline(pipelineId) {
    Store.set('ui.currentPipeline', pipelineId);
    this.renderTabs();
    this.renderBoard();
  },
  
  // Drag and Drop handlers
  handleDragStart(event, dealId) {
    this.draggedDeal = dealId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dealId);
  },
  
  handleDragEnd(event) {
    event.target.classList.remove('dragging');
    this.draggedDeal = null;
    
    // Remove all drag-over states
    document.querySelectorAll('.pipeline-column-cards').forEach(col => {
      col.classList.remove('drag-over');
    });
  },
  
  handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
  },
  
  async handleDrop(event, stageId) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    const dealId = event.dataTransfer.getData('text/plain');
    if (!dealId) return;
    
    const deal = Store.getDealById(dealId);
    if (!deal || deal.stage_id === stageId) return;
    
    try {
      await API.updateDealStage(dealId, stageId);
      UI.toast('Deal moved!', 'success');
      this.renderBoard();
    } catch (error) {
      console.error('Error moving deal:', error);
      UI.toast('Error moving deal', 'error');
    }
  }
};

// Add drag-over CSS
const style = document.createElement('style');
style.textContent = `
  .pipeline-column-cards.drag-over {
    background: var(--joe-orange-light);
    border: 2px dashed var(--joe-orange);
    border-radius: var(--radius-lg);
  }
`;
document.head.appendChild(style);

// Export
window.Pipeline = Pipeline;
