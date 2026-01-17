// ============================================
// SMS MODULE - SMS Inbox
// ============================================

const SMS = {
  currentConversation: null,
  
  async render(params = {}) {
    // Fetch SMS conversations
    await API.fetchSmsConversations();
    this.renderInbox();
  },
  
  renderInbox() {
    const page = document.getElementById('page-sms');
    let container = page.querySelector('#sms-container');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'sms-container';
      container.className = 'sms-layout';
      page.appendChild(container);
    }
    
    const conversations = Store.data.smsConversations;
    
    container.innerHTML = `
      <div class="sms-sidebar">
        <div class="sms-search">
          <input type="text" id="sms-search-input" placeholder="Search conversations..." class="form-input">
        </div>
        <div class="sms-conversations" id="sms-conversations-list">
          ${conversations.length === 0 ? 
            '<p class="text-gray-400 text-center p-4">No conversations yet</p>' :
            conversations.map(conv => this.renderConversationItem(conv)).join('')
          }
        </div>
      </div>
      <div class="sms-main">
        <div class="sms-header" id="sms-header">
          <p class="text-gray-400">Select a conversation to view messages</p>
        </div>
        <div class="sms-messages" id="sms-messages"></div>
        <div class="sms-composer" id="sms-composer" style="display: none;">
          <div class="sms-templates">
            <select id="sms-template-select" class="form-select" style="width: auto;">
              <option value="">Templates...</option>
              ${Store.data.smsTemplates.map(t => `
                <option value="${t.shortcut}">${t.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="sms-input-row">
            <textarea id="sms-input" placeholder="Type a message..." rows="2"></textarea>
            <button class="btn btn-primary" id="sms-send-btn">Send</button>
          </div>
        </div>
      </div>
    `;
    
    // Event listeners
    document.getElementById('sms-search-input').oninput = UI.debounce((e) => {
      this.filterConversations(e.target.value);
    }, 300);
    
    document.getElementById('sms-template-select').onchange = (e) => {
      if (e.target.value) {
        const template = Store.data.smsTemplates.find(t => t.shortcut === e.target.value);
        if (template) {
          document.getElementById('sms-input').value = template.body;
        }
        e.target.value = '';
      }
    };
    
    document.getElementById('sms-send-btn').onclick = () => this.sendMessage();
    
    document.getElementById('sms-input').onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    };
  },
  
  renderConversationItem(conv) {
    const contact = conv.contacts;
    const name = contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : conv.phone_number;
    const initials = contact ? UI.getInitials(`${contact.first_name} ${contact.last_name}`) : '#';
    
    return `
      <div class="sms-conversation-item ${conv.unread_count > 0 ? 'unread' : ''} ${this.currentConversation === conv.id ? 'active' : ''}"
           onclick="SMS.selectConversation('${conv.id}')"
           data-conv-id="${conv.id}">
        <div class="sms-avatar">${initials}</div>
        <div class="sms-conversation-info">
          <div class="sms-conversation-header">
            <span class="sms-conversation-name">${UI.escapeHtml(name)}</span>
            <span class="sms-conversation-time">${conv.last_message_at ? UI.formatRelativeTime(conv.last_message_at) : ''}</span>
          </div>
          <div class="sms-conversation-preview">
            ${conv.last_message_direction === 'outbound' ? '↗️ ' : ''}
            ${UI.escapeHtml(conv.last_message_preview || 'No messages')}
          </div>
        </div>
        ${conv.unread_count > 0 ? `<span class="nav-badge">${conv.unread_count}</span>` : ''}
      </div>
    `;
  },
  
  filterConversations(query) {
    const items = document.querySelectorAll('.sms-conversation-item');
    const lowerQuery = query.toLowerCase();
    
    items.forEach(item => {
      const name = item.querySelector('.sms-conversation-name').textContent.toLowerCase();
      const preview = item.querySelector('.sms-conversation-preview').textContent.toLowerCase();
      const matches = name.includes(lowerQuery) || preview.includes(lowerQuery);
      item.style.display = matches ? '' : 'none';
    });
  },
  
  async selectConversation(conversationId) {
    this.currentConversation = conversationId;
    
    // Update active state
    document.querySelectorAll('.sms-conversation-item').forEach(item => {
      item.classList.toggle('active', item.dataset.convId === conversationId);
    });
    
    // Fetch messages
    const messages = await API.fetchSmsMessages(conversationId);
    
    // Get conversation details
    const conv = Store.data.smsConversations.find(c => c.id === conversationId);
    const contact = conv?.contacts;
    const name = contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : conv?.phone_number;
    
    // Update header
    const header = document.getElementById('sms-header');
    header.innerHTML = `
      <div class="sms-header-info">
        <h3>${UI.escapeHtml(name)}</h3>
        <span class="text-gray-500">${conv?.phone_number ? UI.formatPhone(conv.phone_number) : ''}</span>
      </div>
      <div class="sms-header-actions">
        ${contact ? `
          <button class="btn btn-secondary btn-sm" onclick="Contacts.showDetail('${contact.id}')">
            View Contact
          </button>
        ` : ''}
      </div>
    `;
    
    // Render messages
    const messagesContainer = document.getElementById('sms-messages');
    messagesContainer.innerHTML = messages.map(msg => `
      <div class="sms-message ${msg.direction}">
        <div class="sms-message-content">${UI.escapeHtml(msg.body)}</div>
        <div class="sms-message-time">${UI.formatDateTime(msg.created_at)}</div>
      </div>
    `).join('');
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Show composer
    document.getElementById('sms-composer').style.display = '';
    
    // Focus input
    document.getElementById('sms-input').focus();
    
    // Mark as read (TODO: implement in API)
  },
  
  async sendMessage() {
    if (!this.currentConversation) return;
    
    const input = document.getElementById('sms-input');
    const body = input.value.trim();
    
    if (!body) return;
    
    try {
      await API.sendSms(this.currentConversation, body);
      input.value = '';
      
      // Refresh messages
      await this.selectConversation(this.currentConversation);
      
      // Refresh conversation list
      await API.fetchSmsConversations();
      this.updateConversationList();
      
      UI.toast('Message sent!', 'success');
    } catch (error) {
      console.error('Error sending message:', error);
      UI.toast('Error sending message', 'error');
    }
  },
  
  updateConversationList() {
    const list = document.getElementById('sms-conversations-list');
    const conversations = Store.data.smsConversations;
    
    list.innerHTML = conversations.length === 0 ? 
      '<p class="text-gray-400 text-center p-4">No conversations yet</p>' :
      conversations.map(conv => this.renderConversationItem(conv)).join('');
  },
  
  showNewConversation() {
    const modal = UI.modal({
      title: 'New SMS',
      content: `
        <form class="form">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="tel" id="new-sms-phone" class="form-input" placeholder="+1 (555) 123-4567">
          </div>
          <div class="form-group">
            <label class="form-label">Message</label>
            <textarea id="new-sms-body" class="form-textarea" rows="4" placeholder="Type your message..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Template</label>
            <select id="new-sms-template" class="form-select">
              <option value="">Select template...</option>
              ${Store.data.smsTemplates.map(t => `
                <option value="${t.body}">${t.name}</option>
              `).join('')}
            </select>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="send">Send Message</button>
      `
    });
    
    // Template select
    modal.element.querySelector('#new-sms-template').onchange = (e) => {
      if (e.target.value) {
        modal.element.querySelector('#new-sms-body').value = e.target.value;
      }
    };
    
    modal.element.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    modal.element.querySelector('[data-action="send"]').onclick = async () => {
      const phone = modal.element.querySelector('#new-sms-phone').value.trim();
      const body = modal.element.querySelector('#new-sms-body').value.trim();
      
      if (!phone || !body) {
        UI.toast('Please enter phone and message', 'warning');
        return;
      }
      
      // TODO: Create conversation and send message
      UI.toast('New conversation feature coming soon', 'info');
      modal.close();
    };
  },
  
  startConversation(phone) {
    if (!phone) {
      this.showNewConversation();
      return;
    }
    
    // Find existing conversation
    const conv = Store.data.smsConversations.find(c => c.phone_number === phone);
    
    if (conv) {
      Router.navigate('sms');
      setTimeout(() => this.selectConversation(conv.id), 100);
    } else {
      this.showNewConversation();
      setTimeout(() => {
        document.getElementById('new-sms-phone').value = phone;
      }, 100);
    }
  }
};

// Add CSS
const smsStyles = document.createElement('style');
smsStyles.textContent = `
  .sms-header-info h3 { margin: 0; font-size: 1rem; }
  .sms-header-actions { display: flex; gap: var(--space-2); }
  .sms-input-row { display: flex; gap: var(--space-2); flex: 1; }
  .sms-input-row textarea { flex: 1; resize: none; }
  .sms-templates { margin-bottom: var(--space-2); }
`;
document.head.appendChild(smsStyles);

// Export
window.SMS = SMS;
