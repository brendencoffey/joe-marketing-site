// ============================================
// COMPANIES MODULE - Filtered by CRM 2.0 Pipelines
// ============================================

const Companies = {
  map: null,
  markers: [],
  
  // Only show companies linked to deals in these pipelines
  ALLOWED_PIPELINES: [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  ],

  async render(params = {}) {
    await this.loadData();
    this.setupTabs();
    this.setupFilters();
    this.renderList();
  },

  async loadData() {
    if (!Store.data.companies || Store.data.companies.length === 0) {
      try {
        // First get company IDs that have deals in our allowed pipelines
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
        
        // Then fetch those companies
        const { data, error } = await db
          .from('companies')
          .select('*')
          .in('id', companyIds)
          .order('created_at', { ascending: false });

        if (data) Store.data.companies = data;
      } catch (err) {
        console.error('Error loading companies:', err);
      }
    }
  },

  setupTabs() {
    const tabs = document.querySelectorAll('#page-companies .tab-btn');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const view = tab.dataset.view;
        document.getElementById('companies-list-view').classList.toggle('hidden', view !== 'list');
        document.getElementById('companies-map-view').classList.toggle('hidden', view !== 'map');

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

    // Apply filters
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
          <p>Companies will appear here when linked to deals in Sales or Customer pipelines</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Company Name</th>
            <th>City</th>
            <th>State</th>
            <th>ICP Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${companies.map(company => `
            <tr onclick="Companies.showDetail('${company.id}')" style="cursor:pointer">
              <td><strong>${company.name || 'Unnamed'}</strong></td>
              <td>${company.city || '-'}</td>
              <td>${company.state || '-'}</td>
              <td>${company.icp_type || '-'}</td>
              <td><span class="badge">${company.status || 'Unknown'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  renderMap() {
    const container = document.getElementById('companies-map-view');
    if (!container || !CONFIG.MAPBOX_TOKEN) return;

    if (!this.map) {
      mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;
      this.map = new mapboxgl.Map({
        container: 'companies-map-view',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-98.5795, 39.8283],
        zoom: 3
      });
    }
  },

  showDetail(id) {
    console.log('Show company detail:', id);
  }
};

window.Companies = Companies;