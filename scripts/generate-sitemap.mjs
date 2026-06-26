import { writeFileSync } from 'node:fs';
import { countryOptionCodes, localPlacePresets } from '../src/constants/locale.js';

const siteUrl = 'https://nuzenio.com';
const languages = ['en', 'hi', 'es', 'fr', 'de', 'pt', 'ar', 'ja', 'ko', 'zh', 'bn', 'ta', 'te', 'mr', 'ur'];

const categories = [
  ['top-news', '0.95'],
  ['local', '0.90'],
  ['live', '0.90'],
  ['video', '0.85'],
  ['world', '0.85'],
  ['business', '0.85'],
  ['technology', '0.85'],
  ['ai', '0.85'],
  ['sports', '0.80'],
  ['entertainment', '0.75'],
  ['health', '0.75'],
  ['science', '0.75'],
];

const includeAdvancedIntelligencePages = false;
const countries = ['IN', 'US', 'GB', 'CA', 'AU', 'AE', 'BD', 'PK', 'SG', 'ZA', 'DE', 'FR', 'ES', 'BR', 'RU', 'JP', 'KR'];
const intelligenceCountries = includeAdvancedIntelligencePages ? ['us', 'uk', 'in', 'ca', 'au', 'de', 'fr', 'jp', 'kr', 'br'] : [];
const intelligenceTopics = includeAdvancedIntelligencePages ? ['ai', 'economy', 'markets', 'climate', 'energy', 'space', 'science', 'startups'] : [];
const seoLandingPages = ['latest-news', 'breaking-news', 'world-news', 'technology-news', 'business-news', 'sports-news', 'ai-news', 'science-news', 'health-news'];
const dataPlatformPages = includeAdvancedIntelligencePages ? [
  'ecosystem',
  'publisher-portal',
  'journalist-portal',
  'research-hub',
  'api-marketplace',
  'enterprise',
  'ai-research-assistant',
  'knowledge-graph',
  'marketplace',
  'integrations',
  'brand-infrastructure',
  'data-platform',
  'archive',
  'mobile-app',
  'intelligence-dashboard',
] : [];
const evergreenHubs = includeAdvancedIntelligencePages ? ['ai', 'space', 'climate', 'economy', 'startup'] : [];
const hubAliases = includeAdvancedIntelligencePages ? ['ai-hub', 'space-hub', 'climate-hub', 'economy-hub', 'startup-hub'] : [];
const intelligenceEntities = includeAdvancedIntelligencePages ? ['openai', 'google', 'microsoft', 'nvidia', 'apple', 'tesla', 'amazon', 'meta', 'united-nations', 'world-health-organization', 'federal-reserve', 'european-union', 'nasa', 'india', 'united-states', 'anthropic', 'samsung', 'spacex', 'bitcoin', 'world-bank', 'imf', 'netflix', 'premier-league', 'ipl', 'isro', 'climate-change'] : [];
const publisherPages = includeAdvancedIntelligencePages ? ['nuzenio', 'reuters', 'associated-press', 'bbc-news', 'the-guardian', 'al-jazeera', 'the-hindu', 'ndtv', 'nikkei-asia', 'cbc-news', 'abc-news-au'] : [];
const authorPages = includeAdvancedIntelligencePages ? ['nuzenio-news-desk', 'nuzenio-analysis-team', 'nuzenio-fact-check-desk', 'nuzenio-research-desk'] : [];
const lastmod = new Date().toISOString().slice(0, 10);

const localPlaces = countryOptionCodes
  .flatMap((country) => (localPlacePresets[country] || [])
    .slice(0, 4)
    .map(([region, city]) => ({ country, region, city })));

const staticPages = [
  ['', 'hourly', '1.00'],
  ['about.html', 'monthly', '0.50'],
  ['sources.html', 'monthly', '0.50'],
  ['editorial-policy.html', 'monthly', '0.50'],
  ['fact-checking-policy.html', 'monthly', '0.50'],
  ['ai-policy.html', 'monthly', '0.50'],
  ['corrections.html', 'monthly', '0.50'],
  ['corrections-policy.html', 'monthly', '0.50'],
  ['contact.html', 'monthly', '0.50'],
  ['submit-source.html', 'monthly', '0.52'],
  ['publisher-dashboard.html', 'weekly', '0.50'],
  ['advertise.html', 'monthly', '0.45'],
  ['newsletter.html', 'weekly', '0.58'],
  ['feeds.html', 'weekly', '0.55'],
  ['feed.xml', 'hourly', '0.50'],
  ['privacy.html', 'monthly', '0.40'],
  ['terms.html', 'monthly', '0.40'],
  ['affiliate-disclosure.html', 'monthly', '0.40'],
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function url(path = '', params = {}) {
  const output = new URL(path, `${siteUrl}/`);
  Object.entries(params)
    .filter(([, value]) => value)
    .forEach(([key, value]) => output.searchParams.set(key, value));
  return output.toString();
}

function localizedPath(path = '', language = 'en') {
  const clean = String(path || '').replace(/^\/+/, '');
  if (language === 'x-default') return clean;
  return clean ? `${language}/${clean}` : language;
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'local';
}

function localPlacePath(place) {
  return `local/${place.country.toLowerCase()}/${slugify(place.region)}/${slugify(place.city)}`;
}

function entry(loc, changefreq = 'hourly', priority = '0.70') {
  return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

const entries = [];
const languageEntries = [];

function pushLocalized(path, changefreq = 'hourly', priority = '0.70', params = {}) {
  for (const language of languages) {
    const loc = url(localizedPath(path, language), params);
    entries.push(entry(loc, changefreq, priority));
    languageEntries.push({ path, loc, language, changefreq, priority, params });
  }
}

for (const [path, changefreq, priority] of staticPages) {
  entries.push(entry(url(path), changefreq, priority));
}

for (const [category, priority] of categories) {
  entries.push(entry(url(category), 'hourly', priority));
  pushLocalized(category, 'hourly', priority);
  for (const country of countries) {
    entries.push(entry(url(category, { country }), 'hourly', priority));
  }
}

for (const place of localPlaces) {
  entries.push(entry(url('local', place), 'hourly', '0.82'));
  entries.push(entry(url(localPlacePath(place)), 'hourly', '0.84'));
  pushLocalized(localPlacePath(place), 'hourly', '0.84');
}

for (const country of intelligenceCountries) {
  entries.push(entry(url(`country/${country}`), 'hourly', '0.88'));
  pushLocalized(`country/${country}`, 'hourly', '0.88');
}

for (const topic of intelligenceTopics) {
  entries.push(entry(url(`topic/${topic}`), 'hourly', '0.86'));
  pushLocalized(`topic/${topic}`, 'hourly', '0.86');
}

for (const entity of intelligenceEntities) {
  entries.push(entry(url(`entity/${entity}`), 'hourly', '0.72'));
  pushLocalized(`entity/${entity}`, 'hourly', '0.72');
}

for (const publisher of publisherPages) {
  entries.push(entry(url(`publisher/${publisher}`), 'hourly', '0.76'));
  pushLocalized(`publisher/${publisher}`, 'hourly', '0.76');
}

for (const author of authorPages) {
  entries.push(entry(url(`author/${author}`), 'weekly', '0.68'));
  pushLocalized(`author/${author}`, 'weekly', '0.68');
}

for (const page of seoLandingPages) {
  entries.push(entry(url(page), 'hourly', '0.90'));
  pushLocalized(page, 'hourly', '0.90');
}

for (const page of dataPlatformPages) {
  entries.push(entry(url(page), 'hourly', '0.82'));
  pushLocalized(page, 'hourly', '0.82');
}

for (const hub of evergreenHubs) {
  entries.push(entry(url(`hub/${hub}`), 'hourly', '0.84'));
  pushLocalized(`hub/${hub}`, 'hourly', '0.84');
}

for (const alias of hubAliases) {
  entries.push(entry(url(alias), 'hourly', '0.78'));
  pushLocalized(alias, 'hourly', '0.78');
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(entries)].join('\n')}
</urlset>
`;

writeFileSync(new URL('../public/sitemap.xml', import.meta.url), sitemap);

function languageEntry({ path, loc, language, changefreq, priority }) {
  const alternates = languages.map((code) => {
    const href = url(localizedPath(path, code));
    return `    <xhtml:link rel="alternate" hreflang="${code}" href="${escapeXml(href)}" />`;
  }).join('\n');
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(url(path))}" />
${alternates}
  </url>`;
}

const languageSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${languageEntries.map(languageEntry).join('\n')}
</urlset>
`;

writeFileSync(new URL('../public/sitemap-languages.xml', import.meta.url), languageSitemap);

const sitemapIndexEntries = [
  ['sitemap.xml', lastmod],
  ['sitemap-languages.xml', lastmod],
  ['news-sitemap.xml', lastmod],
];

const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapIndexEntries.map(([path, modified]) => `  <sitemap><loc>${escapeXml(url(path))}</loc><lastmod>${escapeXml(modified)}</lastmod></sitemap>`).join('\n')}
</sitemapindex>
`;

writeFileSync(new URL('../public/sitemap-index.xml', import.meta.url), sitemapIndex);
console.log(`Generated sitemap index with ${new Set(entries).size} URLs and ${languageEntries.length} localized URLs`);
