// ============================================
// CONFIG - Supabase and API Configuration
// ============================================

const CONFIG = {
  SUPABASE_URL: 'https://vpnoaxpmhuknyaxcyxsu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbm9heHBtaHVrbnlheGN5eHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NjkzNTMsImV4cCI6MjA4MjQ0NTM1M30.0JVwCaY-3nUHuJk49ibifQviT0LxBSdYXMslw9WIr9M',
  MAPBOX_TOKEN: 'pk.eyJ1IjoiYnJlbmRlbm1hcnRpbjA1IiwiYSI6ImNtanAwZWZidjJodjEza3E2NDR4b242bW8ifQ.CjDrXl01VxVoEg6jh81c5Q',
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
const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Export globally
window.CONFIG = CONFIG;
window.db = db;
