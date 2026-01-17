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
  },
  
  initGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;
    
    searchInput.onfocus = () => {
      searchInput.blur();
      if (UI.toggleCommandPalette) UI.toggleCommandPalette();
    };
  }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); if(window.lucide) lucide.createIcons(); });
window.App = App;
