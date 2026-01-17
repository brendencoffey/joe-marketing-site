// ============================================
// APP - Main Application Entry Point
// ============================================

const App = {
  async init() {
    console.log('🚀 joe CRM 2.0 initializing...');
    
    // Setup UI components
    UI.init();
    
    // Setup auth
    const isAuthenticated = await Auth.init();
    
    if (isAuthenticated) {
      // User is logged in - initialize the app
      this.startApp();
    } else {
      // Setup sign in button
      document.getElementById('google-signin-btn').onclick = () => Auth.signInWithGoogle();
      console.log('Waiting for authentication...');
    }
    
    console.log('✅ joe CRM 2.0 ready');
  },
  
  // Called after successful authentication
  startApp() {
    console.log('Starting app...');
    
    // Initialize router (handles navigation)
    Router.init();
    
    // Initialize global search
    this.initGlobalSearch();
    
    // Load initial data
    this.loadInitialData();
  },
  
  initGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;
    
    searchInput.onfocus = () => {
      searchInput.blur();
      UI.toggleCommandPalette();
    };
  },
  
  async loadInitialData() {
    console.log('Loading initial data...');
    try {
      // Load user's tasks count, recent activity, etc.
      await Promise.all([
        API.getMyTasks(),
        API.getRecentActivity()
      ]);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Export
window.App = App;
