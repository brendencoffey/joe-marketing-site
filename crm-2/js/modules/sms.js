// ============================================
// SMS MODULE - SMS Inbox
// ============================================

const SMS = {
  currentConversation: null,
  
  async render(params = {}) {
    await this.loadData();
    this.renderConversationsList();
    this.setupEventListeners();
  },
  
  async loadData() {
    // Always reload SMS conversations (don't cache)
    try {
      const { data, error } = await db
        .from('sms_conversation_list')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });
      
      if (error) {
        console.error('Error loading SMS conversations:', error);
        Store.data.smsConversations = [];
      } else {
        Store.data.smsConversations = data || [];
        console.log('Loaded SMS conversations:', Store.data.smsConversations.length);
      }
    } catch (err) {
      console.error('Error loading SMS conversations:', err);
      Store.data.smsConversations = [];
    }
  },
  
  renderConversationsList() {
    const container = document.getElementById('sms-conversations');
    if (!container) return;
    
    const conversations = Store.data.smsConversations || [];
    
    if (conversations.length === 0) {
      container.innerHTML = '<p class="text-muted" style="padding: 1rem; text-align: center;">No conversations yet</p>';
      return;
    }
    
    container.innerHTML = conversations.map(conv => {
      const name = conv.contact_first_name ? 
        `${conv.contact_first_name} ${conv.contact_last_name || ''}`.trim() : 
        conv.phone_number || 'Unknown';
      const initials = conv.contact_first_name ? 
        `${conv.contact_first_name[0]}${(conv.contact_last_name || '')[0] || ''}`.toUpperCase() : '#';
      
      return `
        <div class="sms-conversation-item ${conv.unread_count > 0 ? 'unread' : ''} ${this.currentConversation === conv.id ? 'active' : ''}"
             onclick="SMS.selectConversation('${conv.id}')"
             data-conv-id="${conv.id}">
          <div class="sms-avatar">${initials}</div>
          <div class="sms-conversation-info">
            <div class="sms-conversation-name">${name}</div>
            <div class="sms-conversation-preview">${conv.last_message_preview || ''}</div>
          </div>
          <div class="sms-conversation-meta">
            <span class="sms-conversation-time">${conv.last_message_at ? this.formatTime(conv.last_message_at) : ''}</span>
            ${conv.unread_count > 0 ? `<span class="sms-unread-badge">${conv.unread_count}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },
  
  setupEventListeners() {
    const searchInput = document.getElementById('sms-search');
    if (searchInput) {
      searchInput.oninput = UI.debounce((e) => {
        this.filterConversations(e.target.value);
      }, 300);
    }
    
    const sendBtn = document.getElementById('sms-send');
    if (sendBtn) {
      sendBtn.onclick = () => this.sendMessage();
    }
    
    const input = document.getElementById('sms-input');
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      };
    }
  },
  
  async selectConversation(convId) {
    this.currentConversation = convId;
    
    // Update active state in list
    document.querySelectorAll('.sms-conversation-item').forEach(el => {
      el.classList.toggle('active', el.dataset.convId === convId);
    });
    
    // Load messages
    const conv = Store.data.smsConversations.find(c => c.id === convId);
    if (!conv) return;
    
    // Update header
    const header = document.getElementById('sms-header');
    const name = conv.contact_first_name ? 
      `${conv.contact_first_name} ${conv.contact_last_name || ''}`.trim() : 
      conv.phone_number || 'Unknown';
    if (header) {
      header.innerHTML = `
        <div class="sms-header-info">
          <strong>${name}</strong>
          <span>${conv.phone_number || ''}</span>
        </div>
      `;
    }
    
    // Load messages from DB
    const { data: messages } = await db
      .from('sms_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    
    // Render messages
    const messagesContainer = document.getElementById('sms-messages');
    if (messagesContainer && messages) {
      messagesContainer.innerHTML = messages.map(msg => `
        <div class="sms-message ${msg.direction === 'outbound' ? 'outbound' : 'inbound'}">
          <div class="sms-message-bubble">${msg.body}</div>
          <div class="sms-message-time">${this.formatTime(msg.created_at)}</div>
        </div>
      `).join('');
      
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Show composer
    const composer = document.getElementById('sms-composer');
    if (composer) composer.style.display = 'flex';
  },
  
  filterConversations(query) {
    const items = document.querySelectorAll('.sms-conversation-item');
    const q = query.toLowerCase();
    
    items.forEach(item => {
      const name = item.querySelector('.sms-conversation-name')?.textContent?.toLowerCase() || '';
      const preview = item.querySelector('.sms-conversation-preview')?.textContent?.toLowerCase() || '';
      item.style.display = (name.includes(q) || preview.includes(q)) ? '' : 'none';
    });
  },
  
  async sendMessage() {
    if (!this.currentConversation) return;
    
    const input = document.getElementById('sms-input');
    const body = input?.value?.trim();
    if (!body) return;
    
    const conv = Store.data.smsConversations.find(c => c.id === this.currentConversation);
    if (!conv) return;
    
    // Insert message
    const { data, error } = await db
      .from('sms_messages')
      .insert({
        conversation_id: this.currentConversation,
        body: body,
        direction: 'outbound',
        status: 'sent'
      })
      .select()
      .single();
    
    if (!error && data) {
      // Add to UI
      const messagesContainer = document.getElementById('sms-messages');
      if (messagesContainer) {
        messagesContainer.insertAdjacentHTML('beforeend', `
          <div class="sms-message outbound">
            <div class="sms-message-bubble">${data.body}</div>
            <div class="sms-message-time">${this.formatTime(data.created_at)}</div>
          </div>
        `);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      
      // Clear input
      input.value = '';
      
      // Update conversation
      await db
        .from('sms_conversations')
        .update({ last_message: body, last_message_at: new Date().toISOString() })
        .eq('id', this.currentConversation);
    }
  },
  
  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) { // Less than 24 hours
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diff < 604800000) { // Less than 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }
};

window.SMS = SMS;
