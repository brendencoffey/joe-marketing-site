// ============================================
// CONTACTS MODULE
// ============================================

const Contacts = {
  render(params = {}) {
    this.renderTable();
  },
  
  renderTable() {
    const page = document.getElementById('page-contacts');
    let container = page.querySelector('#contacts-content');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'contacts-content';
      page.appendChild(container);
    }
    
    const contacts = Store.data.contacts.slice(0, 100);
    
    if (contacts.length === 0) {
      container.innerHTML = UI.emptyState('👥', 'No contacts found', 'Add a contact to get started');
      return;
    }
    
    container.innerHTML = `
      <div class="data-table">
        <table>
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
            ${contacts.map(contact => {
              const company = Store.getCompanyById(contact.company_id);
              return `
                <tr onclick="Contacts.showDetail('${contact.id}')">
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="contact-avatar-sm">${UI.getInitials(`${contact.first_name} ${contact.last_name}`)}</div>
                      <span class="font-medium">${contact.first_name || ''} ${contact.last_name || ''}</span>
                    </div>
                  </td>
                  <td>${contact.email || '-'}</td>
                  <td>${contact.phone ? UI.formatPhone(contact.phone) : '-'}</td>
                  <td>${company?.name || '-'}</td>
                  <td>${contact.job_title || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },
  
  showCreateModal(companyId = null) {
    const modal = UI.modal({
      title: 'Add Contact',
      content: this.getFormHtml(null, companyId),
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="save">Create Contact</button>
      `
    });
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="save"]').onclick = async () => {
      const form = modal.element.querySelector('form');
      const formData = new FormData(form);
      
      const contact = {
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        email: formData.get('email') || null,
        phone: formData.get('phone') || null,
        job_title: formData.get('job_title') || null,
        company_id: formData.get('company_id') || null
      };
      
      try {
        await API.createContact(contact);
        UI.toast('Contact created!', 'success');
        modal.close();
        this.renderTable();
      } catch (error) {
        console.error('Error creating contact:', error);
        UI.toast('Error creating contact', 'error');
      }
    };
  },
  
  getFormHtml(contact = null, companyId = null) {
    const companies = Store.data.companies;
    
    return `
      <form class="form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">First Name *</label>
            <input type="text" name="first_name" class="form-input" required 
                   value="${contact?.first_name || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Last Name *</label>
            <input type="text" name="last_name" class="form-input" required 
                   value="${contact?.last_name || ''}">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" name="email" class="form-input" 
                 value="${contact?.email || ''}">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" name="phone" class="form-input" 
                   value="${contact?.phone || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Job Title</label>
            <input type="text" name="job_title" class="form-input" 
                   value="${contact?.job_title || ''}">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Company</label>
          <select name="company_id" class="form-select">
            <option value="">Select company...</option>
            ${companies.slice(0, 100).map(c => `
              <option value="${c.id}" ${(contact?.company_id === c.id || companyId === c.id) ? 'selected' : ''}>
                ${UI.escapeHtml(c.name)}
              </option>
            `).join('')}
          </select>
        </div>
      </form>
    `;
  },
  
  async showDetail(contactId) {
    const contact = Store.getContactById(contactId);
    if (!contact) {
      UI.toast('Contact not found', 'error');
      return;
    }
    
    const company = Store.getCompanyById(contact.company_id);
    const deals = Store.data.deals.filter(d => d.contact_id === contactId);
    const activities = Store.data.activities.filter(a => a.contact_id === contactId);
    
    const modal = UI.modal({
      title: `${contact.first_name} ${contact.last_name}`,
      size: 'modal-lg',
      content: `
        <div class="contact-detail">
          <div class="contact-header">
            <div class="contact-avatar-lg">${UI.getInitials(`${contact.first_name} ${contact.last_name}`)}</div>
            <div>
              <h3>${contact.first_name} ${contact.last_name}</h3>
              <p class="text-gray-500">${contact.job_title || ''} ${company ? `at ${company.name}` : ''}</p>
            </div>
          </div>
          
          <div class="contact-quick-info">
            <div class="info-item">
              <span class="info-label">Email</span>
              <span class="info-value">${contact.email ? `<a href="mailto:${contact.email}">${contact.email}</a>` : '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Phone</span>
              <span class="info-value">${contact.phone ? `<a href="tel:${contact.phone}">${UI.formatPhone(contact.phone)}</a>` : '-'}</span>
            </div>
          </div>
          
          <div class="contact-actions">
            <button class="btn btn-secondary" onclick="SMS.startConversation('${contact.phone}')">
              💬 Send SMS
            </button>
            <button class="btn btn-secondary" onclick="Deals.showCreateModal('${contact.company_id}')">
              💼 Create Deal
            </button>
            <button class="btn btn-secondary" onclick="Tasks.showCreateModal(null, '${contactId}')">
              ✅ Add Task
            </button>
          </div>
          
          <!-- Deals -->
          <h4 class="mt-6 mb-3">Deals (${deals.length})</h4>
          ${deals.length === 0 ? '<p class="text-gray-400">No deals</p>' : `
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
          
          <!-- Activity -->
          <h4 class="mt-6 mb-3">Activity</h4>
          ${activities.length === 0 ? '<p class="text-gray-400">No activity</p>' : `
            <div class="activity-list">
              ${activities.slice(0, 5).map(a => `
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
      `,
      footer: `
        <button class="btn btn-secondary" data-action="edit">Edit</button>
        <button class="btn btn-secondary" data-action="close">Close</button>
      `
    });
    
    modal.element.querySelector('[data-action="close"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="edit"]').onclick = () => {
      modal.close();
      this.showEditModal(contactId);
    };
  },
  
  showEditModal(contactId) {
    const contact = Store.getContactById(contactId);
    if (!contact) return;
    
    const modal = UI.modal({
      title: 'Edit Contact',
      content: this.getFormHtml(contact),
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="save">Save Changes</button>
      `
    });
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="save"]').onclick = async () => {
      const form = modal.element.querySelector('form');
      const formData = new FormData(form);
      
      const updates = {
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        email: formData.get('email') || null,
        phone: formData.get('phone') || null,
        job_title: formData.get('job_title') || null,
        company_id: formData.get('company_id') || null
      };
      
      try {
        await API.updateContact(contactId, updates);
        UI.toast('Contact updated!', 'success');
        modal.close();
        this.renderTable();
      } catch (error) {
        console.error('Error updating contact:', error);
        UI.toast('Error updating contact', 'error');
      }
    };
  }
};

// Add CSS
const contactStyles = document.createElement('style');
contactStyles.textContent = `
  .contact-avatar-sm { width: 32px; height: 32px; border-radius: var(--radius-full); background: var(--joe-orange); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.75rem; }
  .contact-avatar-lg { width: 64px; height: 64px; border-radius: var(--radius-full); background: var(--joe-orange); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.5rem; }
  .contact-header { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-6); }
  .contact-quick-info { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-6); padding: var(--space-4); background: var(--gray-50); border-radius: var(--radius-lg); }
  .contact-actions { display: flex; gap: var(--space-2); }
`;
document.head.appendChild(contactStyles);

// Export
window.Contacts = Contacts;
