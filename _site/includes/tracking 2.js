(function() {
  var shopId = document.body.dataset.shopId || null;
  var contactId = null; // Set if user identified
  
  function track(eventType, subtype, extra) {
    var data = {
      event_type: eventType,
      activity_subtype: subtype || null,
      page_url: window.location.href,
      page_title: document.title,
      shop_id: shopId,
      contact_id: contactId,
      referrer: document.referrer,
      metadata: extra || {}
    };
    
    fetch('/.netlify/functions/track-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(function() {});
  }
  
  // Track page view on load
  track('page_view');
  
  // Expose for manual tracking
  window.joeTrack = track;
})();
