# Milestone 3A — browser-local reader MVP

Base: merged Milestone 2C, `095cd08571df2985b49aeaf0ddd91fa369510312`.
No API/database migration, editorial policy, authentication, logging security,
feed worker, rights permission, or service-worker cache policy is changed.
No live feeds are enabled. Persistent report submission is Milestone 3B.

## Reader behavior

- Cards and story detail share Save state. `/saved` is reachable from the desktop
  bookmark icon, mobile menu, Following and Settings.
- Topic/source follows, hidden sources and the personalisation switch survive
  reloads. An explicitly empty topic list stays empty. No implicit default
  follows are created.
- All consumers within a document update immediately; other tabs refresh on
  storage events/focus. Legacy saved/topic/hidden-source arrays are read directly.
- Following contains recent clusters matching a followed topic OR source.
  For You stably promotes those matches over the other recent edition stories.
  Explanations come from actual preferences. Turning personalisation off
  restores edition order, but does not disable source hiding.
- Hiding a source excludes the entire containing cluster from Top, Local,
  Following, For You, Search, Briefs and source-profile feed lists. Saved keeps
  a removable placeholder for a hidden bookmark. This conservative rule avoids
  presenting an edited evidence set or falsifying independent-source counts.
  Direct source/story links remain accessible. Hiding is a display preference,
  not an authorization or publication rule. Settings/source profiles can unhide.

## Storage and public content boundaries

The shared store retains only canonical IDs and preferences, never story
headlines, summaries, evidence or full public/private API responses.
Arrays are validated/deduplicated, bounded to 200 entries, and corrupt input is
ignored without crashing. Canonical IDs support the database's 300-character
cluster-slug limit. Read input is bounded to 131,072 code units. Failed writes do not update
the UI as successfully persisted. Storage-blocked browsers get a visible warning.
Language/theme remain usable for the visit when persistence is unavailable.

Saved displays ten bookmarks at a time, newest first. Each is fetched from the
same-origin `GET /api/reader/story?slug=...&language=en|hi` route, which calls only
the fixed public reader endpoint, forwards no staff credentials, validates
parameters and sends `private, no-store`. The underlying API client also uses
`no-store`; production never substitutes demo fallback.

404 means unavailable/suppressed, while 503 means an upstream problem. Both
produce placeholders instead of an old copy. A bookmark can be removed in either
state. Opening the list, changing language/page/bookmarks, refresh, returning to
the page, connectivity changes and focus trigger revalidation. Stale in-flight
responses are cancelled/ignored. This is not continuous real-time invalidation:
an already-visible story changes on the next revalidation, not by push delivery.
The existing service worker never caches this API or reader content.

Storage is per browser profile AND origin (scheme/host/port), not cross-device
or an authenticated reader account. Different preview ports have separate lists.
Concurrent writes to the same localStorage key are last-writer-wins; these are
preferences, not a transactional multi-device account database. For You and
Following operate on the current public edition supplied by `getTopFeed`
(currently up to 20 clusters), not the entire historical corpus.

## Verification

- 75 web unit tests passed, including 27 new storage/ranking/route checks.
- Production Next.js webpack build and TypeScript passed; lint/format passed.
- 16 new production-browser checks passed with effective retries zero across
  1440×900 desktop and 390×844 mobile Chromium. Covers same-document/other-tab
  state, reloads, empty Following, source filters, reversible preferences,
  actual ranking/off switch, unavailable/error bookmarks, corrupt/blocked
  storage, bounded pagination/long IDs, Hindi/theme and axe checks on the changed working surfaces.
- Tests run against the real isolated founder PostgreSQL/FastAPI fixture
  preview; explicit browser route mocks exercise 404/503 recovery. Browser
  tests do not bootstrap staff, mutate editorial data or contact publishers.
- New specs participate in the existing release E2E config on both viewports.
  A standalone, local-only config can verify an already-running preview:

  `NUZENIO_READER_TEST_URL=http://127.0.0.1:33273 npm --workspace apps/web run test:e2e -- --config=playwright.reader.config.ts`

The first browser run found ambiguous test locators and missing main landmarks
on the changed views. Locators now target the intended controls; landmarks were
fixed. Accessibility captures wait for the persisted theme's transitions to
finish instead of scanning transient colors. No assertions were skipped or
retries enabled. The local file-watching development server hit host EMFILE;
verification and the delivered preview use the successful production build.

The unchanged full Python/security/Compose/editorial E2E suites were not rerun
for this frontend milestone. No matching GitHub CI is claimed until these local
changes are pushed and CI runs. This implementation is not an independent
security closure review or production approval.
