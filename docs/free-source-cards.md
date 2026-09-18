# Free Source Cards — offline development prototype

This is a layout/data-contract prototype, **not live ingestion or public publishing**.
It needs no paid news API, AI service, database, staff account, or founder-written news.
All four displayed examples were invented for this prototype. Nothing is attributed
to PIB or Global Voices as an actual report. Costs and operations for a future live
service are not established by this demonstration.

## Run safely

Use a separate checkout/worktree; leave an existing founder preview untouched.
After `npm ci`, run from the repository root, choosing an unused loopback port:

```sh
NUZENIO_ENVIRONMENT=development \
NUZENIO_FREE_SOURCE_PREVIEW=true \
NUZENIO_DEMO_MODE=true \
NUZENIO_FEED_KILL_SWITCH=true \
NEXT_TELEMETRY_DISABLED=1 \
npm --workspace apps/web run dev -- --webpack --hostname 127.0.0.1 --port 3199
```

Open `http://127.0.0.1:3199/preview/source-cards`.
On hosts reporting Watchpack `EMFILE`, add `WATCHPACK_POLLING=true` to that
development command; no system-wide watcher limits need changing.
This is not an authenticated admin route: bind it to loopback, never expose the
development server publicly. No secret, private editorial data or real article is
loaded. Production builds refuse this route even with every preview flag enabled.
Missing, malformed or disabled flags also refuse it. `.env.example` keeps the new
flag **false**. No public navigation entry or reader API fallback was added.

## Implemented boundaries

- Two research registry entries (PIB and Global Voices), both disabled and not
  reviewed. Policy links and research dates are evidence metadata, not approvals.
  Proposed fields are not granted fields. Every real content permission stays
  `unknown`; there is no feed endpoint, scheduling, request or publication path.
- Four English/Hindi **fictional, already-decoded RSS-like JSON items**. These
  exercise title/link/description/date/author mappings (including `dc:creator`).
  They do **not** establish actual RSS shape compatibility, parsing, feed freshness,
  daily Hindi availability or a publisher's item-level permission.
- Strict normalization rejects unknown candidate/language, missing or revoked
  fictional display permission, empty/oversized/HTML/control-bearing text, invalid
  dates, duplicates, real hosts and noncanonical URLs. It creates a new allowlisted
  object: source/author attribution and original text preserved, full text/images/
  generated summaries/translations discarded. The only accepted original/licence
  links are canonical HTTPS links to the candidate's exact reserved `.example` host.
- Original content language is independent of interface language. Filters do not
  translate, persist preferences or change saves/follows. Dates are fixed test
  dates, not claims of current reporting. Original/policy example links explicitly
  say they are not live. Real research-policy links are separately labelled.
- Source cards are not `StoryCluster` objects and have no claims, evidence maps,
  verification badge, independent-source count, save action or publish control.
  They cannot enter reader/search/briefs or the draft inbox through this code.
- No database tables, Alembic revisions, API routes, permissions, existing
  editorial logic or feed kill-switch behavior changed. The worker never imports
  this registry. Existing generated-summary rights are **not** fabricated or relaxed.
- Runtime persistence: none. Only fictional fixtures are stored in source control.
  Next's development page renderer sets `no-cache, must-revalidate` (it overrides
  custom page Cache-Control). These fictional responses are **not** promised
  no-store; do not add real or private data to this lab. Denial responses are
  private/no-store, and all responses are noindex. The existing static-only
  service worker does not cache the route. Fixture modules stay in server code.
  A narrowly matched Next.js proxy rejects HTML/RSC before streaming (real 404),
  and the page repeats the gate. It does not match existing reader/admin routes.

## Research evidence — candidates, not approval

Checked 18 September 2026 during the prior source research:

- PIB: [copyright policy](https://www.pib.gov.in/content/3622_2_CopyrightPolicy.aspx?lang=6&reg=17),
  [RSS directory](https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1).
  Accurate reproduction/source credit and third-party exclusions need checking
  against the actual use. Do not invent a Hindi feed endpoint. An official release
  is not independent verification.
- Global Voices: [attribution policy](https://globalvoices.org/about/global-voices-attribution-policy/),
  [RSS directory](https://globalvoices.org/feeds/).
  Check original author, item licence, source/licence links, change notices and
  upstream/third-party exclusions. A Hindi site is not proof of fresh daily Hindi
  coverage. No real licence is attached to these invented examples.

## Verification commands

```sh
npm run format:check:web
npm run lint:web
npm run test:web
npm run build:web
npm --workspace apps/web run test:e2e:source-cards
NUZENIO_SOURCE_CARD_TEST_PRODUCTION=true npm --workspace apps/web run test:e2e:source-cards
```

The browser tests use a separate loopback server, **no database reset or API setup**,
desktop/mobile projects and an unconditional zero-retry reporter. The first run
checks fictional lab rendering, attribution, filters, unchanged original language,
no storage/API/external browser requests, overflow, accessibility and response
headers. The second uses the preceding production build and checks HTML/RSC
requests reject the showcase despite all demo flags being set. Both steps are
included in the E2E workflow, without changing existing release/draft tests.

### Local implementation validation — 18 September 2026

- macOS Node 25.9.0: clean offline `npm ci`, formatting/lint, 197 web unit tests
  and production build passed. Production-denial requests (HTML and RSC) passed.
- Disposable Linux Playwright 1.62.1 image, Node 24.18.1: clean `npm ci`, formatting,
  lint, all 197 web tests and production build passed. Both desktop (1440×900) and
  mobile (390×844) UI/accessibility tests passed, followed by both production-denial
  tests. Four checks total, effective retries zero. No API/external browser
  requests or localStorage changes occurred in the UI tests.
- In-app browser: English/Hindi rendering, original-text preservation and the
  filtered Hindi card/attribution layout inspected. A stalled temporary browser
  tab was closed and replaced; existing founder-preview tabs were preserved.
- Initial runs found a streamed soft-404 and Next's development Cache-Control
  override. The narrow proxy fixes the former; the latter is documented and
  tested as revalidation-only, **not** silently claimed as no-store. A test-helper
  export mismatch was corrected to Next 16.3.4's actual legacy-named export.
- Native macOS Chromium launch was sandbox-blocked before browser assertions;
  Linux provided the automated browser evidence. A local port grant was needed;
  polling resolved local file-watcher exhaustion without system-setting changes.
- API, migrations, dependency lock and Compose definitions are unchanged; no
  full API/database or existing whole-product E2E rerun is claimed. Test containers
  used read-only source mounts and disposable storage, then were removed. All six
  existing founder-preview services remained healthy.
- These are local implementation results, not independent closure review or a
  GitHub CI result. No source approval, feed activation, publisher contact, push,
  merge or deployment had occurred at the time of this implementation validation.
  Subsequent commit, PR and exact-SHA CI status belong in the PR handoff.

## Required next gate, not authorized by this prototype

Before any real fetch: select and verify one exact feed and access terms, define a
separate capability-specific source-card rights and human-review workflow, review
source pause/revocation and item exclusions, and add bounded safe XML parsing,
transport budgets/SSRF controls, deduplication and a private inbox. Existing
`docs/publisher-rights-workflow.md` summary permissions and the fixture-only draft
inbox must not be weakened to accommodate this mode. A research policy must never
be treated as a publishing decision. Obtain independent implementation review and
explicit authority for a bounded private live-source canary. Public automation,
paid services, deployment and publisher contact are outside this slice.
