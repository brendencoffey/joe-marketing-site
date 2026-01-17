// ============================================
// AUTH - Google OAuth Authentication
// ============================================

const Auth = {
  // Initialize auth
  async init() {
    // Check for existing session
    const { data: { session } } = await db.auth.getSession();
    
    if (session) {
      await this.handleSession(session);
    }
    
    // Listen for auth changes
    db.auth.onAuthStateChange(async (event, session) => {
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
    Store.user = session.user;
    
    // Find team member by email
    const teamMember = await this.getTeamMember(session.user.email);
    
    if (!teamMember) {
      UI.toast('Access denied. Your email is not registered.', 'error');
      await this.signOut();
      return;
    }
    
    Store.teamMember = teamMember;
    
    // Update UI
    this.updateUserUI();
    
    // Show app, hide auth
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    // Load data
    await API.fetchAll();
    
    // Subscribe to realtime changes
    API.subscribeToChanges();
    
    // Navigate to current page
    Router.init();
  },
  
  // Get team member
  async getTeamMember(email) {
    const { data, error } = await db.from('team_members')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      console.error('Team member not found:', email);
      return null;
    }
    
    return data;
  },
  
  // Update user UI
  updateUserUI() {
    const user = Store.user;
    const teamMember = Store.teamMember;
    
    if (!user || !teamMember) return;
    
    // Update avatar
    const avatarImg = document.getElementById('user-avatar');
    avatarImg.src = teamMember.avatar_url || user.user_metadata?.avatar_url || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(teamMember.name)}&background=F97316&color=fff`;
    avatarImg.alt = teamMember.name;
    
    // Update name and email
    document.getElementById('user-name').textContent = teamMember.name;
    document.getElementById('user-email').textContent = user.email;
  },
  
  // Sign in with Google
  async signInWithGoogle() {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/crm-2/',
        queryParams: {
          hd: 'joe.coffee' // Restrict to joe.coffee domain
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
    Store.reset();
    
    // Show auth, hide app
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  },
  
  // Check if user is admin
  isAdmin() {
    return Store.teamMember?.role === 'admin';
  },
  
  // Check if user can perform action
  can(action) {
    const role = Store.teamMember?.role;
    
    // Admins can do everything
    if (role === 'admin') return true;
    
    // Role-based permissions
    const permissions = {
      create_deal: ['admin', 'sales_lead', 'sales', 'success'],
      edit_deal: ['admin', 'sales_lead', 'sales', 'success', 'onboarding'],
      delete_deal: ['admin', 'sales_lead'],
      manage_team: ['admin'],
      manage_settings: ['admin'],
      view_all_deals: ['admin', 'sales_lead', 'success'],
      send_sms: ['admin', 'sales_lead', 'sales', 'success', 'onboarding'],
      manage_sequences: ['admin', 'nurture']
    };
    
    return permissions[action]?.includes(role) || false;
  }
};

// Export
window.Auth = Auth;
