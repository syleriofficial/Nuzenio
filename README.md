# Nuzenio 2.0 — India-first news discovery

A **fresh start** in the existing `syleriofficial/Nuzenio` repository, without reusing retired Nuzenio application code.

**Status: development MVP, NOT approved for production.** Hindi and English reader, source attribution, state/category filters, restricted editorial controls, original articles, and a rights-gated RSS ingestion skeleton.

## Quick check

```sh
npm run verify
```

This repository is deliberately kept as a **Cloudflare Workers + D1** starter. It does not fetch real publisher feeds until an editor has separately verified rights and approved a source. The interface initially shows an empty-state message because sample headlines are not published as real news.

## Deployment prerequisites

1. Create a **new** Cloudflare D1 database and update the placeholder database ID in `wrangler.toml`.
2. Apply `db/migrations/0001_init.sql` to the new database.
3. Configure Cloudflare Access for `/admin` and `/api/admin/*`, and configure Worker secrets `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS`.
4. Replace `SITE_URL` with the verified site origin. Keep `ENABLE_INDEXING=false` until all legal, editorial, source rights and quality checks pass.
5. Have independent security testing before allowing public feed onboarding or real news publication. Do **not** deploy this branch automatically.

## Editorial and source rights

Only HTTPS source headlines and their outbound links are stored; no copied article bodies or images. Merely publishing RSS does **not** grant reuse permission. Source approval requires documented commercial rights and an explicit attestation. Revoking approval hides the source's items from the reader.

Original Nuzenio articles are separate and must be manually published. No AI-generated third-party rewrites, fabricated headlines, unauthorized images, production secrets, or guaranteed AdSense claims.

## Next milestones

Improve mobile design, add first-party story clustering, build richer original-article editing and correction history, independently audit XML/DNS security and publisher contracts, and perform full browser and production-security tests.

## Current development functions

- Reader routes: `/hi`, `/en`, category pages, search, and all 28 states + 8 union territories.
- Sources start as **pending**, then an editor checks reuse evidence and explicitly approves. Rights can be revoked, hiding items automatically.
- `/admin` and `/api/admin/*` require a valid Cloudflare Access JWT and email allowlist. Drafts and published originals are separate from publisher links.
- RSS ingestion is guarded by source rights, HTTPS domains and bounded fetches. **An independent SSRF/DNS security audit is still required before live sources.**
- GitHub Actions executes syntax checks and Node smoke/security tests on each push and PR.

**Not yet included:** real publisher contracts, editorial operations team, complete source discovery, full Google News-style clustering and recommendations, production-domain deployment, professional legal review or advertising activation.
