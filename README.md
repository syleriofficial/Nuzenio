# Nuzenio — Hindi news website (editorial preview)

This is a **static, manually edited Astro website**, not an automated news service.

## Current pages

- Responsive homepage, navigation and six editorial sections
- Article detail pages and related-reading cards
- Client-side search over preview content
- Short, interactive **non-AMP** Web Story demos
- Editorial policy, about page and custom 404
- Original abstract SVG artwork (no scraped/unauthorized news imagery)
- Basic SEO metadata and canonical URLs
- CI for Astro type checks and static production build

## Local development

Requires Node.js 22+.

\`\`\`bash
npm install
npm run dev
npm run check
npm run build
npm run preview
\`\`\`

Cloudflare Pages settings after approval: build command \`npm run build\`, output directory \`dist\`, Node 22.

## Editorial safeguards — important

**All existing articles and Web Stories are fictional/evergreen UI examples. They are NOT verified current news.** Every preview page is marked "डेमो"; \`src/data/editorial.ts\` has \`site.preview: true\`, which renders a prominent site-wide preview banner and \`noindex,nofollow\` meta. \`public/robots.txt\` disallows crawling.

There is **no automatic content ingestion, no publishing automation, no backend, no credentials and no production deployment** in this change.

For each real post, a human editor must:
1. Gather credible primary/secondary sources and verify material facts, quotes, names and dates.
2. Write original Hindi text (or revise assisted drafts) and distinguish opinions/analysis from verified news.
3. Verify usage rights for photographs, video and illustrations; add accurate image descriptions/credits.
4. Approve the article/story for publication and manually add or change the appropriate entry in \`src/data/editorial.ts\`.
5. Remove example content. Configure site preview off **only after all demonstration content has been replaced**, and review robots/indexing, Google structured data, author/source attribution, correction workflow, legal pages and production QA.
6. Deploy **only on explicit owner approval**, not by automation.

The site currently offers no real CMS. A secured, manual draft/review/publish CMS is a future milestone. News CMS integration should not bypass owner approval.

## Web Stories / AMP

The included stories are intentionally **interactive HTML prototypes**, not claimed to be valid Google AMP Web Stories. A separate milestone is needed to implement and validate AMP syntax, permitted images, poster assets, accessibility and Google indexing requirements. Do not label these demos "AMP" in public.

## Structure

- \`src/data/editorial.ts\`: category, article and story data
- \`src/layouts/BaseLayout.astro\`: site shell, metadata and navigation
- \`src/components/\`: content cards
- \`src/pages/\`: statically generated routes
- \`src/styles/global.css\`: responsive visual system
- \`public/images/\`: original symbolic art assets

No external news sources are polled, no RSS is consumed and nothing is published without review.
