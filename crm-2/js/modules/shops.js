// ============================================
// SHOPS MODULE
// ============================================

const Shops = {
  map: null,
  markers: [],
  
  render(params = {}) {
    this.renderFilters();
    this.renderTable();
  },
  
  renderFilters() {
    const page = document.getElementById('page-shops');
    
    if (!document.getElementById('shops-filters')) {
      const filtersHtml = `
        <div id="shops-filters" class="page-filters" style="margin-top: 1rem;">
          <input type="text" id="shops-search" class="form-input" placeholder="Search shops..." style="width: 250px;">
          <select id="shops-state-filter" class="form-select">
            <option value="">All States</option>
            ${this.getStates().map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
          <select id="shops-type-filter" class="form-select">
            <option value="">All Types</option>
            ${Store.data.icpTypes.map(t => `<option value="${t.slug}">${t.name}</option>`).join('')}
          </select>
          <select id="shops-partner-filter" class="form-select">
            <option value="">All</option>
            <option value="true">Partners</option>
            <option value="false">Prospects</option>
          </select>
          <select id="shops-online-filter" class="form-select">
            <option value="">All</option>
            <option value="true">Has Online Ordering</option>
            <option value="false">No Online Ordering</option>
          </select>
        </div>
      `;
      page.querySelector('.page-header').insertAdjacentHTML('afterend', filtersHtml);
      
      // Add event listeners
      document.getElementById('shops-search').oninput = UI.debounce(() => this.renderTable(), 300);
      ['shops-state-filter', 'shops-type-filter', 'shops-partner-filter', 'shops-online-filter'].forEach(id => {
        document.getElementById(id).onchange = () => this.renderTable();
      });
    }
  },
  
  getStates() {
    const states = new Set();
    Store.data.shops.forEach(s => {
      if (s.state_code) states.add(s.state_code);
      if (s.state) states.add(s.state);
    });
    return Array.from(states).sort();
  },
  
  renderTable() {
    const page = document.getElementById('page-shops');
    let tableContainer = page.querySelector('.data-table');
    
    if (!tableContainer) {
      tableContainer = document.createElement('div');
      tableContainer.className = 'data-table';
      page.appendChild(tableContainer);
    }
    
    // Apply filters
    let shops = this.getFilteredShops();
    
    // Limit for performance
    const totalCount = shops.length;
    shops = shops.slice(0, 100);
    
    if (shops.length === 0) {
      tableContainer.innerHTML = UI.emptyState('☕', 'No shops found', 'Try a different filter');
      return;
    }
    
    tableContainer.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Shop</th>
            <th>Location</th>
            <th>Type</th>
            <th>Rating</th>
            <th>Status</th>
            <th>Online Ordering</th>
          </tr>
        </thead>
        <tbody>
          ${shops.map(shop => `
            <tr onclick="Shops.showDetail('${shop.id}')">
              <td>
                <div class="font-medium">${UI.escapeHtml(shop.name)}</div>
                ${shop.website ? `<div class="text-xs text-gray-400 truncate" style="max-width: 200px;">${shop.website}</div>` : ''}
              </td>
              <td>${[shop.city, shop.state_code || shop.state].filter(Boolean).join(', ') || '-'}</td>
              <td>
                ${shop.shop_type ? `<span class="badge badge-blue">${shop.shop_type}</span>` : '-'}
              </td>
              <td>
                ${shop.google_rating ? `
                  <span class="rating">
                    ⭐ ${shop.google_rating.toFixed(1)}
                    ${shop.google_reviews ? `<span class="text-gray-400">(${shop.google_reviews})</span>` : ''}
                  </span>
                ` : '-'}
              </td>
              <td>
                ${shop.is_joe_partner ? 
                  '<span class="badge badge-green">Partner</span>' : 
                  '<span class="badge badge-gray">Prospect</span>'}
              </td>
              <td>
                ${shop.has_online_ordering ? 
                  `<span class="badge badge-yellow">${shop.ordering_platform || 'Yes'}</span>` : 
                  '<span class="text-gray-400">No</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="table-footer">
        Showing ${shops.length} of ${totalCount} shops
      </div>
    `;
  },
  
  getFilteredShops() {
    const search = document.getElementById('shops-search')?.value?.toLowerCase() || '';
    const stateFilter = document.getElementById('shops-state-filter')?.value || '';
    const typeFilter = document.getElementById('shops-type-filter')?.value || '';
    const partnerFilter = document.getElementById('shops-partner-filter')?.value || '';
    const onlineFilter = document.getElementById('shops-online-filter')?.value || '';
    
    let shops = Store.data.shops;
    
    if (search) {
      shops = shops.filter(s => 
        s.name?.toLowerCase().includes(search) ||
        s.city?.toLowerCase().includes(search)
      );
    }
    if (stateFilter) {
      shops = shops.filter(s => 
        s.state_code === stateFilter || s.state === stateFilter
      );
    }
    if (typeFilter) {
      shops = shops.filter(s => s.shop_type === typeFilter);
    }
    if (partnerFilter !== '') {
      shops = shops.filter(s => String(s.is_joe_partner) === partnerFilter);
    }
    if (onlineFilter !== '') {
      shops = shops.filter(s => String(!!s.has_online_ordering) === onlineFilter);
    }
    
    return shops;
  },
  
  showCreateModal() {
    const modal = UI.modal({
      title: 'Add Shop',
      content: this.getFormHtml(),
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="save">Add Shop</button>
      `
    });
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="save"]').onclick = async () => {
      // Implementation for creating shop
      UI.toast('Shop creation coming soon', 'info');
      modal.close();
    };
  },
  
  getFormHtml(shop = null) {
    return `
      <form class="form">
        <div class="form-group">
          <label class="form-label">Shop Name *</label>
          <input type="text" name="name" class="form-input" required 
                 value="${shop?.name || ''}" placeholder="Coffee Shop Name">
        </div>
        
        <div class="form-group">
          <label class="form-label">Address</label>
          <input type="text" name="address" class="form-input" 
                 value="${shop?.address || ''}">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">City</label>
            <input type="text" name="city" class="form-input" 
                   value="${shop?.city || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">State</label>
            <input type="text" name="state" class="form-input" 
                   value="${shop?.state || ''}" maxlength="2">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" name="phone" class="form-input" 
                   value="${shop?.phone || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Website</label>
            <input type="url" name="website" class="form-input" 
                   value="${shop?.website || ''}">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Shop Type</label>
          <select name="shop_type" class="form-select">
            <option value="">Select type...</option>
            ${Store.data.icpTypes.map(t => `
              <option value="${t.slug}" ${shop?.shop_type === t.slug ? 'selected' : ''}>
                ${t.name}
              </option>
            `).join('')}
          </select>
        </div>
      </form>
    `;
  },
  
  async showDetail(shopId) {
    const shop = Store.getShopById(shopId);
    if (!shop) {
      UI.toast('Shop not found', 'error');
      return;
    }
    
    const modal = UI.modal({
      title: shop.name,
      size: 'modal-lg',
      content: `
        <div class="shop-detail">
          <!-- Quick Info -->
          <div class="shop-quick-info">
            <div class="info-item">
              <span class="info-label">Address</span>
              <span class="info-value">${shop.address || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Location</span>
              <span class="info-value">${[shop.city, shop.state_code || shop.state].filter(Boolean).join(', ') || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Phone</span>
              <span class="info-value">${shop.phone ? UI.formatPhone(shop.phone) : '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Website</span>
              <span class="info-value">
                ${shop.website ? `<a href="${shop.website}" target="_blank" class="text-blue-500">Visit →</a>` : '-'}
              </span>
            </div>
          </div>
          
          <div class="shop-quick-info">
            <div class="info-item">
              <span class="info-label">Google Rating</span>
              <span class="info-value">
                ${shop.google_rating ? `⭐ ${shop.google_rating.toFixed(1)} (${shop.google_reviews || 0} reviews)` : '-'}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Yelp Rating</span>
              <span class="info-value">
                ${shop.yelp_rating ? `⭐ ${shop.yelp_rating.toFixed(1)} (${shop.yelp_reviews || 0} reviews)` : '-'}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Online Ordering</span>
              <span class="info-value">
                ${shop.has_online_ordering ? 
                  `<span class="badge badge-green">${shop.ordering_platform || 'Yes'}</span>` : 
                  '<span class="badge badge-gray">No</span>'}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Status</span>
              <span class="info-value">
                ${shop.is_joe_partner ? 
                  '<span class="badge badge-green">joe Partner</span>' : 
                  '<span class="badge badge-gray">Prospect</span>'}
              </span>
            </div>
          </div>
          
          <!-- Social Links -->
          ${shop.instagram || shop.facebook ? `
            <div class="shop-socials">
              ${shop.instagram ? `<a href="https://instagram.com/${shop.instagram}" target="_blank" class="btn btn-secondary btn-sm">📷 Instagram</a>` : ''}
              ${shop.facebook ? `<a href="${shop.facebook}" target="_blank" class="btn btn-secondary btn-sm">👤 Facebook</a>` : ''}
            </div>
          ` : ''}
          
          <!-- Actions -->
          <div class="shop-actions mt-6">
            <button class="btn btn-primary" onclick="Deals.showCreateModal()">
              💼 Create Deal
            </button>
            <button class="btn btn-secondary" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name + ' ' + shop.city)}', '_blank')">
              🗺️ View on Map
            </button>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="close">Close</button>
      `
    });
    
    modal.element.querySelector('[data-action="close"]').onclick = () => modal.close();
  }
};

// Add CSS
const shopStyles = document.createElement('style');
shopStyles.textContent = `
  .shop-quick-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-4); padding: var(--space-4); background: var(--gray-50); border-radius: var(--radius-lg); }
  .shop-socials { display: flex; gap: var(--space-2); }
  .shop-actions { display: flex; gap: var(--space-2); }
  .rating { display: flex; align-items: center; gap: var(--space-1); }
`;
document.head.appendChild(shopStyles);

// Export
window.Shops = Shops;
