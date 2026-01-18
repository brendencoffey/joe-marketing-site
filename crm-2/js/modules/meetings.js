// ============================================
// MEETINGS MODULE
// ============================================

const Meetings = {
  async render(params = {}) {
    await this.loadData();
    this.renderTabs();
    this.renderList();
  },
  
  async loadData() {
    // Load meeting types
    const { data: types } = await db
      .from('meeting_types')
      .select('*, team_members(name, email)')
      .eq('is_active', true)
      .order('name');
    
    if (types) Store.data.meetingTypes = types;
    console.log('Loaded meeting types:', types?.length);
    
    // Load bookings
    const { data: bookings } = await db
      .from('bookings')
      .select('*, meeting_types(name, duration_minutes), team_members(name), contacts(first_name, last_name)')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(50);
    
    if (bookings) Store.data.bookings = bookings;
  },
  
  renderTabs() {
    const container = document.getElementById('meetings-tabs');
    if (!container) return;
    
    container.innerHTML = `
      <button class="deal-tab active" data-tab="upcoming">Upcoming</button>
      <button class="deal-tab" data-tab="types">Meeting Types</button>
      <button class="deal-tab" data-tab="settings">Booking Settings</button>
    `;
    
    container.querySelectorAll('.deal-tab').forEach(tab => {
      tab.onclick = () => {
        container.querySelectorAll('.deal-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderList(tab.dataset.tab);
      };
    });
  },
  
  renderList(view = 'upcoming') {
    const container = document.getElementById('meetings-list');
    if (!container) return;
    
    if (view === 'upcoming') {
      this.renderUpcoming(container);
    } else if (view === 'types') {
      this.renderTypes(container);
    } else if (view === 'settings') {
      this.renderSettings(container);
    }
    
    if (window.lucide) lucide.createIcons();
  },
  
  renderUpcoming(container) {
    const bookings = Store.data.bookings || [];
    
    if (!bookings.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📅</div>
        <h3>No upcoming meetings</h3>
        <p>Meetings booked through your booking links will appear here</p>
      </div>`;
      return;
    }
    
    container.innerHTML = `<div class="meetings-grid">
      ${bookings.map(b => `
        <div class="meeting-card">
          <div class="meeting-datetime">
            <div class="meeting-date">${new Date(b.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <div class="meeting-time">${new Date(b.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
          </div>
          <div class="meeting-details">
            <div class="meeting-title">${UI.escapeHtml(b.meeting_types?.name || 'Meeting')}</div>
            <div class="meeting-guest">${b.contacts ? `${b.contacts.first_name} ${b.contacts.last_name || ''}` : b.guest_name || 'Guest'}</div>
            <div class="meeting-duration">${b.duration_minutes || b.meeting_types?.duration_minutes || 30} min</div>
          </div>
          <div class="meeting-actions">
            ${b.google_meet_link ? `<a href="${b.google_meet_link}" target="_blank" class="btn btn-primary btn-sm"><i data-lucide="video"></i> Join</a>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="Meetings.cancel('${b.id}')"><i data-lucide="x"></i></button>
          </div>
        </div>
      `).join('')}
    </div>`;
  },
  
  renderTypes(container) {
    const types = Store.data.meetingTypes || [];
    
    container.innerHTML = `
      <div class="types-header" style="margin-bottom:1rem">
        <button class="btn btn-primary" onclick="Meetings.createType()"><i data-lucide="plus"></i> New Meeting Type</button>
      </div>
      ${!types.length ? `<div class="empty-state"><p>No meeting types configured</p></div>` : `
        <div class="types-grid">
          ${types.map(t => `
            <div class="type-card" style="border-left: 4px solid ${t.color || '#F97316'}">
              <div class="type-header">
                <h3>${UI.escapeHtml(t.name)}</h3>
                <span class="badge">${t.duration_minutes} min</span>
              </div>
              <p class="type-desc">${UI.escapeHtml(t.description || '')}</p>
              <div class="type-owner">
                <i data-lucide="user"></i> ${t.team_members?.name || 'Unassigned'}
              </div>
              <div class="type-link">
                <code>joe.coffee/book/${t.team_members?.email?.split('@')[0] || 'team'}/${t.slug}</code>
                <button class="btn btn-ghost btn-sm" onclick="Meetings.copyLink('${t.team_members?.email?.split('@')[0] || 'team'}', '${t.slug}')">
                  <i data-lucide="copy"></i>
                </button>
              </div>
              <div class="type-actions">
                <button class="btn btn-ghost btn-sm" onclick="Meetings.editType('${t.id}')"><i data-lucide="edit-2"></i> Edit</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  },
  
  renderSettings(container) {
    container.innerHTML = `
      <div class="settings-card">
        <h3>Google Calendar Integration</h3>
        <p class="text-muted">Connect your Google Calendar to enable booking and availability</p>
        <button class="btn btn-secondary" onclick="Meetings.connectGoogle()">
          <i data-lucide="calendar"></i> Connect Google Calendar
        </button>
      </div>
      <div class="settings-card">
        <h3>Working Hours</h3>
        <p class="text-muted">Set your default availability for meetings</p>
        <div class="form-group">
          <label>Default Hours</label>
          <div style="display:flex;gap:1rem;align-items:center">
            <input type="time" class="form-input" value="09:00" style="width:auto">
            <span>to</span>
            <input type="time" class="form-input" value="17:00" style="width:auto">
          </div>
        </div>
      </div>
      <div class="settings-card">
        <h3>Buffer Time</h3>
        <p class="text-muted">Add buffer between meetings</p>
        <select class="form-select" style="width:auto">
          <option value="0">No buffer</option>
          <option value="5">5 minutes</option>
          <option value="10">10 minutes</option>
          <option value="15" selected>15 minutes</option>
          <option value="30">30 minutes</option>
        </select>
      </div>
    `;
  },
  
  copyLink(user, slug) {
    navigator.clipboard.writeText(`https://joe.coffee/book/${user}/${slug}`);
    UI.toast('Link copied!');
  },
  
  createType() { UI.toast('Meeting type editor coming soon'); },
  editType(id) { UI.toast('Meeting type editor coming soon'); },
  cancel(id) { UI.toast('Cancel flow coming soon'); },
  connectGoogle() { UI.toast('Google integration coming soon'); }
};

window.Meetings = Meetings;
