# Nuzenio

Production-oriented Netlify + Supabase AI news platform.

## What is included

- Live RSS news through Netlify Functions at `/api/news`
- Live News and Video sections with playable embedded videos from approved sources
- Clean section pages for `/local`, `/live`, and `/video`
- SEO topic pages for `/top-news`, `/world`, `/business`, `/technology`, `/ai`, `/sports`, `/entertainment`, `/health`, and `/science`
- English-first website experience with automatic local-country news
- Premium clean white responsive UI
- Red breaking-news accent and blue AI/action buttons
- Google login wiring with Supabase Auth
- Saved articles, reading history, newsletter subscribers, RSS sources, AdSense slots, and analytics schema
- English-only launch flow for cleaner UX, SEO, AdSense review, and source consistency
- Article detail modal with AI summary, what happened, why it matters, key facts, source attribution, and read-original link
- Backend-ready admin structures for RSS sources, AdSense slots, newsletter, analytics, SEO, and languages
- Affiliate link manager structure with visible disclosure
- SEO basics: meta tags, Open Graph tags, `robots.txt`, and `sitemap.xml`
- Trust pages: about, sources, editorial policy, contact, privacy, terms, and affiliate disclosure
- Google AdSense publisher script and `ads.txt` configured for `pub-5589150014762971`
- Mobile bottom navigation and readable article view

## Netlify settings

Keep these settings:

```text
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

`netlify.toml` already maps `/api/news` to `/.netlify/functions/news`.

## Supabase setup

1. Create a Supabase project.
2. In Authentication > Providers, enable Google.
3. Add the deployed site URLs to Authentication > URL Configuration.
4. Run `supabase/schema.sql` in the Supabase SQL editor.
5. Add these Netlify environment variables:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
YOUTUBE_API_KEY=<youtube-data-api-key-optional-but-recommended>
YOUTUBE_NEWS_CHANNEL_IDS=UCxxxxxxxxxxxxxxxxxxxxxx,UCyyyyyyyyyyyyyyyyyyyyyy
LIVE_NEWS_SOURCES=[]
TWITCH_EMBED_PARENTS=nuzenio.com,<netlify-site-name>.netlify.app
```

`YOUTUBE_API_KEY` lets Netlify Functions load Live News and Video through the official YouTube Data API. Without it, Nuzenio falls back to live YouTube search parsing.
`YOUTUBE_NEWS_CHANNEL_IDS` is optional. Add comma-separated YouTube channel IDs to show videos from approved news channels first; leave it empty to use country-based YouTube news search.
`LIVE_NEWS_SOURCES` is optional JSON for verified free live channels outside normal YouTube search. Only add official/publicly embeddable sources that the publisher allows. Supported providers are `youtube`, `twitch`, `official_embed`, and `hls`.

Example `LIVE_NEWS_SOURCES` value:

```json
[
  {
    "id": "publisher-live",
    "name": "Publisher News",
    "title": "Publisher News Live",
    "provider": "official_embed",
    "country": "GLOBAL",
    "language": "en",
    "embedUrl": "https://publisher.example/embed/live",
    "link": "https://publisher.example/live",
    "active": true,
    "priority": 100
  }
]
```

Recommended Supabase auth URLs:

```text
Site URL: https://nuzenio.com
Redirect URLs:
https://nuzenio.com
https://nuzenio.com/*
https://<netlify-site-name>.netlify.app
https://<netlify-site-name>.netlify.app/*
```

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
https://nuzenio.com/about.html
https://nuzenio.com/contact.html
https://nuzenio.com/privacy.html
https://nuzenio.com/sitemap.xml
```

8. Submit `https://nuzenio.com/sitemap.xml` in Google Search Console.
9. Keep `https://nuzenio.com` as the canonical production URL.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Monetization notes

- AdSense publisher script is configured in `index.html`; create real ad units in AdSense and replace reserved inventory slots only with approved slot IDs.
- Keep paid placements labeled and separate from editorial RSS stories.
- Keep `public/ads.txt` in sync with the active AdSense publisher account.
- Use the public trust pages in `public/` for review readiness.
- Store approved partner links in `public.affiliate_links` and keep `enabled=false` until reviewed.

## Deploy

Push to GitHub, then deploy from Netlify with the settings above. For CLI deploy:

```bash
netlify deploy --prod --dir=dist --functions=netlify/functions
```
