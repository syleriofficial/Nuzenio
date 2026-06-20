import { handler as newsHandler } from './news.js';

const siteUrl = 'https://nuzenio.com';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
  'Content-Type': 'application/rss+xml; charset=utf-8',
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

function slugifyTitle(value = '') {
  const slug = String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');
  return slug || 'news-story';
}

function articleSlug(article) {
  return article?.slug || slugifyTitle(article?.title || article?.id || 'news-story');
}

function articleUrl(article) {
  const url = new URL(`/article/${encodeURIComponent(articleSlug(article))}`, siteUrl);
  url.searchParams.set('country', article.country || 'IN');
  url.searchParams.set('category', article.category || 'top');
  return url.toString();
}

function cdata(value = '') {
  return `<![CDATA[${String(value).replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

function rssItem(article) {
  const url = articleUrl(article);
  const source = article.source || 'RSS publisher';
  const description = article.summary || article.description || '';
  const pubDate = article.pubDate ? new Date(article.pubDate).toUTCString() : new Date().toUTCString();
  return `    <item>
      <title>${cdata(article.title || 'Nuzenio headline')}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <source>${cdata(source)}</source>
      <category>${escapeXml(article.category || 'top')}</category>
      <description>${cdata(description)}</description>
    </item>`;
}

function rssDocument(articles = []) {
  const updatedAt = new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Nuzenio Top News</title>
    <link>${siteUrl}/</link>
    <description>Live English headlines from Nuzenio with publisher attribution and AI-powered context.</description>
    <language>en</language>
    <lastBuildDate>${escapeXml(updatedAt)}</lastBuildDate>
    <ttl>5</ttl>
${articles.slice(0, 30).map(rssItem).join('\n')}
  </channel>
</rss>`;
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
    const newsResponse = await newsHandler({
      httpMethod: 'GET',
      headers: event.headers || {},
      queryStringParameters: {
        category: event.queryStringParameters?.category || 'top',
        country: event.queryStringParameters?.country || 'IN',
        language: 'en',
      },
    });
    const data = JSON.parse(newsResponse.body || '{}');
    if (!data.ok) throw new Error(data.error || 'News feed failed');
    return {
      statusCode: 200,
      headers,
      body: rssDocument(data.articles || []),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: rssDocument([]).replace('</description>', `</description>\n    <generator>${escapeXml(error.message)}</generator>`),
    };
  }
};
