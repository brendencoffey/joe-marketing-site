// ============================================
// STORE - Global State Management
// ============================================

const Store = {
  // Current user
  user: null,
  teamMember: null,
  
  // Data
  data: {
    pipelines: [],
    stages: [],
    deals: [],
    companies: [],
    contacts: [],
    shops: [],
    tasks: [],
    activities: [],
    teamMembers: [],
    sequences: [],
    smsConversations: [],
    smsMessages: [],
    meetings: [],
    emailTemplates: [],
    smsTemplates: [],
    icpTypes: [],
    icpCriteria: [],
    territories: []
  },
  
  // UI State
  ui: {
    currentPage: 'dashboard',
    currentPipeline: null,
    selectedDeal: null,
    selectedCompany: null,
    selectedContact: null,
    selectedShop: null,
    selectedConversation: null,
    isLoading: false,
    sidebarCollapsed: false,
    filters: {}
  },
  
  // Subscribers for reactive updates
  _subscribers: new Map(),
  
  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this._subscribers.has(key)) {
      this._subscribers.set(key, new Set());
    }
    this._subscribers.get(key).add(callback);
    return () => this._subscribers.get(key).delete(callback);
  },
  
  // Notify subscribers of changes
  notify(key) {
    if (this._subscribers.has(key)) {
      this._subscribers.get(key).forEach(cb => cb(this.get(key)));
    }
  },
  
  // Get state value
  get(key) {
    const keys = key.split('.');
    let value = this;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  },
  
  // Set state value
  set(key, value) {
    const keys = key.split('.');
    let obj = this;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this.notify(key);
  },
  
  // Update data array
  updateData(type, items) {
    this.data[type] = items;
    this.notify(`data.${type}`);
  },
  
  // Add item to data array
  addItem(type, item) {
    this.data[type] = [...this.data[type], item];
    this.notify(`data.${type}`);
  },
  
  // Update item in data array
  updateItem(type, id, updates) {
    this.data[type] = this.data[type].map(item => 
      item.id === id ? { ...item, ...updates } : item
    );
    this.notify(`data.${type}`);
  },
  
  // Remove item from data array
  removeItem(type, id) {
    this.data[type] = this.data[type].filter(item => item.id !== id);
    this.notify(`data.${type}`);
  },
  
  // Get deals by pipeline
  getDealsByPipeline(pipelineId) {
    return this.data.deals.filter(d => d.pipeline_id === pipelineId);
  },
  
  // Get deals by stage
  getDealsByStage(stageId) {
    return this.data.deals.filter(d => d.stage_id === stageId);
  },
  
  // Get stages by pipeline
  getStagesByPipeline(pipelineId) {
    return this.data.stages
      .filter(s => s.pipeline_id === pipelineId)
      .sort((a, b) => a.position - b.position);
  },
  
  // Get contacts by company
  getContactsByCompany(companyId) {
    return this.data.contacts.filter(c => c.company_id === companyId);
  },
  
  // Get tasks for current user
  getMyTasks() {
    if (!this.teamMember) return [];
    return this.data.tasks.filter(t => 
      t.assigned_to === this.teamMember.email || 
      t.assigned_to_id === this.teamMember.id
    );
  },
  
  // Get pending tasks
  getPendingTasks() {
    return this.getMyTasks().filter(t => t.status !== 'completed');
  },
  
  // Get overdue tasks
  getOverdueTasks() {
    const now = new Date();
    return this.getPendingTasks().filter(t => {
      if (!t.due_date) return false;
      return new Date(t.due_date) < now;
    });
  },
  
  // Get team member by email
  getTeamMemberByEmail(email) {
    return this.data.teamMembers.find(tm => tm.email === email);
  },
  
  // Get team member by ID
  getTeamMemberById(id) {
    return this.data.teamMembers.find(tm => tm.id === id);
  },
  
  // Get pipeline by ID
  getPipelineById(id) {
    return this.data.pipelines.find(p => p.id === id);
  },
  
  // Get stage by ID
  getStageById(id) {
    return this.data.stages.find(s => s.id === id);
  },
  
  // Get company by ID
  getCompanyById(id) {
    return this.data.companies.find(c => c.id === id);
  },
  
  // Get contact by ID
  getContactById(id) {
    return this.data.contacts.find(c => c.id === id);
  },
  
  // Get shop by ID
  getShopById(id) {
    return this.data.shops.find(s => s.id === id);
  },
  
  // Get deal by ID
  getDealById(id) {
    return this.data.deals.find(d => d.id === id);
  },
  
  // Calculate stats
  getStats() {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const dealsThisMonth = this.data.deals.filter(d => 
      new Date(d.created_at) >= thisMonth
    );
    
    const dealsLastMonth = this.data.deals.filter(d => {
      const created = new Date(d.created_at);
      return created >= lastMonth && created < thisMonth;
    });
    
    const wonDeals = this.data.deals.filter(d => {
      const stage = this.getStageById(d.stage_id);
      return stage?.stage_key === 'won';
    });
    
    const totalPipelineValue = this.data.deals
      .filter(d => {
        const stage = this.getStageById(d.stage_id);
        return !['won', 'lost', 'not_a_fit', 'cold', 'churned'].includes(stage?.stage_key);
      })
      .reduce((sum, d) => sum + (d.value || 0), 0);
    
    return {
      totalDeals: this.data.deals.length,
      newDealsThisMonth: dealsThisMonth.length,
      newDealsLastMonth: dealsLastMonth.length,
      wonDeals: wonDeals.length,
      totalPipelineValue,
      totalContacts: this.data.contacts.length,
      totalCompanies: this.data.companies.length,
      totalShops: this.data.shops.length,
      pendingTasks: this.getPendingTasks().length,
      overdueTasks: this.getOverdueTasks().length
    };
  },
  
  // Reset store
  reset() {
    this.user = null;
    this.teamMember = null;
    Object.keys(this.data).forEach(key => {
      this.data[key] = [];
    });
    this.ui = {
      currentPage: 'dashboard',
      currentPipeline: null,
      selectedDeal: null,
      selectedCompany: null,
      selectedContact: null,
      selectedShop: null,
      selectedConversation: null,
      isLoading: false,
      sidebarCollapsed: false,
      filters: {}
    };
  }
};

// Export
window.Store = Store;
