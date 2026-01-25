/**
 * joe Website Tracking Script
 * Add to all pages: <script src="/js/track.js"></script>
 */
(function() {
  'use strict';

  const TRACK_ENDPOINT = '/.netlify/functions/track';
  const VISITOR_KEY = 'joe_visitor_id';
  const EMAIL_KEY = 'joe_visitor_email';

  // Generate or retrieve visitor ID
  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  // Get stored email (from previous form submission)
  function getVisitorEmail() {
    // Check localStorage
    let email = localStorage.getItem(EMAIL_KEY);
    
    // Check URL params (for email links)
    if (!email) {
      const params = new URLSearchParams(window.location.search);
      email = params.get('email') || params.get('e');
      if (email) {
        localStorage.setItem(EMAIL_KEY, email);
      }
    }
    
    return email;
  }

  // Store email when captured
  window.joeSetEmail = function(email) {
    if (email) {
      localStorage.setItem(EMAIL_KEY, email);
    }
  };

  // Send tracking event
  function track(eventType, metadata = {}) {
    const data = {
      event: eventType,
      page: window.location.pathname,
      title: document.title,
      visitorId: getVisitorId(),
      email: getVisitorEmail(),
      referrer: document.referrer,
      metadata: metadata
    };

    // Use sendBeacon for reliability (doesn't block page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TRACK_ENDPOINT, JSON.stringify(data));
    } else {
      fetch(TRACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(() => {});
    }
  }

  // Detect page type
  function getPageType() {
    const path = window.location.pathname;
    
    if (path.includes('/blog/testimonials/') || path.includes('/partners/')) {
      return 'testimonial';
    }
    if (path.includes('/blog/')) {
      return 'blog';
    }
    if (path.includes('/pricing') || path.includes('/plans')) {
      return 'pricing';
    }
    if (path.includes('/demo') || path.includes('/contact') || path.includes('/get-started')) {
      return 'high_intent';
    }
    return 'page';
  }

  // Track page view on load
  function trackPageView() {
    const pageType = getPageType();
    
    switch (pageType) {
      case 'testimonial':
        track('testimonial_view');
        break;
      case 'blog':
        track('blog_read');
        break;
      case 'pricing':
        track('pricing_view');
        break;
      case 'high_intent':
        track('page_view', { high_intent: true });
        break;
      default:
        track('page_view');
    }
  }

  // Track scroll depth
  let maxScroll = 0;
  let scrollTracked = { 25: false, 50: false, 75: false, 90: false };
  
  function trackScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = Math.round((scrollTop / docHeight) * 100);
    
    if (scrollPercent > maxScroll) {
      maxScroll = scrollPercent;
      
      // Track milestone scroll depths
      [25, 50, 75, 90].forEach(milestone => {
        if (scrollPercent >= milestone && !scrollTracked[milestone]) {
          scrollTracked[milestone] = true;
          if (milestone >= 75) {
            track('scroll_depth', { depth: milestone });
          }
        }
      });
    }
  }

  // Track time on page
  let startTime = Date.now();
  let timeTracked = { 30: false, 60: false, 120: false, 300: false };
  
  function trackTime() {
    const seconds = Math.round((Date.now() - startTime) / 1000);
    
    [30, 60, 120, 300].forEach(milestone => {
      if (seconds >= milestone && !timeTracked[milestone]) {
        timeTracked[milestone] = true;
        if (milestone >= 60) {
          track('time_on_page', { seconds: milestone });
        }
      }
    });
  }

  // Track CTA clicks
  function trackCTAClicks() {
    document.addEventListener('click', function(e) {
      const target = e.target.closest('a, button');
      if (!target) return;
      
      const text = target.textContent?.trim().toLowerCase() || '';
      const href = target.href || '';
      
      // Detect CTA patterns
      const ctaPatterns = [
        'get started', 'sign up', 'try', 'demo', 'contact', 'schedule',
        'learn more', 'join', 'subscribe', 'download', 'apply'
      ];
      
      const isCTA = ctaPatterns.some(pattern => text.includes(pattern)) ||
                    href.includes('/get-started') ||
                    href.includes('/demo') ||
                    href.includes('/contact') ||
                    target.classList.contains('btn-primary') ||
                    target.classList.contains('cta');
      
      if (isCTA) {
        track('cta_click', { 
          cta: text.substring(0, 50),
          href: href
        });
      }
    });
  }

  // Track form submissions (to capture email)
  function trackForms() {
    document.addEventListener('submit', function(e) {
      const form = e.target;
      const emailInput = form.querySelector('input[type="email"], input[name="email"]');
      
      if (emailInput && emailInput.value) {
        window.joeSetEmail(emailInput.value);
        track('form_submit', { 
          formId: form.id || 'unknown',
          hasEmail: true
        });
      }
    });
  }

  // Track outbound links
  function trackOutbound() {
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a[href]');
      if (!link) return;
      
      const href = link.href;
      if (href && !href.includes(window.location.hostname) && href.startsWith('http')) {
        track('outbound_click', { url: href });
      }
    });
  }

  // Initialize
  function init() {
    // Track page view
    trackPageView();
    
    // Set up scroll tracking (throttled)
    let scrollTimeout;
    window.addEventListener('scroll', function() {
      if (!scrollTimeout) {
        scrollTimeout = setTimeout(function() {
          trackScroll();
          scrollTimeout = null;
        }, 200);
      }
    }, { passive: true });
    
    // Set up time tracking
    setInterval(trackTime, 10000);
    
    // Track CTA clicks
    trackCTAClicks();
    
    // Track forms
    trackForms();
    
    // Track outbound links
    trackOutbound();
    
    // Track before page unload (final scroll depth)
    window.addEventListener('beforeunload', function() {
      if (maxScroll >= 50) {
        track('page_exit', { 
          maxScroll: maxScroll,
          timeOnPage: Math.round((Date.now() - startTime) / 1000)
        });
      }
    });
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual tracking
  window.joeTrack = track;

})();
