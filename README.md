# Nuzenio — Hindi news platform

Nuzenio is an Astro 5 Hindi news site with an **owner-approved/manual publication model**.

**Current status:** Stacked draft implementation. It is not deployed and the editorial CMS login is intentionally unavailable until secure GitHub OAuth setup and owner review.

## Run locally

Node.js 22+:

\`\`\`bash
npm install
npm run dev
npm run check
npm run build
node scripts/test-publication-gates.mjs
\`\`\`

## What's built

- Hindi responsive homepage, categories, search and article pages
- Visual Web Stories (interactive HTML prototypes; **not validated AMP**)
- Original SVG illustrations for demo content
- Markdown news and JSON Web Story content collections validated by Astro/Zod
- Draft, in-review and approved metadata states
- Only explicitly approved news and stories included in public static routes
- Date, source links, image attribution and owner approval metadata on approved articles
- Conditional demo UI: example articles and stories are shown only while \`site.preview\` is enabled
- CI publication-gate tests: approved fixtures published, draft/in-review fixtures excluded
- Future Decap CMS editor configuration template (\`cms/config.example.yml\`) and intentionally closed \`/admin/\` placeholder

## Safeguards

**Everything in \`src/data/editorial.ts\` is example preview content, not real news.** The current preview site has an obvious banner, noindex metadata and robots disallow. It must not be presented as a launched news service.

No auto-generation, feed polling, draft auto-approval or auto-publish is enabled.

Real published content uses \`src/content/news/*.md\` and \`src/content/stories/*.json\`. A new item must start as \`draft\`. Only an item explicitly marked \`approved\` with \`approvedBy: syleriofficial\`, a date and at least one checked source URL can generate a public route. Its status field is a **content assertion, not security verification**; real ownership enforcement requires GitHub protected branch/approval and a trusted authenticated editor.

The repository is PUBLIC. Even if draft material does not appear on the site, any draft committed to a GitHub branch/PR is visible to the public. Do not use these files for confidential reporting.

**Do not merge, enable indexation or deploy to production without explicit approval.**

## Editorial CMS activation (not enabled)

See [docs/editorial-cms.md](docs/editorial-cms.md) for the owner-controlled publishing steps, why \`/admin/\` is closed, OAuth/branch protection requirements and the Decap CMS configuration example.

## Deploy later

Cloudflare Pages: Node.js 22+, build command \`npm run build\`, output \`dist\`.

Prior to launch: replace all sample content, verify corrections/privacy/legal pages, image rights, source provenance, structured data, indexing, real CMS sign-in/security and human editorial workflow.
