# Nuzenio RSS Crawling Engine

Nuzenio's crawler is the backend foundation for turning approved RSS sources into a source-attributed news cache.

## Endpoint

- Scheduled function: `netlify/functions/rss-crawler.js`
- Public route: `/api/rss-crawler`
- Schedule: every 15 minutes
- Manual admin action: available inside `/admin`

## Actions

```json
{ "action": "enqueue", "limit": 8 }
```

Adds due enabled sources from `rss_sources` into `background_jobs`.

```json
{ "action": "run", "limit": 8 }
```

Enqueues due sources and processes queued `rss_ingestion` jobs.

```json
{ "action": "source", "sourceId": "uuid" }
```

Crawls a single source immediately from the Admin dashboard.

## Data Flow

1. Read enabled RSS sources from `rss_sources`.
2. Add due sources to `background_jobs` with `job_type = rss_ingestion`.
3. Claim queued jobs and lock them with a crawler id.
4. Fetch RSS/Atom XML with timeout and redirect-safe `fetch`.
5. Parse title, link, source, short summary, image, category, language, and timestamp.
6. Deduplicate by stable article hash, canonical link, and normalized title.
7. Upsert copyright-safe rows into `news_cache`.
8. Write source health to `rss_sources`.
9. Write crawl result/error rows to `rss_crawl_logs`.
10. Retry failed jobs with backoff until `max_attempts`.

## Copyright Safety

The crawler stores only:

- title
- original publisher link
- source name
- short RSS summary
- image URL when provided by RSS
- category/country/language/timestamps
- source-only AI-safe summary and tags

It does not fetch, copy, or republish full publisher articles.

## Required Supabase Update

Run the latest `supabase/schema.sql` in Supabase SQL Editor after deployment. New crawler fields and `rss_crawl_logs` are added with `if not exists`, so the update is safe to rerun.

## Optional Environment

- `CRON_SECRET`: protects crawler endpoint. Admin dashboard can still run it with an admin Supabase session.
- `RSS_CRAWLER_SOURCE_LIMIT`: default `8`
- `RSS_CRAWLER_ITEM_LIMIT`: default `40`
- `RSS_CRAWLER_TIMEOUT_MS`: default `12000`
