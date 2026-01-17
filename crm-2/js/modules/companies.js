// ============================================
// COMPANIES MODULE
// ============================================

const Companies = {
  render(params = {}) {
    this.renderFilters();
    this.renderTable();
  },
  
  renderFilters() {
    const page = document.getElementById('page-companies');
    
    if (!document.getElementById('companies-filters')) {
      const filtersHtml = `
        <div id="companies-filters" class="page-filters" style="margin-top: 1rem;">
          <input type="text" id="companies-search" class="form-input" placeholder="Search companies..." style="width: 250px;">
          <select id="companies-type-filter" class="form-select">
            <option value="">All Types</option>
            ${Store.data.icpTypes.map(t => `<option value="${t.slug}">${t.name}</option>`).join('')}
          </select>
          <select id="companies-partner-filter" class="form-select">
            <option value="">All</option>
            <option value="true">Partners Only</option>
            <option value="false">Prospects Only</option>
          </select>
        </div>
      `;
      page.querySelector('.page-header').insertAdjacentHTML('afterend', filtersHtml);
      
      document.getElementById('companies-search').oninput = UI.debounce(() => this.renderTable(), 300);
      document.getElementById('companies-type-filter').onchange = () => this.renderTable();
      document.getElementById('companies-partner-filter').onchange = () => this.renderTable();
    }
  },
  
  renderTable() {
    const page = document.getElementById('page-companies');
    let tableContainer = page.querySelector('.data-table');
    
    if (!tableContainer) {
      tableContainer = document.createElement('div');
      tableContainer.className = 'data-table';
      page.appendChild(tableContainer);
    }
    
    const search = document.getElementById('companies-search')?.value?.toLowerCase() || '';
    const typeFilter = document.getElementById('companies-type-filter')?.value || '';
    const partnerFilter = document.getElementById('companies-partner-filter')?.value || '';
    
    let companies = Store.data.companies;
    
    if (search) {
      companies = companies.filter(c => 
        c.name?.toLowerCase().includes(search) ||
        c.city?.toLowerCase().includes(search)
      );
    }
    if (typeFilter) {
      companies = companies.filter(c => c.icp_type === typeFilter);
    }
    if (partnerFilter !== '') {
      companies = companies.filter(c => String(c.is_joe_partner) === partnerFilter);
    }
    
    // Limit for performance
    companies = companies.slice(0, 100);
    
    if (companies.length === 0) {
      tableContainer.innerHTML = UI.emptyState('🏢', 'No companies found', 'Try a different search');
      return;
    }
    
    tableContainer.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Location</th>
            <th>Type</th>
            <th>Status</th>
            <th>Contacts</th>
            <th>Deals</th>
          </tr>
        </thead>
        <tbody>
          ${companies.map(company => {
            const contactCount = Store.data.contacts.filter(c => c.company_id === company.id).length;
            const dealCount = Store.data.deals.filter(d => d.company_id === company.id).length;
            
            return `
              <tr onclick="Companies.showDetail('${company.id}')">
                <td>
                  <div class="font-medium">${UI.escapeHtml(company.name)}</div>
                  ${company.website ? `<div class="text-xs text-gray-400">${company.website}</div>` : ''}
                </td>
                <td>${[company.city, company.state].filter(Boolean).join(', ') || '-'}</td>
                <td>
                  ${company.icp_type ? `<span class="badge badge-blue">${company.icp_type}</span>` : '-'}
                </td>
                <td>
                  ${company.is_joe_partner ? 
                    '<span class="badge badge-green">Partner</span>' : 
                    '<span class="badge badge-gray">Prospect</span>'}
                </td>
                <td>${contactCount}</td>
                <td>${dealCount}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <div class="table-footer">
        Showing ${companies.length} of ${Store.data.companies.length} companies
      </div>
    `;
  },
  
  showCreateModal() {
    const modal = UI.modal({
      title: 'Add Company',
      content: this.getFormHtml(),
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="save">Create Company</button>
      `
    });
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="save"]').onclick = async () => {
      const form = modal.element.querySelector('form');
      const formData = new FormData(form);
      
      const company = {
        name: formData.get('name'),
        website: formData.get('website') || null,
        phone: formData.get('phone') || null,
        address: formData.get('address') || null,
        city: formData.get('city') || null,
        state: formData.get('state') || null,
        icp_type: formData.get('icp_type') || null
      };
      
      try {
        await API.createCompany(company);
        UI.toast('Company created!', 'success');
        modal.close();
        this.renderTable();
      } catch (error) {
        console.error('Error creating company:', error);
        UI.toast('Error creating company', 'error');
      }
    };
  },
  
  getFormHtml(company = null) {
    return `
      <form class="form">
        <div class="form-group">
          <label class="form-label">Company Name *</label>
          <input type="text" name="name" class="form-input" required 
                 value="${company?.name || ''}" placeholder="e.g., Blue Bottle Coffee">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Website</label>
            <input type="url" name="website" class="form-input" 
                   value="${company?.website || ''}" placeholder="https://...">
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" name="phone" class="form-input" 
                   value="${company?.phone || ''}" placeholder="(555) 123-4567">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Address</label>
          <input type="text" name="address" class="form-input" 
                 value="${company?.address || ''}" placeholder="123 Main St">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">City</label>
            <input type="text" name="city" class="form-input" 
                   value="${company?.city || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">State</label>
            <input type="text" name="state" class="form-input" 
                   value="${company?.state || ''}" maxlength="2" placeholder="CA">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">ICP Type</label>
          <select name="icp_type" class="form-select">
            <option value="">Select type...</option>
            ${Store.data.icpTypes.map(t => `
              <option value="${t.slug}" ${company?.icp_type === t.slug ? 'selected' : ''}>
                ${t.name}
              </option>
            `).join('')}
          </select>
        </div>
      </form>
    `;
  },
  
  async showDetail(companyId) {
    const company = Store.getCompanyById(companyId);
    if (!company) {
      UI.toast('Company not found', 'error');
      return;
    }
    
    const contacts = Store.getContactsByCompany(companyId);
    const deals = Store.data.deals.filter(d => d.company_id === companyId);
    const activities = Store.data.activities.filter(a => a.company_id === companyId);
    
    const modal = UI.modal({
      title: company.name,
      size: 'modal-lg',
      content: `
        <div class="company-detail">
          <!-- Quick Info -->
          <div class="company-quick-info">
            <div class="info-item">
              <span class="info-label">Location</span>
              <span class="info-value">${[company.city, company.state].filter(Boolean).join(', ') || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Website</span>
              <span class="info-value">
                ${company.website ? `<a href="${company.website}" target="_blank">${company.website}</a>` : '-'}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Phone</span>
              <span class="info-value">${company.phone ? UI.formatPhone(company.phone) : '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status</span>
              <span class="info-value">
                ${company.is_joe_partner ? 
                  '<span class="badge badge-green">Partner</span>' : 
                  '<span class="badge badge-gray">Prospect</span>'}
              </span>
            </div>
          </div>
          
          <!-- Tabs -->
          <div class="deal-tabs">
            <button class="tab-btn active" data-tab="contacts">Contacts (${contacts.length})</button>
            <button class="tab-btn" data-tab="deals">Deals (${deals.length})</button>
            <button class="tab-btn" data-tab="activity">Activity</button>
          </div>
          
          <!-- Contacts Tab -->
          <div class="tab-content active" data-tab="contacts">
            <button class="btn btn-secondary btn-sm mb-4" onclick="Contacts.showCreateModal('${companyId}')">+ Add Contact</button>
            ${contacts.length === 0 ? '<p class="text-gray-400 text-center p-4">No contacts</p>' : `
              <div class="contacts-list">
                ${contacts.map(c => `
                  <div class="contact-item" onclick="Contacts.showDetail('${c.id}')">
                    <div class="contact-avatar">${UI.getInitials(`${c.first_name} ${c.last_name}`)}</div>
                    <div class="contact-info">
                      <div class="contact-name">${c.first_name} ${c.last_name}</div>
                      <div class="contact-meta">${c.job_title || c.email || ''}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          
          <!-- Deals Tab -->
          <div class="tab-content" data-tab="deals">
            <button class="btn btn-secondary btn-sm mb-4" onclick="Deals.showCreateModal('${companyId}')">+ Add Deal</button>
            ${deals.length === 0 ? '<p class="text-gray-400 text-center p-4">No deals</p>' : `
              <div class="deals-list">
                ${deals.map(d => {
                  const stage = Store.getStageById(d.stage_id);
                  return `
                    <div class="deal-item" onclick="Deals.showDetail('${d.id}')">
                      <div class="deal-info">
                        <div class="deal-name">${UI.escapeHtml(d.name)}</div>
                        <span class="badge" style="background: ${stage?.color}20; color: ${stage?.color}">${stage?.name}</span>
                      </div>
                      <div class="deal-value">${d.value ? UI.formatCurrency(d.value) : '-'}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
          
          <!-- Activity Tab -->
          <div class="tab-content" data-tab="activity">
            ${activities.length === 0 ? '<p class="text-gray-400 text-center p-4">No activity</p>' : `
              <div class="activity-list">
                ${activities.map(a => `
                  <div class="activity-item">
                    <div class="activity-icon">${a.activity_type === 'email' ? '📧' : a.activity_type === 'call' ? '📞' : '📝'}</div>
                    <div class="activity-content">
                      <div class="activity-text">${UI.escapeHtml(a.notes || a.activity_type)}</div>
                      <div class="activity-time">${UI.formatRelativeTime(a.created_at)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `,
      footer: `
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
  }
};

// Add some CSS
const companyStyles = document.createElement('style');
companyStyles.textContent = `
  .company-quick-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-6); padding: var(--space-4); background: var(--gray-50); border-radius: var(--radius-lg); }
  .contact-item, .deal-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border-radius: var(--radius-lg); cursor: pointer; transition: background var(--transition-fast); }
  .contact-item:hover, .deal-item:hover { background: var(--gray-50); }
  .contact-avatar { width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--joe-orange); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; }
  .contact-name, .deal-name { font-weight: 500; }
  .contact-meta { font-size: 0.813rem; color: var(--gray-500); }
  .deal-item { justify-content: space-between; }
  .deal-value { font-weight: 600; color: var(--success); }
  .table-footer { padding: var(--space-3); text-align: center; color: var(--gray-500); font-size: 0.813rem; border-top: 1px solid var(--gray-100); }
`;
document.head.appendChild(companyStyles);

// Export
window.Companies = Companies;
