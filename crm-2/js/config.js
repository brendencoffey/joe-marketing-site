// ============================================
// CONFIG - Supabase and API Configuration
// ============================================

const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://vpnoaxpmhuknyaxcyxsu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbm9heHBtaHVrbnlheGN5eHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2OTQ1MjIsImV4cCI6MjA0MjI3MDUyMn0.nie8VWiYxgSuY6Jw9wDnXIuNnx6gfYohCLuL8b9W5Bw',
  
  // Mapbox
  MAPBOX_TOKEN: 'pk.eyJ1Ijoiam9lY29mZmVlIiwiYSI6ImNsczVxcnkwMjBkNGEycXFqOXdqOTR4Z2gifQ.VuHOdMy06S6yHPyr_VGbSw',
  
  // Anthropic (for AI features)
  ANTHROPIC_API_KEY: '',
  
  // App settings
  APP_NAME: 'joe CRM',
  DEFAULT_PIPELINE: 'Sales',
  ITEMS_PER_PAGE: 50,
  
  // Feature flags
  FEATURES: {
    AI_BRIEFING: true,
    SMS_INBOX: true,
    MEETING_INTELLIGENCE: true,
    SEQUENCES: true,
    MAPBOX: true
  }
};

// Initialize Supabase client
const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Export for use in other modules
window.CONFIG = CONFIG;
window.db = db;
