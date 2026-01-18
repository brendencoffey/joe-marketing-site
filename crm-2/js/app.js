// ============================================
// APP - Main Application Entry Point
// ============================================

const App = {
  async init() {
    console.log('🚀 joe CRM 2.0 initializing...');

    // Setup auth
    const isAuthenticated = await Auth.init();

    if (isAuthenticated) {
      this.startApp();
    } else {
      document.getElementById('google-signin-btn').onclick = () => Auth.signInWithGoogle();
      console.log('Waiting for authentication...');
    }

    console.log('✅ joe CRM 2.0 ready');
  },

  startApp() {
    console.log('Starting app...');

    // Initialize router
    Router.init();

    // Initialize command palette if it exists
    if (UI.initCommandPalette) UI.initCommandPalette();

    // Initialize global search
    this.initGlobalSearch();

    // Initialize main action button
    this.initMainActionButton();

    // Initialize Lucide icons
    this.refreshIcons();
  },

  initGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;

    searchInput.onfocus = () => {
      searchInput.blur();
      if (UI.toggleCommandPalette) UI.toggleCommandPalette();
    };
  },

  initMainActionButton() {
    const btn = document.getElementById('main-action-btn');
    if (!btn) return;

    btn.onclick = () => {
      // Determine action based on current page
      const hash = window.location.hash.split('/')[0];
      
      switch(hash) {
        case '#deals':
        case '#pipeline':
        case '#dashboard':
        case '':
          if (Deals?.showNewDealModal) {
            Deals.showNewDealModal();
          }
          break;
        case '#companies':
          if (Companies?.showNewCompanyModal) {
            Companies.showNewCompanyModal();
          } else {
            UI.toast('Coming soon');
          }
          break;
        case '#contacts':
          if (Contacts?.showNewContactModal) {
            Contacts.showNewContactModal();
          } else {
            UI.toast('Coming soon');
          }
          break;
        case '#tasks':
          if (Tasks?.showCreateModal) {
            Tasks.showCreateModal();
          } else {
            UI.toast('Coming soon');
          }
          break;
        default:
          if (Deals?.showNewDealModal) {
            Deals.showNewDealModal();
          }
      }
    };
  },

  // Update main action button text based on page
  updateMainActionButton(page) {
    const btn = document.getElementById('main-action-btn');
    if (!btn) return;

    const actions = {
      dashboard: { icon: 'plus', text: 'New Deal' },
      pipeline: { icon: 'plus', text: 'New Deal' },
      deals: { icon: 'plus', text: 'New Deal' },
      companies: { icon: 'plus', text: 'New Company' },
      contacts: { icon: 'plus', text: 'New Contact' },
      shops: { icon: 'plus', text: 'Add Shop' },
      tasks: { icon: 'plus', text: 'New Task' },
      sms: { icon: 'message-square', text: 'New Message' },
      meetings: { icon: 'calendar', text: 'Schedule' },
      sequences: { icon: 'plus', text: 'New Sequence' },
      settings: { icon: 'settings', text: 'Settings' }
    };

    const action = actions[page] || actions.dashboard;
    btn.innerHTML = `<i data-lucide="${action.icon}"></i> ${action.text}`;
    this.refreshIcons();
  },

  refreshIcons() {
    if (window.lucide) {
      lucide.createIcons();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  if (window.lucide) lucide.createIcons();
});

window.App = App;
