// ============================================
// SETTINGS MODULE
// ============================================

const Settings = {
  currentSection: 'profile',
  
  render(params = {}) {
    // Get section from hash
    const hash = window.location.hash;
    if (hash.includes('/')) {
      this.currentSection = hash.split('/')[1] || 'profile';
    }
    
    this.updateNav();
    this.renderSection();
    
    // Setup nav clicks
    document.querySelectorAll('.settings-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const section = link.getAttribute('href').split('/')[1];
        this.currentSection = section;
        window.location.hash = `settings/${section}`;
        this.updateNav();
        this.renderSection();
      };
    });
  },
  
  updateNav() {
    document.querySelectorAll('.settings-link').forEach(link => {
      const section = link.getAttribute('href').split('/')[1];
      link.classList.toggle('active', section === this.currentSection);
    });
  },
  
  renderSection() {
    const container = document.getElementById('settings-content');
    
    switch (this.currentSection) {
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
        this.renderIcp(container);
        break;
      case 'territories':
        this.renderTerritories(container);
        break;
      case 'integrations':
        this.renderIntegrations(container);
        break;
      default:
        this.renderProfile(container);
    }
  },
  
  // ==========================================
  // PROFILE
  // ==========================================
  
  renderProfile(container) {
    const user = Store.teamMember;
    
    container.innerHTML = `
      <h3 class="text-lg font-semibold mb-6">Your Profile</h3>
      <form id="profile-form">
        <div class="grid gap-4" style="grid-template-columns: repeat(2, 1fr);">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" class="form-input" name="name" value="${UI.escapeHtml(user?.name || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" value="${UI.escapeHtml(user?.email || '')}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" class="form-input" name="phone" value="${UI.escapeHtml(user?.phone || '')}" placeholder="+1 (555) 123-4567">
          </div>
          <div class="form-group">
            <label class="form-label">Booking Link</label>
            <input type="url" class="form-input" name="booking_link" value="${UI.escapeHtml(user?.booking_link || '')}" placeholder="https://calendly.com/...">
          </div>
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Role</label>
          <input type="text" class="form-input" value="${UI.escapeHtml(user?.role || '')}" disabled>
        </div>
      </form>
    `;
  },
  
  // ==========================================
  // TEAM
  // ==========================================
  
  renderTeam(container) {
    const teamMembers = Store.data.teamMembers;
    
    container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-lg font-semibold">Team Members</h3>
        ${Auth.isAdmin() ? `<button class="btn btn-primary" onclick="Settings.showAddTeamMemberModal()">+ Add Member</button>` : ''}
      </div>
      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${teamMembers.map(tm => `
              <tr>
                <td class="flex items-center gap-3">
                  <img src="${tm.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(tm.name)}&background=F97316&color=fff`}" 
                       class="w-8 h-8 rounded-full">
                  ${UI.escapeHtml(tm.name)}
                </td>
                <td>${UI.escapeHtml(tm.email)}</td>
                <td><span class="badge badge-gray">${tm.role}</span></td>
                <td>${UI.escapeHtml(tm.department || '-')}</td>
                <td><span class="badge ${tm.is_active ? 'badge-green' : 'badge-gray'}">${tm.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },
  
  // ==========================================
  // PIPELINES
  // ==========================================
  
  renderPipelines(container) {
    const pipelines = Store.data.pipelines;
    const stages = Store.data.stages;
    
    container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-lg font-semibold">Pipelines & Stages</h3>
      </div>
      ${pipelines.map(pipeline => {
        const pipelineStages = stages.filter(s => s.pipeline_id === pipeline.id).sort((a, b) => a.position - b.position);
        return `
          <div class="mb-8">
            <h4 class="font-semibold mb-3">${UI.escapeHtml(pipeline.name)}</h4>
            <div class="flex gap-2 flex-wrap">
              ${pipelineStages.map(stage => `
                <div class="px-3 py-2 rounded-lg border flex items-center gap-2" style="border-color: ${stage.color}">
                  <span class="w-3 h-3 rounded-full" style="background: ${stage.color}"></span>
                  ${UI.escapeHtml(stage.name)}
                  ${stage.probability ? `<span class="text-xs text-gray-400">${stage.probability}%</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    `;
  },
  
  // ==========================================
  // ICP CRITERIA
  // ==========================================
  
  renderIcp(container) {
    const types = Store.data.icpTypes;
    const criteria = Store.data.icpCriteria;
    
    // Group criteria by category
    const byCategory = criteria.reduce((acc, c) => {
      if (!acc[c.category]) acc[c.category] = [];
      acc[c.category].push(c);
      return acc;
    }, {});
    
    container.innerHTML = `
      <h3 class="text-lg font-semibold mb-6">ICP Settings</h3>
      
      <div class="mb-8">
        <h4 class="font-semibold mb-3">Shop Types</h4>
        <div class="flex gap-2 flex-wrap">
          ${types.map(type => `
            <div class="px-3 py-2 rounded-lg border" style="border-color: ${type.color}; background: ${type.color}20">
              ${UI.escapeHtml(type.name)}
              <span class="text-xs text-gray-500 ml-2">Priority: ${type.priority}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div>
        <h4 class="font-semibold mb-3">Scoring Criteria</h4>
        ${Object.entries(byCategory).map(([category, items]) => `
          <div class="mb-6">
            <h5 class="text-sm font-medium text-gray-500 uppercase mb-2">${category.replace('_', ' ')}</h5>
            <div class="space-y-2">
              ${items.map(c => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span class="font-medium">${UI.escapeHtml(c.name)}</span>
                    <span class="text-sm text-gray-500 ml-2">${UI.escapeHtml(c.description || '')}</span>
                  </div>
                  <span class="badge ${c.is_positive ? 'badge-green' : 'badge-red'}">
                    ${c.weight > 0 ? '+' : ''}${c.weight}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },
  
  // ==========================================
  // TERRITORIES
  // ==========================================
  
  renderTerritories(container) {
    const territories = Store.data.territories;
    
    container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-lg font-semibold">Territories</h3>
      </div>
      <div class="space-y-4">
        ${territories.map(territory => {
          const owner = Store.getTeamMemberById(territory.team_member_id);
          return `
            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="flex justify-between items-center mb-2">
                <div class="font-semibold">${UI.escapeHtml(territory.name)}</div>
                <div class="flex items-center gap-2">
                  ${owner ? `
                    <img src="${owner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.name)}&size=24&background=F97316&color=fff`}" 
                         class="w-6 h-6 rounded-full">
                    <span>${owner.name}</span>
                  ` : '<span class="text-gray-400">Unassigned</span>'}
                </div>
              </div>
              <div class="flex gap-1 flex-wrap">
                ${(territory.states || []).map(state => `
                  <span class="px-2 py-1 bg-white rounded text-sm">${state}</span>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },
  
  // ==========================================
  // INTEGRATIONS
  // ==========================================
  
  renderIntegrations(container) {
    container.innerHTML = `
      <h3 class="text-lg font-semibold mb-6">Integrations</h3>
      <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
        <div class="p-6 border rounded-xl">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#4285F4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            </div>
            <div>
              <div class="font-semibold">Google Workspace</div>
              <div class="text-sm text-gray-500">Calendar, Meet, Drive</div>
            </div>
          </div>
          <span class="badge badge-green">Connected</span>
        </div>
        
        <div class="p-6 border rounded-xl">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#611f69"><path d="M6.527 14.514A1.973 1.973 0 018.5 12.54a1.974 1.974 0 011.973 1.974v4.946A1.973 1.973 0 018.5 21.433a1.973 1.973 0 01-1.973-1.973v-4.946zm-5.027.048c0-1.09.884-1.973 1.973-1.973h1.973v1.973a1.973 1.973 0 01-1.973 1.973 1.973 1.973 0 01-1.973-1.973z"/><path d="M9.473 6.527A1.973 1.973 0 0111.446 8.5a1.974 1.974 0 01-1.973 1.973H4.527A1.973 1.973 0 012.554 8.5a1.973 1.973 0 011.973-1.973h4.946zm-.048-5.027c1.09 0 1.973.884 1.973 1.973v1.973H9.425a1.973 1.973 0 01-1.973-1.973 1.973 1.973 0 011.973-1.973z"/><path d="M17.473 9.473A1.973 1.973 0 0115.5 11.446a1.974 1.974 0 01-1.973-1.973V4.527A1.973 1.973 0 0115.5 2.554a1.973 1.973 0 011.973 1.973v4.946zm5.027-.048c0 1.09-.884 1.973-1.973 1.973h-1.973V9.425a1.973 1.973 0 011.973-1.973 1.973 1.973 0 011.973 1.973z"/><path d="M14.527 17.473A1.973 1.973 0 0112.554 15.5a1.974 1.974 0 011.973-1.973h4.946a1.973 1.973 0 011.973 1.973 1.973 1.973 0 01-1.973 1.973h-4.946zm.048 5.027c-1.09 0-1.973-.884-1.973-1.973v-1.973h1.973a1.973 1.973 0 011.973 1.973 1.973 1.973 0 01-1.973 1.973z"/></svg>
            </div>
            <div>
              <div class="font-semibold">Slack</div>
              <div class="text-sm text-gray-500">Notifications & alerts</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm">Connect</button>
        </div>
        
        <div class="p-6 border rounded-xl">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-2xl">💬</div>
            <div>
              <div class="font-semibold">Twilio</div>
              <div class="text-sm text-gray-500">SMS messaging</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm">Configure</button>
        </div>
        
        <div class="p-6 border rounded-xl">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#F97316"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div>
              <div class="font-semibold">Stripe</div>
              <div class="text-sm text-gray-500">Payments & billing</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm">Configure</button>
        </div>
      </div>
    `;
  },
  
  // ==========================================
  // SAVE
  // ==========================================
  
  async save() {
    if (this.currentSection === 'profile') {
      const form = document.getElementById('profile-form');
      if (!form) return;
      
      const formData = new FormData(form);
      const updates = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        booking_link: formData.get('booking_link')
      };
      
      try {
        const { error } = await db.from('team_members')
          .update(updates)
          .eq('id', Store.teamMember.id);
        
        if (error) throw error;
        
        // Update local state
        Object.assign(Store.teamMember, updates);
        Store.updateItem('teamMembers', Store.teamMember.id, updates);
        
        UI.toast('Profile saved!', 'success');
      } catch (error) {
        console.error('Error saving profile:', error);
        UI.toast('Error saving profile', 'error');
      }
    }
  }
};

// Export
window.Settings = Settings;
