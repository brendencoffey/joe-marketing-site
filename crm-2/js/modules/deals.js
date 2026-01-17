// ============================================
// DEALS MODULE
// ============================================

const Deals = {
  // CRM 2.0 only uses these pipelines
  ALLOWED_PIPELINES: [
    '11111111-1111-1111-1111-111111111111', // Sales
    '22222222-2222-2222-2222-222222222222'  // Customer
  ],

  async render(params = {}) {
    await this.loadData();
    this.renderFilters();
    this.renderList();
  },
  
  async loadData() {
    // Only load deals from allowed pipelines
    try {
      const { data, error } = await db
        .from('deals')
        .select('*')
        .in('pipeline_id', this.ALLOWED_PIPELINES)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (data) {
        Store.data.deals = data;
        console.log('Loaded deals:', data.length);
      }
      if (error) console.error('Error loading deals:', error);
    } catch (err) {
      console.error('Error loading deals:', err);
    }
  },
  
  renderFilters() {
    // Setup filter handlers
    const stageFilter = document.getElementById('deals-stage-filter');
    const ownerFilter = document.getElementById('deals-owner-filter');
    const searchInput = document.getElementById('deals-search');
    
    if (stageFilter) stageFilter.onchange = () => this.renderList();
    if (ownerFilter) ownerFilter.onchange = () => this.renderList();
    if (searchInput) searchInput.oninput = UI.debounce(() => this.renderList(), 300);
  },
  
  renderList() {
    const container = document.getElementById('deals-list');
    if (!container) return;
    
    let deals = Store.data.deals || [];
    
    // Apply filters
    const stageFilter = document.getElementById('deals-stage-filter')?.value;
    const ownerFilter = document.getElementById('deals-owner-filter')?.value;
    const searchFilter = document.getElementById('deals-search')?.value?.toLowerCase();
    
    if (stageFilter) {
      deals = deals.filter(d => d.stage_id === stageFilter);
    }
    if (ownerFilter) {
      deals = deals.filter(d => d.owner_email === ownerFilter || d.assigned_to === ownerFilter);
    }
    if (searchFilter) {
      deals = deals.filter(d => 
        d.name?.toLowerCase().includes(searchFilter) ||
        d.company_name?.toLowerCase().includes(searchFilter)
      );
    }
    
    if (deals.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💼</div>
          <h3>No deals found</h3>
          <p>Create a new deal to get started</p>
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
              <td><span class="badge">${deal.stage_name || 'Unknown'}</span></td>
              <td>${deal.owner_email?.split('@')[0] || '-'}</td>
              <td>${deal.created_at ? new Date(deal.created_at).toLocaleDateString() : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },
  
  showDetail(dealId) {
    console.log('Show deal:', dealId);
    // TODO: Open deal modal
  }
};

window.Deals = Deals;
