// ============================================
// TASKS MODULE
// ============================================

const Tasks = {
  async render(params = {}) {
    await this.loadData();
    this.setupFilters();
    this.renderTable();
  },
  
  async loadData() {
    if (!Store.data.tasks || Store.data.tasks.length === 0) {
      try {
        const { data, error } = await db
          .from('tasks')
          .select('*, deals(name), companies(name)')
          .order('due_date', { ascending: true });
        
        if (data) Store.data.tasks = data;
      } catch (err) {
        console.error('Error loading tasks:', err);
      }
    }
  },
  
  setupFilters() {
    const statusFilter = document.getElementById('tasks-status-filter');
    const ownerFilter = document.getElementById('tasks-owner-filter');
    
    if (statusFilter) statusFilter.onchange = () => this.renderTable();
    if (ownerFilter) ownerFilter.onchange = () => this.renderTable();
  },
  
  renderTable() {
    const container = document.getElementById('tasks-table');
    if (!container) return;
    
    let tasks = Store.data.tasks || [];
    
    // Apply filters
    const status = document.getElementById('tasks-status-filter')?.value;
    const owner = document.getElementById('tasks-owner-filter')?.value;
    
    if (status === 'pending') tasks = tasks.filter(t => !t.completed);
    if (status === 'completed') tasks = tasks.filter(t => t.completed);
    if (owner) tasks = tasks.filter(t => t.assigned_to === owner);
    
    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <h3>No tasks found</h3>
          <p>All caught up!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Related To</th>
            <th>Due Date</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(task => `
            <tr onclick="Tasks.toggleComplete('${task.id}')" style="cursor:pointer">
              <td><strong>${task.title || 'Untitled'}</strong></td>
              <td>${task.deals?.name || task.companies?.name || '-'}</td>
              <td>${task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
              <td><span class="badge badge-${task.priority || 'default'}">${task.priority || 'Normal'}</span></td>
              <td>${task.completed ? '✅ Done' : '⏳ Pending'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },
  
  async toggleComplete(id) {
    const task = Store.data.tasks.find(t => t.id === id);
    if (task) {
      const { error } = await db
        .from('tasks')
        .update({ completed: !task.completed })
        .eq('id', id);
      
      if (!error) {
        task.completed = !task.completed;
        this.renderTable();
      }
    }
  }
};

window.Tasks = Tasks;
