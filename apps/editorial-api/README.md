# Nuzenio Private Editorial Worker — staging scaffold only

**NOT DEPLOYED.** The editor login and private database require deliberate Cloudflare configuration by the repository owner. No part of this change has activated public news publishing.

The optional backend is a Cloudflare Worker serving a private editor at `/studio/`. It stores Hindi article and Web Story drafts in Cloudflare D1, supports manual reviews, and distinguishes `draft`, `in_review` and `approved_for_manual_release`. Approval never publishes a news item.

### Security design

- Every request (including HTML, JS, CSS) requires a validated Cloudflare Access JWT, checked against the team's public JWKS and the application's configured issuer and audience.
- Check that the signed JWT has the configured owner's email. Reject requests from any other host/origin.
- Mutating requests must send `Origin` matching the configured admin origin exactly.
- No wildcard CORS, CDN scripts, public read API, or GitHub credentials.
- Config missing? The whole service responds with 503. `EDITOR_ENABLED` is disabled in the template.
- Private drafts are in D1, not public GitHub pull requests.
- Prepared SQL, state transition checks and version-matched updates help prevent race-related lost writes.
- JSON request payloads are capped at 64 KiB. Drafts are not logged.
- Manual source verification, image rights attestation and explicit owner confirmation are required to mark ready for manual release.
- No automatic research, article writing, scheduled ingestion, GitHub push, deploy, or public publish endpoint is present.

### Before even considering a private staging deploy

1. Independently review the backend, auth, test coverage, threats and data protection. CI passing is insufficient.
2. Create a dedicated self-hosted Cloudflare Access application for the exact private editor hostname with an owner allowlist and MFA.
3. Create a dedicated private D1 database and apply `schema.sql`. Configure D1 `DB` binding using the real database ID, retaining appropriate backups.
4. Review `wrangler.example.toml` and create private `wrangler.toml`, with `EDITOR_ENABLED` left disabled until owner testing/approval. Configure the exact `ADMIN_ORIGIN`, `TEAM_DOMAIN`, `POLICY_AUD` and `OWNER_EMAIL`.
5. Confirm `workers_dev=false` and verify all Worker preview/custom routes, Access policies, CORS and token rejection in a separate staging environment. Test logout, token revocation, invalid/expired/wrong-audience JWT, spoofed headers, non-owner identity, hostile origins, rate limiting and D1 backups.
6. Only with the owner's explicit approval, enable the staging service. Conduct manual, responsive-browser and independent security review. Never connect its data or state directly to public publication.

**Cloudflare identity documentation:** https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

### API

- `GET /api/me`: owner identity and publishing disabled indicator.
- `GET /api/drafts`: private owner-specific list.
- `POST /api/drafts`: new private draft, always status draft.
- `GET /api/drafts/:id`: private full draft.
- `PUT /api/drafts/:id`: edit a draft with matching revision.
- `POST /api/drafts/:id/review`: submit to review (requires source links).
- `POST /api/drafts/:id/return`: return to draft.
- `POST /api/drafts/:id/approve`: explicit checked approval for **manual release only**, not publication.
- `GET /api/drafts/:id/history`: private audit display.

The public `/admin/` remains inactive. There is no publishing endpoint, and no transfer of D1 drafts to the public content directory.

### Local checks

From repo root: `npm install && npm run editorial-api:check`.

These are unit/contract tests with a fake DB and fake successful identity **only for testing**. They do not replace deployed signature validation, Cloudflare Access policy checks, penetration testing, D1 integration testing or production operational review.

### Important limitation

D1 audit entries currently aid review but do not claim legal-grade, append-only tamper-evident logs. This prototype must not be treated as a complete regulated newsroom system.
