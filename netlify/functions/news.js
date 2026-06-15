import https from 'node:https';

const TOPICS = {
  world: 'WORLD',
  business: 'BUSINESS',
  tech: 'TECHNOLOGY',
  sports: 'SPORTS',
  entertainment: 'ENTERTAINMENT',
  health: 'HEALTH',
  science: 'SCIENCE',
};

const CATEGORIES = new Set(['local', 'top', 'video', 'shorts', ...Object.keys(TOPICS)]);

const COUNTRY_NAMES = {
  AE: 'United Arab Emirates',
  AU: 'Australia',
  BD: 'Bangladesh',
  BR: 'Brazil',
  CA: 'Canada',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  IN: 'India',
  IT: 'Italy',
  JP: 'Japan',
  KR: 'South Korea',
  NL: 'Netherlands',
  PK: 'Pakistan',
  RU: 'Russia',
  SG: 'Singapore',
  US: 'United States',
  ZA: 'South Africa',
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=120',
  'Content-Type': 'application/json; charset=utf-8',
};

function fetchText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        timeout: 9000,
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml',
          'User-Agent': 'Nuzenio/1.0 (+https://nuzenio.com)',
        },
      },
      (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          response.resume();
          if (redirects > 2) return reject(new Error('Too many RSS redirects'));
          return resolve(fetchText(new URL(response.headers.location, url).toString(), redirects + 1));
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          return reject(new Error(`RSS request failed with ${response.statusCode}`));
        }

        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => resolve(data));
      },
    );

    request.on('timeout', () => request.destroy(new Error('RSS request timed out')));
    request.on('error', reject);
  });
}

function clean(value = '') {
  return value
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? clean(match[1]) : '';
}

function extractImage(item) {
  const media = item.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  const enclosure = item.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  return media?.[1] || enclosure?.[1] || '';
}

function parse(xml, category, country) {
  return (xml.match(/<item\b[\s\S]*?<\/item>/gi) || [])
    .slice(0, 60)
    .map((item, index) => {
      const title = first(item, 'title');
      const description = first(item, 'description');
      const source = first(item, 'source') || 'Google News';
      const link = first(item, 'link');
      const pubDate = first(item, 'pubDate');
      const summary = buildSummary(description || title);
      const fullBrief = clean(description || title);
      return {
        id: `${country}-${category}-${Buffer.from(`${title}${link}`).toString('base64url').slice(0, 24)}`,
        title,
        link,
        source,
        pubDate,
        category,
        country,
        image: extractImage(item),
        readTime: Math.max(1, Math.ceil((description || title).split(/\s+/).length / 180)),
        trustScore: Math.max(84, 99 - (index % 12)),
        summary,
        fullBrief,
        whatHappened: summary,
        whyItMatters: buildWhyItMatters(category, source),
      };
    })
    .filter((article) => article.title && article.link)
    .filter((article) => (['video', 'shorts'].includes(category) ? isYouTubeArticle(article) : true));
}

function isYouTubeArticle(article) {
  return /youtube/i.test(`${article.source} ${article.link} ${article.title}`);
}

function buildSummary(text) {
  const cleanText = clean(text);
  if (cleanText.length <= 260) return cleanText;
  return `${cleanText.slice(0, 257).trim()}...`;
}

function buildWhyItMatters(category, source) {
  const topic = category === 'top' || category === 'local' ? 'public interest' : category;
  return `This ${topic} report is being tracked from ${source} because it may affect readers, markets, policy, culture, or daily decisions.`;
}

function normalizeCountry(country = 'IN') {
  const value = country.toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : 'IN';
}

function countryLabel(country = 'IN') {
  const value = normalizeCountry(country);
  if (COUNTRY_NAMES[value]) return COUNTRY_NAMES[value];
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(value) || value;
  } catch {
    return value;
  }
}

function cleanRegion(region = '') {
  return region.replace(/[^\p{L}\p{N}\s.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function cleanQuery(query = '') {
  return query.replace(/[^\p{L}\p{N}\s.,'"!?&:()-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function normalizeCategory(category = 'local') {
  const value = category.toLowerCase();
  return CATEGORIES.has(value) ? value : 'local';
}

function normalizeLanguage(language = 'en') {
  const value = language.toLowerCase();
  return /^[a-z]{2}$/.test(value) ? value : 'en';
}

function googleNewsUrl({ category, country, q, region, city, language }) {
  const countryCode = normalizeCountry(country);
  const newsLanguage = normalizeLanguage(language);
  const stateRegion = cleanRegion(region);
  const cityArea = cleanRegion(city);
  const params = `hl=${newsLanguage}-${countryCode}&gl=${countryCode}&ceid=${countryCode}:${newsLanguage}`;
  if (q) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${params}`;
  }
  if (category === 'local') {
    const localQuery = [cityArea, stateRegion, countryLabel(countryCode)].filter(Boolean).join(' ');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(localQuery)}&${params}`;
  }
  if (category === 'video') {
    const videoQuery = ['site:youtube.com', 'video news', countryLabel(countryCode)].filter(Boolean).join(' ');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(videoQuery)}&${params}`;
  }
  if (category === 'shorts') {
    const shortsQuery = ['site:youtube.com/shorts', 'news', countryLabel(countryCode)].filter(Boolean).join(' ');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(shortsQuery)}&${params}`;
  }
  if (TOPICS[category]) {
    return `https://news.google.com/rss/headlines/section/topic/${TOPICS[category]}?${params}`;
  }
  return `https://news.google.com/rss?${params}`;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const category = normalizeCategory(event.queryStringParameters?.category || 'local');
    const country = normalizeCountry(event.queryStringParameters?.country || 'IN');
    const region = cleanRegion(event.queryStringParameters?.region || '');
    const city = cleanRegion(event.queryStringParameters?.city || '');
    const language = normalizeLanguage(event.queryStringParameters?.language || 'en');
    const q = cleanQuery(event.queryStringParameters?.q || '');
    const url = googleNewsUrl({ category, country, q, region, city, language });
    const xml = await fetchText(url);
    const articles = parse(xml, category, country);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        category,
        country,
        countryName: countryLabel(country),
        region: region || null,
        city: city || null,
        language,
        query: q || null,
        total: articles.length,
        sourceType: 'live-rss',
        updatedAt: new Date().toISOString(),
        articles,
      }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ ok: false, error: error.message, sourceType: 'live-rss' }),
    };
  }
};
