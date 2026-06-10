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

const COUNTRY_NAMES = {
  AE: 'United Arab Emirates',
  AU: 'Australia',
  BD: 'Bangladesh',
  CA: 'Canada',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  IN: 'India',
  JP: 'Japan',
  KR: 'South Korea',
  PK: 'Pakistan',
  RU: 'Russia',
  US: 'United States',
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
          'User-Agent': 'NewsSetu/1.0 (+https://newssetu.netlify.app)',
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
        id: `${country}-${category}-${index}-${Buffer.from(`${title}${link}`).toString('base64url').slice(0, 16)}`,
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
    .filter((article) => article.title && article.link);
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
  return COUNTRY_NAMES[value] ? value : 'IN';
}

function googleNewsUrl({ category, country, q }) {
  const region = normalizeCountry(country);
  const params = `hl=en-${region}&gl=${region}&ceid=${region}:en`;
  if (q) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${params}`;
  }
  if (category === 'local') {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(COUNTRY_NAMES[region])}&${params}`;
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
    const category = (event.queryStringParameters?.category || 'local').toLowerCase();
    const country = normalizeCountry(event.queryStringParameters?.country || 'IN');
    const q = (event.queryStringParameters?.q || '').trim();
    const url = googleNewsUrl({ category, country, q });
    const xml = await fetchText(url);
    const articles = parse(xml, category, country);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        category,
        country,
        countryName: COUNTRY_NAMES[country],
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
