# PR #1 security remediation

Reviewed head: `818cb5b42f58beacf7d3ff6f66ad56322ffdf5b2`. Base: `83635db201acde4e7540922f3c241f9be8fb34f4`.
The complete independent review in the task is the acceptance checklist. No finding is dismissed by a green existing suite. Independent re-review is required; this document is not a merge authorization.

| Finding | Reproduction/evidence | Fix | Regression coverage | Remaining risk |
| --- | --- | --- | --- | --- |
| F01 | Startup CMD and seed assignments confirmed; baseline preservation regression failed | Explicit dev/test-only create-only seed; production refusal; hold unproven legacy approvals; all reader queries require current review | `test_remediation.py` F01; upgrade fixtures; isolated Compose restart/reseed | Existing HIGH content deliberately disappears until reassessed; owner SQL is privileged |
| F02 | Review accepted based on old row identity rather than current content; review PoC confirmed; summary decision could transfer draft authorship | Material revision binding, supersession, current-pending-only decisions, cluster-first locking, independent final/alert reviewers including administrators; preserve draft author during summary decisions | F02 stale/repeated/concurrent API requests and authorship-transfer regression; high-risk E2E | Authorized editorial evidence assessment is still required |
| F03 | Baseline JSONB datetime audit regression failed | Recursive JSON-safe audit/revision encoder; one transaction; failures propagate | Nested datetime/UUID/enum test; real suppression/restoration and summary decisions; injected audit failure rolls domain change back | Unsupported future types deliberately fail closed |
| F04 | Old combined account/IP bucket and post-hash throttle confirmed in code/review PoC | Atomic Redis global/IP/account admission before hash; fixed cooldown; trusted-proxy allow-list; Redis failure denies admission; R5 below replaces expiring verifier leases | Rotated IPs/random usernames/global cap/concurrency/cooldown/Redis outage/spoofed forwarding tests | Rate limits can temporarily deny legitimate staff under attack; operational monitoring/edge limits needed |
| F05 | Review's blocked-fetch pause PoC and stale ORM authorization path confirmed | No network transaction; final refreshed ordered locks, approval versions/dates and kill-switch check; queued work cancelled on revocation | Six in-flight changes: pause, expiry, revocation, DB/global switch, environment switch, rights version | Coarse pilot-wide lock limits throughput; direct owner writes are outside the API protocol |
| F06 | Truthy empty map accepted; additional null-text SQL regression failed before fix | Strict sentence/evidence schema, complete coverage, same-cluster relational checks at approval and reader selection; suppress legacy invalid maps; new mapped revisions preserve old text | Empty/partial/fabricated/cross-cluster/null/document maps; API revision/approval; SQL/Python boundary tests | Structural provenance is NOT truth or entailment verification; conservative punctuation sentence splitting |
| F07 | Mutable brief slug references and allocation code confirmed; split draft recovery regression failed | UUID brief membership with archived slugs; transactional documented allocation; preserve revisions/corrections; hold all results; empty unapprovable split drafts | Merge/split membership/evidence/public reader checks; duplicate-slug partial failure rollback; E2E | JSON UUID membership is application-managed, not a normalized FK relation; remapping summaries is an authenticated API operation |
| F08 | No abandoned RUNNING recovery/atomic claim at reviewed head; repeated dead-letter replay regression failed | Durable DB dispatch outbox, atomic claims, 60s leases/10s heartbeats, fencing, partial unique active-feed index, single-use replay | Worker takeover/death-equivalent lease expiry, duplicate deliveries, Redis failure, competing schedulers and dead-letter replay | Recovery needs a live worker and PostgreSQL; Redis remains availability infrastructure, not authority |
| F09 | Export writer emitted untrusted cells directly; review formula PoC confirmed | Neutralize every CSV cell after leading whitespace/control inspection; canonical records/JSON unchanged | Prefix variants and real User-Agent/action/entity/request/reason exports | Spreadsheet behavior varies; treat exported data as untrusted |
| F10 | Rights review UI/API omitted evidence and permissions | Complete policy/publisher/ownership/date snapshot, granular permissions, review history, hash+version-bound approval; stale/missing snapshots conflict | API snapshot/hash contract and publisher onboarding browser journey | A hash identifies approved data; it cannot prove a human read or legally validated a contract |
| F11 | Transport had idle-only timeout and automatic decoding | Absolute subprocess deadline across DNS/TLS/redirect/body; identity-only response encoding; raw byte bounds; explicit `trust_env=False`; retain pinned socket/Host/SNI | Slow-drip fixture, compressed bomb rejected before read, stalled production transport killed, existing SSRF/XML suite | Compressed feeds intentionally unsupported; production egress firewall still recommended |
| F12 | Runtime and migration database owner were identical; row trigger does not stop TRUNCATE | Separate owner/runtime provisioning; runtime has no ownership/DDL/audit mutation grants; statement TRUNCATE trigger; production identity guard | Actual runtime LOGIN attempts UPDATE/DELETE/TRUNCATE/disable-trigger/create-table/drop-function; owner TRUNCATE trigger test | Database owner/superuser can deliberately change grants/triggers; separate privileged controls required |
| F13 | Baseline HttpUrl accepted HTTP/userinfo document URLs | Shared strict HTTPS/no-userinfo external-link type at document/correction inputs | Scheme, userinfo, authority/backslash/control/port validation cases | HTTPS is not a publisher authenticity or content-safety guarantee |
| F14 | Advisory independently confirmed against official sources | pytest `>=9.0.3,<10` (tested 9.1.1); npm and complete installed third-party Python dependency audit gates | Both audits report no known vulnerabilities; full suite runs with patched pytest | Registry/advisory coverage is incomplete and time-dependent; dependency ranges still need ongoing maintenance |
| F15 | Reviewed schema/ORM differed on four redundant uniqueness constraints | Forward migration removes redundant constraints while retaining unique indexes; drift checks on clean and both upgrade paths | `test_database_remediation.py`, `alembic check` in CI | Data/index work needs a maintenance window and tested backup at production scale |

Baseline evidence includes the independent local fixture/database proofs recorded in the review and direct inspection of the reviewed code. The initial regression run recorded six expected failures before behavior changes. Not every new interface test could run against the old schema: new lease/snapshot/revision fields did not exist. Those are integration regressions, not claims of independent pre-fix exploit execution. No finding was dismissed. Tests use explicitly disposable databases only, never existing application volumes.

Additional adversarial checks during remediation found null sentence text accepted by the initial SQL validator, repeated dead-letter replay, and missing split draft recovery. Each had a failing regression before repair. An attempted evidence row with BOTH article and document was already rejected by the existing one-source CHECK constraint; this was not an exploitable bypass. The final test uses a foreign-cluster document and both validators reject it.

A final F02 sequence also reproduced HTTP 200 for an original drafter's final approval after a
different user approved the summary. Summary decisions now preserve the current draft author while
superseding/rebinding the review; the original drafter receives `409 dual_control_required`.

## Forward migration and operational decisions

Applied 2A/2B migration history is unchanged. New chain:
`b31f72a9c4de -> d4f8c2a71e90 -> e52ba4d9013c -> f61c2d0387ab -> a74e9b0216cd`.

- `d4f8c2a71e90`: hold legacy unproven high-risk content, supersede reviews, add material revisions and evidence/current-review SQL predicates; never fabricate historical approvals.
- `e52ba4d9013c`: durable leases/fencing, singleton feed control, active-run exclusion and conservative repair of legacy active runs.
- `f61c2d0387ab`: migrate brief slugs to UUIDs, preserve original references, hold unresolved briefs, align redundant constraints, protect audit TRUNCATE.
- `a74e9b0216cd`: strict SQL JSON types and local evidence references aligned with Python; invalid approved summaries become pending.

Run migrations/provisioning with a dedicated owner, then start API/worker with the runtime identity.
Stop writers and take a tested backup before upgrading. Safety revisions refuse downgrade; use a
forward repair or restore matching code/database from backup. See [recovery procedure](backup-recovery.md).

The lockfile-only CI fix had moved Vite from 7.3.6 to 8.2.2. This unrelated major change is reverted
with an exact 7.3.6 override compatible with the existing Vitest dependency range. The regenerated
lockfile retains oxfmt 0.61.0 and Lightning CSS 1.31.1 with their exact Linux/macOS optional native
bindings; `npm ci` remains the installation command. No native package versions were guessed.

## Validation record

All validation uses fictional fixtures. No publisher feed, existing application volume, deployment,
merge, or paid service is involved.

| Check | Result |
| --- | --- |
| macOS clean `npm ci`, web format/lint, unit tests, production build | Pass; 13 web tests |
| API Ruff lint/format and full PostgreSQL/Redis tests | 114 passed; includes clean migration, 2A/2B upgrades, drift, concurrency, privilege and security suites |
| Linux Python 3.12 API suite | 114 passed; same PostgreSQL/Redis regression coverage |
| Linux Chromium Playwright E2E + axe desktop/mobile | 13 passed, including six reader/admin accessibility scans |
| Repeated production-server axe scans, retries disabled | 30 passed: five repetitions of all six desktop/mobile route scans |
| macOS Chromium E2E | Environment-blocked by sandbox Mach-port restrictions; no tests disabled; Linux run is the browser validation |
| Clean Linux AMD64 Node 22.13.0 / npm 10.9.2 `npm ci`, format/lint/tests/build | Pass; 13 tests; both native toolchains load |
| Isolated Compose build/config/health | Pass: migration/provisioning exits successfully; API, worker, PostgreSQL, Redis healthy |
| Seed/restart smoke | Seven fixtures retained; edited headline, HELD status and persistent kill switch survive restart and repeat seed; production seed refusal tested |
| Dependency audits | npm: zero known vulnerabilities; Python frozen installed third-party set: zero known vulnerabilities |

The first remediation CI run (`33809517465`) completed green but reported one retried `/admin`
axe `document-title` failure: the earlier title assertion had passed, then axe saw an empty title.
This is disclosed rather than counted as a clean first-attempt pass. Browser verification now starts
the production Next.js build (not the hot-reloading development server) and waits for the admin login
form and route-specific title before axe. No accessibility rule is disabled or violation filtered.

The Python gate is `python -m pip freeze --all --exclude-editable | pip-audit --strict --no-deps --disable-pip -r /dev/stdin`.
It audits the complete resolved third-party environment including pip; only this first-party editable
project is omitted because it has no registry release. `--no-deps` prevents re-resolution of the fully
pinned input, not omission of transitive installed packages. The attempted combination of `--local
--skip-editable --strict` rejected the first-party editable distribution and was replaced, not ignored.
There are no advisory exceptions. Any future exception requires a specific advisory, evidence,
owner, expiry and independent approval; never blanket-ignore audit failures.

## Limits and handoff

Representative legacy fixtures, not production data, were used for upgrade tests. Mock transports
and a blocked child process verify resource controls without internet; no real slow publisher was
contacted. Audit tests use a real non-owner PostgreSQL login, not a mock permission layer.
The original authentication lease assumption was invalid and is superseded by R5 below;
edge admission controls and operational process/memory limits remain recommended. Rights review
history displays the latest 100 transitions; the authorized audit interface retains the full history.
Summary remapping currently uses the authenticated API, with review/approval in the existing UI.
Offline browser caches already outside server control cannot be remotely erased; correction
metadata invalidates server-managed saved snapshots on next synchronization.

Independent security re-review is required. Passing tests are not a SAFE TO MERGE verdict.

Advisory verification: https://github.com/advisories/GHSA-6w46-j5rx-g56g and https://github.com/pytest-dev/pytest/releases/tag/9.0.3 (checked 2026-09-04). Structural evidence coverage is not verification that a claim is true.

## Independent re-review: R1–R6 targeted remediation

Reviewed baseline: `3429765a0562315fd436a035efc9348ac079c184`, branch
`feat/milestone-2b-editorial-ops`. The complete independent re-review was read, including its
bounded stream-close diagnosis. Baseline branch/head, clean worktree and origin were verified;
PR #1 and CI run `33810394557` both still pointed to that exact baseline before changes/push.
No milestone, reader redesign, ingestion expansion, deployment or merge is part of this round.

### Reproduction → invariant → fix → regression → residual risk

| Finding | Independent reproduction before fix | Invariant and repair | Regression | Residual risk |
| --- | --- | --- | --- | --- |
| R1 material authorship | Original A→B identical headline→A final approval returned 200; normalized and secondary edits also lost A's protection | Detect NFC/whitespace-equivalent no-ops before revision changes. Append-only cluster-lineage contributor set survives headline/claim/evidence/summary changes and merge/split. Every contributor, including administrators, is excluded from final and alert approval. Ordered cluster locking preserves revision checks; unknown legacy provenance cannot be approved | `test_rereview_regressions.py`, `test_material_invariants.py`: original exploit, identical/normalized/secondary edits, all material paths, administrator restriction, independent reviewer success, concurrent edit/decision, unknown provenance. Existing stale/repeated/alert tests retained | Conservative lineage never removes an author, even after a complete rewrite. Unknown legacy high-risk content needs independently reviewed reconstruction, not a fabricated author or a new edit used as a bypass |
| R2 duplicate merge | `[S,S]` accepted and lost memberships | Canonical UUID duplicate/target validation before mutation; defensive unique sorted IDs internally; preserve transaction and locks | Original PoC; full graph snapshot unchanged for duplicate, uppercase canonical duplicate and target input; competing merges produce one 200 and one 409; existing normal relationship and rollback tests | Brief membership remains application-managed JSON UUIDs; SQL owners can bypass application protocols |
| R3 correction dependencies | Claim-only correction retained the old approved assertion publicly | Central dependency invalidation retires all affected language versions before mutation, including corrections with no replacement text and article corrections across clusters. Claim/evidence changes retire dependent maps. Historical text is retained but invalidated IDs cannot be re-approved. Saved snapshots lose stale payloads; high-risk review is superseded | Claim-only/article-only bilingual API regressions cover detail, Top, Local, sources, search/counts and both briefs, authenticated-only history, saved snapshot removal and unaffected clusters. Correction browser journey now requires new mapped summary, approval and restoration | Structural evidence still does not prove truth. Already-offline devices require reconnect/update; older clients cannot be remotely purged. Conservative correction invalidation may temporarily remove otherwise usable summaries |
| R4 private search oracle | Unique pending summary canary affected anonymous result counts | SQL `nuzenio_public_summary` is the single version selector for rendering AND matching before count/pagination. Only current approved/non-invalidated/structurally valid requested-language summary (or English fallback) is searchable | Pending, rejected, superseded approved, withdrawn and stale canaries yield empty pages and zero counts while selected public text is found; R3 corrections also remove previously searchable text | No autocomplete/facets exist. Future search adapters must preserve eligibility before indexing/matching, not post-filter private hits |
| R5 verifier ownership | Real Redis, concurrency=1, real 61-second blocking work: second attempt admitted while first was live | No expiring ownership lease. Child inherits local OS file lock; parent must kill and reap before release. Child wall/CPU/memory controls plus supervisor deadline. Request cancellation cannot release a running thread/child; Redis failure fails closed. Capacity configuration cannot drift within a live lock domain | `test_rereview_verifier.py`: real >60s work, limit-one refusal, child stop/kill/reap, actual supervisor SIGSTOP/SIGKILL, inherited orphan ownership, Redis-client failure during real active work, cancelled awaiter and successful capacity recovery. Existing pre-hash/global/IP/account regressions retained | Strict cap is local lock-domain/container/host scope, NOT fleet-wide under partitions. Requires local POSIX filesystem and stable lock files; deployment CPU/memory/PID/edge limits remain necessary. Kernel-uninterruptible work retains capacity until actual exit |
| R6 private offline cache | Production same-origin proxy: private JSON replayed after logout; missing no-store; legacy cache persisted | Static-only credential-free allowlist; every API/admin/RSC request network-only. Reject private/no-store/RSC responses even on static paths. `nuzenio-static-v2` activation deletes legacy `nuzenio-*` caches only. API private/no-store headers include exceptional 500s. Clear/abort/invalidate private client state on logout/login, cross-tab change and BFCache restore | Production same-origin Playwright: admin/analyst switch, private read→logout→offline, staff-only endpoint restriction, cross-tab clearing, no-store, legacy private canary purge, unrelated cache preserved, offline static asset success. Unit tests cover RSC/query/header bypass and late response races; real 500-header regression | Already-offline devices cannot receive the purge until reconnect and worker update. Previously disclosed data cannot be recalled. Static offline page is preserved; live story/API offline reading is deliberately not supported |

The original five server security-invariant reproductions failed before behavioral fixes; the
production-browser baseline had three expected failures establishing R6. Six additional authorship/
search regressions also failed against the old behavior. Newly introduced schema/process interfaces
are tested on the repaired implementation, not falsely described as runnable pre-fix tests. The
61-second reproduction uses actual elapsed time, not a mocked clock. Redis-failure tests inject a
client connection failure while using real Redis admission; they do not claim a fleet partition test.

One original test created a review directly with a named drafter but no new contributor record;
its fixture now records that explicit author. It still rejects self-approval and requires independent
approval. Older correction tests expected immediate public restoration after changing evidence;
they now require a fresh mapped version and review, while retaining their original correction-history
and reader assertions. No test/check/rule was disabled. The API exposes invalidated history only to
authorized staff, not through reader response payloads.

### Forward migration and operation

New migration: `a74e9b0216cd → b85f0e1162da`. Applied migration history is unchanged.
It adds contributor provenance and append-only protection, unknown-provenance holds, irrevocable
summary invalidation fields, legacy stale-summary repair, and shared public-summary SQL selection.
Existing IDs/text are preserved. No historical authors/reviewers are inferred. Re-run owner-only
runtime provisioning after upgrade. Actual runtime LOGIN tests deny contributor/audit UPDATE,
DELETE, TRUNCATE and trigger alteration plus DDL. Safety downgrade remains deliberately refused.

Contributors are retained for the entire content lineage; a later contributor cannot remove an
earlier author's approval exclusion. A no-op returns the same version without new review/audit
mutation. Regeneration creates new summary IDs; retired IDs remain authenticated history.

See [authentication ownership and limits](authentication-authorization.md#password-work-ownership-r5),
[environment settings](environment.md), [correction policy](correction-policy.md), and
[migration/recovery](backup-recovery.md). Only fictional `.example` feeds/local fixtures are configured;
the fixture worker kill switch stays enabled. No third-party publishers were contacted.

### R1–R6 validation record

This record supersedes the earlier milestone test counts, not the disclosure of earlier failures.

| Check | Result |
| --- | --- |
| API formatting/lint | Ruff passes |
| macOS full PostgreSQL/Redis API suite | 147 passed, including all new regressions and existing F01–F15 suites |
| Linux Python 3.12 full PostgreSQL/Redis suite | 147 passed; 79.39 seconds; two upstream TestClient deprecation warnings |
| Web formatting/lint/unit/build (macOS) | Pass; 28 unit tests and production build |
| Production Chromium E2E + accessibility | 17 passed, retries disabled; includes six desktop/mobile axe scans and four private-cache/account tests |
| Clean migration; representative 2A, initial 2B and reviewed-head upgrades; drift | Pass in database regression suite; no drift |
| Actual archived 2A and reviewed initial-2B seed upgrade | Pass: all IDs unchanged across 14 core entity tables, seven clusters/23 articles retained, unknown high-risk held; no drift |
| Runtime-role mutation/DDL protections and seed idempotency | Pass in full API suite |
| Clean Linux AMD64 Node 22.13.0/npm 10.9.2 install/build | `npm ci`, formatting, lint, 28 unit tests and production build pass; Linux optional native bindings load |
| Compose configuration/build/health and restart/reseed | Pass in a separate project with tmpfs PostgreSQL/Redis: migrate exits 0; API/worker/DB/Redis healthy. Three seeds retain seven clusters; edited headline, HELD state and persistent kill switch survive restart |
| Dependency audits | npm audit (all severities): zero known vulnerabilities. Frozen installed third-party Python environment including upgraded pip 26.2.1: zero known vulnerabilities. No exceptions |

A Linux full-suite rerun exposed an existing test-isolation bug: the scheduler test left a QUEUED
fixture on an arbitrary seeded feed that a later retry test reused. After asserting scheduling and
idempotency, it now marks only that test-owned unexecuted run SKIPPED and commits cleanup. An initial
cleanup attempt incorrectly nested the scheduler's own commits in a transaction context; that test
change was corrected before the final 147-pass run. Production feed scheduling/lease code is unchanged.
The first Python audit of the older disposable image found advisories in its pip 25.0.1; upgrading
that test environment's pip to 26.2.1 (as CI already does) produced the clean audit above. No project
dependency was exempted or advisory ignored.

No dependency manifests/lockfiles or unrelated streaming code were changed. The retained Vite 7.3.6
and exact oxfmt/Lightning CSS platform bindings remain covered by clean Linux `npm ci` and the macOS
build. Native macOS Playwright remains environment-blocked by the previously diagnosed sandbox;
the browser execution is Linux Chromium against the production build, not a claim of macOS coverage.

## Closure follow-up: correction contributor provenance

Reviewed baseline: `de6eb9e06f19a86469934b61935eb391f68d75c3`. The independent closure
reproduction was confirmed before this change: staff A opened a correction containing a unique
factual assertion, B applied it and regenerated the summary, then A's final high-risk decision
returned HTTP 200 and made A's correction text visible to an anonymous reader.

Root cause: cluster material lineage recorded the applying editor but not the persisted author of
the correction. The shared invariant is now: every authenticated creator or later material editor
of a retained correction, plus its applying editor and replacement-summary authors, is an
append-only contributor to every affected cluster and cannot provide final or alert-readiness
approval. `provenance.py` is the single registration boundary for cluster and correction lineage.
Correction creation, versioned open-draft editing, application, cluster revision invalidation,
review creation and audit insertion remain atomic in their respective transactions. Application
locks affected clusters in deterministic UUID order before locking/reloading the correction;
approval takes the same cluster lock, so it cannot publish between content change and lineage
registration. Identities always come from authenticated context or persisted contributor rows.

Forward migration `b85f0e1162da → c96a1d2273eb` adds `correction_contributors`, append-only row and
statement triggers, `corrections.provenance_complete`, reader/review SQL gating and a conservative
legacy repair. It recovers only creator and resolver identities already stored by the old workflow,
at their verifiable versions. Every previously published correction forces a new review. Corrected
clusters with unknown or inconsistent correction provenance are held and cannot be restored or
approved; no intermediate editor or historical approval is fabricated. Re-provision the runtime
role after migration; it receives SELECT/INSERT but not UPDATE/DELETE/TRUNCATE/DDL authority over
the new table.

Regression coverage includes creator and applying-editor final/alert denial, exact and
NFC/whitespace-equivalent no-op drafts, later correction editors, administrator actions,
claim-targeted changes, article corrections shared by multiple clusters, independent reviewer
success, concurrent apply/approval serialization, audit-failure rollback, anonymous reader gating,
legacy known/unknown provenance upgrades, schema drift, and actual runtime-role mutation attempts.
Files changed are the correction schemas/routes/service, shared provenance boundary, ORM/reader
repository, forward migration, seed-only explicit fixture marker, runtime-role guard, tests and the
linked API/correction/recovery documentation. Contributor retention is deliberately conservative:
a later complete rewrite does not remove an earlier contributor's approval exclusion. Database
owners/superusers remain outside application append-only guarantees.

## Closure follow-up: explicit request `no-store`

The production-browser case was also reproduced before this change. Requests for
`/icon-192.png` using `Request.cache = "no-store"`, `Cache-Control: no-store`, both controls,
mixed-case combined directives, and a quoted-extension/comma variant all caused the old worker to
write the response to `nuzenio-static-v2`; every pre-fix regression observed a cache entry.

Root cause: the worker enforced response-side `private`/`no-store`, but its static allowlist did not
honor request-side storage prohibitions before lookup. The fetch boundary now inspects
`Request.cache` and parses Cache-Control directive names case-insensitively while respecting quoted
commas and escaped quotes. Any explicit `no-store` request is left to the native network path before
URL classification, CacheStorage lookup, write or offline fallback. Therefore a warm CacheStorage
entry cannot satisfy the request, a successful response cannot create/replace an entry, and an
offline request fails instead of replaying stored content. Response-side controls, static-only
allowlisting, credential omission, private API/RSC exclusion and Nuzenio-scoped legacy-cache purge
remain unchanged; unrelated origin caches are never removed.

Changed files are `apps/web/public/service-worker.js`, its VM policy tests, production same-origin
Playwright security suite and this record. Regressions cover cold/warm/offline behavior for request
cache mode alone, header alone, both, combined case variants and quoted values, plus ordinary public
static offline caching and all existing logout/account-switch/private-response/legacy-purge cases.
The browser's native HTTP cache remains governed by browser request semantics; the asserted product
boundary is that Nuzenio's service worker never reads or writes CacheStorage for an explicit
`no-store` request. A device that never reconnects cannot receive updated worker code or a legacy
cache purge until it reconnects and activates the update.

### Stream-close diagnosis remains bounded

The production E2E run still logged `The destination stream closed early.`. No streaming behavior
was changed to suppress it. The independent review traced its controlled reproduction to cancelled
background RSC prefetches during teardown; completed foreground requests/navigation remained intact.
That cancellation path was benign. This is not proof that every occurrence of the message is benign;
retain targeted request/response monitoring before deployment and investigate any failed foreground
navigation separately. Passing E2E assertions alone are not the diagnosis.

Independent re-review is required. This remediation record does not declare SAFE TO MERGE or
production readiness and does not resolve any PR review finding automatically.

## PR #2 independent-review remediation

Reviewed starting head: `0052b0f2342de711b379f562d590658e18668c98`. This targeted round preserves
the prior F01–F15 and R1–R6 controls and addresses the eight independently reported production-
hardening findings. It does not enable a feed, contact a publisher, deploy, merge or claim merge
suitability.

| Finding | Reproduction/root cause | Invariant and fix | Regression evidence | Residual risk |
| --- | --- | --- | --- | --- |
| P1 environment classification | Environment checks used independently normalized strings, and an omitted value silently selected development behavior | A required typed setting and single enum/parser accept only exact `development`, `test` or `production`; API, worker, feed runner, seed, staff bootstrap, E2E setup and role provisioning share it and reject absent or malformed values | Production, case/whitespace variants, empty/unknown/unset values and subprocess entry-point tests; local Compose and CI set their environments explicitly | A deployment can still deliberately choose the development profile; deployment policy must constrain the value to exact `production` outside isolated local/test systems |
| P1 authentication-event mutation | The runtime role retained ordinary table mutation grants and the table lacked append-only triggers | Forward migration `c96a1d2273eb → 6d0a4f2b8c91` preserves rows/IDs, adds row and statement triggers and revokes runtime UPDATE/DELETE/TRUNCATE; provisioning and identity assertions enforce the same boundary | Clean/legacy migrations and actual provisioned-login INSERT success plus UPDATE/DELETE/TRUNCATE/trigger/DDL failures; audit reader remains read-only | Migration owners/superusers remain outside application guarantees and require infrastructure audit/access controls |
| P1 restore option injection | A positional database argument could be parsed as a PostgreSQL command-line option; independent closure testing also found restore verification backed up the source before validating its target URI | A shared URI parser accepts only canonical PostgreSQL URIs, emits a passwordless URI and every PostgreSQL tool uses explicit `--dbname=...` plus argument boundaries; backup, restore and verification preflight every relevant URI before temporary files or database commands | Real-tool tests reject `--command`, `-c`, whitespace/control, malformed IDNA, multi-host/socket, malformed and wrong-scheme values; a verifier regression proves an invalid target cannot invoke `pg_dump` | PostgreSQL client behavior and URI query options must be reassessed when client versions or the explicit option allowlist change |
| P2 credentials in argv | Password-bearing URLs were inherited and passed to PostgreSQL tools | `umask 077`, exclusively created mode-0600 `PGPASSFILE`, passwordless argv, removed child URL environments and signal/failure cleanup | A unique marker is inspected in live `/proc` argv/environment and is absent from output/diagnostics; success/failure/interruption cleanup is asserted | A privileged observer of the parent environment or secret file can still read the credential; operational isolation remains required |
| P2 backup symlink/race | Predictable partial paths and final rename could be redirected or clobber a concurrent destination; closure testing found an intermediate parent symlink was still followed | A random destination-directory `mktemp` is restrictive; every existing parent component must resolve without a symlink; same-filesystem hard-link publication is atomic and no-clobber; traps clean partials | Real `pg_dump` tests cover legacy partial symlink, destination and parent-chain symlinks, destination race, two writers, interruption and successful custom archive publication | A privileged destination-parent writer can still race directory replacement; protected directory ownership and permissions remain an infrastructure requirement |
| P2 allowed hosts | Production host validation allowed canonical-equivalent local or malformed values, including malformed ASCII A-labels and local special-use suffixes | Production permits only exact lower-case, round-trip canonical ASCII/IDNA fully qualified DNS names; every wildcard, IP form, local/trailing-dot equivalent, local special-use suffix, authority/path/port and malformed label is rejected before middleware construction | Case, wildcard, localhost/subdomain, `.local`, `home.arpa`, legacy/normal IPv4, IPv6, link-local/private examples, whitespace, scheme, userinfo, port, path and malformed/valid IDNA variants | DNS ownership/resolution is an external control; host validation is not certificate or DNS-rebinding validation |
| P2 lost-lease visibility | Feed execution returned only a run row, so worker status counted fenced work as completed | A typed execution outcome explicitly distinguishes success, skip, retry, dead letter, cancellation, failure, active/terminal no-op and lost lease; worker metrics increment success only for true success | Real PostgreSQL/Redis competing-worker fencing test asserts lost-lease=1 and completion=0; unit tests cover every terminal counter | Metrics counters reset per process; durable database state and external aggregation remain authoritative |
| P3 free-form log redaction | Key-based redaction did not protect credentials embedded in third-party free-form text; closure canaries found mixed percent-encoding and multiline userinfo gaps | Stable structured event names remain preferred; bounded URI-userinfo, bearer/cookie and assignment sanitizers cover nested/free-form strings, common mixed encodings and multiline values without treating a passwordless database URL followed by an email address as credentials | JSON formatter tests place unique canaries in plain, encoded, mixed, multiline and nested diagnostics and assert the marker never appears while representative safe messages remain byte-for-byte intact | Pattern redaction is defense in depth and cannot recognize every novel encoding; secret-bearing free-form input must still be excluded by design |

The authentication-event revision is forward-only and performs no content rewrite. Upgrade through the
migration owner, re-run role provisioning, then assert both restricted identities before starting the
API/worker. Backup/restore tests use disposable PostgreSQL and fictional data only. The operational
scripts require a protected destination directory and PostgreSQL/Python tools; they are not an
encrypted retention service or substitute for WAL archival. Independent re-review remains mandatory.

## PR #2 closure follow-up

Starting head `119b1c576a1ecf51dbe664563db3092328c0b819` was independently reported to
retain one P2 release-gate issue and two P3 defense-in-depth gaps. This implementation preserves the
previous migration head and all editorial, ingestion, audit and offline-cache controls.

| Finding | Reproduction/root cause | Invariant and fix | Regression evidence | Residual risk |
| --- | --- | --- | --- | --- |
| P2 Playwright retry forwarding | `npm run test:e2e -- --retries=0` consumed the option at the outer npm layer; the first fix then made enforcement conditional on an optional environment flag | CI now invokes the dedicated `test:e2e:release` command. Its release-only Playwright configuration fixes retries at zero and installs an unconditional reporter that rejects any resolved nonzero retry | The release command exits nonzero when `--retries=1` overrides the config, regardless of missing, empty, true, false or malformed legacy flag values. The normal release command reports two projects and effective retries zero | Local developer runs retain their existing retry default; the release command/configuration is the sole release-gate source of truth |
| P2/P3 bounded log redaction | Double-percent-encoded secrets and credentials whose terminating `@host` fell beyond the old output cutoff survived visible-string matching | Sanitization now operates on a bounded 16,384-character scan window before the final 8,192-character output truncation, applies at most two detection-only decode passes and conservatively redacts an unfinished credential authority | Raw/single/double-encoded URI, bearer, cookie and assignment canaries at and across the cutoff are absent from full formatted JSON, nested fields and diagnostics; million-character safe/malformed inputs remain bounded and safe text truncates predictably | Pattern redaction cannot recognize every transform or novel encoding, so stable non-secret event names and avoiding secret-bearing exceptions remain the primary controls |
| P3 PostgreSQL query strictness | Allowed query values were reconstructed without rejecting malformed percent escapes; earlier control checks also needed to cover nested encodings | Before normal parsing, the shared connection parser rejects every `%` not followed by two hexadecimal digits. It repeats strict syntax and control validation after each of its bounded decode stages, before any operation can create temporary output or invoke a PostgreSQL tool | Helper and all three operation-script regressions cover malformed/trailing/repeated percent signs, mixed valid-invalid input, encoded malformed escapes, invalid UTF-8, raw/single/double-encoded controls and repeated key/value parameters; valid repeated allowlisted parameters still reach real `pg_dump` | The explicit PostgreSQL option allowlist must be reassessed with client upgrades; this parser is intentionally stricter than general libpq URI parsing |

No schema or data migration is required; Alembic head remains `6d0a4f2b8c91`. This work does not
enable feeds, contact publishers, deploy, merge or claim independent closure.

## PR #2 SQL/logging closure follow-up

Starting head `5d81b608f49552f5ed1b7967f689e93c36a8cfb7` was independently reported to
retain one P2 SQL-logging disclosure and one P3 qualified-assignment redaction gap. This focused
implementation leaves the database schema, editorial controls, ingestion controls and feed kill
switch unchanged.

| Finding | Reproduction/root cause | Invariant and fix | Regression evidence | Residual risk |
| --- | --- | --- | --- | --- |
| P2 production SQL logging | Production accepted `NUZENIO_SQL_ECHO=true`, and the runtime engine forwarded it to SQLAlchemy, which emitted bound values through a plain echo handler and the root logger | Production settings reject every Pydantic truthy spelling. A shared engine policy forces SQL/pool echo off and `hide_parameters=true` for runtime, migrations and role provisioning; SQLAlchemy handlers are normalized into Nuzenio logging | A real PostgreSQL regression executes parameterized `SELECT` and `INSERT` statements with independent canaries while capturing stdout, stderr, JSON/root and an intentionally verbose SQLAlchemy handler. Both values stay absent while safe statement diagnostics remain present; a validation matrix covers `true`, `TRUE`, `1`, `yes` and `on` | Parameter hiding does not protect private values deliberately interpolated into SQL literals; application queries must bind private values. Database/platform logs remain separately governed infrastructure |
| P3 qualified assignments | The free-form matcher recognized only standalone keys, so values assigned to names such as `db_password`, `api.token` and `client-secret` could survive | One case-insensitive bounded key grammar recognizes standalone and `_`/`.`/`-` qualified password, token, secret, session/CSRF and pepper forms at both free-form and structured-field boundaries | Raw, quoted, colon/equal, mixed-case, multiline, nested, single/double-encoded, truncation-crossing and million-character cases assert the original canary is absent from complete JSON output; `secretary`, `tokenizer` and `passwordless` controls remain readable | Pattern redaction is defense in depth and intentionally bounded to two decoding passes and a 16,384-character scan; stable non-secret event names remain the primary control |

No forward migration is needed; Alembic head remains `6d0a4f2b8c91`. No feed was enabled or contacted,
and independent read-only closure review remains required before merge.
