import { handler as newsHandler } from './news.js';

const siteUrl = 'https://nuzenio.com';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
  'Content-Type': 'application/xml; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function articleUrl(article) {
  const url = new URL(`/article/${encodeURIComponent(article.id)}`, siteUrl);
  url.searchParams.set('country', article.country || 'IN');
  url.searchParams.set('category', article.category || 'top');
  return url.toString();
}

function isNewsSitemapFresh(article) {
  const time = new Date(article.pubDate).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= 48 * 60 * 60 * 1000;
}

function newsEntry(article) {
  const publishedAt = new Date(article.pubDate).toISOString();
  return `  <url>
    <loc>${escapeXml(articleUrl(article))}</loc>
    <news:news>
      <news:publication>
        <news:name>Nuzenio</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(publishedAt)}</news:publication_date>
      <news:title>${escapeXml(article.title || 'Nuzenio headline')}</news:title>
    </news:news>
  </url>`;
}

function sitemapDocument(articles = []) {
  const entries = articles
    .filter(isNewsSitemapFresh)
    .slice(0, 180)
    .map(newsEntry)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries}
</urlset>`;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        Allow: 'GET, OPTIONS',
      },
      body: 'Method not allowed',
    };
  }

  try {
    const country = event.queryStringParameters?.country || 'IN';
    const requestedCategory = event.queryStringParameters?.category;
    const categories = requestedCategory
      ? [requestedCategory]
      : ['top', 'world', 'business', 'tech', 'ai', 'sports', 'science', 'health', 'entertainment'];
    const responses = await Promise.all(categories.map(async (category) => {
      const newsResponse = await newsHandler({
        httpMethod: 'GET',
        headers: event.headers || {},
        queryStringParameters: {
          category,
          country,
          language: 'en',
        },
      });
      const data = JSON.parse(newsResponse.body || '{}');
      return data.ok ? data.articles || [] : [];
    }));
    const seen = new Set();
    const articles = responses.flat().filter((article) => {
      if (!article?.id || seen.has(article.id)) return false;
      seen.add(article.id);
      return true;
    });
    return {
      statusCode: 200,
      headers,
      body: sitemapDocument(articles),
    };
  } catch {
    return {
      statusCode: 200,
      headers,
      body: sitemapDocument([]),
    };
  }
};
