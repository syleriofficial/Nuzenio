# NewsSetu V26 Premium UI

Built without v0. Netlify + Supabase compatible.

Includes:
- Premium clean white UI
- Live RSS Netlify Function
- Multilingual language selector
- Breaking ticker
- Hero story
- For You feed
- Trust badges
- Fact-check badge UI
- AI summary buttons
- Article detail modal
- Saved articles local storage
- Admin dashboard
- Analytics dashboard
- Monetization dashboard
- AdSense slots
- Mobile bottom navigation
- Supabase schema

Deploy:
```bash
npm install
npm run build
netlify deploy --prod
```

Supabase:
Run `supabase/schema.sql`.
Add env:
```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
