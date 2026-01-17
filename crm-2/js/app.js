// ============================================
// APP - Main Application Entry Point
// ============================================

const App = {
  async init() {
    console.log('🚀 joe CRM 2.0 initializing...');
    
    // Setup UI components
    UI.initCommandPalette();
    
    // Setup global search
    this.initGlobalSearch();
    
    // Setup auth
    const isAuthenticated = await Auth.init();
    
    if (!isAuthenticated) {
      // Setup sign in button
      document.getElementById('google-signin-btn').onclick = () => Auth.signInWithGoogle();
      console.log('Waiting for authentication...');
    }
    
    console.log('✅ joe CRM 2.0 ready');
  },
  
  initGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    
    // Open command palette on focus
    searchInput.onfocus = () => {
      searchInput.blur();
      UI.toggleCommandPalette();
    };
    
    // Keyboard shortcut
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        UI.toggleCommandPalette();
      }
    };
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Export
window.App = App;
