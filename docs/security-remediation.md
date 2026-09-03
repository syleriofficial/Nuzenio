# PR #1 security remediation

Reviewed head: `818cb5b42f58beacf7d3ff6f66ad56322ffdf5b2`. Base: `83635db201acde4e7540922f3c241f9be8fb34f4`.
The complete independent review in the task is the acceptance checklist. No finding is dismissed by a green existing suite. Independent re-review is required; this document is not a merge authorization.

| Finding | Reproduction at reviewed head | Remediation / regression status |
| --- | --- | --- |
| F01 | Image CMD runs seed; seed overwrites approval/hold/kill state; HIGH fixture publicly approved without reviewer | Pending: explicit create-only dev seed, legacy hold migration, reader invariant |
| F02 | Old review can approve edited cluster and set push readiness | Pending: material revision binding, supersession, locking |
| F03 | Suppression and summary decision JSONB contains datetime; commit rolls back | Pending: shared recursive encoder, API regressions |
| F04 | Locked attempts still hash; username+IP bucket bypassed by IP rotation | Pending: atomic pre-hash Redis admission and bounded concurrency |
| F05 | Pause during blocked fetch still permits article persistence | Pending: final locked rights check and version fence |
| F06 | Nonempty `{sentences: []}` passes evidence guard | Pending: typed sentence coverage and relational validation |
| F07 | Merge/split leaves obsolete brief slugs and derived content | Pending: stable membership migration, allocation/hold policy |
| F08 | Abandoned RUNNING is never recovered; non-atomic dequeue/claim | Pending: leases, fencing, durable dispatch |
| F09 | Formula-valued unauthenticated User-Agent exported raw | Pending: neutralize every CSV cell, preserve JSON |
| F10 | Rights approval UI omits submitted evidence/permissions | Pending: full versioned snapshot and browser contract |
| F11 | Only inactivity timeout; decompression occurs before limit | Pending: total deadline and identity-only bounded transport |
| F12 | Runtime owner can TRUNCATE audit log | Pending: separate owner/runtime roles, trigger and actual-role tests |
| F13 | HttpUrl accepts credential-bearing document/correction URL | Pending: shared HTTPS/no-userinfo type |
| F14 | Verified GHSA-6w46-j5rx-g56g affects pytest <9.0.3 | Pending: patched compatible version and audit gate |
| F15 | Alembic check reports four redundant unique constraints | Pending: forward-only drift migration and checks |

Baseline evidence includes the independent local fixture/database proofs recorded in the review. New regressions will be run against the unfixed behavior where practical; migrations and new interfaces necessarily require an integration test after implementation. Tests use explicitly disposable databases only, never existing application volumes.

Advisory verification: https://github.com/advisories/GHSA-6w46-j5rx-g56g and https://github.com/pytest-dev/pytest/releases/tag/9.0.3 (checked 2026-09-04). Structural evidence coverage is not verification that a claim is true.
