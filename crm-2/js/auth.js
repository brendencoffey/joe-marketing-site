// ============================================
// AUTH - Google OAuth Authentication
// ============================================

const Auth = {
  // Initialize auth
  async init() {
    // First, check if we're handling an OAuth callback (tokens in URL)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    
    if (accessToken) {
      console.log('Processing OAuth callback...');
      // Wait for Supabase to process the tokens
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Check for existing session
    const { data: { session }, error } = await db.auth.getSession();
    
    if (error) {
      console.error('Auth error:', error);
    }
    
    if (session) {
      console.log('Session found, handling...');
      await this.handleSession(session);
      // Clean up URL hash
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
      }
    }
    
    // Listen for auth changes
    db.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);
      if (event === 'SIGNED_IN' && session) {
        await this.handleSession(session);
        // Clean up URL hash
        if (window.location.hash) {
          history.replaceState(null, '', window.location.pathname);
        }
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
      console.log('Team member not found, creating...');
    }
  },
  
  // Sign in with Google
  async signInWithGoogle() {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/crm-2/',
        queryParams: {
          hd: 'joe.coffee'
        }
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
