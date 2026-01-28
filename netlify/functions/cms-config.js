exports.handler = async () => {
  const config = `backend:
  name: git-gateway
  branch: main

media_folder: "images/uploads"
public_folder: "/images/uploads"

site_url: https://joe.coffee
display_url: https://joe.coffee
logo_url: /images/logo.png

slug:
  encoding: "ascii"
  clean_accents: true
  sanitize_replacement: "-"

collections:
  - name: "authors"
    label: "Authors"
    folder: "authors"
    create: true
    slug: "{{slug}}"
    extension: "md"
    fields:
      - { label: "Name", name: "title", widget: "string" }
      - { label: "Photo", name: "photo", widget: "image", required: false }
      - { label: "Role", name: "role", widget: "string" }
      - { label: "Bio", name: "bio", widget: "text", required: false }

  - name: "posts"
    label: "Blog Posts"
    folder: "blog/posts"
    create: true
    slug: "{{slug}}"
    extension: "md"
    summary: "{{title}} - {{date | date('MMM D, YYYY')}}"
    fields:
      - { label: "Title", name: "title", widget: "string" }
      - { label: "Slug", name: "slug", widget: "string", required: false }
      - { label: "Publish Date", name: "date", widget: "datetime", date_format: "YYYY-MM-DD", time_format: false }
      - { label: "Status", name: "status", widget: "select", default: "draft", options: ["draft", "published"] }
      - { label: "Author", name: "author", widget: "relation", collection: "authors", search_fields: ["title"], value_field: "{{slug}}", display_fields: ["title"] }
      - { label: "Category", name: "category", widget: "select", options: ["industry-trends", "build-in-public", "coffee-shop-owner", "product-updates", "loyalty-marketing", "coffee-shop-marketing", "mobile-ordering", "barista", "community"] }
      - { label: "Tags", name: "tags", widget: "list", required: false }
      - { label: "Excerpt", name: "excerpt", widget: "text" }
      - { label: "Featured Image", name: "featured_image", widget: "image", required: false }
      - { label: "Featured", name: "featured", widget: "boolean", default: false }
      - { label: "Body", name: "body", widget: "markdown" }

  - name: "testimonials"
    label: "Testimonials"
    folder: "blog/testimonials"
    create: true
    slug: "{{slug}}"
    extension: "md"
    fields:
      - { label: "Title", name: "title", widget: "string" }
      - { label: "Date", name: "date", widget: "datetime" }
      - { label: "Shop Name", name: "shop_name", widget: "string" }
      - { label: "Location", name: "location", widget: "string", required: false }
      - { label: "Quote", name: "quote", widget: "text" }
      - { label: "Photo", name: "photo", widget: "image", required: false }
      - { label: "Body", name: "body", widget: "markdown" }

  - name: "partners"
    label: "Partner Pages"
    folder: "partners"
    create: true
    slug: "{{slug}}"
    extension: "md"
    fields:
      - { label: "Partner Name", name: "title", widget: "string" }
      - { label: "Slug", name: "slug", widget: "string" }
      - { label: "Status", name: "status", widget: "select", default: "active", options: ["draft", "active", "ended"] }
      - { label: "Logo", name: "logo", widget: "image", required: false }
      - { label: "Hero Image", name: "hero_image", widget: "image", required: false }
      - { label: "Headline", name: "headline", widget: "string" }
      - { label: "Description", name: "description", widget: "text" }
      - { label: "Promo Code", name: "promo_code", widget: "string", required: false }
      - { label: "Body", name: "body", widget: "markdown" }

  - name: "campaigns"
    label: "Campaign Pages"
    folder: "campaigns"
    create: true
    slug: "{{slug}}"
    extension: "md"
    fields:
      - { label: "Campaign Name", name: "title", widget: "string" }
      - { label: "Slug", name: "slug", widget: "string" }
      - { label: "Status", name: "status", widget: "select", default: "draft", options: ["draft", "active", "scheduled", "ended"] }
      - { label: "Hero Image", name: "hero_image", widget: "image", required: false }
      - { label: "Headline", name: "headline", widget: "string" }
      - { label: "Subheadline", name: "subheadline", widget: "text", required: false }
      - { label: "CTA Text", name: "cta_text", widget: "string", default: "Get Started" }
      - { label: "CTA Link", name: "cta_link", widget: "string", default: "https://get.joe.coffee" }
      - { label: "Promo Code", name: "promo_code", widget: "string", required: false }
      - { label: "Start Date", name: "start_date", widget: "datetime" }
      - { label: "End Date", name: "end_date", widget: "datetime", required: false }
      - { label: "Body", name: "body", widget: "markdown" }
`;

  return {
    statusCode: 200,
    headers: { 
      'Content-Type': 'text/yaml',
      'Access-Control-Allow-Origin': '*'
    },
    body: config
  };
};
