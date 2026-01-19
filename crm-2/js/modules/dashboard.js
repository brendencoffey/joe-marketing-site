// ============================================
// DASHBOARD MODULE - With AI Briefing Chat
// ============================================

const Dashboard = {
  aiMessages: [],

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
    const activities = Store.data.activities?.slice(0, 5) || [];

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

    const hotDeals = (Store.data.deals || [])
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
      const company = deal.companies;

      return `
        <div class="deal-card" onclick="Router.navigate('deals/${deal.id}')">
          <div class="deal-card-header">
            <div class="deal-card-title">${UI.escapeHtml(deal.name)}</div>
            ${deal.value ? `<div class="deal-card-value">${UI.formatCurrency(deal.value)}</div>` : ''}
          </div>
          <div class="deal-card-company">${UI.escapeHtml(company?.name || 'No company')}</div>
          <div class="deal-card-footer">
            <div class="deal-card-owner">Unassigned</div>
            <span class="badge ${UI.getBadgeClass(stage?.stage_key)}">${stage?.name || 'Unknown'}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  // ==========================================
  // AI BRIEFING WITH CHAT
  // ==========================================

  renderAiBriefing() {
    const container = document.getElementById('ai-briefing');
    const stats = Store.getStats();
    const overdueTasks = Store.getOverdueTasks();
    const pendingTasks = Store.getPendingTasks();

    // Generate smart briefing points
    let briefing = [];

    if (overdueTasks.length > 0) {
      briefing.push(`⚠️ You have <strong>${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}</strong> that need attention.`);
    }

    const todayTasks = pendingTasks.filter(t =>
      t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString()
    );
    if (todayTasks.length > 0) {
      briefing.push(`📋 You have <strong>${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''}</strong> due today.`);
    }

    if (stats.newDealsThisMonth > 0) {
      briefing.push(`📈 <strong>${stats.newDealsThisMonth} new deal${stats.newDealsThisMonth > 1 ? 's' : ''}</strong> created this month.`);
    }

    if (stats.totalPipelineValue > 0) {
      briefing.push(`💰 Total pipeline value: <strong>${UI.formatCurrency(stats.totalPipelineValue)}</strong>`);
    }

    if (briefing.length === 0) {
      briefing.push('👋 Welcome back! Your pipeline is looking good.');
    }

    // Suggested prompts
    const prompts = [
      { icon: '📊', text: 'Summarize my pipeline', prompt: 'Give me a summary of my current sales pipeline - how many deals in each stage and total value.' },
      { icon: '🎯', text: 'What should I focus on?', prompt: 'Based on my deals and tasks, what should I prioritize today?' },
      { icon: '📈', text: 'Deal recommendations', prompt: 'Which deals need attention? Are any at risk of going cold?' },
      { icon: '✅', text: 'Task overview', prompt: 'What tasks do I have pending and which are overdue?' },
      { icon: '💡', text: 'Follow-up suggestions', prompt: 'Suggest follow-up actions for my active deals.' }
    ];

    container.innerHTML = `
      <div class="ai-briefing-summary">
        ${briefing.map(b => `<p>${b}</p>`).join('')}
      </div>

      <div class="ai-prompts">
        <div class="ai-prompts-label">Ask joe AI:</div>
        <div class="ai-prompt-chips">
          ${prompts.map(p => `
            <button class="ai-prompt-chip" onclick="Dashboard.askAi('${p.prompt.replace(/'/g, "\\'")}')">
              <span>${p.icon}</span> ${p.text}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="ai-chat-container">
        <div id="ai-chat-messages" class="ai-chat-messages"></div>
        <div class="ai-chat-input">
          <input type="text" id="ai-input" placeholder="Ask joe anything about your CRM..." 
                 onkeypress="if(event.key==='Enter') Dashboard.askAi()">
          <button class="btn btn-primary" onclick="Dashboard.askAi()">
            <i data-lucide="send"></i>
          </button>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  async askAi(predefinedPrompt) {
    const input = document.getElementById('ai-input');
    const messagesContainer = document.getElementById('ai-chat-messages');
    const query = predefinedPrompt || input.value.trim();

    if (!query) return;

    // Clear input
    if (!predefinedPrompt) input.value = '';

    // Add user message
    this.aiMessages.push({ role: 'user', content: query });
    this.renderAiMessages();

    // Show loading
    messagesContainer.innerHTML += `
      <div class="ai-message assistant loading">
        <div class="ai-message-avatar">🤖</div>
        <div class="ai-message-content">Thinking...</div>
      </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Get API key
    const apiKey = localStorage.getItem('anthropic_api_key');
    if (!apiKey) {
      this.aiMessages.push({
        role: 'assistant',
        content: '⚠️ Please add your Anthropic API key in Settings → Integrations to use AI features.'
      });
      this.renderAiMessages();
      return;
    }

    // Build context
    const context = this.buildAiContext();

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: context,
          messages: this.aiMessages.filter(m => m.role !== 'system')
        })
      });

      const data = await response.json();

      if (data.error) {
        this.aiMessages.push({ role: 'assistant', content: `Error: ${data.error.message}` });
      } else {
        this.aiMessages.push({ role: 'assistant', content: data.content[0].text });
      }
    } catch (error) {
      this.aiMessages.push({ role: 'assistant', content: `Error: ${error.message}` });
    }

    this.renderAiMessages();
  },

  buildAiContext() {
    const stats = Store.getStats();
    const deals = Store.data.deals || [];
    const tasks = Store.data.tasks || [];
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    const overdueTasks = pendingTasks.filter(t => t.due_date && new Date(t.due_date) < new Date());

    // Get deal summaries by stage
    const dealsByStage = {};
    deals.forEach(d => {
      const stage = Store.getStageById(d.stage_id);
      const stageName = stage?.name || 'Unknown';
      if (!dealsByStage[stageName]) dealsByStage[stageName] = { count: 0, value: 0 };
      dealsByStage[stageName].count++;
      dealsByStage[stageName].value += d.value || 0;
    });

    const stagesSummary = Object.entries(dealsByStage)
      .map(([stage, data]) => `${stage}: ${data.count} deals ($${data.value.toLocaleString()})`)
      .join('\n');

    // Hot deals (top 5 by value)
    const hotDeals = deals
      .filter(d => {
        const stage = Store.getStageById(d.stage_id);
        return stage && !['won', 'lost', 'not_a_fit', 'cold', 'churned'].includes(stage.stage_key);
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);

    return `You are joe, a helpful AI sales assistant for the joe CRM system. You help the sales team manage their coffee shop partnerships.

CURRENT CRM DATA:
- Total deals: ${deals.length}
- Pipeline value: $${stats.totalPipelineValue?.toLocaleString() || 0}
- New deals this month: ${stats.newDealsThisMonth}
- Won deals: ${stats.wonDeals}
- Pending tasks: ${pendingTasks.length}
- Overdue tasks: ${overdueTasks.length}

DEALS BY STAGE:
${stagesSummary || 'No deals'}

TOP DEALS (by value):
${hotDeals.map(d => `- ${d.name}: $${(d.value || 0).toLocaleString()} (${Store.getStageById(d.stage_id)?.name || 'Unknown'})`).join('\n') || 'No active deals'}

OVERDUE TASKS:
${overdueTasks.slice(0, 5).map(t => `- ${t.title} (due ${UI.formatDate(t.due_date)})`).join('\n') || 'None'}

Be concise, friendly, and actionable. When asked about deals or tasks, reference the specific data above. Give practical advice for sales follow-ups and prioritization.`;
  },

  renderAiMessages() {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    container.innerHTML = this.aiMessages.map(msg => `
      <div class="ai-message ${msg.role}">
        <div class="ai-message-avatar">${msg.role === 'user' ? '👤' : '🤖'}</div>
        <div class="ai-message-content">${msg.role === 'assistant' ? msg.content.replace(/\n/g, '<br>') : UI.escapeHtml(msg.content)}</div>
      </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
  }
};

// Export
window.Dashboard = Dashboard;
