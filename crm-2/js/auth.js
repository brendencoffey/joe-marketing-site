// ============================================
// AUTH - Google OAuth Authentication
// ============================================

const Auth = {
  async init() {
    console.log('Auth init starting...');
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
    
    db.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email);
      if (event === 'SIGNED_IN' && session) {
        await this.handleSession(session);
        // Start the app after sign in
        App.startApp();
      } else if (event === 'SIGNED_OUT') {
        this.handleSignOut();
      }
    });
  },
  
  async handleSession(session) {
    console.log('Handling session for:', session.user.email);
    Store.user = session.user;
    
    if (!session.user.email.endsWith('@joe.coffee')) {
      console.warn('User not from joe.coffee domain');
      await this.signOut();
      return;
    }
    
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    
    if (window.location.hash) {
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
