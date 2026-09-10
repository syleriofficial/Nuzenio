# Founder acceptance matrix

This is a repeatable acceptance checklist for the production build and fictional fixture environment.
It does not authorize deployment or live feeds. Browser tests use disposable `nuzenio_e2e` data and
must never target an application database.

## Reader

| Area | Acceptance evidence |
| --- | --- |
| Top, Local, Story, Source, Search and Briefs | API contract/unit coverage plus reader browser navigation against the production build. |
| For You and Following | Device-local preference, explanation, follow/save/hide and empty-state tests. |
| English/Hindi | Headline, summary, claim and navigation switching; Hindi remains readable without clipping. |
| Story cluster | Neutral headline, short brief, Confirmed/Developing/Disputed evidence, organization source count, comparison, timeline, primary documents, publisher links and correction history. |
| Responsive UI | Chromium at approximately 390px mobile and 1440px desktop; also inspect the existing 768px breakpoint before release. |
| Accessibility | Automated axe checks plus keyboard order, visible focus, landmark/name and touch-target inspection. |
| PWA/offline | Manifest/install metadata and static-only offline behavior. API/admin/RSC/no-store responses never enter CacheStorage or receive an app-shell fallback. |

## Editorial workspace

Verify login/logout, generic errors, RBAC for all five roles, review queue, contributor-bound high-risk
dual control, alert approval separation, cluster merge/split/suppression, correction propagation,
publisher/rights snapshots, no-fetch feed dry run, edition pause and formula-safe audit CSV/JSON export.
Temporary fixture sessions must be logged out/revoked after the run.

## Required commands

```bash
npm ci
npm run format:check:web
npm run lint:web
npm run test:web
npm run build:web
apps/api/.venv/bin/ruff check apps/api
apps/api/.venv/bin/ruff format --check apps/api
apps/api/.venv/bin/pytest apps/api/tests
npm run test:e2e
```

The GitHub Compose job additionally creates a run-scoped project, builds API/worker/migration/seed
images, waits for PostgreSQL/Redis/API/worker readiness, loads only explicit fictional fixtures,
verifies a real PostgreSQL backup/restore into a separate empty instance and unconditionally removes
its containers, network and volumes. A green syntax-only Compose check is not sufficient.

Record exact commit, viewport/browser, results, console/network failures and screenshots in the PR.
If Docker is unavailable locally, report the exact socket command/error and rely only on matching-SHA
GitHub evidence for the Compose portion; do not claim local full-stack validation.
