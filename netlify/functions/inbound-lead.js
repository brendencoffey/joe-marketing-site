// Netlify function to process inbound leads from website forms
// Place in: netlify/functions/inbound-lead.js
//
// This function:
// 1. Receives form data (first_name, last_name, email, phone, company_name, address, website)
// 2. Searches Google Places for business info
// 3. Scrapes website for social links, online ordering, POS
// 4. Matches to existing company or creates new
// 5. Creates contact + deal in Sales pipeline
// 6. Logs activity

const { isRateLimited, getClientIP } = require('./rate-limiter');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit: 5 leads per minute per IP
  const ip = getClientIP(event);
  if (isRateLimited(ip, 5, 60000)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please wait.' }) };
  }

  try {
    const data = JSON.parse(event.body);
    
    // Honeypot check - if filled, it's a bot
    if (data.website_url || data.fax) {
      console.log('Honeypot triggered, rejecting submission');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    const { 
      first_name, last_name, email, phone, company_name, address, website, 
      source, form_name,
      // New fields from Google Places autocomplete
      place_id, city, state, zip, lat, lng 
    } = data;

    if (!email || !company_name) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and company name required' }) };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email format' }) };
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Use provided address components or parse from address string
    const addressParts = city ? { city, state, state_code: state, zip } : parseAddress(address);
    
    // Check if shop already exists by place_id first (most reliable)
    let existingShop = null;
    if (place_id) {
      const { data: shopByPlaceId } = await supabase
        .from('shops')
        .select('*')
        .eq('google_place_id', place_id)
        .limit(1);
      if (shopByPlaceId?.length) {
        existingShop = shopByPlaceId[0];
        console.log('Found existing shop by place_id:', existingShop.name);
      }
    }
    
    // If not found by place_id, check by name + city
    if (!existingShop && addressParts.city) {
      const { data: shopByName } = await supabase
        .from('shops')
        .select('*')
        .ilike('name', `%${company_name}%`)
        .ilike('city', `%${addressParts.city}%`)
        .limit(1);
      if (shopByName?.length) {
        existingShop = shopByName[0];
        console.log('Found existing shop by name+city:', existingShop.name);
      }
    }

    // Try to find existing company by name + city or by phone/email
    let company = null;
    let isNewCompany = false;

    // If we found an existing shop with a company_id, use that company
    if (existingShop?.company_id) {
      const { data: shopCompany } = await supabase
        .from('companies')
        .select('*')
        .eq('id', existingShop.company_id)
        .single();
      if (shopCompany) {
        company = shopCompany;
        console.log('Using existing shop company:', company.name);
      }
    }

    // Search by name and city first
    if (!company && addressParts.city) {
      const { data: existingByName } = await supabase
        .from('companies')
        .select('*')
        .ilike('name', `%${company_name}%`)
        .ilike('city', `%${addressParts.city}%`)
        .limit(1);
      
      if (existingByName?.length) {
        company = existingByName[0];
      }
    }

    // If not found, search by phone
    if (!company && phone) {
      const cleanPhone = phone.replace(/[^\d]/g, '');
      const { data: existingByPhone } = await supabase
        .from('companies')
        .select('*')
        .ilike('phone', `%${cleanPhone.slice(-10)}%`)
        .limit(1);
      
      if (existingByPhone?.length) {
        company = existingByPhone[0];
      }
    }

    // If not found, search by email domain
    if (!company && email) {
      const domain = email.split('@')[1];
      if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
        const { data: existingByDomain } = await supabase
          .from('companies')
          .select('*')
          .ilike('email', `%${domain}%`)
          .limit(1);
        
        if (existingByDomain?.length) {
          company = existingByDomain[0];
        }
      }
    }

    // Use frontend place data if available, otherwise enrich from Google Places
    let enrichedData = {};
    if (place_id) {
      // We have data from frontend autocomplete
      enrichedData = {
        place_id: place_id,
        city: city || addressParts.city,
        state: state || addressParts.state,
        state_code: state || addressParts.state_code,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null
      };
      console.log('Using frontend place data:', enrichedData);
    } else if (process.env.GOOGLE_PLACES_API_KEY && company_name && address) {
      // Fall back to server-side enrichment
      try {
        enrichedData = await enrichFromGooglePlaces(company_name, address);
      } catch (err) {
        console.error('Google Places enrichment failed:', err);
      }
    }

    // Scrape website for additional info
    let websiteData = {};
    const siteUrl = website || enrichedData.website;
    if (siteUrl) {
      try {
        websiteData = await scrapeWebsite(siteUrl);
      } catch (err) {
        console.error('Website scraping failed:', err);
      }
    }

    // Create or update company
    if (!company) {
      isNewCompany = true;
      // Only use columns that exist in companies table
      const companyData = {
        name: company_name,
        address: address || enrichedData.address,
        city: addressParts.city || enrichedData.city,
        state: addressParts.state || enrichedData.state,
        phone: phone || enrichedData.phone,
        website: siteUrl,
        source: source || 'inbound',
        lead_score: 50, // Inbound leads start with higher score
        google_place_id: place_id || enrichedData.place_id,
        icp_type: 'cafe' // Default for inbound coffee shops
      };

      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert([companyData])
        .select()
        .single();

      if (companyError) {
        console.error('Error creating company:', companyError);
        // Try minimal insert
        const { data: newCompany2, error: companyError2 } = await supabase
          .from('companies')
          .insert([{
            name: company_name,
            address: address,
            city: addressParts.city,
            state: addressParts.state,
            phone: phone,
            website: siteUrl,
            source: source || 'inbound'
          }])
          .select()
          .single();
        if (companyError2) {
          console.error('Minimal company insert also failed:', companyError2);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create company', details: companyError2.message })
          };
        }
        company = newCompany2;
      } else {
        company = newCompany;
      }
    } else {
      // Update existing company with new info if provided
      const updates = {};
      if (phone && !company.phone) updates.phone = phone;
      if (email && !company.email) updates.email = email;
      if (siteUrl && !company.website) updates.website = siteUrl;
      if (address && !company.address) updates.address = address;
      
      // Upgrade to inbound if was enriched
      if (company.source === 'enriched') {
        updates.source = 'inbound';
        updates.lead_score = Math.min((company.lead_score || 0) + 25, 100);
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('companies').update(updates).eq('id', company.id);
        Object.assign(company, updates);
      }
    }

    // Check for existing contact by email
    let contact = null;
    if (email) {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('email', email.toLowerCase())
        .limit(1);
      
      if (existingContact?.length) {
        contact = existingContact[0];
        // Update company_id if not set
        if (!contact.company_id && company?.id) {
          await supabase.from('contacts').update({ company_id: company.id }).eq('id', contact.id);
        }
      }
    }

    // Create contact if not exists
    if (!contact && company) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert([{
          first_name: first_name || '',
          last_name: last_name || '',
          email: email.toLowerCase(),
          phone: phone,
          company_id: company.id,
          lifecycle_stage: 'lead',
          lead_source: source || 'inbound',
          source: source || 'inbound'
        }])
        .select()
        .single();

      if (contactError) {
        console.error('Error creating contact:', contactError);
      } else {
        contact = newContact;
      }
    }

    // Check for existing deal for this company
    let deal = null;
    let isReturningLead = false;
    if (company) {
      const { data: existingDeal } = await supabase
        .from('deals')
        .select('*')
        .eq('company_id', company.id)
        .limit(1);
      
      if (existingDeal?.length) {
        deal = existingDeal[0];
        isReturningLead = true;
        
        // Update existing deal - mark as having new activity, bump lead score
        const dealUpdates = {
          updated_at: new Date().toISOString(),
          lead_score: Math.min((deal.lead_score || 0) + 15, 100) // Bump score for returning interest
        };
        
        // If deal was closed-lost, reopen it
        if (['closed_lost', 'lost', 'churned'].includes(deal.stage)) {
          dealUpdates.stage = 'new';
          dealUpdates.notes = `${deal.notes || ''}\n\n[${new Date().toLocaleDateString()}] Lead re-engaged via ${form_name || 'website form'}`;
        }
        
        await supabase.from('deals').update(dealUpdates).eq('id', deal.id);
        console.log('Updated existing deal:', deal.id);
      }
    }

    // Create deal if not exists
    if (!deal && company) {
      const { data: newDeal, error: dealError } = await supabase
        .from('deals')
        .insert([{
          name: company_name,
          company_id: company.id,
          contact_id: contact?.id,
          stage: 'new',
          source: source || 'inbound',
          how_heard: form_name || 'website',
          pipeline_id: '791c7398-d2b4-4652-b1c6-7dcf6199a58b' // Sales pipeline
        }])
        .select()
        .single();

      if (dealError) {
        console.error('Error creating deal:', dealError);
      } else {
        deal = newDeal;
        console.log('Created new deal:', deal.id);
      }
    }

    // Summary log for debugging
    console.log('Lead processing complete:', {
      company_name,
      email,
      company_id: company?.id,
      contact_id: contact?.id,
      deal_id: deal?.id,
      isNewCompany,
      isReturningLead,
      matchedExistingShop: !!existingShop
    });

    // Log activity
    if (company) {
      await supabase.from('activities').insert([{
        company_id: company.id,
        contact_id: contact?.id,
        deal_id: deal?.id,
        activity_type: 'form_submission',
        subject: `Inbound lead from ${form_name || 'website'}`,
        notes: `New lead submitted via ${form_name || 'website form'}`
      }]);
    }

    // Send email notification to sales team
    const isNewLead = !isReturningLead;
    if (process.env.RESEND_API_KEY) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'joe CRM <notifications@joe.coffee>',
            to: ['thrive@joe.coffee'],
            cc: ['brenden@joe.coffee', 'mario@joe.coffee', 'ally@joe.coffee'],
            subject: `🔥 ${isNewLead ? 'New' : 'Returning'} Inbound Lead: ${company_name}`,
            html: `
              <h2>${isNewLead ? '🆕 New Lead' : '🔄 Returning Lead'}: ${company_name}</h2>
              <p><strong>Contact:</strong> ${first_name || ''} ${last_name || ''}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
              <p><strong>Address:</strong> ${address || 'Not provided'}</p>
              <p><strong>Website:</strong> ${siteUrl ? `<a href="${siteUrl}">${siteUrl}</a>` : 'Not provided'}</p>
              <hr>
              <p><strong>Source:</strong> ${source || 'inbound'}</p>
              <p><strong>Form:</strong> ${form_name || 'website'}</p>
              ${websiteData.pos ? `<p><strong>Current POS:</strong> ${websiteData.pos}</p>` : ''}
              <hr>
              <p><a href="https://crm.joe.coffee/deals/${deal?.id}">View Deal in CRM →</a></p>
            `
          })
        });
        if (!emailResponse.ok) {
          console.error('Email notification failed:', await emailResponse.text());
        }
      } catch (emailErr) {
        console.error('Email notification error:', emailErr);
      }
    } else {
      console.log('Email notification skipped - RESEND_API_KEY not configured');
    }

    // Create/update shop record
    if (!existingShop && company) {
      const shopData = {
        name: company_name,
        address: address || enrichedData.address,
        city: addressParts.city || enrichedData.city,
        state: addressParts.state || enrichedData.state,
        state_code: addressParts.state_code || enrichedData.state_code,
        zip: zip || addressParts.zip,
        phone: phone || enrichedData.phone,
        email: email,
        website: siteUrl,
        source: 'inbound',
        is_active: true,
        lifecycle_stage: 'lead',
        pipeline_stage: 'new',
        lead_score: 50,
        google_place_id: place_id || enrichedData.place_id,
        google_rating: enrichedData.rating,
        total_reviews: enrichedData.reviews,
        lat: lat ? parseFloat(lat) : enrichedData.lat,
        lng: lng ? parseFloat(lng) : enrichedData.lng,
        company_id: company.id,
        current_pos: websiteData.pos,
        ordering_url: websiteData.online_ordering,
        instagram_url: websiteData.instagram,
        facebook_url: websiteData.facebook,
        twitter_url: websiteData.twitter,
        yelp_url: websiteData.yelp,
        icp_type: 'cafe'
      };
      
      const { data: newShop, error: shopError } = await supabase
        .from('shops')
        .insert([shopData])
        .select()
        .single();
      
      if (shopError) {
        console.error('Error creating shop:', shopError);
        // Try minimal insert
        const { error: shopError2 } = await supabase.from('shops').insert([{
          name: company_name,
          address: address,
          city: addressParts.city,
          state: addressParts.state,
          phone: phone,
          email: email,
          website: siteUrl,
          source: 'inbound',
          company_id: company.id
        }]);
        if (shopError2) console.error('Minimal shop insert also failed:', shopError2);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        company_id: company?.id,
        contact_id: contact?.id,
        deal_id: deal?.id,
        is_new_company: isNewCompany,
        is_returning_lead: isReturningLead,
        matched_existing_shop: !!existingShop,
        shop_id: existingShop?.id,
        enriched: Object.keys(enrichedData).length > 0
      })
    };

  } catch (err) {
    console.error('Error processing inbound lead:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process lead', details: err.message })
    };
  }
};

// Parse address string into components
function parseAddress(address) {
  if (!address) return {};
  
  const result = {};
  
  // Try to extract city, state from common formats
  // "123 Main St, Seattle, WA 98101" or "Seattle, WA" or "Seattle, Washington"
  const stateAbbrevs = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
    'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
    'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
    'district of columbia': 'DC'
  };

  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    // Last part might be "State ZIP" or just "State"
    const lastPart = parts[parts.length - 1];
    const stateZipMatch = lastPart.match(/^([A-Z]{2})\s*(\d{5})?$/i);
    
    if (stateZipMatch) {
      result.state_code = stateZipMatch[1].toUpperCase();
      result.city = parts[parts.length - 2];
    } else {
      // Check if it's a full state name
      const stateLower = lastPart.toLowerCase().replace(/\s+\d{5}.*$/, '');
      if (stateAbbrevs[stateLower]) {
        result.state_code = stateAbbrevs[stateLower];
        result.state = lastPart.replace(/\s+\d{5}.*$/, '');
        result.city = parts[parts.length - 2];
      } else {
        // Maybe city is in last part
        result.city = lastPart.replace(/\s+\d{5}.*$/, '');
      }
    }
  }

  return result;
}

// Enrich from Google Places API
async function enrichFromGooglePlaces(name, address) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return {};

  try {
    // Search for the place
    const searchQuery = encodeURIComponent(`${name} ${address}`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${searchQuery}&inputtype=textquery&fields=place_id,name,formatted_address,geometry&key=${apiKey}`;
    
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.candidates?.length) return {};

    const placeId = searchData.candidates[0].place_id;

    // Get place details
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry,address_components&key=${apiKey}`;
    
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (!detailsData.result) return {};

    const place = detailsData.result;
    const result = {
      place_id: placeId,
      address: place.formatted_address,
      phone: place.formatted_phone_number,
      website: place.website,
      rating: place.rating,
      reviews: place.user_ratings_total,
      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng
    };

    // Extract city/state from address components
    if (place.address_components) {
      for (const comp of place.address_components) {
        if (comp.types.includes('locality')) {
          result.city = comp.long_name;
        }
        if (comp.types.includes('administrative_area_level_1')) {
          result.state = comp.long_name;
          result.state_code = comp.short_name;
        }
      }
    }

    return result;
  } catch (err) {
    console.error('Google Places API error:', err);
    return {};
  }
}

// Scrape website for social links and POS info
async function scrapeWebsite(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JoeBot/1.0)' },
      timeout: 5000
    });
    const html = await res.text();

    const result = {};

    // Find social links
    const socialPatterns = {
      instagram: /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi,
      facebook: /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+/gi,
      twitter: /https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+/gi,
      yelp: /https?:\/\/(www\.)?yelp\.com\/biz\/[a-zA-Z0-9-]+/gi
    };

    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      const match = html.match(pattern);
      if (match) result[platform] = match[0];
    }

    // Find online ordering links
    const orderingPatterns = [
      /https?:\/\/[a-zA-Z0-9.-]*square\.site[^\s"']*/gi,
      /https?:\/\/[a-zA-Z0-9.-]*toast\.com[^\s"']*/gi,
      /https?:\/\/[a-zA-Z0-9.-]*doordash\.com[^\s"']*/gi,
      /https?:\/\/[a-zA-Z0-9.-]*ubereats\.com[^\s"']*/gi,
      /https?:\/\/[a-zA-Z0-9.-]*grubhub\.com[^\s"']*/gi,
      /https?:\/\/order\.[a-zA-Z0-9.-]+[^\s"']*/gi
    ];

    for (const pattern of orderingPatterns) {
      const match = html.match(pattern);
      if (match) {
        result.online_ordering = match[0];
        break;
      }
    }

    // Detect POS from scripts/links
    const posPatterns = {
      'Square': /squareup\.com|square\.site|squarecdn\.com/i,
      'Toast': /toasttab\.com|toast\.com/i,
      'Clover': /clover\.com/i,
      'Lightspeed': /lightspeedhq\.com|lightspeedpos\.com/i,
      'Shopify': /shopify\.com|cdn\.shopify/i,
      'joe': /joe\.coffee|joecoffeeapp/i
    };

    for (const [pos, pattern] of Object.entries(posPatterns)) {
      if (pattern.test(html)) {
        result.pos = pos;
        break;
      }
    }

    return result;
  } catch (err) {
    console.error('Website scraping error:', err);
    return {};
  }
}