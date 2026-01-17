// ============================================
// DASHBOARD MODULE
// ============================================

const Dashboard = {
  render() {
    this.renderStats();
    this.renderTasks();
    this.renderActivity();
    this.renderHotDeals();
    this.renderAiBriefing();
  },
  
  renderStats() {
    const stats = Store.getStats();
    const container = document.getElementById('dashboard-stats');
    
    const dealsChange = stats.newDealsLastMonth > 0 
      ? ((stats.newDealsThisMonth - stats.newDealsLastMonth) / stats.newDealsLastMonth * 100).toFixed(0)
      : 0;
    
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-label">Pipeline Value</div>
        <div class="stat-card-value">${UI.formatCurrency(stats.totalPipelineValue)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">New Deals (This Month)</div>
        <div class="stat-card-value">${stats.newDealsThisMonth}</div>
        <div class="stat-card-change ${dealsChange >= 0 ? 'positive' : 'negative'}">
          ${dealsChange >= 0 ? '↑' : '↓'} ${Math.abs(dealsChange)}% vs last month
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Won Deals</div>
        <div class="stat-card-value">${stats.wonDeals}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Pending Tasks</div>
        <div class="stat-card-value">${stats.pendingTasks}</div>
        ${stats.overdueTasks > 0 ? `
          <div class="stat-card-change negative">
            ${stats.overdueTasks} overdue
          </div>
        ` : ''}
      </div>
    `;
  },
  
  renderTasks() {
    const container = document.getElementById('my-tasks-list');
    const tasks = Store.getPendingTasks()
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5);
    
    if (tasks.length === 0) {
      container.innerHTML = UI.emptyState('✅', 'All caught up!', 'No pending tasks');
      return;
    }
    
    container.innerHTML = tasks.map(task => {
      const isOverdue = task.due_date && new Date(task.due_date) < new Date();
      const isToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
      
      return `
        <div class="task-item" data-id="${task.id}">
          <div class="task-checkbox" onclick="Dashboard.toggleTask('${task.id}')"></div>
          <div class="task-content">
            <div class="task-title">${UI.escapeHtml(task.title)}</div>
            <div class="task-meta">
              ${task.due_date ? `
                <span class="task-due ${isOverdue ? 'overdue' : ''} ${isToday ? 'today' : ''}">
                  ${isToday ? 'Today' : UI.formatDate(task.due_date)}
                </span>
              ` : ''}
              ${task.deal_id ? `<span>Deal</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },
  
  async toggleTask(taskId) {
    try {
      await API.completeTask(taskId);
      UI.toast('Task completed!', 'success');
      this.renderTasks();
      this.renderStats();
    } catch (error) {
      console.error('Error completing task:', error);
      UI.toast('Error completing task', 'error');
    }
  },
  
  renderActivity() {
    const container = document.getElementById('recent-activity-list');
    const activities = Store.data.activities.slice(0, 5);
    
    if (activities.length === 0) {
      container.innerHTML = UI.emptyState('📋', 'No recent activity', 'Activities will appear here');
      return;
    }
    
    const icons = {
      email: '📧',
      call: '📞',
      meeting: '🗓️',
      note: '📝',
      sms: '💬',
      stage_change: '🔄'
    };
    
    container.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <div class="activity-icon ${activity.activity_type}">
          ${icons[activity.activity_type] || '📋'}
        </div>
        <div class="activity-content">
          <div class="activity-text">${UI.escapeHtml(activity.notes || activity.activity_type)}</div>
          <div class="activity-time">${UI.formatRelativeTime(activity.created_at)}</div>
        </div>
      </div>
    `).join('');
  },
  
  renderHotDeals() {
    const container = document.getElementById('hot-deals-list');
    
    // Get deals in active stages, sorted by value
    const hotDeals = Store.data.deals
      .filter(d => {
        const stage = Store.getStageById(d.stage_id);
        return stage && !['won', 'lost', 'not_a_fit', 'cold', 'churned'].includes(stage.stage_key);
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
    
    if (hotDeals.length === 0) {
      container.innerHTML = UI.emptyState('💰', 'No active deals', 'Create a deal to get started');
      return;
    }
    
    container.innerHTML = hotDeals.map(deal => {
      const stage = Store.getStageById(deal.stage_id);
      const owner = Store.getTeamMemberByEmail(deal.assigned_to);
      
      return `
        <div class="deal-card" onclick="Deals.showDetail('${deal.id}')">
          <div class="deal-card-header">
            <div class="deal-card-title">${UI.escapeHtml(deal.name)}</div>
            ${deal.value ? `
              <div class="deal-card-value">${UI.formatCurrency(deal.value)}</div>
            ` : ''}
          </div>
          <div class="deal-card-company">${UI.escapeHtml(deal.companies?.name || 'No company')}</div>
          <div class="deal-card-footer">
            <div class="deal-card-owner">
              ${owner ? `
                <img src="${owner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.name)}&size=20`}" alt="${owner.name}">
                <span>${owner.name.split(' ')[0]}</span>
              ` : 'Unassigned'}
            </div>
            <span class="badge ${UI.getBadgeClass(stage?.stage_key)}">${stage?.name || 'Unknown'}</span>
          </div>
        </div>
      `;
    }).join('');
  },
  
  renderAiBriefing() {
    const container = document.getElementById('ai-briefing');
    
    if (!CONFIG.FEATURES.AI_BRIEFING) {
      container.innerHTML = UI.emptyState('🤖', 'AI Briefing', 'Coming soon');
      return;
    }
    
    // Generate simple briefing based on data
    const stats = Store.getStats();
    const overdueTasks = Store.getOverdueTasks();
    const pendingTasks = Store.getPendingTasks();
    
    let briefing = [];
    
    // Overdue tasks
    if (overdueTasks.length > 0) {
      briefing.push(`⚠️ You have <strong>${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}</strong> that need attention.`);
    }
    
    // Today's tasks
    const todayTasks = pendingTasks.filter(t => 
      t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString()
    );
    if (todayTasks.length > 0) {
      briefing.push(`📋 You have <strong>${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''}</strong> due today.`);
    }
    
    // New deals
    if (stats.newDealsThisMonth > 0) {
      briefing.push(`📈 <strong>${stats.newDealsThisMonth} new deal${stats.newDealsThisMonth > 1 ? 's' : ''}</strong> created this month.`);
    }
    
    // Pipeline value
    if (stats.totalPipelineValue > 0) {
      briefing.push(`💰 Total pipeline value: <strong>${UI.formatCurrency(stats.totalPipelineValue)}</strong>`);
    }
    
    if (briefing.length === 0) {
      briefing.push('👋 Welcome back! Your pipeline is looking good.');
    }
    
    container.innerHTML = `
      <div class="ai-briefing-content">
        ${briefing.map(b => `<p style="margin-bottom: 0.75rem;">${b}</p>`).join('')}
      </div>
    `;
  }
};

// Export
window.Dashboard = Dashboard;
