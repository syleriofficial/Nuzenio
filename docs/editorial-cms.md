# Nuzenio manual editorial CMS — Phase 2

Status: **integration scaffold / non-live**, built as a stacked change on draft PR #9. No CMS credentials or OAuth proxy have been deployed.

## What works in the code

- Astro content collections for Markdown news and JSON Web Stories.
- Strict metadata schemas, draft/in-review/approved status, and owner-signoff/source URL requirements for approved entries.
- A site-side filter includes **approved entries only**, preserving no-publication-by-default.
- Draft entries in the repository will not generate public article or Web Story routes.
- An editorial CMS configuration template for Decap CMS using the GitHub backend and \`publish_mode: editorial_workflow\`.
- A deliberately closed /admin route while authentication remains unconfigured.
- No background news ingest, RSS fetch, AI generation, webhook, scheduler or deploy.

## Why the login is intentionally inactive

Decap CMS on GitHub needs a separately configured GitHub OAuth application and trusted OAuth proxy. Never add client secrets to this public repo, static \`/admin\` assets or GitHub history.

To activate, after security review:
1. Create a dedicated GitHub OAuth app with the correct redirect URL. Deploy a maintained and audited OAuth proxy with server-side secrets and least possible permissions, and restrict the editor area (for example with Cloudflare Access).
2. Verify \`main\` contains the approved site foundation and this CMS stack, and that owner-only branch protection / PR review controls are configured. Approval metadata is **not** an identity proof by itself.
3. Set \`cms/config.example.yml\` as a reviewed starting point; replace the invalid \`.invalid\` authentication endpoint with the real protected proxy origin, remove its \`publish: false\` documentation guard, audit configuration, then serve it at \`public/admin/config.yml\`.
4. Replace the deliberate placeholder \`public/admin/index.html\` with a security-reviewed Decap CMS loader pinned to a specific tested version, and restrict editor access. Test editor authentication, logout, CSRF/state handling and GitHub permissions.
5. Test a new draft, in-review, approved but unmerged draft, explicit CMS publish to a PR and an owner-approved merge. Test that unauthorized users cannot publish.
6. Review deployment triggers separately: any production auto-deploy on an owner-approved merge would be a deployment resulting from that manual approval, **not automatic news creation**. Preserve ability to hold publication and roll back.
7. Conduct browser, mobile, accessibility and SEO tests. Validate image rights and attribution, source provenance, correction workflow and copyright/legal pages. Only then disable global preview/noindex mode.

### Important privacy constraint

This repository is PUBLIC. Decap/GitHub editorial workflow opens pull requests containing draft content. Such draft text is visible to anyone on GitHub **before publication** even though it does not appear on Nuzenio's public site. **Do not use this setup for confidential tips, unannounced investigations, embargoes or secrets.** A private editorial repository / authenticated API with a private database is needed for confidential drafts.

### Content authoring

For news create \`src/content/news/english-slug.md\` with YAML frontmatter:

\`\`\`yaml
---
title: "पूरा सत्यापित शीर्षक यहाँ लिखें"
description: "समाचार का सटीक सार जो कम से कम 25 अक्षरों का हो"
category: desh
author: "Nuzenio Desk"
status: draft
sourceUrls: []
---
यहाँ मूल हिंदी लेख आएगा।
\`\`\`

On owner approval only, complete sourceUrls, image rights and credit, \`approvedBy: syleriofficial\`, \`approvedAt\`, \`publishedAt\`, set \`status: approved\`, and merge through reviewed PR. The site will show it at \`/news/english-slug/\`.

For Web Stories create \`src/content/stories/english-slug.json\` with the same editorial metadata plus a licensed/original cover image, 5–8 slides and \`status: draft\` initially. Approved entries appear at \`/web-stories/english-slug/\`. **These are responsive HTML slides, not AMP-validated Web Stories.**

## Non-automatic workflow

Research → Fact check → Write → Draft → Owner review → Owner approval → Manual PR merge → Build/deploy only when authorized.

No item becomes public solely because it exists in the content folder or because someone saves an unpublished CMS draft. If an entry is marked "approved" in an editor branch, it may appear on **preview** builds of that branch; keep those builds private/noindex and require protected approvals before public deployment.


## Phase 3 — local-only working draft editor

Open \`tools/editor/index.html\` in your browser from a local checkout of the Nuzenio repository.

- Article and Web Story form controls, safe live text previews and field-level validation
- News text exported as \`src/content/news/<slug>.md\`
- 5–8-slide Web Stories exported as \`src/content/stories/<slug>.json\`
- All exports have \`status: draft\` **without approval fields**; there is no UI control for marking approved.
- No autosave, upload, remote service, GitHub credential, API token or publishing endpoint.
- Files are downloaded only when the editor explicitly clicks the export button.
- This editor is stored OUTSIDE \`public/\` and \`src/pages/\`; no production URL is generated.
- Node tests verify validation, draft-only output, malicious scheme/traversal blocking, safe YAML output, and no networking APIs in the editor.

This is not an authentication system; the public \`/admin/\` route continues to be a disabled-login notice. Do not confuse a local draft editor with a deployed, protected CMS. For an authenticated in-browser CMS, first complete GitHub OAuth and trusted access protection, as described above.
