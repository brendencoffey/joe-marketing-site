// ============================================
// CONTACTS MODULE - Filtered by CRM 2.0 Pipelines
// ============================================

const Contacts = {
  // Only show contacts linked to deals in these pipelines
  ALLOWED_PIPELINES: [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  ],

  async render(params = {}) {
    await this.loadData();
    this.setupFilters();
    this.renderTable();
  },

  async loadData() {
    if (!Store.data.contacts || Store.data.contacts.length === 0) {
      try {
        // First get contact IDs linked to deals in allowed pipelines
        const { data: dealContacts } = await db
          .from('deal_contacts')
          .select('contact_id, deals!inner(pipeline_id)')
          .in('deals.pipeline_id', this.ALLOWED_PIPELINES);
        
        const contactIds = [...new Set((dealContacts || []).map(dc => dc.contact_id).filter(Boolean))];
        
        if (contactIds.length === 0) {
          Store.data.contacts = [];
          return;
        }
        
        // Then fetch those contacts
        const { data, error } = await db
          .from('contacts')
          .select('*, companies(name)')
          .in('id', contactIds)
          .order('created_at', { ascending: false });

        if (data) Store.data.contacts = data;
      } catch (err) {
        console.error('Error loading contacts:', err);
        // Fallback: try loading without the join filter
        try {
          const { data } = await db
            .from('contacts')
            .select('*, companies(name)')
            .order('created_at', { ascending: false })
            .limit(0); // Show empty until we have proper deal associations
          Store.data.contacts = data || [];
        } catch (e) {
          Store.data.contacts = [];
        }
      }
    }
  },

  setupFilters() {
    const companyFilter = document.getElementById('contacts-company-filter');
    const searchInput = document.getElementById('contacts-search');

    if (companyFilter && Store.data.companies) {
      companyFilter.innerHTML = '<option value="">All Companies</option>' +
        Store.data.companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      companyFilter.onchange = () => this.renderTable();
    }

    if (searchInput) searchInput.oninput = UI.debounce(() => this.renderTable(), 300);
  },

  renderTable() {
    const container = document.getElementById('contacts-table');
    if (!container) return;

    let contacts = Store.data.contacts || [];

    // Apply filters
    const companyId = document.getElementById('contacts-company-filter')?.value;
    const search = document.getElementById('contacts-search')?.value?.toLowerCase();

    if (companyId) contacts = contacts.filter(c => c.company_id === companyId);
    if (search) contacts = contacts.filter(c =>
      c.first_name?.toLowerCase().includes(search) ||
      c.last_name?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search)
    );

    if (contacts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <h3>No contacts found</h3>
          <p>Contacts will appear here when linked to deals in Sales or Customer pipelines</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="table">
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
            <tr onclick="Contacts.showDetail('${contact.id}')" style="cursor:pointer">
              <td><strong>${contact.first_name || ''} ${contact.last_name || ''}</strong></td>
              <td>${contact.email || '-'}</td>
              <td>${contact.phone || '-'}</td>
              <td>${contact.companies?.name || '-'}</td>
              <td>${contact.title || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  showDetail(id) {
    console.log('Show contact detail:', id);
  }
};

window.Contacts = Contacts;