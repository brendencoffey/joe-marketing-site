// ============================================
// AUTH - Google OAuth Authentication
// ============================================

const Auth = {
  // Initialize auth
  async init() {
    console.log('Auth init starting...');
    
    // Let Supabase handle any URL tokens automatically
    const { data: { session }, error } = await db.auth.getSession();
    
    if (error) {
      console.error('Auth error:', error);
    }
    
    if (session) {
      console.log('Session found:', session.user.email);
      await this.handleSession(session);
    } else {
      console.log('No session found');
    }
    
    // Listen for auth changes
    db.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email);
      if (event === 'SIGNED_IN' && session) {
        await this.handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        this.handleSignOut();
      }
    });
    
    return !!session;
  },
  
  // Handle session
  async handleSession(session) {
    console.log('Handling session for:', session.user.email);
    Store.user = session.user;
    
    // Check if user email is from joe.coffee domain
    if (!session.user.email.endsWith('@joe.coffee')) {
      console.warn('User not from joe.coffee domain');
      await this.signOut();
      UI.toast('Access restricted to joe.coffee team members', 'error');
      return;
    }
    
    // Hide login, show app
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    
    // Clean URL if it has auth params
    if (window.location.hash || window.location.search.includes('code=')) {
      history.replaceState(null, '', window.location.pathname);
    }
    
    // Load user's team member record
    await this.loadTeamMember(session.user);
  },
  
  // Load team member data
  async loadTeamMember(user) {
    try {
      const { data, error } = await db
        .from('team_members')
        .select('*')
        .eq('email', user.email)
        .single();
      
      if (data) {
        Store.teamMember = data;
        console.log('Team member loaded:', data.name);
      }
    } catch (err) {
      console.log('Team member not found');
    }
  },
  
  // Sign in with Google
  async signInWithGoogle() {
    console.log('Starting Google sign in...');
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/crm-2/'
      }
    });
    
    if (error) {
      console.error('Sign in error:', error);
      UI.toast('Failed to sign in', 'error');
    }
  },
  
  // Sign out
  async signOut() {
    await db.auth.signOut();
    this.handleSignOut();
  },
  
  // Handle sign out
  handleSignOut() {
    Store.user = null;
    Store.teamMember = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
  }
};

// Export
window.Auth = Auth;
