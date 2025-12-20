const { DateTime } = require("luxon");

module.exports = function(eleventyConfig) {
  
  // Passthrough copy for static assets
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("_redirects");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("sitemap.xml");
  eleventyConfig.addPassthroughCopy("videos");
  
  // Date filters
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    if (!dateObj) return '';
    const dt = dateObj instanceof Date ? dateObj : new Date(dateObj);
    return DateTime.fromJSDate(dt, { zone: 'utc' }).toFormat("LLLL d, yyyy");
  });
  
  eleventyConfig.addFilter("shortDate", (dateObj) => {
    if (!dateObj) return '';
    const dt = dateObj instanceof Date ? dateObj : new Date(dateObj);
    return DateTime.fromJSDate(dt, { zone: 'utc' }).toFormat("LLL d, yyyy");
  });
  
  eleventyConfig.addFilter("isoDate", (dateObj) => {
    if (!dateObj) return '';
    const dt = dateObj instanceof Date ? dateObj : new Date(dateObj);
    return DateTime.fromJSDate(dt, { zone: 'utc' }).toISODate();
  });
  
  eleventyConfig.addFilter("year", (dateObj) => {
    if (!dateObj) return '';
    const dt = dateObj instanceof Date ? dateObj : new Date(dateObj);
    return DateTime.fromJSDate(dt, { zone: 'utc' }).toFormat("yyyy");
  });

  // Date formatting for partners/campaigns
  eleventyConfig.addFilter("date", (dateObj, format) => {
    if (!dateObj) return '';
    const dt = dateObj instanceof Date ? dateObj : new Date(dateObj);
    return DateTime.fromJSDate(dt, { zone: 'utc' }).toFormat(format || "LLLL d, yyyy");
  });

  // Slug filter
  eleventyConfig.addFilter("slug", (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  });

  // Excerpt filter - strip HTML and truncate
  eleventyConfig.addFilter("excerpt", (content, length = 160) => {
    if (!content) return '';
    const stripped = content.replace(/<[^>]+>/g, '');
    return stripped.length > length 
      ? stripped.substring(0, length).trim() + '...' 
      : stripped;
  });

  // Category display name
  eleventyConfig.addFilter("categoryName", (category) => {
    const names = {
      'industry-trends': 'Industry Trends',
      'build-in-public': 'Build In Public',
      'coffee-shop-owner': 'Coffee Shop Owner',
      'product-updates': 'Product Updates',
      'loyalty-marketing': 'Loyalty Marketing',
      'coffee-shop-marketing': 'Coffee Shop Marketing',
      'mobile-ordering': 'Mobile Ordering',
      'barista': 'Barista',
      'community': 'Community',
      'joe-pos': 'joe POS',
      'square-integration': 'Square Integration',
      'barista-workflow': 'Barista Workflow',
      'coffee-shop-launch': 'Coffee Shop Launch'
    };
    return names[category] || category;
  });

  // JSON-LD Schema generators
  eleventyConfig.addShortcode("blogPostSchema", function(post) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.excerpt || post.description,
      "image": post.featured_image || "https://magical-beignet-f08a5b.netlify.app/images/default-og.jpg",
      "author": {
        "@type": "Person",
        "name": post.author || "joe Coffee Team"
      },
      "publisher": {
        "@type": "Organization",
        "name": "joe Coffee",
        "logo": {
          "@type": "ImageObject",
          "url": "https://magical-beignet-f08a5b.netlify.app/images/logo.png"
        }
      },
      "datePublished": post.date,
      "dateModified": post.date,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://magical-beignet-f08a5b.netlify.app/blog/posts/${post.slug}/`
      },
      "keywords": post.tags ? post.tags.join(", ") : "",
      "articleSection": post.category
    };
    return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  });

  eleventyConfig.addShortcode("testimonialSchema", function(testimonial) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Review",
      "itemReviewed": {
        "@type": "Product",
        "name": "joe Coffee Platform",
        "brand": {
          "@type": "Brand",
          "name": "joe Coffee"
        }
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      },
      "author": {
        "@type": "Organization",
        "name": testimonial.shop_name,
        "address": testimonial.location
      },
      "reviewBody": testimonial.excerpt,
      "datePublished": testimonial.date
    };
    return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  });

  eleventyConfig.addShortcode("breadcrumbSchema", function(items) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": items.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.name,
        "item": item.url
      }))
    };
    return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  });

  eleventyConfig.addShortcode("organizationSchema", function() {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "joe Coffee",
      "url": "https://magical-beignet-f08a5b.netlify.app",
      "logo": "https://magical-beignet-f08a5b.netlify.app/images/logo.png",
      "description": "The complete ordering system, built for local coffee shops to thrive.",
      "sameAs": [
        "https://twitter.com/joecoffeeapp",
        "https://instagram.com/joecoffeeapp",
        "https://www.linkedin.com/company/joecoffee"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "email": "success@joe.coffee"
      }
    };
    return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  });

  // ============================================
  // COLLECTIONS - BLOG POSTS
  // ============================================

  // Collection: All blog posts sorted by date
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("blog/posts/*.md")
      .filter(post => post.data.status !== 'draft')
      .sort((a, b) => b.date - a.date);
  });

  // Collection: All posts including drafts (for admin)
  eleventyConfig.addCollection("allPosts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("blog/posts/*.md")
      .sort((a, b) => b.date - a.date);
  });

  // Collection: Featured posts
  eleventyConfig.addCollection("featuredPosts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("blog/posts/*.md")
      .filter(post => post.data.featured && post.data.status !== 'draft')
      .sort((a, b) => b.date - a.date)
      .slice(0, 3);
  });

  // ============================================
  // COLLECTIONS - TESTIMONIALS
  // ============================================

  // Collection: Testimonials
  eleventyConfig.addCollection("testimonials", function(collectionApi) {
    return collectionApi.getFilteredByGlob("blog/testimonials/*.md")
      .filter(t => t.data.status !== 'draft')
      .sort((a, b) => b.date - a.date);
  });

  // Collection: Featured testimonials
  eleventyConfig.addCollection("featuredTestimonials", function(collectionApi) {
    return collectionApi.getFilteredByGlob("blog/testimonials/*.md")
      .filter(t => t.data.featured && t.data.status !== 'draft')
      .sort((a, b) => b.date - a.date)
      .slice(0, 6);
  });

  // ============================================
  // COLLECTIONS - PARTNERS (NEW)
  // ============================================

  // Collection: Partner pages
  eleventyConfig.addCollection("partners", function(collectionApi) {
    return collectionApi.getFilteredByGlob("partners/*.md")
      .filter(p => p.data.status === 'published')
      .sort((a, b) => {
        // Sort by date if available, otherwise alphabetically
        if (a.date && b.date) return b.date - a.date;
        return (a.data.title || '').localeCompare(b.data.title || '');
      });
  });

  // Collection: All partners including drafts
  eleventyConfig.addCollection("allPartners", function(collectionApi) {
    return collectionApi.getFilteredByGlob("partners/*.md");
  });

  // ============================================
  // COLLECTIONS - CAMPAIGNS (NEW)
  // ============================================

  // Collection: Active campaign pages
  eleventyConfig.addCollection("campaigns", function(collectionApi) {
    return collectionApi.getFilteredByGlob("campaigns/*.md")
      .filter(c => c.data.status === 'active' || c.data.status === 'published')
      .sort((a, b) => {
        if (a.data.start_date && b.data.start_date) {
          return new Date(b.data.start_date) - new Date(a.data.start_date);
        }
        return b.date - a.date;
      });
  });

  // Collection: All campaigns including drafts and ended
  eleventyConfig.addCollection("allCampaigns", function(collectionApi) {
    return collectionApi.getFilteredByGlob("campaigns/*.md");
  });

  // ============================================
  // COLLECTIONS - AUTHORS
  // ============================================

  // Collection: Authors
  eleventyConfig.addCollection("authors", function(collectionApi) {
    return collectionApi.getFilteredByGlob("authors/*.md");
  });

  // ============================================
  // COLLECTIONS - CATEGORIES & TAGS
  // ============================================

  // Collection: Posts by category
  eleventyConfig.addCollection("postsByCategory", function(collectionApi) {
    const posts = collectionApi.getFilteredByGlob("blog/posts/*.md")
      .filter(post => post.data.status !== 'draft');
    
    const categories = {};
    posts.forEach(post => {
      const cat = post.data.category || 'uncategorized';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(post);
    });
    
    // Sort each category by date
    Object.keys(categories).forEach(cat => {
      categories[cat].sort((a, b) => b.date - a.date);
    });
    
    return categories;
  });

  // Collection: All tags
  eleventyConfig.addCollection("tagList", function(collectionApi) {
    const tags = new Set();
    collectionApi.getFilteredByGlob("blog/posts/*.md").forEach(post => {
      if (post.data.tags) {
        post.data.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  });

  // ============================================
  // SEARCH INDEX
  // ============================================

  // Generate JSON feed for search
  eleventyConfig.addCollection("searchIndex", function(collectionApi) {
    return collectionApi.getFilteredByGlob("blog/posts/*.md")
      .filter(post => post.data.status !== 'draft')
      .map(post => ({
        title: post.data.title,
        slug: post.fileSlug,
        date: post.date,
        category: post.data.category,
        tags: post.data.tags || [],
        excerpt: post.data.excerpt,
        image: post.data.featured_image || '',
        status: post.data.status || 'published',
        author: post.data.author
      }));
  });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
