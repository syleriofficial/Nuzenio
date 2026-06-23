# Nuzenio

Production-oriented Netlify + Supabase AI news platform.

## What is included

- Live RSS news through Netlify Functions at `/api/news`
- Aggregated headlines from Google News RSS plus approved publisher RSS feeds
- Live News and Video sections with playable embedded videos from approved sources
- Clean section pages for `/local`, `/live`, and `/video`
- SEO topic pages for `/top-news`, `/world`, `/business`, `/technology`, `/ai`, `/sports`, `/entertainment`, `/health`, and `/science`
- English-first website experience with automatic local-country news
- Global multi-language expansion for English, Hindi, Spanish, French, German, Portuguese, Arabic, Japanese, Korean, Chinese, Bengali, Tamil, Telugu, Marathi, and Urdu
- Localized routes such as `/en/world-news`, `/hi/world-news`, `/es/world-news`, with hreflang alternates and `sitemap-languages.xml`
- Regional editions for India, USA, UK, Canada, Australia, Europe, Middle East, and Asia-Pacific
- Translation workflow tables for translated summaries, AI confidence, source language tracking, and human review
- Premium clean white responsive UI
- Red breaking-news accent and blue AI/action buttons
- Google login wiring with Supabase Auth
- Saved articles, reading history, newsletter subscribers, RSS sources, AdSense slots, sponsored blocks, and analytics schema
- Newsletter retention system with double opt-in, unsubscribe tokens, reader preferences, and digest logs
- English-first editorial safety with global language routes, localized RSS requests, and translation quality controls
- Article detail modal with AI summary, what happened, why it matters, key facts, source attribution, and read-original link
- AI explain layer with 3-line summaries, key points, simple-English mode, timelines, background, and source comparison
- Trust layer with source credibility labels, story clustering, fact-check status, source transparency, and correction reporting
- Global intelligence pages for countries, topics, and entities with trend signals and internal linking
- Google Discover and SEO growth pages including news landing pages, evergreen hubs, E-E-A-T panels, and SEO monitoring
- Android, iPhone, iPad, and PWA launch foundation with mobile API contract, offline sync tables, push-notification tables, store metadata, and app release checklist
- Shared mobile APIs for news, search, recommendations, and user capability checks through `/api/news` and `/api/v1/*`
- V18 global-scale reliability foundation with `/api/health`, CI workflow, background job tables, search telemetry, incident tracking, and infrastructure docs
- Backend-ready admin structures for RSS sources, AdSense slots, sponsored blocks, newsletter, analytics, SEO, affiliate links, and policies
- Affiliate and sponsored block managers with visible disclosures
- SEO and discovery: meta tags, Open Graph tags, structured data, `robots.txt`, `sitemap-index.xml`, `sitemap.xml`, `news-sitemap.xml`, `feed.xml`, and `opensearch.xml`
- Trust pages: about, sources, editorial policy, AI policy, corrections, contact, advertise, privacy, terms, and affiliate disclosure
- Transparency files: `ads.txt`, `humans.txt`, `llms.txt`, and `.well-known/security.txt`
- Google AdSense publisher script and `ads.txt` configured for `pub-5589150014762971`
- Mobile bottom navigation and readable article view

## Netlify settings

Keep these settings:

```text
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

`netlify.toml` maps `/api/news`, `/api/location`, `/feed.xml`, and `/news-sitemap.xml` to Netlify Functions.

## Supabase setup

1. Create a Supabase project.
2. In Authentication > Providers, enable Google and Email OTP / magic links.
3. Add the deployed site URLs to Authentication > URL Configuration.
4. Run `supabase/schema.sql` in the Supabase SQL editor.
5. Add these Netlify environment variables:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
# Also accepted by the frontend login flow:
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key-for-server-cache>
YOUTUBE_API_KEY=<youtube-data-api-key-optional-but-recommended>
YOUTUBE_NEWS_CHANNEL_IDS=UCxxxxxxxxxxxxxxxxxxxxxx,UCyyyyyyyyyyyyyyyyyyyyyy
LIVE_NEWS_SOURCES=[]
TWITCH_EMBED_PARENTS=nuzenio.com,<netlify-site-name>.netlify.app
VITE_ADVANCED_ROUTES=true
VITE_AFFILIATE_LINKS=[]
EMAIL_WEBHOOK_URL=<optional-email-provider-webhook>
CRON_SECRET=<optional-secret-for-digest-cron>
FCM_SERVER_KEY=<optional-android-push-key-for-future-mobile-api>
APNS_KEY_ID=<optional-ios-push-key-id-for-future-mobile-api>
```

For local development, copy `.env.example` to `.env.local`, fill the Supabase values, then run:

```bash
npm run supabase:check
```

The checker verifies the public anon client can read `languages` and the service role can access `news_cache`.

`YOUTUBE_API_KEY` lets Netlify Functions load Live News and Video through the official YouTube Data API. Without it, Nuzenio falls back to live YouTube search parsing.
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are the preferred frontend auth variables. `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are also supported for compatibility with Supabase's publishable-key naming.
`YOUTUBE_NEWS_CHANNEL_IDS` is optional. Add comma-separated YouTube channel IDs to show videos from approved news channels first; leave it empty to use country-based YouTube news search.
`SUPABASE_SERVICE_ROLE_KEY` is used only inside Netlify Functions to read/write the server-side `news_cache` table. Do not expose it in client-side `VITE_` variables.
`LIVE_NEWS_SOURCES` is optional JSON for verified free live channels and approved publisher RSS feeds. Only add official/publicly available sources that the publisher allows. Live video providers are `youtube`, `twitch`, `official_embed`, and `hls`. Publisher RSS entries use `type: "rss"` plus an HTTPS `rssUrl`.
`VITE_ADVANCED_ROUTES` controls country, topic, hub, entity, publisher, and author intelligence routes. Routes are enabled by default; set it to `false` only if you intentionally want to hide advanced pages.
`VITE_AFFILIATE_LINKS` is optional JSON for approved partner links. Links must be real, HTTPS, labeled, and relevant. If Supabase is configured, enabled rows from `public.affiliate_links` are loaded first.
`EMAIL_WEBHOOK_URL` is optional. When configured, `/api/newsletter` posts opt-in emails to your email provider webhook. Without it, subscriptions are stored as pending and the API returns the confirmation URL for testing/integration.
`CRON_SECRET` is optional. If set, call `/api/newsletter-digest` with header `X-Nuzenio-Cron: <secret>` from a scheduler to generate daily/weekly digest logs.
`FCM_SERVER_KEY` and `APNS_KEY_ID` are reserved for the native push notification service. They are not used by the current Netlify build until the push sender function is added.

Example `LIVE_NEWS_SOURCES` value:

```json
[
  {
    "id": "bbc-world",
    "type": "rss",
    "name": "BBC News",
    "rssUrl": "https://feeds.bbci.co.uk/news/world/rss.xml",
    "homepage": "https://www.bbc.com/news/world",
    "country": "GLOBAL",
    "language": "en",
    "category": "world",
    "priority": 100,
    "enabled": true
  }
]
```

Example `VITE_AFFILIATE_LINKS` value:

```json
[
  {
    "title": "Approved partner offer title",
    "category": "technology",
    "url": "https://partner.example/your-approved-affiliate-url",
    "disclosure": "Nuzenio may earn a commission from this partner link."
  }
]
```

Recommended Supabase auth URLs:

```text
Site URL: https://nuzenio.com
Redirect URLs:
https://nuzenio.com
https://nuzenio.com/login
https://nuzenio.com/*
https://<netlify-site-name>.netlify.app
https://<netlify-site-name>.netlify.app/login
https://<netlify-site-name>.netlify.app/*
```

If Google login redirects to `localhost:3000/?error=bad_oauth_state`, Supabase still has a localhost Site URL or the active domain is missing from Redirect URLs. Set the Site URL to `https://nuzenio.com`, add `/login` redirect URLs, save, then start login again from the same domain.

## Nuzenio.com launch checklist

1. Buy `nuzenio.com` from a registrar.
2. In Netlify, open Site configuration > Domain management.
3. Add `nuzenio.com` as the primary custom domain.
4. Add `www.nuzenio.com` as a domain alias.
5. At the registrar DNS panel, use Netlify DNS or add these records:

```text
A     @     75.2.60.5
CNAME www   <netlify-site-name>.netlify.app
```

6. In Netlify, enable HTTPS after DNS propagation.
7. Confirm these URLs load:

```text
https://nuzenio.com
https://nuzenio.com/api/news
https://nuzenio.com/api/health
https://nuzenio.com/feed.xml
https://nuzenio.com/news-sitemap.xml
https://nuzenio.com/sitemap-index.xml
https://nuzenio.com/sitemap-languages.xml
https://nuzenio.com/about.html
https://nuzenio.com/editorial-policy.html
https://nuzenio.com/ai-policy.html
https://nuzenio.com/corrections.html
https://nuzenio.com/contact.html
https://nuzenio.com/privacy.html
https://nuzenio.com/sitemap.xml
https://nuzenio.com/robots.txt
https://nuzenio.com/ads.txt
https://nuzenio.com/llms.txt
https://nuzenio.com/.well-known/security.txt
```

8. Submit `https://nuzenio.com/sitemap-index.xml` in Google Search Console. Keep `sitemap.xml` and `news-sitemap.xml` as direct backup submissions if Search Console asks for them.
9. Confirm `/feed.xml`, `/sitemap-index.xml`, and `/news-sitemap.xml` return XML, not the SPA HTML shell.
10. Keep `https://nuzenio.com` as the canonical production URL.

## Multi-language SEO

Nuzenio supports these language codes:

```text
en, hi, es, fr, de, pt, ar, ja, ko, zh, bn, ta, te, mr, ur
```

Examples:

```text
https://nuzenio.com/en/world-news
https://nuzenio.com/hi/world-news
https://nuzenio.com/es/world-news
https://nuzenio.com/ar/world-news
```

The app auto-detects browser language, lets readers switch manually, remembers `nuzenio_news_language`, and marks non-English article views as localized summary views while preserving original publisher links. Run the new Supabase schema so `languages`, `translated_articles`, `translation_jobs`, and `regional_editions` exist before turning on human-reviewed translation workflows.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Reliability and scale

V18 infrastructure files:

- `docs/infra/V18-global-scale-reliability.md`
- `infra/reliability.json`
- `.github/workflows/ci.yml`
- `/api/health`

The health endpoint checks API availability, Supabase `news_cache`, `languages`, and `api_usage_logs`. The schema also includes `background_jobs`, `system_incidents`, `search_queries`, and `infrastructure_regions` for queue tracking, monitoring, search telemetry, and multi-region planning.

## Mobile app readiness

The `mobile/` folder contains the Android/iOS/iPad launch foundation:

- `mobile/capacitor.config.json` for the future Capacitor native wrapper.
- `mobile/api-contract.md` for shared News, Search, User, and Recommendation APIs.
- `mobile/store-metadata.json` for Play Store and App Store listing copy.
- `mobile/privacy-labels.json` for app privacy disclosures.
- `mobile/release-checklist.md` for Android, iPhone, and iPad launch QA.

Generate native projects only after installing Capacitor packages:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

Keep `prefer_related_applications` disabled in `public/site.webmanifest` until real Play Store and App Store URLs are live.

## Monetization notes

- AdSense publisher script is configured in `index.html`; create real ad units in AdSense and replace reserved inventory slots only with approved slot IDs.
- Header, in-feed, article, sidebar, and footer ad inventory is controlled by `public.adsense_slots`.
- Keep paid placements labeled and separate from editorial RSS stories. Nuzenio never simulates ad clicks or hides commercial labels.
- Keep `public/ads.txt` in sync with the active AdSense publisher account.
- Use the public trust pages in `public/` for AdSense and publisher review readiness.
- Store approved Amazon Associates or other partner links in `public.affiliate_links` and keep `enabled=false` until reviewed. Only set `enabled=true` after the destination, disclosure, category, and network are approved.
- Manage sponsored campaigns in `public.sponsored_blocks` with label, sponsor name, destination, placement, and optional start/end dates.

## Trust and corrections

- Nuzenio labels stories as verified, official, local, or developing using source metadata, category, freshness, and publisher signals.
- Duplicate headlines are clustered so the feed avoids repeated cards and article pages can show "Also reported by" sources.
- Fact-check panels are source-transparency aids, not independent verification claims.
- Reader correction reports are stored in `public.correction_reports` for admin review.

## AI summary controls

- AI summaries are deterministic summaries from RSS title, RSS summary, source metadata, timestamps, and publisher links.
- The article page clearly labels AI summaries and keeps original source links visible.
- Admins can enable or disable AI summaries, simple explain mode, source comparison, and category coverage in `public.ai_settings`.
- Nuzenio should not invent facts or copy full publisher articles.

## Intelligence pages

- Country routes such as `/country/us`, `/country/in`, `/country/uk`, `/country/de`, and `/country/jp` provide live news dashboards.
- Topic routes such as `/topic/ai`, `/topic/economy`, `/topic/markets`, `/topic/climate`, `/topic/energy`, `/topic/space`, and `/topic/startups` provide topic intelligence.
- Entity routes such as `/entity/nvidia` or `/entity/openai` track people, companies, countries, and organizations through live RSS search.
- Intelligence pages include trend signals, breaking clusters, related countries, related topics, related entities, and sitemap entries.

## Discover and SEO growth

- SEO landing pages include `/latest-news`, `/breaking-news`, `/world-news`, `/technology-news`, `/business-news`, `/sports-news`, `/ai-news`, `/science-news`, and `/health-news`.
- Evergreen hubs include `/hub/ai`, `/hub/space`, `/hub/climate`, `/hub/economy`, `/hub/startup`, plus short aliases such as `/ai-hub`.
- Discover readiness panels show large-image candidates, publisher counts, editor information, publication/update timestamps, and E-E-A-T signals.
- Admin SEO monitoring shows sitemap status, top pages, search queries, and CTR-ready fields for future Search Console integration.

## News intelligence dashboard

V19 adds `/intelligence-dashboard` as a Bloomberg/Google Trends style command center:

- Real-time volume, breaking tracker, topic momentum, country heat map, sentiment, publisher intelligence, entity tracking, story lifecycle, and alert readiness.
- Client-side JSON/CSV exports and print-to-PDF report flow from the live feed.
- `/api/v1/intelligence` exposes trend, snapshot, sentiment, entity, publisher, alert, and latest-article data for enterprise dashboards.
- Supabase tables added: `trends`, `trend_snapshots`, `sentiment_scores`, `entity_metrics`, `publisher_metrics`, `alerts`, `saved_reports`, `shared_dashboards`, and `dashboard_exports`.

Run `supabase/schema.sql` in Supabase SQL Editor after deploy so V19 dashboard tables and RLS policies exist in production.

## Deploy

Push to GitHub, then deploy from Netlify with the settings above. For CLI deploy:

```bash
netlify deploy --prod --dir=dist --functions=netlify/functions
```
