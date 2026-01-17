// ============================================
// SEQUENCES MODULE
// ============================================

const Sequences = {
  render() {
    this.renderGrid();
  },
  
  renderGrid() {
    const container = document.getElementById('sequences-grid');
    const sequences = Store.data.sequences;
    
    if (sequences.length === 0) {
      container.innerHTML = UI.emptyState('🔄', 'No sequences yet', 'Create a sequence to automate outreach');
      return;
    }
    
    container.innerHTML = `
      <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
        ${sequences.map(seq => {
          const steps = seq.sequence_steps || [];
          const enrollments = Store.data.sequenceEnrollments?.filter(e => e.sequence_id === seq.id) || [];
          const activeCount = enrollments.filter(e => e.status === 'active').length;
          
          return `
            <div class="dashboard-card cursor-pointer" onclick="Sequences.showDetail('${seq.id}')">
              <div class="flex justify-between items-start mb-3">
                <div>
                  <h3 class="font-semibold">${UI.escapeHtml(seq.name)}</h3>
                  <p class="text-sm text-gray-500">${UI.escapeHtml(seq.description || '')}</p>
                </div>
                <span class="badge ${seq.is_active ? 'badge-green' : 'badge-gray'}">
                  ${seq.is_active ? 'Active' : 'Paused'}
                </span>
              </div>
              <div class="flex gap-4 text-sm text-gray-500">
                <span>${steps.length} steps</span>
                <span>${activeCount} enrolled</span>
                <span>${seq.trigger_type}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },
  
  showCreateModal() {
    const modal = UI.modal({
      title: 'New Sequence',
      content: `
        <form id="create-sequence-form">
          <div class="form-group">
            <label class="form-label">Sequence Name *</label>
            <input type="text" class="form-input" name="name" required placeholder="e.g., Lost Lead Nurture">
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" name="description" placeholder="What is this sequence for?"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Trigger Type</label>
            <select class="form-select" name="trigger_type">
              <option value="manual">Manual enrollment</option>
              <option value="automatic">Automatic (stage change)</option>
            </select>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="Sequences.handleCreate()">Create Sequence</button>
      `
    });
  },
  
  async handleCreate() {
    const form = document.getElementById('create-sequence-form');
    const formData = new FormData(form);
    
    const sequence = {
      name: formData.get('name'),
      description: formData.get('description'),
      trigger_type: formData.get('trigger_type'),
      is_active: true,
      created_by: Store.teamMember?.id
    };
    
    if (!sequence.name) {
      UI.toast('Sequence name is required', 'error');
      return;
    }
    
    try {
      const { data, error } = await db.from('sequences').insert(sequence).select().single();
      if (error) throw error;
      
      Store.addItem('sequences', data);
      UI.toast('Sequence created!', 'success');
      document.querySelector('.modal-overlay').remove();
      this.renderGrid();
      this.showDetail(data.id);
    } catch (error) {
      console.error('Error creating sequence:', error);
      UI.toast('Error creating sequence', 'error');
    }
  },
  
  showDetail(sequenceId) {
    const sequence = Store.data.sequences.find(s => s.id === sequenceId);
    if (!sequence) return;
    
    const steps = sequence.sequence_steps || [];
    
    const modal = UI.modal({
      title: sequence.name,
      size: 'modal-lg',
      content: `
        <div class="mb-4">
          <p class="text-gray-500">${UI.escapeHtml(sequence.description || 'No description')}</p>
          <div class="flex gap-4 mt-2">
            <span class="badge ${sequence.is_active ? 'badge-green' : 'badge-gray'}">
              ${sequence.is_active ? 'Active' : 'Paused'}
            </span>
            <span class="text-sm text-gray-500">Trigger: ${sequence.trigger_type}</span>
          </div>
        </div>
        
        <h4 class="font-semibold mb-3">Steps</h4>
        <div id="sequence-steps" class="space-y-3">
          ${steps.length === 0 ? '<p class="text-gray-500">No steps yet. Add a step to get started.</p>' : ''}
          ${steps.sort((a, b) => a.step_order - b.step_order).map((step, i) => `
            <div class="p-4 bg-gray-50 rounded-lg flex items-center gap-4">
              <div class="w-8 h-8 rounded-full bg-joe-orange text-white flex items-center justify-center font-semibold">
                ${i + 1}
              </div>
              <div class="flex-1">
                <div class="font-medium">${step.step_type === 'email' ? '📧 Email' : step.step_type === 'sms' ? '💬 SMS' : step.step_type === 'call' ? '📞 Call' : '✅ Task'}</div>
                <div class="text-sm text-gray-500">
                  ${step.subject || step.body?.substring(0, 50) || 'No content'}
                </div>
              </div>
              <div class="text-sm text-gray-400">
                +${step.delay_days} days
              </div>
            </div>
          `).join('')}
        </div>
        
        <button class="btn btn-secondary mt-4" onclick="Sequences.showAddStepModal('${sequenceId}')">
          + Add Step
        </button>
      `,
      footer: `
        <button class="btn btn-danger" onclick="Sequences.confirmDelete('${sequenceId}')">Delete</button>
        <button class="btn btn-secondary" onclick="Sequences.toggleActive('${sequenceId}')">${sequence.is_active ? 'Pause' : 'Activate'}</button>
        <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Close</button>
      `
    });
  },
  
  showAddStepModal(sequenceId) {
    const sequence = Store.data.sequences.find(s => s.id === sequenceId);
    const existingSteps = sequence?.sequence_steps?.length || 0;
    
    const stepModal = UI.modal({
      title: 'Add Step',
      content: `
        <form id="add-step-form">
          <input type="hidden" name="sequence_id" value="${sequenceId}">
          <div class="form-group">
            <label class="form-label">Step Type</label>
            <select class="form-select" name="step_type" id="step-type-select">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="call">Call</option>
              <option value="task">Task</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Delay (days after previous step)</label>
            <input type="number" class="form-input" name="delay_days" value="1" min="0">
          </div>
          <div class="form-group" id="subject-group">
            <label class="form-label">Subject</label>
            <input type="text" class="form-input" name="subject" placeholder="Email subject...">
          </div>
          <div class="form-group">
            <label class="form-label">Content</label>
            <textarea class="form-textarea" name="body" placeholder="Step content..."></textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="Sequences.handleAddStep()">Add Step</button>
      `
    });
    
    // Toggle subject field based on type
    document.getElementById('step-type-select').onchange = (e) => {
      document.getElementById('subject-group').style.display = 
        e.target.value === 'email' ? 'block' : 'none';
    };
  },
  
  async handleAddStep() {
    const form = document.getElementById('add-step-form');
    const formData = new FormData(form);
    
    const sequence = Store.data.sequences.find(s => s.id === formData.get('sequence_id'));
    const existingSteps = sequence?.sequence_steps?.length || 0;
    
    const step = {
      sequence_id: formData.get('sequence_id'),
      step_type: formData.get('step_type'),
      delay_days: parseInt(formData.get('delay_days')) || 1,
      subject: formData.get('subject'),
      body: formData.get('body'),
      step_order: existingSteps + 1,
      position: existingSteps + 1
    };
    
    try {
      const { data, error } = await db.from('sequence_steps').insert(step).select().single();
      if (error) throw error;
      
      // Update local state
      if (!sequence.sequence_steps) sequence.sequence_steps = [];
      sequence.sequence_steps.push(data);
      
      UI.toast('Step added!', 'success');
      
      // Close add step modal
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      
      // Re-open detail modal
      this.showDetail(step.sequence_id);
    } catch (error) {
      console.error('Error adding step:', error);
      UI.toast('Error adding step', 'error');
    }
  },
  
  async toggleActive(sequenceId) {
    const sequence = Store.data.sequences.find(s => s.id === sequenceId);
    if (!sequence) return;
    
    try {
      const { error } = await db.from('sequences')
        .update({ is_active: !sequence.is_active })
        .eq('id', sequenceId);
      if (error) throw error;
      
      sequence.is_active = !sequence.is_active;
      UI.toast(sequence.is_active ? 'Sequence activated' : 'Sequence paused', 'success');
      document.querySelector('.modal-overlay').remove();
      this.renderGrid();
    } catch (error) {
      console.error('Error toggling sequence:', error);
      UI.toast('Error updating sequence', 'error');
    }
  },
  
  confirmDelete(sequenceId) {
    UI.confirm('Are you sure you want to delete this sequence?', async () => {
      try {
        const { error } = await db.from('sequences').delete().eq('id', sequenceId);
        if (error) throw error;
        
        Store.removeItem('sequences', sequenceId);
        UI.toast('Sequence deleted', 'success');
        document.querySelector('.modal-overlay').remove();
        this.renderGrid();
      } catch (error) {
        console.error('Error deleting sequence:', error);
        UI.toast('Error deleting sequence', 'error');
      }
    });
  }
};

// Export
window.Sequences = Sequences;
