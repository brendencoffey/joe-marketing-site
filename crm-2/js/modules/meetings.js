// ============================================
// MEETINGS MODULE
// ============================================

const Meetings = {
  render(params = {}) {
    this.renderList();
  },
  
  renderList() {
    const page = document.getElementById('page-meetings');
    let container = page.querySelector('#meetings-content');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'meetings-content';
      page.appendChild(container);
    }
    
    // Get meetings from bookings table (if loaded)
    const meetings = Store.data.meetings || [];
    
    container.innerHTML = `
      <div class="meetings-tabs">
        <button class="tab-btn active" data-filter="upcoming">Upcoming</button>
        <button class="tab-btn" data-filter="past">Past</button>
        <button class="tab-btn" data-filter="all">All</button>
      </div>
      
      <div class="meetings-list" id="meetings-list">
        ${meetings.length === 0 ? 
          UI.emptyState('📅', 'No meetings scheduled', 'Meetings will appear here when scheduled') :
          meetings.map(m => this.renderMeeting(m)).join('')
        }
      </div>
      
      <div class="meeting-types-section mt-8">
        <h3 class="mb-4">Your Meeting Types</h3>
        <div class="meeting-types-grid" id="meeting-types-grid">
          ${this.renderMeetingTypes()}
        </div>
      </div>
    `;
    
    // Tab handlers
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterMeetings(btn.dataset.filter);
      };
    });
  },
  
  renderMeeting(meeting) {
    const isPast = new Date(meeting.scheduled_start) < new Date();
    
    return `
      <div class="meeting-item ${isPast ? 'past' : ''}">
        <div class="meeting-date">
          <div class="meeting-day">${new Date(meeting.scheduled_start).getDate()}</div>
          <div class="meeting-month">${new Date(meeting.scheduled_start).toLocaleDateString('en-US', { month: 'short' })}</div>
        </div>
        <div class="meeting-info">
          <div class="meeting-title">${UI.escapeHtml(meeting.title)}</div>
          <div class="meeting-time">
            ${new Date(meeting.scheduled_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            - ${new Date(meeting.scheduled_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
          ${meeting.attendees ? `
            <div class="meeting-attendees">
              ${meeting.attendees.map(a => a.email).join(', ')}
            </div>
          ` : ''}
        </div>
        <div class="meeting-actions">
          ${meeting.google_meet_id ? `
            <a href="https://meet.google.com/${meeting.google_meet_id}" target="_blank" class="btn btn-primary btn-sm">
              Join Meet
            </a>
          ` : ''}
          ${meeting.recording_url ? `
            <button class="btn btn-secondary btn-sm" onclick="Meetings.viewRecording('${meeting.id}')">
              View Recording
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },
  
  renderMeetingTypes() {
    const meetingTypes = Store.data.meetingTypes || [];
    const myTypes = meetingTypes.filter(mt => mt.team_member_id === Store.teamMember?.id);
    
    if (myTypes.length === 0) {
      return `
        <div class="empty-state">
          <p>No meeting types configured</p>
          <button class="btn btn-secondary mt-2" onclick="Meetings.createMeetingType()">
            + Create Meeting Type
          </button>
        </div>
      `;
    }
    
    return myTypes.map(mt => `
      <div class="meeting-type-card">
        <div class="meeting-type-color" style="background: ${mt.color || '#F97316'}"></div>
        <div class="meeting-type-info">
          <div class="meeting-type-name">${UI.escapeHtml(mt.name)}</div>
          <div class="meeting-type-duration">${mt.duration_minutes} minutes</div>
        </div>
        <div class="meeting-type-link">
          <input type="text" readonly value="${window.location.origin}/book/${Store.teamMember?.email?.split('@')[0]}/${mt.slug}" 
                 class="form-input text-sm">
          <button class="btn btn-secondary btn-sm" onclick="Meetings.copyLink(this)">Copy</button>
        </div>
      </div>
    `).join('');
  },
  
  filterMeetings(filter) {
    const now = new Date();
    const items = document.querySelectorAll('.meeting-item');
    
    items.forEach(item => {
      if (filter === 'all') {
        item.style.display = '';
      } else if (filter === 'upcoming') {
        item.style.display = item.classList.contains('past') ? 'none' : '';
      } else if (filter === 'past') {
        item.style.display = item.classList.contains('past') ? '' : 'none';
      }
    });
  },
  
  showScheduleModal() {
    const modal = UI.modal({
      title: 'Schedule Meeting',
      content: `
        <form class="form">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" name="title" class="form-input" required placeholder="Meeting title">
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input type="date" name="date" class="form-input" required>
            </div>
            <div class="form-group">
              <label class="form-label">Time *</label>
              <input type="time" name="time" class="form-input" required>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Duration</label>
            <select name="duration" class="form-select">
              <option value="15">15 minutes</option>
              <option value="30" selected>30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Attendee Email</label>
            <input type="email" name="attendee" class="form-input" placeholder="attendee@example.com">
          </div>
          
          <div class="form-group">
            <label class="form-label">Related Deal</label>
            <select name="deal_id" class="form-select">
              <option value="">None</option>
              ${Store.data.deals.slice(0, 50).map(d => `
                <option value="${d.id}">${UI.escapeHtml(d.name)}</option>
              `).join('')}
            </select>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="save">Schedule Meeting</button>
      `
    });
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="save"]').onclick = async () => {
      // TODO: Implement meeting scheduling via Google Calendar API
      UI.toast('Meeting scheduling coming soon', 'info');
      modal.close();
    };
  },
  
  viewRecording(meetingId) {
    // TODO: Implement recording viewer with transcript
    UI.toast('Recording viewer coming soon', 'info');
  },
  
  createMeetingType() {
    const modal = UI.modal({
      title: 'Create Meeting Type',
      content: `
        <form class="form">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input type="text" name="name" class="form-input" required placeholder="e.g., 30 Min Demo">
          </div>
          
          <div class="form-group">
            <label class="form-label">URL Slug *</label>
            <input type="text" name="slug" class="form-input" required placeholder="demo" pattern="[a-z0-9-]+">
            <div class="form-helper">lowercase letters, numbers, and dashes only</div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Duration (minutes)</label>
              <input type="number" name="duration" class="form-input" value="30" min="15" max="120">
            </div>
            <div class="form-group">
              <label class="form-label">Buffer (minutes)</label>
              <input type="number" name="buffer" class="form-input" value="15" min="0" max="60">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea name="description" class="form-textarea" rows="2" placeholder="Brief description..."></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">Color</label>
            <input type="color" name="color" class="form-input" value="#F97316" style="height: 40px;">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="save">Create</button>
      `
    });
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="save"]').onclick = async () => {
      // TODO: Implement meeting type creation
      UI.toast('Meeting type creation coming soon', 'info');
      modal.close();
    };
  },
  
  copyLink(btn) {
    const input = btn.previousElementSibling;
    input.select();
    document.execCommand('copy');
    UI.toast('Link copied!', 'success');
  }
};

// Add CSS
const meetingStyles = document.createElement('style');
meetingStyles.textContent = `
  .meetings-tabs { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
  .meetings-list { display: flex; flex-direction: column; gap: var(--space-3); }
  .meeting-item { display: flex; gap: var(--space-4); padding: var(--space-4); background: white; border-radius: var(--radius-lg); border: 1px solid var(--gray-200); }
  .meeting-item.past { opacity: 0.6; }
  .meeting-date { text-align: center; min-width: 50px; }
  .meeting-day { font-size: 1.5rem; font-weight: 700; }
  .meeting-month { font-size: 0.75rem; text-transform: uppercase; color: var(--gray-500); }
  .meeting-info { flex: 1; }
  .meeting-title { font-weight: 600; margin-bottom: var(--space-1); }
  .meeting-time { color: var(--gray-500); font-size: 0.875rem; }
  .meeting-attendees { font-size: 0.75rem; color: var(--gray-400); margin-top: var(--space-1); }
  .meeting-actions { display: flex; gap: var(--space-2); align-items: flex-start; }
  .meeting-types-grid { display: grid; gap: var(--space-4); }
  .meeting-type-card { display: flex; gap: var(--space-3); padding: var(--space-4); background: white; border-radius: var(--radius-lg); border: 1px solid var(--gray-200); }
  .meeting-type-color { width: 4px; border-radius: var(--radius-full); }
  .meeting-type-info { flex: 1; }
  .meeting-type-name { font-weight: 600; }
  .meeting-type-duration { font-size: 0.875rem; color: var(--gray-500); }
  .meeting-type-link { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
  .meeting-type-link input { flex: 1; font-size: 0.75rem; }
`;
document.head.appendChild(meetingStyles);

// Export
window.Meetings = Meetings;
