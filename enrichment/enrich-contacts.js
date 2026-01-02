#!/usr/bin/env node

/**
 * joe CRM - Contact Enrichment Script
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Config
const SUPABASE_URL = 'https://vpnoaxpmhuknyaxcyxsu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbm9heHBtaHVrbnlheGN5eHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NjkzNTMsImV4cCI6MjA4MjQ0NTM1M30.0JVwCaY-3nUHuJk49ibifQviT0LxBSdYXMslw9WIr9M';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DELAY_MS = 1500;
const TIMEOUT_MS = 10000;

const EMAIL_PATTERNS = [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g];
const PHONE_PATTERNS = [/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g];
const SOCIAL_PATTERNS = {
  facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[a-zA-Z0-9.]+/gi,
  instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+/gi,
};

const EMAIL_BLACKLIST = ['example.com', 'test.com', 'wixpress.com', 'sentry.io', 'googleapis.com'];

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(url, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) redirectUrl = new URL(redirectUrl, url).href;
        fetchUrl(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractEmails(html) {
  const emails = new Set();
  for (const pattern of EMAIL_PATTERNS) {
    const matches = html.match(pattern) || [];
    for (const email of matches) {
      const normalized = email.toLowerCase().trim();
      const domain = normalized.split('@')[1];
      if (domain && !EMAIL_BLACKLIST.some(b => domain.includes(b)) && !normalized.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
        emails.add(normalized);
      }
    }
  }
  return [...emails].sort((a, b) => {
    const priority = ['contact', 'info', 'hello', 'mail', 'coffee'];
    const aScore = priority.findIndex(p => a.startsWith(p));
    const bScore = priority.findIndex(p => b.startsWith(p));
    return (aScore === -1 ? 999 : aScore) - (bScore === -1 ? 999 : bScore);
  });
}

function extractPhones(html) {
  const phones = new Set();
  const text = html.replace(/<[^>]+>/g, ' ');
  for (const pattern of PHONE_PATTERNS) {
    const matches = text.match(pattern) || [];
    for (const phone of matches) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        phones.add(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
      }
    }
  }
  return [...phones];
}

function extractSocialLinks(html) {
  const social = { facebook: null, instagram: null };
  for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
    const matches = html.match(pattern) || [];
    if (matches.length > 0) {
      let url = matches[0];
      if (!url.startsWith('http')) url = 'https://' + url;
      social[platform] = url;
    }
  }
  return social;
}

function classifyWebsite(url, html) {
  if (!url || url.trim() === '') return 'none';
  const urlLower = url.toLowerCase();
  if (urlLower.includes('facebook.com')) return 'facebook';
  if (urlLower.includes('instagram.com')) return 'instagram';
  const builders = ['wix', 'squarespace', 'weebly', 'godaddy', 'wordpress.com'];
  for (const builder of builders) {
    if (urlLower.includes(builder) || (html && html.toLowerCase().includes(builder))) return 'basic';
  }
  return 'basic';
}

async function enrichShop(shop) {
  const result = { enrichment_status: 'enriched', enriched_at: new Date().toISOString() };
  if (!shop.website || shop.website.trim() === '') {
    result.website_type = 'none';
    result.enrichment_status = 'no_website';
    return result;
  }
  let url = shop.website.trim();
  if (!url.startsWith('http')) url = 'https://' + url;

  try {
    console.log(`  Fetching: ${url}`);
    const html = await fetchUrl(url);
    const emails = extractEmails(html);
    const phones = extractPhones(html);
    const social = extractSocialLinks(html);
    const websiteType = classifyWebsite(url, html);

    if (emails.length > 0 && !shop.email) result.email = emails[0];
    if (phones.length > 0 && !shop.phone) result.phone = phones[0];
    if (social.facebook) result.facebook_url = social.facebook;
    if (social.instagram) result.instagram_url = social.instagram;
    result.website_type = websiteType;

    console.log(`    ✓ Type: ${websiteType}, Email: ${result.email || 'none'}, Phone: ${result.phone || 'existing'}`);
  } catch (err) {
    console.log(`    ✗ Error: ${err.message}`);
    result.enrichment_status = 'failed';
    result.website_type = classifyWebsite(url, null);
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  let limit = null, city = null, force = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1]); i++; }
    else if (args[i] === '--city' && args[i + 1]) { city = args[i + 1]; i++; }
    else if (args[i] === '--force') force = true;
  }

  console.log('\n☕ joe CRM - Contact Enrichment\n');
  console.log(`Settings: Limit: ${limit || 'all'}, City: ${city || 'all'}, Force: ${force}\n`);

  let query = supabase.from('shops').select('*');
  if (!force) query = query.or('enrichment_status.is.null,enrichment_status.eq.pending');
  if (city) query = query.ilike('city', `%${city}%`);
  query = query.order('lead_score', { ascending: false });
  if (limit) query = query.limit(limit);

  const { data: shops, error } = await query;
  if (error) { console.error('Error fetching shops:', error); process.exit(1); }

  console.log(`Found ${shops.length} shops to enrich\n`);

  let enriched = 0, failed = 0, noWebsite = 0;

  for (let i = 0; i < shops.length; i++) {
    const shop = shops[i];
    console.log(`[${i + 1}/${shops.length}] ${shop.name}`);
    const updates = await enrichShop(shop);
    
    const { error: updateError } = await supabase.from('shops').update(updates).eq('id', shop.id);
    if (updateError) { console.log(`    ✗ DB Error: ${updateError.message}`); failed++; }
    else if (updates.enrichment_status === 'no_website') noWebsite++;
    else if (updates.enrichment_status === 'failed') failed++;
    else enriched++;

    if (i < shops.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Summary: ✓ Enriched: ${enriched} | ✗ Failed: ${failed} | ○ No Website: ${noWebsite}`);
  console.log('='.repeat(50) + '\n');
}

main().catch(console.error);
