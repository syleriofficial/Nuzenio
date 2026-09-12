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
Arrays are validated/deduplicated and corrupt input is ignored without crashing.
The 200-entry limit applies to new additions, not legacy reads: valid larger
lists remain visible/removable in full, in their original order. Adding an ID
is refused until the list contains fewer than 200 entries; removing one never
discards unrelated overflow entries. Canonical IDs support the database's
300-character cluster-slug limit. Read input is bounded to 131,072 code units.
Above that parsing budget, storage is treated as unavailable/read-only rather
than replacing omitted data with an empty list. The original value is retained
for external recovery; no automatic truncation or migration is performed.
Failed writes do not update
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
Saved request cancellation uses a per-request AbortController, a parent abort
listener and an eight-second timer through response-body decoding. It does not
require AbortSignal.any or AbortSignal.timeout. Timers/listeners are cleaned up
on completion, failure or cancellation, and late results after abort are rejected.

Storage is per browser profile AND origin (scheme/host/port), not cross-device
or an authenticated reader account. Different preview ports have separate lists.
Concurrent writes to the same localStorage key are last-writer-wins; these are
preferences, not a transactional multi-device account database. For You and
Following operate on the current public edition supplied by `getTopFeed`
(currently up to 20 clusters), not the entire historical corpus.

## Verification

- 98 web unit tests passed, including legacy-overflow/capacity/recovery cases,
  compatible timeout/abort/cleanup cases and release-suite ordering/coverage.
- Production Next.js webpack build and TypeScript passed; lint/format passed.
- 24 reader production-browser checks passed with effective retries zero across
  1440×900 desktop and 390×844 mobile Chromium. Covers same-document/other-tab
  state, reloads, empty Following, source filters, reversible preferences,
  actual ranking/off switch, unavailable/error bookmarks, corrupt/blocked
  storage, bounded pagination/long IDs, Hindi/theme and axe checks on the changed working surfaces.
- Tests run against the real isolated founder PostgreSQL/FastAPI fixture
  preview; explicit browser route mocks exercise 404/503 recovery. Browser
  tests do not bootstrap staff, mutate editorial data or contact publishers.
- New specs participate in the existing release E2E config on both viewports.
  Explicit project dependencies run desktop reader and read-only mobile checks
  before the existing desktop editorial suite mutates their shared seed data.
  All 50 checks remain selected once (three projects, two viewports), with
  effective retries zero. Config/listing regressions preserve that ordering
  and coverage. The standalone reader config remains two read-only projects.
  A standalone, local-only config can verify an already-running preview:

  `NUZENIO_READER_TEST_URL=http://127.0.0.1:33273 npm --workspace apps/web run test:e2e -- --config=playwright.reader.config.ts`

The first browser run found ambiguous test locators and missing main landmarks
on the changed views. Locators now target the intended controls; landmarks were
fixed. Accessibility captures wait for the persisted theme's transitions to
finish instead of scanning transient colors. No assertions were skipped or
retries enabled. The local file-watching development server hit host EMFILE;
verification and the delivered preview use the successful production build.

The unchanged full Python/security/Compose/editorial E2E suites were not rerun
locally for this frontend milestone. The first PR CI run (34657105206) passed
Web, API and Compose but exposed a fixture-ordering defect: editorial tests had
already split the national cluster and corrected the technology headline before
the new reader assertions ran (30 passed, 12 failed). The explicit project
dependencies above correct that test boundary; no product behavior, editorial
assertions, fixture data or retry policy was weakened. The follow-up CI run
34657611292 passed the original combined 42-check suite. The latest remediation
adds eight checks; a new exact-head CI run must verify all 50. This implementation is not an
independent security closure review or production approval.

## PR #3 independent-review remediations

- **Legacy loss:** the review reproduced removing one of 201 old bookmarks and
  persisting only 199. Six new unit regressions failed before the fix and passed
  afterward. Coverage includes first/middle/last and overflow removals, long
  slugs, cross-tab rereads, capacity recovery, other ID lists and oversized
  values that must remain untouched. Desktop/mobile browser checks verify
  all 201 are recognized and removing one retains exactly the other 200.
- **Browser cancellation:** the review's missing-AbortSignal.any reproduction
  is covered in actual production Chromium with any, timeout or both static APIs
  disabled before application load. Stories load, disappear after a 404
  revalidation, recover and reload. This models capability absence; it does not
  claim execution of native Safari 16.4. Unit tests additionally cover an already
  aborted request, the eight-second deadline, late body decoding, parallel
  cancellation, HTTP/error handling and timer/listener cleanup.
- The legacy-overflow and missing-any browser cases failed on both viewports
  against the prior production preview (four failures). Against the fixed
  production build all 24 reader cases passed without retries, including the
  original 16. These tests used fresh isolated contexts and the existing
  fictional public API; no staff/bootstrap/fixture reset or publisher call ran.

No backend, migration, dependency, service-worker or editorial changes were
needed. Native Safari and complete local API/Compose/editorial reruns are not
claimed; exact-head CI and a fresh independent closure review remain required.
