import { handler as newsHandler } from './news.js';

const siteUrl = 'https://nuzenio.com';
const fallbackImage = `${siteUrl}/og-image.svg`;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeCategory(value = 'top') {
  return /^[a-z-]+$/i.test(value) ? value : 'top';
}

function normalizeCountry(value = 'IN') {
  return /^[A-Z]{2}$/i.test(value) ? value.toUpperCase() : 'IN';
}

function articleIdFromPath(path = '') {
  const [, encodedId] = path.match(/^\/article\/([^/?#]+)\/?/) || [];
  return encodedId ? decodeURIComponent(encodedId) : '';
}

function articleUrl(articleId, category, country) {
  const url = new URL(`/article/${encodeURIComponent(articleId)}`, siteUrl);
  url.searchParams.set('country', country);
  url.searchParams.set('category', category);
  return url.toString();
}

function appUrl(articleId, category, country) {
  const url = new URL(category === 'top' ? '/top-news' : `/${category}`, siteUrl);
  if (category === 'tech') url.pathname = '/technology';
  if (category === 'entertainment') url.pathname = '/entertainment';
  url.searchParams.set('country', country);
  url.searchParams.set('category', category);
  url.searchParams.set('article', articleId);
  return url.toString();
}

function seoImage(article) {
  if (article?.imageKind === 'logo') return fallbackImage;
  return /^https:\/\//i.test(article?.image || '') ? article.image : fallbackImage;
}

function safeJsonScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function htmlDocument({ article, articleId, category, country }) {
  const canonical = articleUrl(articleId, category, country);
  const app = appUrl(articleId, category, country);
  const title = article?.title ? `${article.title} | Nuzenio` : 'Nuzenio Article';
  const description = article?.summary || 'Read the latest source-attributed Nuzenio news brief with AI-powered context and original publisher attribution.';
  const image = seoImage(article);
  const publishedAt = article?.pubDate || new Date().toISOString();
  const source = article?.source || 'RSS publisher';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article?.title || 'Nuzenio Article',
    description,
    image,
    datePublished: publishedAt,
    dateModified: publishedAt,
    mainEntityOfPage: canonical,
    url: canonical,
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: 'Nuzenio',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/icon.svg`,
      },
    },
    author: {
      '@type': 'Organization',
      name: source,
    },
    isBasedOn: article?.link || undefined,
    citation: source,
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:site_name" content="Nuzenio">
  <meta property="article:published_time" content="${escapeHtml(publishedAt)}">
  <meta property="article:section" content="${escapeHtml(category)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <script type="application/ld+json">${safeJsonScript(jsonLd)}</script>
  <script>window.location.replace(${JSON.stringify(app)});</script>
</head>
<body>
  <main>
    <h1>${escapeHtml(article?.title || 'Opening Nuzenio article...')}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(app)}">Open this story on Nuzenio</a></p>
  </main>
</body>
</html>`;
}

async function findArticle(articleId, category, country, event) {
  const categories = [category, 'top', 'world', 'business', 'tech', 'ai', 'sports', 'health', 'science', 'entertainment'];
  for (const cat of [...new Set(categories)]) {
    const newsResponse = await newsHandler({
      httpMethod: 'GET',
      headers: event.headers || {},
      queryStringParameters: {
        category: cat,
        country,
        language: 'en',
      },
    });
    const data = JSON.parse(newsResponse.body || '{}');
    const article = data.articles?.find((item) => item.id === articleId);
    if (article) return { article, category: cat };
  }
  return { article: null, category };
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

  const articleId = articleIdFromPath(event.path || '');
  const requestedCategory = normalizeCategory(event.queryStringParameters?.category || 'top');
  const country = normalizeCountry(event.queryStringParameters?.country || 'IN');
  const { article, category } = articleId
    ? await findArticle(articleId, requestedCategory, country, event)
    : { article: null, category: requestedCategory };

  return {
    statusCode: article ? 200 : 404,
    headers,
    body: htmlDocument({ article, articleId, category, country }),
  };
};
