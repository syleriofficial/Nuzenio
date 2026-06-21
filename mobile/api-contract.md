# Nuzenio Mobile API Contract

Nuzenio mobile apps use the same Netlify and Supabase backend as the website. Native apps should never scrape publisher pages or copy full articles.

## Public news APIs

### News feed

```text
GET /api/news?category=top&country=IN&limit=30
```

Returns live RSS-backed articles with title, short summary, source, image, publish time, category, country, and original publisher link.

### Search

```text
GET /api/v1/search?q=climate&limit=30
```

Searches cached Nuzenio article metadata. Use for mobile search and topic drill-down.

### Recommendations

```text
GET /api/v1/recommendations?country=IN&categories=top,world,business,tech,ai&limit=30
```

Returns personalized-ready stories from cached articles. Native apps can pass country and category preferences until signed-in recommendation logic is expanded.

### User capabilities

```text
GET /api/v1/user
```

Returns auth provider and sync capability metadata for app clients.

## Auth

Use Supabase Auth for:

- Google login
- Apple login
- Email login

Mobile apps must use the same Supabase project as the website so saved articles, reading history, preferences, followed topics, and notification settings sync across web, PWA, Android, iPhone, and iPad.

## Sync tables

- `user_preferences`: country, categories, notification preferences, digest settings
- `saved_articles`: save for later
- `reading_history`: continue reading and recommendation signals
- `followed_topics`, `followed_sources`, `followed_entities`, `followed_authors`: follow graph
- `mobile_devices`: app platform, push token, app version, last seen
- `push_subscriptions`: breaking news, followed topic, daily brief, major world event channels
- `offline_sync_queue`: pending mobile sync actions
- `mobile_session_events`: DAU, MAU, session time, retention analytics
- `mobile_app_builds`: Android, iOS, iPad, and PWA release tracking

## Offline reading rules

Cache only copyright-safe article metadata:

- title
- short summary
- image
- source name
- publish time
- original link
- AI summary generated from available source/RSS metadata

Do not cache copied full publisher article text unless Nuzenio has explicit publisher permission.

## Push notification rules

Allowed channels:

- breaking news
- followed topics
- daily briefing
- major world events

Every app must ask for notification permission, allow opt-out, respect quiet hours, and never send promotional notifications without clear consent.
