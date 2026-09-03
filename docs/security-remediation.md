# PR #1 security remediation

Reviewed head: `818cb5b42f58beacf7d3ff6f66ad56322ffdf5b2`. Base: `83635db201acde4e7540922f3c241f9be8fb34f4`.
The complete independent review in the task is the acceptance checklist. No finding is dismissed by a green existing suite. Independent re-review is required; this document is not a merge authorization.

| Finding | Reproduction/evidence | Fix | Regression coverage | Remaining risk |
| --- | --- | --- | --- | --- |
| F01 | Startup CMD and seed assignments confirmed; baseline preservation regression failed | Explicit dev/test-only create-only seed; production refusal; hold unproven legacy approvals; all reader queries require current review | `test_remediation.py` F01; upgrade fixtures; isolated Compose restart/reseed | Existing HIGH content deliberately disappears until reassessed; owner SQL is privileged |
| F02 | Review accepted based on old row identity rather than current content; review PoC confirmed; summary decision could transfer draft authorship | Material revision binding, supersession, current-pending-only decisions, cluster-first locking, independent final/alert reviewers including administrators; preserve draft author during summary decisions | F02 stale/repeated/concurrent API requests and authorship-transfer regression; high-risk E2E | Authorized editorial evidence assessment is still required |
| F03 | Baseline JSONB datetime audit regression failed | Recursive JSON-safe audit/revision encoder; one transaction; failures propagate | Nested datetime/UUID/enum test; real suppression/restoration and summary decisions; injected audit failure rolls domain change back | Unsupported future types deliberately fail closed |
| F04 | Old combined account/IP bucket and post-hash throttle confirmed in code/review PoC | Atomic Redis global/IP/account admission before hash; verifier leases; fixed cooldown; trusted-proxy allow-list; Redis failure denies admission | Rotated IPs/random usernames/global cap/concurrency/cooldown/Redis outage/spoofed forwarding tests | Rate limits can temporarily deny legitimate staff under attack; operational monitoring/edge limits needed |
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
The authentication verifier lease assumes password verification completes within 60 seconds;
edge admission controls and operational process/memory limits remain recommended. Rights review
history displays the latest 100 transitions; the authorized audit interface retains the full history.
Summary remapping currently uses the authenticated API, with review/approval in the existing UI.
Offline browser caches already outside server control cannot be remotely erased; correction
metadata invalidates server-managed saved snapshots on next synchronization.

Independent security re-review is required. Passing tests are not a SAFE TO MERGE verdict.

Advisory verification: https://github.com/advisories/GHSA-6w46-j5rx-g56g and https://github.com/pytest-dev/pytest/releases/tag/9.0.3 (checked 2026-09-04). Structural evidence coverage is not verification that a claim is true.
