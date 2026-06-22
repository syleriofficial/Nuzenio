# Nuzenio Mobile Apps

This folder prepares Nuzenio for Android, iPhone, and iPad apps while keeping the current Netlify deployment simple and stable.

## Current foundation

- Capacitor-ready app config in `capacitor.config.json`
- Shared backend APIs for news, search, recommendations, and user capability checks
- PWA service worker cache for app shell, news API, and recommendation API
- Supabase schema for mobile devices, push subscriptions, offline sync, mobile analytics, and release tracking
- Store metadata and privacy label draft for Play Store and App Store submission

## Native app setup

Run these only when the native projects are ready to be generated:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run build
npx cap init Nuzenio com.nuzenio.app --web-dir dist
npx cap add android
npx cap add ios
npx cap sync
```

Open native projects:

```bash
npx cap open android
npx cap open ios
```

## Production settings

Before app-store submission:

1. Add the official Apple App Store id to `public/site.webmanifest` only after Apple assigns the listing id.
2. Publish Play Store package `com.nuzenio.app`.
3. Set `prefer_related_applications` to `true` only after both store listings are live.
4. Configure Supabase Google, Apple, and email auth redirect URLs for mobile deep links.
5. Configure FCM for Android and APNs for iOS.
6. Add real screenshots listed in `store-metadata.json`.
7. Confirm `privacy.html`, `terms.html`, and `affiliate-disclosure.html` are live on `https://nuzenio.com`.

## Mobile feature map

- Personalized feed: `/api/v1/recommendations` plus `user_preferences`
- Breaking alerts: `push_subscriptions` channel `breaking`
- Save for later: `saved_articles`
- Reading history: `reading_history`
- Follow topics: `followed_topics`
- Follow publishers: `followed_sources`
- Follow countries: `user_preferences.preferred_country`
- Offline reading: local app cache plus `offline_sync_queue`
- Mobile analytics: `mobile_session_events`

## App store checklist

- App name: Nuzenio
- Category: News
- Age rating: 12+
- Privacy policy: `https://nuzenio.com/privacy.html`
- Terms: `https://nuzenio.com/terms.html`
- Support: `https://nuzenio.com/contact.html`
- Bundle id: `com.nuzenio.app`
- Screenshots: Android phone, iPhone, iPad
- Review notes: Nuzenio shows publisher-sourced summaries and links users to original publishers. It does not copy full publisher articles.
