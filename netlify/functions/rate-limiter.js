/**
 * Simple in-memory rate limiter for Netlify functions
 * Add this to any function that accepts public submissions
 */

// In-memory store (resets on cold start, which is fine for basic protection)
const rateLimitStore = new Map();

/**
 * Check if request should be rate limited
 * @param {string} ip - Client IP address
 * @param {number} maxRequests - Max requests per window (default: 5)
 * @param {number} windowMs - Time window in ms (default: 60000 = 1 min)
 * @returns {boolean} - true if should be blocked
 */
function isRateLimited(ip, maxRequests = 5, windowMs = 60000) {
  const now = Date.now();
  const requests = rateLimitStore.get(ip) || [];
  
  // Filter to only recent requests
  const recentRequests = requests.filter(t => t > now - windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return true;
  }
  
  // Add this request
  recentRequests.push(now);
  rateLimitStore.set(ip, recentRequests);
  
  // Cleanup old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, times] of rateLimitStore) {
      const valid = times.filter(t => t > now - windowMs);
      if (valid.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  return false;
}

/**
 * Get client IP from Netlify event
 */
function getClientIP(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || event.headers['client-ip'] 
    || 'unknown';
}

/**
 * Rate limit response
 */
const RATE_LIMIT_RESPONSE = {
  statusCode: 429,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    error: 'Too many requests. Please wait a minute and try again.' 
  })
};

module.exports = { isRateLimited, getClientIP, RATE_LIMIT_RESPONSE };


// =============================================================
// EXAMPLE USAGE in submit-upvote.js:
// =============================================================
/*
const { isRateLimited, getClientIP, RATE_LIMIT_RESPONSE } = require('./rate-limiter');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit check
  const ip = getClientIP(event);
  if (isRateLimited(ip, 5, 60000)) { // 5 requests per minute
    return RATE_LIMIT_RESPONSE;
  }

  // ... rest of your handler
};
*/
