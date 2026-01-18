// ============================================
// ROUTER - SPA Navigation
// ============================================

const Router = {
  routes: {
    'dashboard': { title: 'Dashboard', module: 'Dashboard' },
    'pipeline': { title: 'Pipeline', module: 'Pipeline' },
    'deals': { title: 'Deals', module: 'Deals' },
    'companies': { title: 'Companies', module: 'Companies' },
    'contacts': { title: 'Contacts', module: 'Contacts' },
    'shops': { title: 'Shops', module: 'Shops' },
    'tasks': { title: 'Tasks', module: 'Tasks' },
    'sms': { title: 'SMS Inbox', module: 'SMS' },
    'meetings': { title: 'Meetings', module: 'Meetings' },
    'sequences': { title: 'Sequences', module: 'Sequences' },
    'settings': { title: 'Settings', module: 'Settings' }
  },

  // Initialize router
  init() {
    // Handle initial route
    this.handleRoute();

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());

    // Setup nav clicks
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.navigate(page);
      });
    });
  },

  // Navigate to page
  navigate(path, params = {}) {
    let hash = `#${path}`;
    if (Object.keys(params).length > 0) {
      const query = new URLSearchParams(params).toString();
      hash += `?${query}`;
    }
    window.location.hash = hash;
  },

  // Handle route change
  handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const [pathWithId, queryString] = hash.split('?');
    
    // Parse path - handle both "deals" and "deals/123-uuid"
    const pathParts = pathWithId.split('/');
    const page = pathParts[0];
    const id = pathParts[1] || null;
    
    // Parse query params
    const queryParams = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};
    
    // Combine id and query params
    const params = { ...queryParams };
    if (id) {
      params.id = id;
    }

    const route = this.routes[page];
    if (!route) {
      this.navigate('dashboard');
      return;
    }

    // Update store
    Store.set('ui.currentPage', page);

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Update page title
    const titleEl = document.getElementById('page-title');
    if (titleEl) {
      titleEl.textContent = route.title;
    }

    // Show page
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Update main action button
    this.updateMainActionButton(page);

    // Call module render with params
    const moduleName = route.module;
    if (window[moduleName] && typeof window[moduleName].render === 'function') {
      window[moduleName].render(params);
      if (window.lucide) lucide.createIcons();
    }
  },

  // Update main action button based on page
  updateMainActionButton(page) {
    const btn = document.getElementById('main-action-btn');
    if (!btn) return;

    const actions = {
      'dashboard': { text: 'New Deal', icon: 'plus', action: () => Deals.showNewDealModal?.() },
      'pipeline': { text: 'New Deal', icon: 'plus', action: () => Deals.showNewDealModal?.() },
      'deals': { text: 'New Deal', icon: 'plus', action: () => Deals.showNewDealModal?.() },
      'companies': { text: 'New Company', icon: 'plus', action: () => Companies.showCreateModal?.() },
      'contacts': { text: 'New Contact', icon: 'plus', action: () => Contacts.showCreateModal?.() },
      'shops': { text: 'Add Shop', icon: 'plus', action: () => Shops.showCreateModal?.() },
      'tasks': { text: 'New Task', icon: 'plus', action: () => Tasks.showCreateModal?.() },
      'sms': { text: 'New Message', icon: 'message', action: () => SMS?.showNewConversation?.() },
      'meetings': { text: 'Schedule', icon: 'calendar', action: () => Meetings?.showScheduleModal?.() },
      'sequences': { text: 'New Sequence', icon: 'plus', action: () => Sequences?.showCreateModal?.() },
      'settings': { text: 'Save Changes', icon: 'check', action: () => Settings?.save?.() }
    };

    const config = actions[page] || actions['dashboard'];

    btn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        ${config.icon === 'plus' ? '<path d="M12 4v16m-8-8h16"/>' :
          config.icon === 'message' ? '<path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>' :
          config.icon === 'calendar' ? '<path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>' :
          '<path d="M5 13l4 4L19 7"/>'}
      </svg>
      ${config.text}
    `;
    btn.onclick = config.action;
  },

  // Get current params
  getParams() {
    const hash = window.location.hash.slice(1);
    const [pathWithId, queryString] = hash.split('?');
    const pathParts = pathWithId.split('/');
    const id = pathParts[1] || null;
    const queryParams = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};
    
    const params = { ...queryParams };
    if (id) params.id = id;
    return params;
  },

  // Update params without navigation
  updateParams(params) {
    const currentPage = Store.ui.currentPage;
    const currentParams = this.getParams();
    const newParams = { ...currentParams, ...params };

    // Remove null/undefined params
    Object.keys(newParams).forEach(key => {
      if (newParams[key] === null || newParams[key] === undefined || newParams[key] === '') {
        delete newParams[key];
      }
    });

    let hash = `#${currentPage}`;
    if (Object.keys(newParams).length > 0) {
      hash += `?${new URLSearchParams(newParams).toString()}`;
    }
    history.replaceState(null, '', hash);
  }
};

// Export
window.Router = Router;
