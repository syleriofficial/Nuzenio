# Production observability

Nuzenio emits newline-delimited JSON to standard output in production. Logs contain an ISO-8601
timestamp, severity, service, event name and the request/correlation ID when available. Request logs
use route templates rather than raw paths and do not include bodies, query strings, cookies,
authorization values or client IPs by default. Fields whose names indicate passwords, tokens,
secrets, cookies, authorization or CSRF values are recursively redacted.
Free-form third-party messages cross the same sanitizer boundary: common PostgreSQL/Redis credential
URIs, bearer/cookie values and password/token/secret assignments (including common percent-encoded
forms) are redacted. Application code should still prefer stable structured event names; redaction is
defense in depth, not permission to log request bodies or secret-bearing exception text.

`X-Request-ID` may be supplied by an upstream proxy when it contains only alphanumeric characters,
hyphen, underscore or dot and is at most 80 characters; otherwise the API creates a UUID. Return the
ID to the user when investigating a failed request. Feed runs retain their durable request ID and log
their run/feed IDs, state, attempt and bounded operational counts—not publisher response bodies.

## Health surfaces

| Service | Endpoint | Meaning |
| --- | --- | --- |
| API | `/health/live` | Process can handle HTTP. It does not claim dependency availability. |
| API | `/health/ready` and compatibility `/health` | PostgreSQL query and bounded Redis ping succeed. |
| Worker | `:8001/health/live` | Worker health server is running. Internal-only. |
| Worker | `:8001/health/ready` | Main loop recently completed a PostgreSQL/Redis-backed iteration and is not stopping. |
| API | `/metrics` | OpenMetrics text; bearer-token protected when `NUZENIO_METRICS_TOKEN` is set and required in production. |
| Worker | `:8001/metrics` | Internal lifecycle counters; do not expose publicly. |

Readiness probes may remove a process from service but must not restart it on their own. Liveness
failure is appropriate for restart. The worker completes bounded in-flight work after SIGTERM; its
fetcher already enforces an absolute deadline. Deployments should allow at least 20 seconds before
SIGKILL.

## Metrics and initial alert thresholds

The repository supplies metrics and thresholds, not a paid collector. A Prometheus-compatible
scraper, existing platform metrics agent or periodic authenticated check can collect them.

| Signal | Initial threshold | Operator response |
| --- | --- | --- |
| API readiness | 2 consecutive failures or >1% over 5 minutes | Check PostgreSQL/Redis before restarting application processes. |
| Worker readiness | Not ready for 60 seconds | Inspect worker logs, queue and database connectivity. |
| `nuzenio_worker_abandoned_runs` | Any value >0 for 2 minutes | Confirm lease expiry/recovery; do not manually complete the row. |
| `nuzenio_queue_depth{queue="ready"}` | >100 for 10 minutes | Check worker capacity and oldest durable `FeedRun`. |
| Scheduled queue | Sustained growth for 15 minutes | Check Redis dispatch and rights/kill-switch state. |
| Retrying feed runs | >10% of feed runs over 15 minutes | Group by feed/error code; pause a failing source if needed. |
| `nuzenio_dead_letters_unreplayed` | >0 for 15 minutes or any increase | Triage; replay only after the underlying cause and current rights are verified. |
| Pending high-risk review | Oldest pending >15 minutes for urgent public safety; >60 minutes otherwise | Escalate to an independent reviewer; never auto-approve. |
| Pending standard review | Oldest pending >4 hours | Review editorial staffing and queue ownership. |

Counters reset on process restart; feed, retry, lease, dead-letter and review gauges are rebuilt from
PostgreSQL/Redis. Alert rules must tolerate deployment resets. Until a time-series collector is
selected, operators should preserve container logs and periodically record the authenticated metrics
snapshot. Metrics endpoints return `Cache-Control: no-store`.

Feed execution returns a typed outcome for success, rights/kill-switch skip, retry, dead letter,
failure, cancellation, already-active work and lease/fencing loss. Worker completion metrics consume
that outcome directly: fenced work increments the lost-lease counter and never the success counter.
These counters are process-local and restart; the durable feed-run state remains authoritative.

## Diagnostics boundaries

The API metric surface exposes counts only. Internal errors, rights evidence, review notes and feed
payloads remain in permission-gated workflows and structured service logs. Worker health exposes a
current run UUID for correlation but no URL or publisher content. Keep the worker port on the private
service network. The default `NUZENIO_LOG_CLIENT_IP=false` supports data minimization; enabling it
requires a documented retention/legal basis.
