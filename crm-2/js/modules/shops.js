// ============================================
// SHOPS MODULE
// ============================================

const Shops = {
  map: null,
  markers: [],
  
  async render(params = {}) {
    await this.loadData();
    this.setupTabs();
    this.renderList();
  },
  
  async loadData() {
    if (!Store.data.shops || Store.data.shops.length === 0) {
      try {
        const { data, error } = await db
          .from('coffee_shops')
          .select('*')
          .limit(100)
          .order('created_at', { ascending: false });
        
        if (data) Store.data.shops = data;
        if (error) console.error('Error loading shops:', error);
      } catch (err) {
        console.error('Error loading shops:', err);
      }
    }
  },
  
  setupTabs() {
    const tabs = document.querySelectorAll('#page-shops .tab-btn');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const view = tab.dataset.view;
        document.getElementById('shops-list-view').classList.toggle('hidden', view !== 'list');
        document.getElementById('shops-map-view').classList.toggle('hidden', view !== 'map');
        
        if (view === 'map') this.renderMap();
      };
    });
  },
  
  renderList() {
    const container = document.getElementById('shops-list-view');
    if (!container) return;
    
    const shops = Store.data.shops || [];
    
    if (shops.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">☕</div>
          <h3>No shops found</h3>
          <p>Try a different filter</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Shop Name</th>
            <th>City</th>
            <th>State</th>
            <th>Rating</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${shops.map(shop => `
            <tr onclick="Shops.showDetail('${shop.id}')" style="cursor:pointer">
              <td><strong>${shop.name || 'Unnamed'}</strong></td>
              <td>${shop.city || '-'}</td>
              <td>${shop.state || '-'}</td>
              <td>${shop.rating ? '⭐ ' + shop.rating : '-'}</td>
              <td><span class="badge badge-${shop.is_partner ? 'success' : 'default'}">${shop.is_partner ? 'Partner' : 'Prospect'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },
  
  renderMap() {
    const container = document.getElementById('shops-map-view');
    if (!container || !CONFIG.MAPBOX_TOKEN) return;
    
    if (!this.map) {
      mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;
      this.map = new mapboxgl.Map({
        container: 'shops-map-view',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-98.5795, 39.8283],
        zoom: 3
      });
    }
    
    // Clear existing markers
    this.markers.forEach(m => m.remove());
    this.markers = [];
    
    // Add markers for shops with coordinates
    const shops = Store.data.shops || [];
    shops.forEach(shop => {
      if (shop.longitude && shop.latitude) {
        const marker = new mapboxgl.Marker()
          .setLngLat([shop.longitude, shop.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${shop.name}</strong><br>${shop.city}, ${shop.state}`))
          .addTo(this.map);
        this.markers.push(marker);
      }
    });
  },
  
  showDetail(id) {
    console.log('Show shop detail:', id);
  }
};

window.Shops = Shops;
