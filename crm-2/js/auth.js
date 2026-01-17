// ============================================
// AUTH - Google OAuth Authentication
// ============================================

const Auth = {
  async init() {
    console.log('Auth init starting...');
    
    // Check if there are tokens in the URL hash (OAuth callback)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      console.log('OAuth callback detected, processing tokens...');
      // Supabase should auto-process, but let's give it a moment
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Set up auth state change listener
    db.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email);
      if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
        await this.handleSession(session);
        if (typeof App !== 'undefined' && App.startApp) {
          App.startApp();
        }
      } else if (event === 'SIGNED_OUT') {
        this.handleSignOut();
      }
    });
    
    // Check for existing session
    const { data: { session }, error } = await db.auth.getSession();
    
    if (error) console.error('Auth error:', error);
    
    if (session) {
      console.log('Session found:', session.user.email);
      await this.handleSession(session);
      return true;
    } else {
      console.log('No session found');
      return false;
    }
  },
  
  async handleSession(session) {
    if (!session) return;
    
    console.log('Handling session for:', session.user.email);
    Store.user = session.user;
    
    if (!session.user.email.endsWith('@joe.coffee')) {
      console.warn('User not from joe.coffee domain');
      await this.signOut();
      return;
    }
    
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    
    // Clean up URL hash
    if (window.location.hash && window.location.hash.includes('access_token')) {
      history.replaceState(null, '', window.location.pathname);
    }
  },
  
  async signInWithGoogle() {
    console.log('Starting Google sign in...');
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/crm-2/'
      }
    });
    if (error) console.error('Sign in error:', error);
  },
  
  async signOut() {
    await db.auth.signOut();
    this.handleSignOut();
  },
  
  handleSignOut() {
    Store.user = null;
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').classList.add('hidden');
  }
};

window.Auth = Auth;
