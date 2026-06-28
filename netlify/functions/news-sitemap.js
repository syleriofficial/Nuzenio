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
  url.searchParams.set('country', article.country || 'US');
  url.searchParams.set('category', article.category || 'top');
  return url.toString();
}

function safeImageUrl(value = '') {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function isNewsSitemapFresh(article) {
  const time = new Date(article.pubDate).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= 48 * 60 * 60 * 1000;
}

function newsEntry(article) {
  const publishedAt = new Date(article.pubDate).toISOString();
  const source = article.source || 'Publisher';
  const image = safeImageUrl(article.image);
  return `  <url>
    <loc>${escapeXml(articleUrl(article))}</loc>
    <lastmod>${escapeXml(publishedAt)}</lastmod>
    <news:news>
      <news:publication>
        <news:name>Nuzenio</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(publishedAt)}</news:publication_date>
      <news:title>${escapeXml(article.title || 'Nuzenio headline')}</news:title>
      <news:keywords>${escapeXml([source, article.category || 'news'].filter(Boolean).join(', '))}</news:keywords>
    </news:news>
${image ? `    <image:image>
      <image:loc>${escapeXml(image)}</image:loc>
      <image:title>${escapeXml(article.title || 'Nuzenio headline')}</image:title>
    </image:image>` : ''}
  </url>`;
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
}

async function readCachedArticles() {
  const config = supabaseConfig();
  if (!config.enabled) return [];
  try {
    const response = await fetch(`${config.url}/rest/v1/news_cache?select=article_id,title,link,source,summary,image,image_kind,category,country,published_at,updated_at,payload&order=published_at.desc&limit=180`, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.article_id,
      slug: row.payload?.slug || slugifyTitle(row.title),
      title: row.title,
      source: row.source || 'Publisher',
      category: row.category || 'top',
      country: row.country || 'US',
      pubDate: row.published_at || row.updated_at,
      image: row.image || row.payload?.image || '',
    }));
  } catch {
    return [];
  }
}

function sitemapDocument(articles = []) {
  const entries = articles
    .filter(isNewsSitemapFresh)
    .slice(0, 180)
    .map(newsEntry)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
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
    const country = event.queryStringParameters?.country || 'US';
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
    const cachedArticles = await readCachedArticles();
    const seen = new Set();
    const articles = [...cachedArticles, ...responses.flat()].filter((article) => {
      const key = article?.id || articleSlug(article);
      if (!key || seen.has(key)) return false;
      seen.add(key);
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
