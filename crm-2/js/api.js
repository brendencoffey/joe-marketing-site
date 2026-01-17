// ============================================
// API - Supabase Data Operations
// ============================================

const API = {
  // ==========================================
  // FETCH OPERATIONS
  // ==========================================
  
  async fetchAll() {
    Store.set('ui.isLoading', true);
    try {
      const [
        pipelines,
        stages,
        deals,
        companies,
        contacts,
        shops,
        tasks,
        activities,
        teamMembers,
        sequences,
        icpTypes,
        icpCriteria,
        territories,
        emailTemplates,
        smsTemplates
      ] = await Promise.all([
        this.fetchPipelines(),
        this.fetchStages(),
        this.fetchDeals(),
        this.fetchCompanies(),
        this.fetchContacts(),
        this.fetchShops(),
        this.fetchTasks(),
        this.fetchActivities(),
        this.fetchTeamMembers(),
        this.fetchSequences(),
        this.fetchIcpTypes(),
        this.fetchIcpCriteria(),
        this.fetchTerritories(),
        this.fetchEmailTemplates(),
        this.fetchSmsTemplates()
      ]);
      
      Store.updateData('pipelines', pipelines);
      Store.updateData('stages', stages);
      Store.updateData('deals', deals);
      Store.updateData('companies', companies);
      Store.updateData('contacts', contacts);
      Store.updateData('shops', shops);
      Store.updateData('tasks', tasks);
      Store.updateData('activities', activities);
      Store.updateData('teamMembers', teamMembers);
      Store.updateData('sequences', sequences);
      Store.updateData('icpTypes', icpTypes);
      Store.updateData('icpCriteria', icpCriteria);
      Store.updateData('territories', territories);
      Store.updateData('emailTemplates', emailTemplates);
      Store.updateData('smsTemplates', smsTemplates);
      
      // Set default pipeline
      if (pipelines.length > 0 && !Store.ui.currentPipeline) {
        const salesPipeline = pipelines.find(p => p.name === 'Sales') || pipelines[0];
        Store.set('ui.currentPipeline', salesPipeline.id);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      UI.toast('Error loading data', 'error');
    } finally {
      Store.set('ui.isLoading', false);
    }
  },
  
  async fetchPipelines() {
    const { data, error } = await db.from('pipelines').select('*').order('name');
    if (error) throw error;
    return data || [];
  },
  
  async fetchStages() {
    const { data, error } = await db.from('pipeline_stages').select('*').order('position');
    if (error) throw error;
    return data || [];
  },
  
  async fetchDeals() {
    const { data, error } = await db.from('deals')
      .select('*, contacts(*), companies(*)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return data || [];
  },
  
  async fetchCompanies() {
    const { data, error } = await db.from('companies')
      .select('*')
      .order('name')
      .limit(1000);
    if (error) throw error;
    return data || [];
  },
  
  async fetchContacts() {
    const { data, error } = await db.from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw error;
    return data || [];
  },
  
  async fetchShops(filters = {}) {
    let query = db.from('shops').select('*');
    
    if (filters.state) query = query.eq('state_code', filters.state);
    if (filters.city) query = query.eq('city', filters.city);
    if (filters.isPartner !== undefined) query = query.eq('is_joe_partner', filters.isPartner);
    if (filters.search) query = query.ilike('name', `%${filters.search}%`);
    
    query = query.order('name').limit(filters.limit || 500);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  
  async fetchTasks() {
    const { data, error } = await db.from('tasks')
      .select('*')
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },
  
  async fetchActivities() {
    const { data, error } = await db.from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },
  
  async fetchTeamMembers() {
    const { data, error } = await db.from('team_members')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  },
  
  async fetchSequences() {
    const { data, error } = await db.from('sequences')
      .select('*, sequence_steps(*)')
      .order('name');
    if (error) throw error;
    return data || [];
  },
  
  async fetchIcpTypes() {
    const { data, error } = await db.from('icp_types').select('*').order('priority');
    if (error) throw error;
    return data || [];
  },
  
  async fetchIcpCriteria() {
    const { data, error } = await db.from('icp_criteria').select('*').order('category');
    if (error) throw error;
    return data || [];
  },
  
  async fetchTerritories() {
    const { data, error } = await db.from('territories').select('*');
    if (error) throw error;
    return data || [];
  },
  
  async fetchEmailTemplates() {
    const { data, error } = await db.from('email_templates').select('*').order('name');
    if (error) throw error;
    return data || [];
  },
  
  async fetchSmsTemplates() {
    const { data, error } = await db.from('sms_templates').select('*').order('name');
    if (error) throw error;
    return data || [];
  },
  
  async fetchSmsConversations() {
    const { data, error } = await db.from('sms_conversations')
      .select('*, contacts(*)')
      .order('last_message_at', { ascending: false });
    if (error) throw error;
    Store.updateData('smsConversations', data || []);
    return data || [];
  },
  
  async fetchSmsMessages(conversationId) {
    const { data, error } = await db.from('sms_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    Store.updateData('smsMessages', data || []);
    return data || [];
  },
  
  // ==========================================
  // CREATE OPERATIONS
  // ==========================================
  
  async createDeal(deal) {
    const { data, error } = await db.from('deals')
      .insert(deal)
      .select('*, contacts(*), companies(*)')
      .single();
    if (error) throw error;
    Store.addItem('deals', data);
    return data;
  },
  
  async createContact(contact) {
    const { data, error } = await db.from('contacts')
      .insert(contact)
      .select()
      .single();
    if (error) throw error;
    Store.addItem('contacts', data);
    return data;
  },
  
  async createCompany(company) {
    const { data, error } = await db.from('companies')
      .insert(company)
      .select()
      .single();
    if (error) throw error;
    Store.addItem('companies', data);
    return data;
  },
  
  async createTask(task) {
    const { data, error } = await db.from('tasks')
      .insert(task)
      .select()
      .single();
    if (error) throw error;
    Store.addItem('tasks', data);
    return data;
  },
  
  async createActivity(activity) {
    const { data, error } = await db.from('activities')
      .insert(activity)
      .select()
      .single();
    if (error) throw error;
    Store.addItem('activities', data);
    return data;
  },
  
  async sendSms(conversationId, body) {
    const { data, error } = await db.from('sms_messages')
      .insert({
        conversation_id: conversationId,
        direction: 'outbound',
        body: body,
        sent_by: Store.teamMember?.id,
        status: 'queued'
      })
      .select()
      .single();
    if (error) throw error;
    
    // Update conversation
    await db.from('sms_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.substring(0, 100),
        last_message_direction: 'outbound'
      })
      .eq('id', conversationId);
    
    return data;
  },
  
  // ==========================================
  // UPDATE OPERATIONS
  // ==========================================
  
  async updateDeal(id, updates) {
    const { data, error } = await db.from('deals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, contacts(*), companies(*)')
      .single();
    if (error) throw error;
    Store.updateItem('deals', id, data);
    return data;
  },
  
  async updateDealStage(dealId, stageId) {
    // Log activity for stage change
    const deal = Store.getDealById(dealId);
    const oldStage = Store.getStageById(deal?.stage_id);
    const newStage = Store.getStageById(stageId);
    
    const { data, error } = await db.from('deals')
      .update({ 
        stage_id: stageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', dealId)
      .select('*, contacts(*), companies(*)')
      .single();
    if (error) throw error;
    
    // Create activity
    if (oldStage && newStage) {
      await this.createActivity({
        deal_id: dealId,
        activity_type: 'stage_change',
        notes: `Stage changed from ${oldStage.name} to ${newStage.name}`,
        created_by: Store.teamMember?.id
      });
    }
    
    Store.updateItem('deals', dealId, data);
    return data;
  },
  
  async updateContact(id, updates) {
    const { data, error } = await db.from('contacts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    Store.updateItem('contacts', id, data);
    return data;
  },
  
  async updateCompany(id, updates) {
    const { data, error } = await db.from('companies')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    Store.updateItem('companies', id, data);
    return data;
  },
  
  async updateTask(id, updates) {
    const { data, error } = await db.from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    Store.updateItem('tasks', id, data);
    return data;
  },
  
  async completeTask(id) {
    return this.updateTask(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: Store.teamMember?.id
    });
  },
  
  // ==========================================
  // DELETE OPERATIONS
  // ==========================================
  
  async deleteDeal(id) {
    const { error } = await db.from('deals').delete().eq('id', id);
    if (error) throw error;
    Store.removeItem('deals', id);
  },
  
  async deleteContact(id) {
    const { error } = await db.from('contacts').delete().eq('id', id);
    if (error) throw error;
    Store.removeItem('contacts', id);
  },
  
  async deleteTask(id) {
    const { error } = await db.from('tasks').delete().eq('id', id);
    if (error) throw error;
    Store.removeItem('tasks', id);
  },
  
  // ==========================================
  // SEARCH
  // ==========================================
  
  async searchAll(query) {
    const lowerQuery = query.toLowerCase();
    
    const results = {
      deals: Store.data.deals.filter(d => 
        d.name?.toLowerCase().includes(lowerQuery)
      ).slice(0, 5),
      companies: Store.data.companies.filter(c => 
        c.name?.toLowerCase().includes(lowerQuery)
      ).slice(0, 5),
      contacts: Store.data.contacts.filter(c => 
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(lowerQuery) ||
        c.email?.toLowerCase().includes(lowerQuery)
      ).slice(0, 5),
      shops: Store.data.shops.filter(s => 
        s.name?.toLowerCase().includes(lowerQuery)
      ).slice(0, 5)
    };
    
    return results;
  },
  
  // ==========================================
  // REALTIME SUBSCRIPTIONS
  // ==========================================
  
  subscribeToChanges() {
    // Subscribe to deals changes
    db.channel('deals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          Store.addItem('deals', payload.new);
        } else if (payload.eventType === 'UPDATE') {
          Store.updateItem('deals', payload.new.id, payload.new);
        } else if (payload.eventType === 'DELETE') {
          Store.removeItem('deals', payload.old.id);
        }
      })
      .subscribe();
    
    // Subscribe to tasks changes
    db.channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          Store.addItem('tasks', payload.new);
        } else if (payload.eventType === 'UPDATE') {
          Store.updateItem('tasks', payload.new.id, payload.new);
        } else if (payload.eventType === 'DELETE') {
          Store.removeItem('tasks', payload.old.id);
        }
      })
      .subscribe();
    
    // Subscribe to SMS messages
    db.channel('sms-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sms_messages' }, (payload) => {
        if (payload.new.conversation_id === Store.ui.selectedConversation) {
          Store.addItem('smsMessages', payload.new);
        }
        // Update unread badge
        this.fetchSmsConversations();
      })
      .subscribe();
  }
};

// Export
window.API = API;
