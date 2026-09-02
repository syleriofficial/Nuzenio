# Product decisions and assumptions

## Product stance

Nuzenio is an aggregator and comparison layer, not a publisher of original news. The public experience begins with a story cluster and makes publisher reporting, conflicts, provenance and updates visible without reproducing complete articles.

## Milestone 1 decisions

- **Fictional demonstration edition:** all story, publisher, document and external URLs are explicitly fictional and use `example.com`. This prevents a sample build from presenting invented current events as real news.
- **Neutral cluster copy:** headlines describe the shared event. Briefs are 40–80 English words and avoid motives or outcomes not represented in the evidence fixture.
- **Source diversity:** counts use publisher organisation identity. Multiple domains from one owner count once. Syndicated copies retain a link but do not increase diversity.
- **Claim states:** Confirmed, Still developing and Disputed are separate, scannable sections. Empty disputed sections are suppressed instead of implying disagreement.
- **Evidence-first summaries:** unsupported sentences are removed; a summary with no supported sentences is not published.
- **High-risk review:** elections, communal violence, war, public safety, health emergencies and market-moving stories require editorial approval. The Delhi air-quality example demonstrates the reviewed state.
- **Translation:** English/Hindi switching covers navigation, cluster headlines, briefs and key controls. Hindi demonstration copy is labelled as machine-translated on cluster detail pages.
- **Personalisation:** For You explains each recommendation. Save, follow, source-hide, language and theme preferences use local device storage in this milestone.
- **Local pilot:** Delhi NCR includes Delhi, Gurugram, Noida, Ghaziabad and Faridabad, with a settings entry point for later geographies.
- **Briefs:** morning and evening editions link every item back to the full cluster comparison.
- **Admin:** the registry, feed health, merge/split, corrections and high-risk review surfaces are interaction prototypes. Production mutations require authentication, persistence, concurrency control and audit logs.
- **No paid AI dependency:** all pipeline implementations are deterministic. Provider protocols allow evaluated replacements without changing domain rules.
- **No deployment:** the implementation remains local, as requested.

## Accessibility and interaction

- Controls are native buttons, links, form fields or accessible primitives.
- Touch targets are designed around at least 32–44 CSS pixels depending on density and placement.
- Sticky mobile navigation is thumb reachable; desktop navigation preserves a reading-width feed.
- Status changes announce through polite live regions.
- Colour is reinforced by labels and icons.
- Motion respects `prefers-reduced-motion`.

## Known milestone boundaries

- The web demonstration reads its checked-in fixture rather than the live FastAPI service.
- PWA preferences are device-local; no authentication or cross-device sync exists.
- Publisher connectors, feed polling, browser push and production admin writes are interfaces only.
- No real publisher content, licensed feed or official document is included.
