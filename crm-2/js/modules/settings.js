// ============================================
// SETTINGS MODULE
// ============================================

const Settings = {
  currentTab: 'profile',
  
  render(params = {}) {
    this.setupTabs();
    // Check if there's a specific section in params
    const section = params.section || 'profile';
    this.renderSection(section);
  },
  
  setupTabs() {
    const links = document.querySelectorAll('#page-settings .settings-link');
    links.forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Extract section from href like "#settings/profile"
        const href = link.getAttribute('href');
        const section = href.split('/')[1] || 'profile';
        this.renderSection(section);
      };
    });
  },
  
  renderSection(section) {
    this.currentTab = section;
    const container = document.getElementById('settings-content');
    if (!container) return;
    
    switch(section) {
      case 'profile':
        this.renderProfile(container);
        break;
      case 'team':
        this.renderTeam(container);
        break;
      case 'pipelines':
        this.renderPipelines(container);
        break;
      case 'icp':
        this.renderICPCriteria(container);
        break;
      case 'territories':
        this.renderTerritories(container);
        break;
      case 'integrations':
        this.renderIntegrations(container);
        break;
      default:
        container.innerHTML = '<p>Section not found</p>';
    }
  },
  
  renderProfile(container) {
    const user = Store.user || {};
    container.innerHTML = `
      <div class="settings-section">
        <h3>Your Profile</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="profile-name" class="form-input" value="${user.user_metadata?.full_name || ''}" placeholder="Your name">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" class="form-input" value="${user.email || ''}" disabled>
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" id="profile-phone" class="form-input" placeholder="+1 (555) 123-4567">
          </div>
          <div class="form-group">
            <label>Booking Link</label>
            <input type="url" id="profile-booking" class="form-input" placeholder="https://calendly.com/...">
          </div>
        </div>
        <button class="btn btn-primary" onclick="Settings.saveProfile()">Save Changes</button>
      </div>
    `;
  },
  
  renderTeam(container) {
    const members = Store.data.teamMembers || [];
    container.innerHTML = `
      <div class="settings-section">
        <h3>Team Members</h3>
        ${members.length === 0 ? '<p>No team members found.</p>' : `
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            ${members.map(m => `
              <tr>
                <td>${m.name}</td>
                <td>${m.email}</td>
                <td>${m.role || 'Member'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    `;
  },
  
  renderPipelines(container) {
    const pipelines = Store.data.pipelines || [];
    container.innerHTML = `
      <div class="settings-section">
        <h3>Pipelines</h3>
        <p>Configure your sales pipelines and stages.</p>
        ${pipelines.length === 0 ? '<p>No pipelines configured.</p>' : pipelines.map(p => `
          <div class="pipeline-card" style="margin-bottom:1rem;padding:1rem;border:1px solid #eee;border-radius:8px;">
            <strong>${p.name}</strong>
          </div>
        `).join('')}
      </div>
    `;
  },
  
  renderICPCriteria(container) {
    container.innerHTML = `
      <div class="settings-section">
        <h3>ICP Criteria</h3>
        <p>Define your Ideal Customer Profile criteria for lead scoring.</p>
      </div>
    `;
  },
  
  renderTerritories(container) {
    container.innerHTML = `
      <div class="settings-section">
        <h3>Territories</h3>
        <p>Configure sales territories and assignments.</p>
      </div>
    `;
  },
  
  renderIntegrations(container) {
    container.innerHTML = `
      <div class="settings-section">
        <h3>Integrations</h3>
        <p>Connect external services.</p>
      </div>
    `;
  },
  
  async saveProfile() {
    UI.toast('Profile saved!', 'success');
  }
};

window.Settings = Settings;
