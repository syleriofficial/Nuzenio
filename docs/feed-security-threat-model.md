# Feed-security threat model

## Remediation resource and race boundaries

The default production fetch path runs in a disposable subprocess with an absolute deadline
covering DNS, connect, TLS, redirects, headers and body; overdue work is terminated. The child also
checks a monotonic budget between stages. Proxy environment variables are disabled (`trust_env=False`).
The validated IP remains the actual connection target with original Host/SNI. Only identity encoding
is accepted: compressed responses are rejected before body iteration/decompression. Content-Length
and streamed bytes are bounded. Existing SSRF/XML checks remain in place.

Fetches do not hold a database transaction. Before persistence the worker reacquires the shared
control lock, refreshes and locks approval records, checks dates and version snapshots, and checks
its current lease token. Revocation/kill-switch changes cancel pending work and fence in-flight
results. Redis delivery is recoverable from PostgreSQL; expired worker leases cannot commit after
takeover. The coarse control lock is a deliberate pilot-scale correctness tradeoff, not a scaling design.

## Assets and trust boundary

Publisher-provided URLs, DNS answers, redirects, headers and XML are untrusted. The protected assets are internal services and metadata endpoints, credentials, worker availability, database integrity, editorial content and user privacy. Feed fetching is the only component allowed to make publisher-origin requests; tests and seed commands never make network requests.

## Controls

| Threat | Control |
| --- | --- |
| URL points to localhost or an internal service | Reject localhost and non-global, private, loopback, link-local, multicast, unspecified, reserved and metadata IP ranges. |
| DNS name changes after approval | Resolve before each request, pin the validated addresses in the transport path, and compare follow-up resolution to detect rebinding. |
| Redirect reaches a forbidden target | Limit redirect count and repeat full URL/DNS validation for every target. Automatic HTTP-client redirects are disabled. |
| Credentials embedded in a URL | Reject URLs containing a username or password. |
| Cleartext interception | Require HTTPS in production. Development exceptions require explicit configuration. |
| Slow or oversized response | Apply connection/read timeout and a strict byte ceiling while streaming. |
| Unexpected media | Accept only approved RSS/Atom/XML content types. |
| XXE, DTD or entity expansion | Reject DOCTYPE/entity declarations and parse with `defusedxml`; external entity resolution is unavailable. |
| Publisher controls request behavior | Send only Nuzenio-owned `User-Agent`, `Accept`, conditional ETag and Last-Modified headers. Arbitrary publisher headers are not accepted. |
| Markup/script enters the product | Extract text, strip markup, normalize whitespace and cap field lengths; React renders imported text without raw HTML. |
| Retry storm | Enforce per-source run limits, one outstanding run, bounded exponential retry and dead-letter termination. |
| Secret leakage | Return stable public and admin-facing error codes; retain detailed fetch/parser diagnostics in the database for protected operational diagnosis. Audit redaction removes password/token/secret/cookie/authorization/CSRF keys. |

## Residual risks

Production should add egress firewall rules as a second SSRF boundary, DNS resolver monitoring, certificate-policy monitoring and content-type anomaly alerts. The current worker is a single lightweight process rather than a multi-region queue. It does not execute JavaScript or follow article links. Full-article retrieval and publisher-supplied custom headers remain prohibited.

## Test strategy

Fixture tests cover HTTP rejection, embedded credentials, private and metadata targets, mixed DNS answers, redirect revalidation, rebinding, unapproved content types, response-size limits, unsafe text and malicious DTD/entity payloads. `httpx.MockTransport` and deterministic resolvers ensure no test depends on external DNS or internet access.
