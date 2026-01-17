// ============================================
// AUTH - Google OAuth Authentication
// ============================================

const Auth = {
  async init() {
    console.log('Auth init starting...');
    
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) this.handleLogin(session.user);
    
    db.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event);
      if (event === 'SIGNED_IN' && session?.user) this.handleLogin(session.user);
      if (event === 'SIGNED_OUT') location.reload();
    });
  },
  
  handleLogin(user) {
    console.log('handleLogin:', user.email);
    if (!user.email?.endsWith('@joe.coffee')) {
      console.warn('User not from joe.coffee domain');
      db.auth.signOut();
      return;
    }
    
    Store.user = {
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
      avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture
    };
    
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    
    // Start the app
    if (typeof App !== 'undefined' && App.startApp) {
      App.startApp();
    }
  },
  
  async signInWithGoogle() {
    console.log('Starting Google sign in...');
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/crm-2/',
        queryParams: { hd: 'joe.coffee' }
      }
    });
    if (error) console.error('Sign in error:', error);
  },
  
  async signOut() {
    await db.auth.signOut();
  }
};

window.Auth = Auth;
