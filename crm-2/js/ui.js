// ============================================
// UI - User Interface Utilities
// ============================================

const UI = {
  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  
  toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toasts');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-content">
        <div class="toast-title">${message}</div>
      </div>
      <div class="toast-close" onclick="this.parentElement.remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
    
    return toast;
  },
  
  // ==========================================
  // MODALS
  // ==========================================
  
  modal(options) {
    const { title, content, size = '', onClose, footer } = options;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    overlay.innerHTML = `
      <div class="modal ${size}">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;
    
    // Close handlers
    const close = () => {
      overlay.remove();
      if (onClose) onClose();
    };
    
    overlay.querySelector('.modal-close').onclick = close;
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };
    
    document.getElementById('modals').appendChild(overlay);
    
    // Focus first input
    const firstInput = overlay.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
    
    return { close, element: overlay };
  },
  
  confirm(message, onConfirm, onCancel) {
    const modal = this.modal({
      title: 'Confirm',
      content: `<p>${message}</p>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="confirm">Confirm</button>
      `
    });
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => {
      modal.close();
      if (onCancel) onCancel();
    };
    
    modal.element.querySelector('[data-action="confirm"]').onclick = () => {
      modal.close();
      if (onConfirm) onConfirm();
    };
  },
  
  // ==========================================
  // COMMAND PALETTE
  // ==========================================
  
  initCommandPalette() {
    const palette = document.getElementById('command-palette');
    const input = document.getElementById('command-input');
    const results = document.getElementById('command-results');
    
    // Open with Cmd+K
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggleCommandPalette();
      }
      if (e.key === 'Escape' && !palette.classList.contains('hidden')) {
        this.closeCommandPalette();
      }
    });
    
    // Close on overlay click
    palette.querySelector('.command-palette-overlay').onclick = () => {
      this.closeCommandPalette();
    };
    
    // Search on input
    input.oninput = () => this.searchCommandPalette(input.value);
    
    // Handle enter
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const active = results.querySelector('.command-item.active');
        if (active) active.click();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateCommandPalette(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateCommandPalette(-1);
      }
    };
  },
  
  toggleCommandPalette() {
    const palette = document.getElementById('command-palette');
    palette.classList.toggle('hidden');
    
    if (!palette.classList.contains('hidden')) {
      const input = document.getElementById('command-input');
      input.value = '';
      input.focus();
      this.searchCommandPalette('');
    }
  },
  
  closeCommandPalette() {
    document.getElementById('command-palette').classList.add('hidden');
  },
  
  async searchCommandPalette(query) {
    const results = document.getElementById('command-results');
    
    // Default commands
    const commands = [
      { icon: '📊', label: 'Go to Dashboard', shortcut: 'G D', action: () => Router.navigate('dashboard') },
      { icon: '📋', label: 'Go to Pipeline', shortcut: 'G P', action: () => Router.navigate('pipeline') },
      { icon: '💰', label: 'Go to Deals', shortcut: 'G E', action: () => Router.navigate('deals') },
      { icon: '🏢', label: 'Go to Companies', shortcut: 'G C', action: () => Router.navigate('companies') },
      { icon: '👥', label: 'Go to Contacts', shortcut: 'G O', action: () => Router.navigate('contacts') },
      { icon: '☕', label: 'Go to Shops', shortcut: 'G S', action: () => Router.navigate('shops') },
      { icon: '✅', label: 'Go to Tasks', shortcut: 'G T', action: () => Router.navigate('tasks') },
      { icon: '💬', label: 'Go to SMS', shortcut: 'G M', action: () => Router.navigate('sms') },
      { icon: '➕', label: 'New Deal', shortcut: 'N D', action: () => Deals.showCreateModal() },
      { icon: '➕', label: 'New Task', shortcut: 'N T', action: () => Tasks.showCreateModal() },
      { icon: '➕', label: 'New Contact', shortcut: 'N C', action: () => Contacts.showCreateModal() }
    ];
    
    let items = commands;
    
    if (query.length > 0) {
      // Filter commands
      items = commands.filter(c => 
        c.label.toLowerCase().includes(query.toLowerCase())
      );
      
      // Search data
      const searchResults = await API.searchAll(query);
      
      // Add deals
      searchResults.deals.forEach(deal => {
        items.push({
          icon: '💰',
          label: deal.name,
          type: 'Deal',
          action: () => Deals.showDetail(deal.id)
        });
      });
      
      // Add companies
      searchResults.companies.forEach(company => {
        items.push({
          icon: '🏢',
          label: company.name,
          type: 'Company',
          action: () => Companies.showDetail(company.id)
        });
      });
      
      // Add contacts
      searchResults.contacts.forEach(contact => {
        items.push({
          icon: '👤',
          label: `${contact.first_name} ${contact.last_name}`,
          type: 'Contact',
          action: () => Contacts.showDetail(contact.id)
        });
      });
    }
    
    results.innerHTML = items.map((item, i) => `
      <div class="command-item ${i === 0 ? 'active' : ''}" data-index="${i}">
        <span class="command-item-icon">${item.icon}</span>
        <span class="command-item-label">
          ${item.label}
          ${item.type ? `<span class="text-gray-400 text-xs ml-2">${item.type}</span>` : ''}
        </span>
        ${item.shortcut ? `
          <span class="command-item-shortcut">
            ${item.shortcut.split(' ').map(k => `<kbd>${k}</kbd>`).join('')}
          </span>
        ` : ''}
      </div>
    `).join('');
    
    // Add click handlers
    results.querySelectorAll('.command-item').forEach((el, i) => {
      el.onclick = () => {
        items[i].action();
        this.closeCommandPalette();
      };
    });
  },
  
  navigateCommandPalette(direction) {
    const results = document.getElementById('command-results');
    const items = results.querySelectorAll('.command-item');
    const active = results.querySelector('.command-item.active');
    
    if (!active) return;
    
    const currentIndex = parseInt(active.dataset.index);
    const newIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
    
    active.classList.remove('active');
    items[newIndex].classList.add('active');
    items[newIndex].scrollIntoView({ block: 'nearest' });
  },
  
  // ==========================================
  // HELPERS
  // ==========================================
  
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit'
    });
  },
  
  formatRelativeTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return this.formatDate(date);
  },
  
  formatCurrency(amount) {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  },
  
  formatNumber(num) {
    if (!num) return '0';
    return new Intl.NumberFormat('en-US').format(num);
  },
  
  formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7)}`;
    }
    return phone;
  },
  
  getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  },
  
  // Get badge class based on value
  getBadgeClass(type) {
    const classes = {
      new: 'badge-gray',
      contacted: 'badge-blue',
      qualified: 'badge-yellow',
      demo: 'badge-orange',
      proposal: 'badge-orange',
      won: 'badge-green',
      lost: 'badge-red',
      active: 'badge-green',
      churned: 'badge-red',
      high: 'badge-red',
      medium: 'badge-yellow',
      low: 'badge-gray',
      completed: 'badge-green',
      pending: 'badge-yellow',
      overdue: 'badge-red'
    };
    return classes[type] || 'badge-gray';
  },
  
  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // Generate a simple ID
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  },
  
  // Escape HTML
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  // Loading state
  showLoading(element) {
    element.classList.add('loading');
    element.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>' + element.innerHTML;
  },
  
  hideLoading(element) {
    element.classList.remove('loading');
    const overlay = element.querySelector('.loading-overlay');
    if (overlay) overlay.remove();
  },
  
  // Empty state
  emptyState(icon, title, text) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-text">${text}</div>
      </div>
    `;
  }
};

// Export
window.UI = UI;
