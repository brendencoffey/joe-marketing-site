// Shops Module - Full Shop Detail with all CRM data
const Shops = {
    shops: [],
    currentShop: null,
    
    async render(params = {}) {
        // Check for detail view
        if (params.id) {
            await this.showDetail(params.id);
            return;
        }
        
        // Load and render list
        await this.loadShops();
        this.setupFilters();
        this.renderList();
    },
    
    async loadShops() {
        try {
            const { data, error } = await db
                .from('shops')
                .select('*')
                .order('name')
                .limit(500);
            
            if (error) {
                console.error('Error loading shops:', error);
                this.shops = [];
            } else {
                this.shops = data || [];
            }
        } catch (err) {
            console.error('Error loading shops:', err);
            this.shops = [];
        }
    },
    
    setupFilters() {
        const filtersContainer = document.getElementById('shops-filters');
        if (filtersContainer) {
            filtersContainer.innerHTML = `
                <div class="filter-row">
                    <input type="text" id="shops-search" class="search-input" placeholder="Search shops..." oninput="Shops.renderList()">
                    <select id="shops-type-filter" class="filter-select" onchange="Shops.renderList()">
                        <option value="">All Types</option>
                        <option value="cafe">Cafe</option>
                        <option value="roaster">Roaster</option>
                        <option value="drive-thru">Drive-Thru</option>
                        <option value="cafe-drive-thru">Cafe + Drive-Thru</option>
                        <option value="kiosk">Kiosk</option>
                    </select>
                    <select id="shops-partner-filter" class="filter-select" onchange="Shops.renderList()">
                        <option value="">All Shops</option>
                        <option value="partner">joe Partners</option>
                        <option value="prospect">Prospects</option>
                    </select>
                    <select id="shops-state-filter" class="filter-select" onchange="Shops.renderList()">
                        <option value="">All States</option>
                    </select>
                </div>
            `;
            
            // Populate state filter with unique states
            const states = [...new Set(this.shops.map(s => s.state).filter(Boolean))].sort();
            const stateSelect = document.getElementById('shops-state-filter');
            if (stateSelect) {
                states.forEach(state => {
                    stateSelect.innerHTML += `<option value="${state}">${state}</option>`;
                });
            }
        }
    },
    
    renderList() {
        const container = document.getElementById('shops-list-view');
        if (!container) return;
        
        let filtered = [...this.shops];
        
        // Apply filters
        const search = document.getElementById('shops-search')?.value?.toLowerCase();
        const typeFilter = document.getElementById('shops-type-filter')?.value;
        const partnerFilter = document.getElementById('shops-partner-filter')?.value;
        const stateFilter = document.getElementById('shops-state-filter')?.value;
        
        if (search) {
            filtered = filtered.filter(s => 
                (s.name || '').toLowerCase().includes(search) ||
                (s.city || '').toLowerCase().includes(search)
            );
        }
        if (typeFilter) {
            filtered = filtered.filter(s => s.coffee_shop_type === typeFilter);
        }
        if (partnerFilter === 'partner') {
            filtered = filtered.filter(s => s.is_joe_partner);
        } else if (partnerFilter === 'prospect') {
            filtered = filtered.filter(s => !s.is_joe_partner);
        }
        if (stateFilter) {
            filtered = filtered.filter(s => s.state === stateFilter);
        }
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">☕</div>
                    <h3>No shops found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="shops-grid">
                ${filtered.slice(0, 100).map(shop => this.renderShopCard(shop)).join('')}
            </div>
            ${filtered.length > 100 ? `<p class="text-muted" style="margin-top:16px;">Showing first 100 of ${filtered.length} shops</p>` : ''}
        `;
        
        if (window.lucide) lucide.createIcons();
    },
    
    renderShopCard(shop) {
        return `
            <div class="shop-card" onclick="Shops.showDetail('${shop.id}')">
                <div class="shop-card-header">
                    <h3>${shop.name || 'Unknown Shop'}</h3>
                    ${shop.is_joe_partner ? '<span class="badge badge-green">Partner</span>' : ''}
                </div>
                <div class="shop-card-meta">
                    <span><i data-lucide="map-pin"></i> ${shop.city || ''}, ${shop.state || ''}</span>
                    ${shop.google_rating ? `<span><i data-lucide="star"></i> ${shop.google_rating}</span>` : ''}
                </div>
                ${shop.coffee_shop_type ? `<span class="badge badge-gray">${shop.coffee_shop_type}</span>` : ''}
            </div>
        `;
    },
    
    async showDetail(id) {
        const supabase = db;
        
        // Load shop with all related data
        const { data: shop, error } = await supabase
            .from('shops')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error || !shop) {
            console.error('Error loading shop:', error);
            return;
        }
        
        this.currentShop = shop;
        
        // Load related deals
        const { data: deals } = await supabase
            .from('deals')
            .select('*, companies(name)')
            .eq('shop_id', id);
        
        // Load related contacts
        const { data: contacts } = await supabase
            .from('contact_shops')
            .select('contacts(*)')
            .eq('shop_id', id);
        
        // Load invoices
        const { data: invoices } = await supabase
            .from('invoices')
            .select('*')
            .eq('shop_id', id)
            .order('created_at', { ascending: false });
        
        // Load joe products used
        const { data: products } = await supabase
            .from('joe_products')
            .select('*');
        
        // Load shop analytics
        const { data: analytics } = await supabase
            .from('shop_analytics')
            .select('*')
            .eq('shop_id', id)
            .order('date', { ascending: false })
            .limit(30);
        
        this.renderDetail(shop, deals || [], contacts || [], invoices || [], products || [], analytics || []);
    },
    
    renderDetail(shop, deals, contacts, invoices, products, analytics) {
        const container = document.getElementById('shops-list-view');
        if (!container) return;
        
        const contactList = contacts.map(c => c.contacts).filter(Boolean);
        
        // Calculate analytics
        const totalViews = analytics.reduce((sum, a) => sum + (a.page_views || 0), 0);
        const totalOrders = analytics.reduce((sum, a) => sum + (a.orders || 0), 0);
        
        container.innerHTML = `
            <div class="shop-detail">
                <!-- Header -->
                <div class="shop-detail-header">
                    <div class="shop-header-left">
                        <a href="#shops" class="back-link"><i data-lucide="arrow-left"></i> Back</a>
                        <div class="shop-title-section">
                            <h1>${shop.name || 'Unknown Shop'}</h1>
                            <div class="shop-subtitle">
                                <span>${shop.city || ''}, ${shop.state || ''}</span>
                                ${shop.is_joe_partner ? '<span class="badge badge-green">joe Partner</span>' : '<span class="badge badge-gray">Prospect</span>'}
                                ${shop.coffee_shop_type ? `<span class="badge badge-blue">${shop.coffee_shop_type}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="shop-header-actions">
                        <button class="btn btn-secondary" onclick="Shops.editShop()">
                            <i data-lucide="edit-2"></i> Edit
                        </button>
                        <button class="btn btn-primary" onclick="Shops.createInvoice()">
                            <i data-lucide="file-text"></i> Create Invoice
                        </button>
                    </div>
                </div>
                
                <!-- Quick Links -->
                <div class="quick-links-bar">
                    <a href="https://joe.coffee/locations/${shop.id}" target="_blank" class="quick-link">
                        <i data-lucide="external-link"></i> View on joe.coffee
                    </a>
                    ${shop.is_joe_partner ? `
                        <a href="https://joe.coffee/owner/admin/${shop.id}" target="_blank" class="quick-link">
                            <i data-lucide="layout-dashboard"></i> Owner Dashboard
                        </a>
                    ` : ''}
                    ${shop.website ? `
                        <a href="${shop.website}" target="_blank" class="quick-link">
                            <i data-lucide="globe"></i> Website
                        </a>
                    ` : ''}
                    ${shop.ordering_url ? `
                        <a href="${shop.ordering_url}" target="_blank" class="quick-link">
                            <i data-lucide="shopping-cart"></i> Online Ordering
                        </a>
                    ` : ''}
                </div>
                
                <!-- Stats Row -->
                <div class="stats-row">
                    <div class="stat-card">
                        <span class="stat-label">Google Rating</span>
                        <span class="stat-value">${shop.google_rating || '-'} <small>★</small></span>
                        <span class="stat-detail">${shop.google_reviews || 0} reviews</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Yelp Rating</span>
                        <span class="stat-value">${shop.yelp_rating || '-'} <small>★</small></span>
                        <span class="stat-detail">${shop.yelp_reviews || 0} reviews</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Page Views</span>
                        <span class="stat-value">${totalViews}</span>
                        <span class="stat-detail">Last 30 days</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Orders</span>
                        <span class="stat-value">${totalOrders}</span>
                        <span class="stat-detail">Last 30 days</span>
                    </div>
                </div>
                
                <!-- Tabs -->
                <div class="shop-tabs">
                    <button class="tab-btn active" onclick="Shops.switchTab('overview')">Overview</button>
                    <button class="tab-btn" onclick="Shops.switchTab('deals')">Deals (${deals.length})</button>
                    <button class="tab-btn" onclick="Shops.switchTab('contacts')">Contacts (${contactList.length})</button>
                    <button class="tab-btn" onclick="Shops.switchTab('invoices')">Invoices (${invoices.length})</button>
                    <button class="tab-btn" onclick="Shops.switchTab('activity')">Activity</button>
                </div>
                
                <!-- Tab Content -->
                <div class="tab-content" id="tab-overview">
                    <div class="detail-grid">
                        <!-- Left Column -->
                        <div class="detail-main">
                            <!-- Shop Details Card -->
                            <div class="card">
                                <div class="card-header">
                                    <h3>Shop Details</h3>
                                    <button class="btn-icon" onclick="Shops.editShop()"><i data-lucide="edit-2"></i></button>
                                </div>
                                <div class="details-grid">
                                    <div class="detail-row">
                                        <span class="detail-label">Address</span>
                                        <span class="detail-value">${shop.address || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">City, State</span>
                                        <span class="detail-value">${shop.city || ''}, ${shop.state || ''} ${shop.zip || ''}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Phone</span>
                                        <span class="detail-value">${shop.phone || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Email</span>
                                        <span class="detail-value">${shop.email || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Website</span>
                                        <span class="detail-value">${shop.website ? `<a href="${shop.website}" target="_blank">${shop.website}</a>` : '-'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Operations Card -->
                            <div class="card">
                                <div class="card-header">
                                    <h3>Operations & ICP Fit</h3>
                                </div>
                                <div class="details-grid">
                                    <div class="detail-row">
                                        <span class="detail-label">Shop Type</span>
                                        <span class="detail-value">${shop.coffee_shop_type || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Locations</span>
                                        <span class="detail-value">${shop.num_locations || 1}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Monthly Revenue</span>
                                        <span class="detail-value">${shop.monthly_revenue ? '$' + Number(shop.monthly_revenue).toLocaleString() : '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Current Ordering</span>
                                        <span class="detail-value">
                                            ${shop.ordering_platform || 'None'}
                                            ${shop.ordering_url ? `<a href="${shop.ordering_url}" target="_blank" class="link-icon"><i data-lucide="external-link"></i></a>` : ''}
                                        </span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Pipeline Stage</span>
                                        <span class="detail-value">${shop.pipeline_stage || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Lead Source</span>
                                        <span class="detail-value">${shop.lead_source || '-'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">ICP Score</span>
                                        <span class="detail-value">${shop.lead_score || '-'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Social Links Card -->
                            <div class="card">
                                <div class="card-header">
                                    <h3>Social Links</h3>
                                    <button class="btn-icon" onclick="Shops.editSocialLinks()"><i data-lucide="edit-2"></i></button>
                                </div>
                                <div class="social-links-grid">
                                    ${this.renderSocialLink('instagram', shop.instagram_url)}
                                    ${this.renderSocialLink('facebook', shop.facebook_url)}
                                    ${this.renderSocialLink('twitter', shop.twitter_url)}
                                    ${this.renderSocialLink('tiktok', shop.tiktok_url)}
                                    ${this.renderSocialLink('linkedin', shop.linkedin_url)}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Right Sidebar -->
                        <div class="detail-sidebar">
                            <!-- joe Products Card -->
                            <div class="card">
                                <div class="card-header">
                                    <h3>joe Products</h3>
                                </div>
                                <div class="products-list">
                                    ${shop.is_joe_partner ? `
                                        <div class="product-item active">
                                            <i data-lucide="check-circle"></i>
                                            <span>joe OS (POS)</span>
                                        </div>
                                        <div class="product-item active">
                                            <i data-lucide="check-circle"></i>
                                            <span>Mobile Ordering</span>
                                        </div>
                                        <div class="product-item active">
                                            <i data-lucide="check-circle"></i>
                                            <span>Loyalty Program</span>
                                        </div>
                                    ` : `
                                        <div class="product-item inactive">
                                            <i data-lucide="circle"></i>
                                            <span>joe OS (POS)</span>
                                        </div>
                                        <div class="product-item inactive">
                                            <i data-lucide="circle"></i>
                                            <span>Mobile Ordering</span>
                                        </div>
                                        <div class="product-item inactive">
                                            <i data-lucide="circle"></i>
                                            <span>Loyalty Program</span>
                                        </div>
                                    `}
                                </div>
                            </div>
                            
                            <!-- Active Deals Card -->
                            <div class="card">
                                <div class="card-header">
                                    <h3>Active Deals</h3>
                                    <button class="btn-icon" onclick="Shops.createDeal()"><i data-lucide="plus"></i></button>
                                </div>
                                ${deals.length > 0 ? deals.slice(0, 3).map(deal => `
                                    <div class="mini-deal-card" onclick="window.location.hash='#deals/${deal.id}'">
                                        <div class="mini-deal-name">${deal.name}</div>
                                        <span class="badge badge-${this.getStageColor(deal.stage)}">${deal.stage}</span>
                                        <span class="mini-deal-value">$${Number(deal.value || 0).toLocaleString()}</span>
                                    </div>
                                `).join('') : '<div class="empty-mini">No active deals</div>'}
                            </div>
                            
                            <!-- Contacts Card -->
                            <div class="card">
                                <div class="card-header">
                                    <h3>Contacts</h3>
                                    <button class="btn-icon" onclick="Shops.addContact()"><i data-lucide="plus"></i></button>
                                </div>
                                ${contactList.length > 0 ? contactList.slice(0, 3).map(contact => `
                                    <div class="mini-contact-card" onclick="window.location.hash='#contacts/${contact.id}'">
                                        <div class="avatar-sm">${(contact.first_name || '?')[0]}${(contact.last_name || '')[0]}</div>
                                        <div class="mini-contact-info">
                                            <div class="mini-contact-name">${contact.first_name || ''} ${contact.last_name || ''}</div>
                                            <div class="mini-contact-title">${contact.title || ''}</div>
                                        </div>
                                    </div>
                                `).join('') : '<div class="empty-mini">No contacts</div>'}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Deals Tab -->
                <div class="tab-content hidden" id="tab-deals">
                    <div class="card">
                        <div class="card-header">
                            <h3>All Deals</h3>
                            <button class="btn btn-primary btn-sm" onclick="Shops.createDeal()">
                                <i data-lucide="plus"></i> New Deal
                            </button>
                        </div>
                        ${deals.length > 0 ? `
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Deal Name</th>
                                        <th>Stage</th>
                                        <th>Value</th>
                                        <th>Expected Close</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${deals.map(deal => `
                                        <tr class="clickable-row" onclick="window.location.hash='#deals/${deal.id}'">
                                            <td>${deal.name}</td>
                                            <td><span class="badge badge-${this.getStageColor(deal.stage)}">${deal.stage}</span></td>
                                            <td>$${Number(deal.value || 0).toLocaleString()}</td>
                                            <td>${deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<div class="empty-state">No deals yet</div>'}
                    </div>
                </div>
                
                <!-- Contacts Tab -->
                <div class="tab-content hidden" id="tab-contacts">
                    <div class="card">
                        <div class="card-header">
                            <h3>All Contacts</h3>
                            <button class="btn btn-primary btn-sm" onclick="Shops.addContact()">
                                <i data-lucide="plus"></i> Add Contact
                            </button>
                        </div>
                        ${contactList.length > 0 ? `
                            <div class="contacts-grid">
                                ${contactList.map(contact => `
                                    <div class="contact-card" onclick="window.location.hash='#contacts/${contact.id}'">
                                        <div class="avatar-md">${(contact.first_name || '?')[0]}${(contact.last_name || '')[0]}</div>
                                        <div class="contact-card-info">
                                            <div class="contact-card-name">${contact.first_name || ''} ${contact.last_name || ''}</div>
                                            <div class="contact-card-title">${contact.title || ''}</div>
                                            <div class="contact-card-email">${contact.email || ''}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div class="empty-state">No contacts yet</div>'}
                    </div>
                </div>
                
                <!-- Invoices Tab -->
                <div class="tab-content hidden" id="tab-invoices">
                    <div class="card">
                        <div class="card-header">
                            <h3>Invoices</h3>
                            <button class="btn btn-primary btn-sm" onclick="Shops.createInvoice()">
                                <i data-lucide="plus"></i> Create Invoice
                            </button>
                        </div>
                        ${invoices.length > 0 ? `
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Invoice #</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invoices.map(inv => `
                                        <tr>
                                            <td>${inv.id.slice(0, 8)}...</td>
                                            <td>$${Number(inv.amount || 0).toLocaleString()}</td>
                                            <td><span class="badge badge-${inv.status === 'paid' ? 'green' : inv.status === 'pending' ? 'yellow' : 'gray'}">${inv.status}</span></td>
                                            <td>${new Date(inv.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <button class="btn-icon" onclick="Shops.viewInvoice('${inv.id}')" title="View">
                                                    <i data-lucide="eye"></i>
                                                </button>
                                                <button class="btn-icon" onclick="Shops.sendInvoice('${inv.id}')" title="Send">
                                                    <i data-lucide="send"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<div class="empty-state">No invoices yet</div>'}
                    </div>
                </div>
                
                <!-- Activity Tab -->
                <div class="tab-content hidden" id="tab-activity">
                    <div class="card">
                        <div class="card-header">
                            <h3>Activity</h3>
                            <button class="btn btn-secondary btn-sm" onclick="Shops.logActivity()">
                                <i data-lucide="plus"></i> Log Activity
                            </button>
                        </div>
                        <div class="activity-timeline">
                            <div class="empty-state">No activity logged yet</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        if (window.lucide) lucide.createIcons();
    },
    
    renderSocialLink(platform, url) {
        const icons = {
            instagram: 'instagram',
            facebook: 'facebook',
            twitter: 'twitter',
            tiktok: 'music',
            linkedin: 'linkedin'
        };
        
        if (url) {
            return `
                <a href="${url}" target="_blank" class="social-link active">
                    <i data-lucide="${icons[platform] || 'link'}"></i>
                    <span>${platform}</span>
                </a>
            `;
        }
        return `
            <div class="social-link inactive">
                <i data-lucide="${icons[platform] || 'link'}"></i>
                <span>${platform}</span>
            </div>
        `;
    },
    
    getStageColor(stage) {
        const colors = {
            'New': 'gray',
            'Contacted': 'blue',
            'Qualified': 'yellow',
            'Demo': 'orange',
            'Proposal': 'purple',
            'Won': 'green',
            'Lost': 'red'
        };
        return colors[stage] || 'gray';
    },
    
    switchTab(tab) {
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(`tab-${tab}`).classList.remove('hidden');
    },
    
    editShop() {
        if (!this.currentShop) return;
        const shop = this.currentShop;
        
        UI.showModal('Edit Shop', `
            <form id="edit-shop-form">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Shop Name</label>
                        <input type="text" name="name" value="${shop.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" name="phone" value="${shop.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" value="${shop.email || ''}">
                    </div>
                    <div class="form-group">
                        <label>Website</label>
                        <input type="url" name="website" value="${shop.website || ''}">
                    </div>
                    <div class="form-group">
                        <label>Address</label>
                        <input type="text" name="address" value="${shop.address || ''}">
                    </div>
                    <div class="form-group">
                        <label>City</label>
                        <input type="text" name="city" value="${shop.city || ''}">
                    </div>
                    <div class="form-group">
                        <label>State</label>
                        <input type="text" name="state" value="${shop.state || ''}">
                    </div>
                    <div class="form-group">
                        <label>Zip</label>
                        <input type="text" name="zip" value="${shop.zip || ''}">
                    </div>
                    <div class="form-group">
                        <label>Coffee Shop Type</label>
                        <select name="coffee_shop_type">
                            <option value="">Select type...</option>
                            <option value="cafe" ${shop.coffee_shop_type === 'cafe' ? 'selected' : ''}>Cafe</option>
                            <option value="roaster" ${shop.coffee_shop_type === 'roaster' ? 'selected' : ''}>Roaster</option>
                            <option value="drive-thru" ${shop.coffee_shop_type === 'drive-thru' ? 'selected' : ''}>Drive-Thru</option>
                            <option value="cafe-drive-thru" ${shop.coffee_shop_type === 'cafe-drive-thru' ? 'selected' : ''}>Cafe + Drive-Thru</option>
                            <option value="kiosk" ${shop.coffee_shop_type === 'kiosk' ? 'selected' : ''}>Kiosk</option>
                            <option value="pop-up" ${shop.coffee_shop_type === 'pop-up' ? 'selected' : ''}>Pop-Up</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Ordering Platform</label>
                        <select name="ordering_platform">
                            <option value="">None</option>
                            <option value="joe" ${shop.ordering_platform === 'joe' ? 'selected' : ''}>joe</option>
                            <option value="Square" ${shop.ordering_platform === 'Square' ? 'selected' : ''}>Square</option>
                            <option value="Toast" ${shop.ordering_platform === 'Toast' ? 'selected' : ''}>Toast</option>
                            <option value="DoorDash" ${shop.ordering_platform === 'DoorDash' ? 'selected' : ''}>DoorDash Storefront</option>
                            <option value="ChowNow" ${shop.ordering_platform === 'ChowNow' ? 'selected' : ''}>ChowNow</option>
                            <option value="Olo" ${shop.ordering_platform === 'Olo' ? 'selected' : ''}>Olo</option>
                            <option value="PopMenu" ${shop.ordering_platform === 'PopMenu' ? 'selected' : ''}>PopMenu</option>
                            <option value="Owner" ${shop.ordering_platform === 'Owner' ? 'selected' : ''}>Owner.com</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Ordering URL</label>
                        <input type="url" name="ordering_url" value="${shop.ordering_url || ''}">
                    </div>
                    <div class="form-group">
                        <label>Monthly Revenue</label>
                        <input type="number" name="monthly_revenue" value="${shop.monthly_revenue || ''}">
                    </div>
                    <div class="form-group">
                        <label>Number of Locations</label>
                        <input type="number" name="num_locations" value="${shop.num_locations || 1}">
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `, async () => {
            const form = document.getElementById('edit-shop-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const updates = Object.fromEntries(formData.entries());
                
                const supabase = db;
                const { error } = await supabase
                    .from('shops')
                    .update(updates)
                    .eq('id', shop.id);
                
                if (error) {
                    alert('Error updating shop: ' + error.message);
                } else {
                    UI.closeModal();
                    this.showDetail(shop.id);
                }
            };
        });
    },
    
    editSocialLinks() {
        if (!this.currentShop) return;
        const shop = this.currentShop;
        
        UI.showModal('Edit Social Links', `
            <form id="edit-social-form">
                <div class="form-group">
                    <label><i data-lucide="instagram"></i> Instagram URL</label>
                    <input type="url" name="instagram_url" value="${shop.instagram_url || ''}" placeholder="https://instagram.com/...">
                </div>
                <div class="form-group">
                    <label><i data-lucide="facebook"></i> Facebook URL</label>
                    <input type="url" name="facebook_url" value="${shop.facebook_url || ''}" placeholder="https://facebook.com/...">
                </div>
                <div class="form-group">
                    <label><i data-lucide="twitter"></i> Twitter URL</label>
                    <input type="url" name="twitter_url" value="${shop.twitter_url || ''}" placeholder="https://twitter.com/...">
                </div>
                <div class="form-group">
                    <label><i data-lucide="music"></i> TikTok URL</label>
                    <input type="url" name="tiktok_url" value="${shop.tiktok_url || ''}" placeholder="https://tiktok.com/@...">
                </div>
                <div class="form-group">
                    <label><i data-lucide="linkedin"></i> LinkedIn URL</label>
                    <input type="url" name="linkedin_url" value="${shop.linkedin_url || ''}" placeholder="https://linkedin.com/company/...">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        `, async () => {
            if (window.lucide) lucide.createIcons();
            const form = document.getElementById('edit-social-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const updates = Object.fromEntries(formData.entries());
                
                const supabase = db;
                const { error } = await supabase
                    .from('shops')
                    .update(updates)
                    .eq('id', shop.id);
                
                if (error) {
                    alert('Error updating social links: ' + error.message);
                } else {
                    UI.closeModal();
                    this.showDetail(shop.id);
                }
            };
        });
    },
    
    createInvoice() {
        if (!this.currentShop) return;
        const shop = this.currentShop;
        
        UI.showModal('Create Invoice', `
            <form id="create-invoice-form">
                <div class="form-group">
                    <label>Shop</label>
                    <input type="text" value="${shop.name}" disabled>
                </div>
                <div class="form-group">
                    <label>Amount ($)</label>
                    <input type="number" name="amount" step="0.01" required placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="notes" rows="3" placeholder="Invoice description..."></textarea>
                </div>
                <div class="form-group">
                    <label>Items (JSON)</label>
                    <textarea name="items" rows="3" placeholder='[{"name": "Setup Fee", "amount": 100}]'></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create Invoice</button>
                </div>
            </form>
        `, () => {
            const form = document.getElementById('create-invoice-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                
                let items = [];
                try {
                    const itemsStr = formData.get('items');
                    if (itemsStr) items = JSON.parse(itemsStr);
                } catch (err) {
                    console.error('Invalid items JSON');
                }
                
                const invoice = {
                    shop_id: shop.id,
                    amount: parseFloat(formData.get('amount')),
                    notes: formData.get('notes'),
                    items: items,
                    status: 'pending'
                };
                
                const supabase = db;
                const { data, error } = await supabase
                    .from('invoices')
                    .insert([invoice])
                    .select()
                    .single();
                
                if (error) {
                    alert('Error creating invoice: ' + error.message);
                } else {
                    UI.closeModal();
                    alert('Invoice created successfully!');
                    this.showDetail(shop.id);
                }
            };
        });
    },
    
    async sendInvoice(invoiceId) {
        if (!confirm('Send this invoice via email?')) return;
        
        // In production, this would integrate with an email service
        alert('Invoice sending functionality would be implemented here.\n\nThis would:\n1. Generate a PDF invoice\n2. Send via email to the shop contact\n3. Update invoice status to "sent"');
    },
    
    async viewInvoice(invoiceId) {
        const supabase = db;
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .single();
        
        if (error || !invoice) {
            alert('Error loading invoice');
            return;
        }
        
        UI.showModal('Invoice Details', `
            <div class="invoice-preview">
                <div class="invoice-header">
                    <h2>Invoice</h2>
                    <span class="badge badge-${invoice.status === 'paid' ? 'green' : 'yellow'}">${invoice.status}</span>
                </div>
                <div class="invoice-details">
                    <div class="detail-row">
                        <span>Invoice ID:</span>
                        <span>${invoice.id}</span>
                    </div>
                    <div class="detail-row">
                        <span>Amount:</span>
                        <span class="invoice-amount">$${Number(invoice.amount).toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span>Created:</span>
                        <span>${new Date(invoice.created_at).toLocaleDateString()}</span>
                    </div>
                    ${invoice.notes ? `
                        <div class="detail-row">
                            <span>Notes:</span>
                            <span>${invoice.notes}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>
                    ${invoice.status === 'pending' ? `
                        <button class="btn btn-primary" onclick="Shops.markInvoicePaid('${invoice.id}')">Mark as Paid</button>
                    ` : ''}
                </div>
            </div>
        `);
    },
    
    async markInvoicePaid(invoiceId) {
        const supabase = db;
        const { error } = await supabase
            .from('invoices')
            .update({ status: 'paid' })
            .eq('id', invoiceId);
        
        if (error) {
            alert('Error updating invoice: ' + error.message);
        } else {
            UI.closeModal();
            this.showDetail(this.currentShop.id);
        }
    },
    
    createDeal() {
        if (!this.currentShop) return;
        // Navigate to deals with prefilled shop
        if (window.Deals && Deals.showNewDealModal) {
            Deals.showNewDealModal(this.currentShop.id, this.currentShop.name);
        }
    },
    
    addContact() {
        // Show add contact modal
        UI.showModal('Add Contact', `
            <form id="add-contact-form">
                <div class="form-grid">
                    <div class="form-group">
                        <label>First Name</label>
                        <input type="text" name="first_name" required>
                    </div>
                    <div class="form-group">
                        <label>Last Name</label>
                        <input type="text" name="last_name">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email">
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" name="phone">
                    </div>
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" name="title" placeholder="e.g. Owner, Manager">
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Contact</button>
                </div>
            </form>
        `, () => {
            const form = document.getElementById('add-contact-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const contact = Object.fromEntries(formData.entries());
                
                const supabase = db;
                
                // Create contact
                const { data: newContact, error: contactError } = await supabase
                    .from('contacts')
                    .insert([contact])
                    .select()
                    .single();
                
                if (contactError) {
                    alert('Error creating contact: ' + contactError.message);
                    return;
                }
                
                // Link to shop
                const { error: linkError } = await supabase
                    .from('contact_shops')
                    .insert([{ contact_id: newContact.id, shop_id: this.currentShop.id }]);
                
                if (linkError) {
                    console.error('Error linking contact to shop:', linkError);
                }
                
                UI.closeModal();
                this.showDetail(this.currentShop.id);
            };
        });
    },
    
    logActivity() {
        UI.showModal('Log Activity', `
            <form id="log-activity-form">
                <div class="form-group">
                    <label>Activity Type</label>
                    <select name="type" required>
                        <option value="call">Call</option>
                        <option value="email">Email</option>
                        <option value="meeting">Meeting</option>
                        <option value="note">Note</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" rows="4" required placeholder="What happened?"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Log Activity</button>
                </div>
            </form>
        `, () => {
            const form = document.getElementById('log-activity-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                
                const activity = {
                    type: formData.get('type'),
                    notes: formData.get('notes'),
                    shop_id: this.currentShop.id,
                    created_at: new Date().toISOString()
                };
                
                const supabase = db;
                const { error } = await supabase
                    .from('activities')
                    .insert([activity]);
                
                if (error) {
                    alert('Error logging activity: ' + error.message);
                } else {
                    UI.closeModal();
                    this.showDetail(this.currentShop.id);
                }
            };
        });
    }
};

// Make globally available
window.Shops = Shops;
