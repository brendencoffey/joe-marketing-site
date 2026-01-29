# GBP Integration - Pickup Reference

## Status: Waiting for API Approval
- **Submitted:** January 29, 2026
- **Case ID:** 1-4504000040544
- **Expected:** 1-4 weeks (could be up to 60 days)

## How to Check If Approved

1. Go to: https://console.cloud.google.com
2. Select project: `joe-owner-dashboard`
3. Go to: APIs & Services → Enabled APIs → My Business Account Management API
4. Check **Quotas** section:
   - **0 QPM** = Still waiting
   - **300 QPM** = Approved! ✅

## What's Already Built

### Netlify Functions (ready to use)
- `google-gbp-callback.js` - OAuth callback handler
- `gbp-get-locations.js` - Fetch owner's GBP locations  
- `gbp-add-ordering-link.js` - Add joe ordering link to GBP
- `gbp-sync-hours.js` - Sync shop hours to GBP
- `gbp-link-location.js` - Link GBP location to joe shop
- `gbp-disconnect.js` - Remove GBP connection

### Database (already migrated)
- `shop_owners` table has: gbp_access_token, gbp_refresh_token, gbp_token_expires_at, gbp_account_id
- `shops` table has: gbp_location_id, gbp_account_id, gbp_last_synced_at
- `gbp_sync_log` table exists for tracking

### Environment Variables (already set in Netlify)
- `GOOGLE_GBP_CLIENT_ID`
- `GOOGLE_GBP_CLIENT_SECRET`

### Owner Dashboard
- "🔗 Google Business" tab exists with "Coming Soon" message
- Located in `owner/index.html`

## When Approved - What To Do

1. **Update owner/index.html** - Replace the Coming Soon content in `#tab-gbp` with:
   - "Connect Google Business Profile" button
   - GBP location selector dropdown
   - "Add Ordering Link" button
   - "Sync Hours" button
   - Connection status display

2. **The Connect button should link to:**
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://joe.coffee/.netlify/functions/google-gbp-callback&
  response_type=code&
  scope=openid email profile https://www.googleapis.com/auth/business.manage&
  access_type=offline&
  prompt=consent
```

3. **Test the flow:**
   - Connect with your test account (brenden@joe.coffee is a test user)
   - Verify locations load
   - Test adding ordering link
   - Test syncing hours

## Google Cloud Console Access
- Project: `joe-owner-dashboard`
- OAuth Client: "joe owner dashboard" (External)
- Test users: brenden@joe.coffee

## Files Reference
- Functions: `netlify/functions/gbp-*.js` and `google-gbp-callback.js`
- Dashboard: `owner/index.html` (search for `tab-gbp`)
- Full plan: See conversation transcript from Jan 29, 2026

## Quick Start Prompt for Claude
When you resume, tell Claude:
> "GBP API was approved. Help me update owner/index.html to replace the Coming Soon tab with the actual GBP connection UI. The functions are already built in netlify/functions/gbp-*.js"
