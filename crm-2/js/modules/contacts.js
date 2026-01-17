// ============================================
// CONTACTS MODULE
// ============================================

const Contacts = {
  async render(params = {}) {
    await this.loadData();
    this.setupFilters();
    this.renderTable();
  },
  
  async loadData() {
    if (!Store.data.contacts || Store.data.contacts.length === 0) {
      try {
        const { data, error } = await db
          .from('contacts')
          .select('*, companies(name)')
          .order('created_at', { ascending: false });
        
        if (data) Store.data.contacts = data;
      } catch (err) {
        console.error('Error loading contacts:', err);
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
          <p>Add contacts to your companies</p>
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
