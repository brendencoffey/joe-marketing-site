// ============================================
// CONFIG - Supabase and API Configuration
// ============================================

const CONFIG = {
  SUPABASE_URL: 'https://vpnoaxpmhuknyaxcyxsu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbm9heHBtaHVrbnlheGN5eHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2OTQ1MjIsImV4cCI6MjA0MjI3MDUyMn0.nie8VWiYxgSuY6Jw9wDnXIuNnx6gfYohCLuL8b9W5Bw',
  MAPBOX_TOKEN: 'pk.eyJ1Ijoiam9lY29mZmVlIiwiYSI6ImNsczVxcnkwMjBkNGEycXFqOXdqOTR4Z2gifQ.VuHOdMy06S6yHPyr_VGbSw',
  APP_NAME: 'joe CRM',
  ITEMS_PER_PAGE: 50
};

// Initialize Supabase client - use window.supabase explicitly
const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Export globally
window.CONFIG = CONFIG;
window.db = db;
