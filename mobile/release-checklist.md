# Nuzenio Mobile Release Checklist

## Android

- Create Google Play Console app.
- Reserve package name `com.nuzenio.app`.
- Add privacy policy, terms, and support URLs.
- Upload phone and tablet screenshots.
- Configure FCM sender and push credentials.
- Build signed Android App Bundle.
- Test install, login, offline reading, saved articles, and notification opt-out.

## iPhone and iPad

- Create App Store Connect app.
- Reserve bundle id `com.nuzenio.app`.
- Enable Sign in with Apple.
- Configure APNs key and push entitlements.
- Add iPhone and iPad screenshots.
- Fill privacy nutrition labels from `privacy-labels.json`.
- Test login, local news, article view, offline cache, and notification settings.

## Shared QA

- `npm run build` passes.
- `/api/news` returns live articles.
- `/api/v1/recommendations` returns cached recommendations when Supabase is configured.
- Offline page loads without network.
- Saved articles sync across web and mobile account.
- No full publisher article text is copied into Nuzenio.
- Ads and affiliate placements are clearly labeled and never placed near misleading buttons.
