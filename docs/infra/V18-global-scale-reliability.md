# Nuzenio V18 Global Scale Infrastructure & Reliability

Nuzenio currently runs as a Netlify CDN frontend, Netlify Functions API layer, and Supabase data layer. V18 prepares the platform for global traffic by formalizing cache boundaries, job queues, monitoring, disaster recovery, and CI/CD.

## Target Architecture

- Frontend CDN: Netlify global CDN serves static Vite assets with immutable asset caching.
- API layer: Netlify Functions serve `/api/news`, `/api/v1/*`, `/api/health`, feed, sitemap, newsletter, and article metadata.
- Background workers: scheduled RSS ingestion, entity extraction, AI summaries, sitemap refresh, trend detection.
- Queue system: `background_jobs` in Supabase now; Redis or managed queue later for high-volume processing.
- Data layer: Supabase Postgres with `news_cache`, `story_clusters`, `entities`, `api_usage_logs`, and search indexes.

## Multi-Region Plan

- North America: primary API and database region.
- Europe: CDN edge now, read replica planned.
- Asia: CDN edge now, read replica planned.
- Oceania: CDN edge now, read replica planned.

Traffic should use cached reads at the edge first, Supabase cache second, and publisher RSS only from background ingestion or controlled refresh paths.

## Caching Strategy

- Edge cache: Netlify headers for static assets, feeds, sitemaps, and API responses.
- Article cache: `news_cache` stores title, short summary, source, image, category, country, timestamps, and payload.
- Search cache: Postgres indexes and future Redis hot-key cache.
- Redis cache: planned for API rate counters, trending read-through cache, and queue locks.

## Search Infrastructure

- Full-text search: `news_cache_search_idx` over title, summary, source, category, country.
- Entity search: `entities_search_idx` over entity names and descriptions.
- Trending search: `search_queries` stores query, language, country, result count, and trend score.
- Semantic search: planned embedding table once an embedding provider is selected.

## Background Jobs

Initial job table: `background_jobs`.

Job types:

- `rss_ingestion`
- `entity_extraction`
- `ai_summary`
- `sitemap_generation`
- `trend_detection`
- `search_index_refresh`
- `backup_verification`

## Monitoring

- Health endpoint: `/api/health`
- API metrics: `api_usage_logs`
- Job metrics: `background_jobs`
- Incidents: `system_incidents`
- Search metrics: `search_queries`

Recommended external monitors:

- Uptime check every 60 seconds for `/api/health`
- Lighthouse scheduled check for `/`
- Error alert on 5xx > 1% for 5 minutes
- Job queue alert when queued jobs are older than 15 minutes

## Security

- WAF: Netlify/Cloudflare rules for suspicious traffic.
- DDoS: CDN-level protection.
- Rate limiting: API key quotas now, Redis counters later.
- Secrets: keep service role keys only in Netlify environment variables and local `.env.local`.
- Headers: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`.

## Disaster Recovery

- Automated Supabase backups enabled.
- Daily export verification via `backup_verification` job.
- RPO target: 15 minutes.
- RTO target: 60 minutes.
- Failover: read-only mode from latest `news_cache` and static sitemap/feed if upstream providers fail.

## CI/CD

- GitHub Actions runs install, function syntax checks, Supabase checker syntax, and production build.
- Netlify deploy remains `npm run build`, publish `dist`, functions `netlify/functions`.
- Rollback path: revert Git commit or Netlify deploy rollback.

## Performance Targets

- 99.9% uptime.
- Cached API p95 under 200ms.
- Lighthouse 95+.
- Global availability through CDN and cached fallback.
