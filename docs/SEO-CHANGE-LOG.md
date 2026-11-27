# SEO change log

## 2026-11-27 — menu category pages

New URLs, not a title rewrite of pages Google has already crawled. whistlestopgrill.com has no Search Console property yet, and public DNS is still Wix.

- Each menu category page now has its own title, description, robots directive, Open Graph tags, breadcrumb, menu, restaurant, and FAQ schema, a visible FAQ, and internal links to the rest of the site.
- Each category also has `site/citations/{id}.ai.txt` and `site/citations/{id}.llms.txt`. The sitewide `ai.txt` and `llms.txt` list every category with its current items and prices.
- `robots.txt` now matches `ai.txt`: admin, homepage options, tests, and downloads stay out of the index.
- Public pages that had no robots meta now say `index, follow`. Existing titles and descriptions were left as they are.
