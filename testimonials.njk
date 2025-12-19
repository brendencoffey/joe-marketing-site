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
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat("LLLL d, yyyy");
  });
  
  eleventyConfig.addFilter("shortDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat("LLL d, yyyy");
  });
  
  eleventyConfig.addFilter("isoDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toISO();
  });
  
  eleventyConfig.addFilter("year", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat("yyyy");
  });

  // Slug filter
  eleventyConfig.addFilter("slug", (str) => {
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
      "image": post.featured_image || "https://joe.coffee/images/default-og.jpg",
      "author": {
        "@type": "Person",
        "name": post.author || "joe Coffee Team"
      },
      "publisher": {
        "@type": "Organization",
        "name": "joe Coffee",
        "logo": {
          "@type": "ImageObject",
          "url": "https://joe.coffee/images/logo.png"
        }
      },
      "datePublished": post.date,
      "dateModified": post.date,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://joe.coffee/blog/posts/${post.slug}/`
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
      "url": "https://joe.coffee",
      "logo": "https://joe.coffee/images/logo.png",
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

  // Collection: Authors
  eleventyConfig.addCollection("authors", function(collectionApi) {
    return collectionApi.getFilteredByGlob("authors/*.md");
  });

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
