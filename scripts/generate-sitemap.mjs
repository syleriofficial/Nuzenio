import { writeFileSync } from 'node:fs';

const siteUrl = 'https://nuzenio.com';

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

const countries = ['IN', 'US', 'GB', 'CA', 'AU', 'AE', 'BD', 'PK', 'SG', 'ZA', 'DE', 'FR', 'ES', 'BR', 'RU', 'JP', 'KR'];
const lastmod = new Date().toISOString().slice(0, 10);

const localPlaces = [
  { country: 'IN', region: 'Bihar', city: 'Raxaul' },
  { country: 'IN', region: 'Delhi', city: 'New Delhi' },
  { country: 'IN', region: 'Maharashtra', city: 'Mumbai' },
  { country: 'IN', region: 'Karnataka', city: 'Bengaluru' },
  { country: 'IN', region: 'Tamil Nadu', city: 'Chennai' },
  { country: 'US', region: 'California', city: 'Los Angeles' },
  { country: 'US', region: 'New York', city: 'New York' },
  { country: 'GB', region: 'England', city: 'London' },
  { country: 'CA', region: 'Ontario', city: 'Toronto' },
  { country: 'AU', region: 'New South Wales', city: 'Sydney' },
  { country: 'AE', region: 'Dubai', city: 'Dubai' },
  { country: 'BD', region: 'Dhaka', city: 'Dhaka' },
  { country: 'PK', region: 'Punjab', city: 'Lahore' },
  { country: 'SG', region: 'Singapore', city: 'Singapore' },
  { country: 'ZA', region: 'Gauteng', city: 'Johannesburg' },
];

const staticPages = [
  ['', 'hourly', '1.00'],
  ['about.html', 'monthly', '0.50'],
  ['sources.html', 'monthly', '0.50'],
  ['editorial-policy.html', 'monthly', '0.50'],
  ['ai-policy.html', 'monthly', '0.50'],
  ['corrections.html', 'monthly', '0.50'],
  ['contact.html', 'monthly', '0.50'],
  ['advertise.html', 'monthly', '0.45'],
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

function entry(loc, changefreq = 'hourly', priority = '0.70') {
  return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

const entries = [];

for (const [path, changefreq, priority] of staticPages) {
  entries.push(entry(url(path), changefreq, priority));
}

for (const [category, priority] of categories) {
  entries.push(entry(url(category), 'hourly', priority));
  for (const country of countries) {
    entries.push(entry(url(category, { country }), 'hourly', priority));
  }
}

for (const place of localPlaces) {
  entries.push(entry(url('local', place), 'hourly', '0.82'));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(entries)].join('\n')}
</urlset>
`;

writeFileSync(new URL('../public/sitemap.xml', import.meta.url), sitemap);
console.log(`Generated sitemap with ${new Set(entries).size} URLs`);
