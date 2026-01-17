// ============================================
// TASKS MODULE
// ============================================

const Tasks = {
  render(params = {}) {
    this.renderFilters();
    this.renderList();
  },
  
  renderFilters() {
    const page = document.getElementById('page-tasks');
    
    if (!document.getElementById('tasks-filters')) {
      const filtersHtml = `
        <div id="tasks-filters" class="page-filters" style="margin-top: 1rem;">
          <select id="tasks-status-filter" class="form-select">
            <option value="pending">Open Tasks</option>
            <option value="completed">Completed</option>
            <option value="">All Tasks</option>
          </select>
          <select id="tasks-priority-filter" class="form-select">
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <select id="tasks-owner-filter" class="form-select">
            <option value="">All Owners</option>
            <option value="mine">My Tasks</option>
            ${Store.data.teamMembers.map(tm => `<option value="${tm.email}">${tm.name}</option>`).join('')}
          </select>
        </div>
      `;
      page.querySelector('.page-header').insertAdjacentHTML('afterend', filtersHtml);
      
      ['tasks-status-filter', 'tasks-priority-filter', 'tasks-owner-filter'].forEach(id => {
        document.getElementById(id).onchange = () => this.renderList();
      });
    }
  },
  
  renderList() {
    const page = document.getElementById('page-tasks');
    let container = page.querySelector('#tasks-content');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'tasks-content';
      page.appendChild(container);
    }
    
    // Apply filters
    const statusFilter = document.getElementById('tasks-status-filter')?.value || '';
    const priorityFilter = document.getElementById('tasks-priority-filter')?.value || '';
    const ownerFilter = document.getElementById('tasks-owner-filter')?.value || '';
    
    let tasks = Store.data.tasks;
    
    if (statusFilter) {
      tasks = tasks.filter(t => t.status === statusFilter);
    }
    if (priorityFilter) {
      tasks = tasks.filter(t => t.priority === priorityFilter);
    }
    if (ownerFilter === 'mine') {
      tasks = tasks.filter(t => 
        t.assigned_to === Store.teamMember?.email ||
        t.assigned_to_id === Store.teamMember?.id
      );
    } else if (ownerFilter) {
      tasks = tasks.filter(t => t.assigned_to === ownerFilter);
    }
    
    // Sort by due date
    tasks = tasks.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
    
    if (tasks.length === 0) {
      container.innerHTML = UI.emptyState('✅', 'No tasks found', 'All caught up!');
      return;
    }
    
    // Group by date
    const today = new Date().toDateString();
    const tomorrow = new Date(Date.now() + 86400000).toDateString();
    
    const overdue = tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date() && new Date(t.due_date).toDateString() !== today);
    const todayTasks = tasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === today);
    const tomorrowTasks = tasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === tomorrow);
    const upcoming = tasks.filter(t => t.due_date && new Date(t.due_date) > new Date(Date.now() + 86400000));
    const noDue = tasks.filter(t => !t.due_date);
    
    container.innerHTML = `
      <div class="tasks-grouped">
        ${overdue.length > 0 ? `
          <div class="task-group">
            <h3 class="task-group-title text-error">Overdue (${overdue.length})</h3>
            ${overdue.map(t => this.renderTask(t)).join('')}
          </div>
        ` : ''}
        
        ${todayTasks.length > 0 ? `
          <div class="task-group">
            <h3 class="task-group-title">Today (${todayTasks.length})</h3>
            ${todayTasks.map(t => this.renderTask(t)).join('')}
          </div>
        ` : ''}
        
        ${tomorrowTasks.length > 0 ? `
          <div class="task-group">
            <h3 class="task-group-title">Tomorrow (${tomorrowTasks.length})</h3>
            ${tomorrowTasks.map(t => this.renderTask(t)).join('')}
          </div>
        ` : ''}
        
        ${upcoming.length > 0 ? `
          <div class="task-group">
            <h3 class="task-group-title">Upcoming (${upcoming.length})</h3>
            ${upcoming.map(t => this.renderTask(t)).join('')}
          </div>
        ` : ''}
        
        ${noDue.length > 0 ? `
          <div class="task-group">
            <h3 class="task-group-title text-gray-400">No Due Date (${noDue.length})</h3>
            ${noDue.map(t => this.renderTask(t)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },
  
  renderTask(task) {
    const isOverdue = task.status !== 'completed' && task.due_date && new Date(task.due_date) < new Date();
    const deal = task.deal_id ? Store.getDealById(task.deal_id) : null;
    const assignee = Store.getTeamMemberByEmail(task.assigned_to);
    
    return `
      <div class="task-item ${task.status === 'completed' ? 'completed' : ''}" data-id="${task.id}">
        <div class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}" 
             onclick="Tasks.toggle('${task.id}')"></div>
        <div class="task-content" onclick="Tasks.showDetail('${task.id}')">
          <div class="task-header">
            <div class="task-title">${UI.escapeHtml(task.title)}</div>
            ${task.priority === 'high' ? '<span class="badge badge-red">High</span>' : ''}
          </div>
          <div class="task-meta">
            ${task.due_date ? `
              <span class="task-due ${isOverdue ? 'overdue' : ''}">
                📅 ${UI.formatDate(task.due_date)}
              </span>
            ` : ''}
            ${deal ? `<span>💼 ${UI.escapeHtml(deal.name)}</span>` : ''}
            ${assignee ? `<span>👤 ${assignee.name}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },
  
  async toggle(taskId) {
    const task = Store.data.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    try {
      if (newStatus === 'completed') {
        await API.completeTask(taskId);
      } else {
        await API.updateTask(taskId, { status: 'pending', completed_at: null });
      }
      UI.toast(newStatus === 'completed' ? 'Task completed!' : 'Task reopened', 'success');
      this.renderList();
      Dashboard.renderTasks();
      Dashboard.renderStats();
    } catch (error) {
      console.error('Error toggling task:', error);
      UI.toast('Error updating task', 'error');
    }
  },
  
  showCreateModal(dealId = null, contactId = null) {
    const modal = UI.modal({
      title: 'Add Task',
      content: this.getFormHtml(null, dealId, contactId),
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="save">Create Task</button>
      `
    });
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="save"]').onclick = async () => {
      const form = modal.element.querySelector('form');
      const formData = new FormData(form);
      
      const task = {
        title: formData.get('title'),
        description: formData.get('description') || null,
        due_date: formData.get('due_date') || null,
        priority: formData.get('priority') || 'normal',
        task_type: formData.get('task_type') || 'follow_up',
        assigned_to: formData.get('assigned_to') || Store.teamMember?.email,
        deal_id: formData.get('deal_id') || dealId || null,
        contact_id: formData.get('contact_id') || contactId || null,
        status: 'pending'
      };
      
      try {
        await API.createTask(task);
        UI.toast('Task created!', 'success');
        modal.close();
        this.renderList();
        Dashboard.renderTasks();
        Dashboard.renderStats();
      } catch (error) {
        console.error('Error creating task:', error);
        UI.toast('Error creating task', 'error');
      }
    };
  },
  
  getFormHtml(task = null, dealId = null, contactId = null) {
    const teamMembers = Store.data.teamMembers;
    const deals = Store.data.deals.slice(0, 50);
    
    // Default due date to tomorrow
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    return `
      <form class="form">
        <div class="form-group">
          <label class="form-label">Task Title *</label>
          <input type="text" name="title" class="form-input" required 
                 value="${task?.title || ''}" placeholder="e.g., Follow up with prospect">
        </div>
        
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea name="description" class="form-textarea" rows="3"
                    placeholder="Add details...">${task?.description || ''}</textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" name="due_date" class="form-input" 
                   value="${task?.due_date?.split('T')[0] || tomorrow}">
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select name="priority" class="form-select">
              <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="normal" ${!task || task?.priority === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Task Type</label>
            <select name="task_type" class="form-select">
              <option value="follow_up">Follow Up</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="demo">Demo</option>
              <option value="research">Research</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned To</label>
            <select name="assigned_to" class="form-select">
              ${teamMembers.map(tm => `
                <option value="${tm.email}" ${tm.email === Store.teamMember?.email ? 'selected' : ''}>
                  ${tm.name}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Related Deal</label>
          <select name="deal_id" class="form-select">
            <option value="">None</option>
            ${deals.map(d => `
              <option value="${d.id}" ${(task?.deal_id === d.id || dealId === d.id) ? 'selected' : ''}>
                ${UI.escapeHtml(d.name)}
              </option>
            `).join('')}
          </select>
        </div>
      </form>
    `;
  },
  
  showDetail(taskId) {
    const task = Store.data.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const modal = UI.modal({
      title: 'Edit Task',
      content: this.getFormHtml(task),
      footer: `
        <button class="btn btn-secondary" onclick="Tasks.deleteTask('${taskId}')">Delete</button>
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="save">Save Changes</button>
      `
    });
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="save"]').onclick = async () => {
      const form = modal.element.querySelector('form');
      const formData = new FormData(form);
      
      const updates = {
        title: formData.get('title'),
        description: formData.get('description') || null,
        due_date: formData.get('due_date') || null,
        priority: formData.get('priority'),
        task_type: formData.get('task_type'),
        assigned_to: formData.get('assigned_to'),
        deal_id: formData.get('deal_id') || null
      };
      
      try {
        await API.updateTask(taskId, updates);
        UI.toast('Task updated!', 'success');
        modal.close();
        this.renderList();
      } catch (error) {
        console.error('Error updating task:', error);
        UI.toast('Error updating task', 'error');
      }
    };
    
    this.currentModal = modal;
  },
  
  async deleteTask(taskId) {
    UI.confirm('Are you sure you want to delete this task?', async () => {
      try {
        await API.deleteTask(taskId);
        UI.toast('Task deleted', 'success');
        if (this.currentModal) this.currentModal.close();
        this.renderList();
        Dashboard.renderTasks();
      } catch (error) {
        console.error('Error deleting task:', error);
        UI.toast('Error deleting task', 'error');
      }
    });
  }
};

// Add CSS
const taskStyles = document.createElement('style');
taskStyles.textContent = `
  .tasks-grouped { display: flex; flex-direction: column; gap: var(--space-6); }
  .task-group-title { font-size: 0.875rem; font-weight: 600; margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--gray-200); }
  .task-item { display: flex; gap: var(--space-3); padding: var(--space-3); background: white; border-radius: var(--radius-lg); border: 1px solid var(--gray-200); margin-bottom: var(--space-2); }
  .task-item:hover { border-color: var(--gray-300); }
  .task-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); }
  .task-content { flex: 1; cursor: pointer; }
`;
document.head.appendChild(taskStyles);

// Export
window.Tasks = Tasks;
