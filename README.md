# NewsSetu

Production-oriented Netlify + Supabase AI news platform.

## What is included

- Live RSS news through Netlify Functions at `/api/news`
- Premium clean white responsive UI
- Red breaking-news accent and blue AI/action buttons
- Google login wiring with Supabase Auth
- Saved articles, reading history, newsletter subscribers, RSS sources, AdSense slots, and analytics schema
- Multilingual selector for Hindi, English, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Arabic, Spanish, French, German, Portuguese, Russian, Chinese, Japanese, Korean
- RTL document support for Urdu and Arabic
- Original / translated reading toggle UI
- Article detail modal with AI summary, what happened, why it matters, key facts, source attribution, and read-original link
- Admin dashboard for RSS sources, AdSense slots, newsletter, analytics, SEO, and languages
- SEO basics: meta tags, Open Graph tags, `robots.txt`, and `sitemap.xml`
- AdSense placeholders only, with no fake ad scripts
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
3. Add the deployed site URL to Authentication > URL Configuration.
4. Run `supabase/schema.sql` in the Supabase SQL editor.
5. Add these Netlify environment variables:

```text
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Deploy

Push to GitHub, then deploy from Netlify with the settings above. For CLI deploy:

```bash
netlify deploy --prod --dir=dist --functions=netlify/functions
```
