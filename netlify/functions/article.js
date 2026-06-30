import { handler as newsHandler } from './news.js';

const siteUrl = 'https://nuzenio.com';
const fallbackImage = `${siteUrl}/og-image.png`;
const supportedLanguages = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur', 'ar', 'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ja', 'ko'];
const supportedLanguageSet = new Set(supportedLanguages);

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

function safeSummary(value = '', fallback = '') {
  const clean = String(value || fallback || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= 260) return clean;
  return `${clean.slice(0, 257).trim()}...`;
}

function normalizeCategory(value = 'top') {
  return /^[a-z-]+$/i.test(value) ? value : 'top';
}

function normalizeCountry(value = 'US') {
  return /^[A-Z]{2}$/i.test(value) ? value.toUpperCase() : 'US';
}

function articleIdFromPath(path = '') {
  const [, maybeLang, rest = path] = path.match(/^\/([a-z]{2})(\/article\/.*)$/i) || [];
  const articlePath = maybeLang && supportedLanguageSet.has(maybeLang.toLowerCase()) ? rest : path;
  const [, encodedId] = articlePath.match(/^\/article\/([^/?#]+)\/?/) || [];
  return encodedId ? decodeURIComponent(encodedId) : '';
}

function languageFromPath(path = '', fallback = 'en') {
  const [, maybeLang] = path.match(/^\/([a-z]{2})(?:\/|$)/i) || [];
  const value = String(maybeLang || fallback || 'en').toLowerCase().split('-')[0];
  return supportedLanguageSet.has(value) ? value : 'en';
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

function articleSlug(article, fallback = '') {
  return article?.slug || slugifyTitle(article?.title || fallback || 'news-story');
}

function localizedPath(path, language = 'en') {
  return language === 'x-default' ? path : `/${language}${path}`;
}

function articleUrl(slug, category, country, language = 'en') {
  const url = new URL(localizedPath(`/article/${encodeURIComponent(slug)}`, language), siteUrl);
  url.searchParams.set('country', country);
  url.searchParams.set('category', category);
  return url.toString();
}

function appUrl(slug, category, country) {
  const url = new URL(category === 'top' ? '/top-news' : `/${category}`, siteUrl);
  if (category === 'tech') url.pathname = '/technology';
  if (category === 'entertainment') url.pathname = '/entertainment';
  url.searchParams.set('country', country);
  url.searchParams.set('category', category);
  url.searchParams.set('article', slug);
  return url.toString();
}

function seoImage(article) {
  if (article?.imageKind === 'logo') return fallbackImage;
  return /^https:\/\//i.test(article?.image || '') ? article.image : fallbackImage;
}

function safeJsonScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function htmlDocument({ article, articleId, category, country, language }) {
  const slug = articleSlug(article, articleId);
  const canonical = articleUrl(slug, category, country, language);
  const app = appUrl(slug, category, country);
  const isFound = Boolean(article);
  const title = article?.title ? `${article.title} | Nuzenio` : 'Story expired | Nuzenio';
  const description = safeSummary(
    article?.summary,
    'This RSS story is no longer available in Nuzenio live cache. Browse the latest source-attributed headlines on Nuzenio.',
  );
  const image = seoImage(article);
  const publishedAt = article?.pubDate || new Date().toISOString();
  const modifiedAt = article?.updatedAt || publishedAt;
  const source = article?.source || 'RSS publisher';
  const sourceUrl = article?.sourceUrl || article?.link || siteUrl;
  const whatHappened = safeSummary(article?.whatHappened || article?.summary, description);
  const whyItMatters = article?.whyItMatters || `Nuzenio tracks this story from ${source} with source attribution and a copyright-safe brief.`;
  const keyFacts = [
    article?.category ? `Category: ${article.category}` : '',
    article?.country ? `Edition: ${article.country}` : '',
    article?.clusterSize > 1 ? `Also reported by ${article.clusterSize - 1} more source${article.clusterSize > 2 ? 's' : ''}` : '',
    article?.fetchedAt ? `Fetched: ${new Date(article.fetchedAt).toUTCString()}` : '',
  ].filter(Boolean);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${canonical}#article`,
    headline: article?.title || 'Nuzenio Article',
    description,
    image: [image],
    datePublished: publishedAt,
    dateModified: modifiedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
    url: canonical,
    articleSection: category,
    inLanguage: language,
    isAccessibleForFree: true,
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: 'Nuzenio',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/icon.svg`,
        width: 512,
        height: 512,
      },
    },
    author: {
      '@type': 'Organization',
      name: source,
    },
    isBasedOn: article?.link || undefined,
    citation: source,
    about: article?.category || category,
  };

  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${isFound ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, follow'}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(articleUrl(slug, category, country, 'x-default'))}">
  ${supportedLanguages.map((code) => `<link rel="alternate" hreflang="${code}" href="${escapeHtml(articleUrl(slug, category, country, code))}">`).join('\n  ')}
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="${escapeHtml(source)}">
  <meta name="news-source" content="${escapeHtml(source)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:site_name" content="Nuzenio">
  <meta property="article:published_time" content="${escapeHtml(publishedAt)}">
  <meta property="article:modified_time" content="${escapeHtml(modifiedAt)}">
  <meta property="article:section" content="${escapeHtml(category)}">
  <meta property="article:author" content="${escapeHtml(source)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  ${isFound ? `<script type="application/ld+json">${safeJsonScript(jsonLd)}</script>` : ''}
  <style>
    :root {
      color: #111827;
      background: #f8fafc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    body {
      margin: 0;
      background: #f8fafc;
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      padding: 28px 18px 48px;
    }
    .articleShell {
      background: #fff;
      border: 1px solid #dbeafe;
      border-radius: 18px;
      box-shadow: 0 22px 70px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }
    .articleBody {
      padding: clamp(22px, 4vw, 44px);
    }
    .brandRow {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      color: #1e40af;
      font-weight: 900;
      margin-bottom: 20px;
    }
    .sourcePill {
      border: 1px solid #dbeafe;
      border-radius: 999px;
      color: #475569;
      font-size: 0.9rem;
      padding: 8px 12px;
    }
    h1 {
      font-size: clamp(2rem, 5vw, 4.4rem);
      letter-spacing: 0;
      line-height: 0.98;
      margin: 0 0 18px;
    }
    .dek {
      color: #475569;
      font-size: 1.15rem;
      max-width: 780px;
    }
    .heroImage {
      aspect-ratio: 16 / 9;
      background: #eef2ff;
      width: 100%;
      object-fit: cover;
      display: block;
    }
    .metaLine {
      color: #64748b;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 18px 0 0;
      font-size: 0.95rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 26px;
    }
    .panel {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px;
      background: #fff;
    }
    .panel b {
      color: #0f172a;
      display: block;
      margin-bottom: 8px;
    }
    .panel p, .panel li {
      color: #475569;
      margin: 0;
    }
    .panel ul {
      margin: 0;
      padding-left: 18px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }
    a {
      color: #2563eb;
      font-weight: 800;
      text-decoration: none;
    }
    .button {
      background: #2563eb;
      border-radius: 12px;
      color: #fff;
      padding: 12px 16px;
    }
    .secondary {
      border: 1px solid #dbeafe;
      border-radius: 12px;
      padding: 12px 16px;
    }
    .notice {
      color: #64748b;
      font-size: 0.92rem;
      margin-top: 18px;
    }
    @media (max-width: 720px) {
      main { padding: 14px 10px 28px; }
      .articleShell { border-radius: 14px; }
      .articleBody { padding: 20px; }
      .grid { grid-template-columns: 1fr; }
      h1 { line-height: 1.04; }
    }
  </style>
</head>
<body>
  <main>
    <article class="articleShell">
      ${isFound ? `<img class="heroImage" src="${escapeHtml(image)}" alt="" loading="eager">` : ''}
      <div class="articleBody">
        <div class="brandRow">
          <a href="${siteUrl}">Nuzenio</a>
          <span class="sourcePill">${escapeHtml(isFound ? 'Source-attributed brief' : 'Expired RSS story')}</span>
        </div>
        <h1>${escapeHtml(article?.title || 'This story has expired')}</h1>
        <p class="dek">${escapeHtml(description)}</p>
        ${isFound ? `<div class="metaLine"><span>${escapeHtml(source)}</span><span>·</span><time datetime="${escapeHtml(publishedAt)}">${escapeHtml(new Date(publishedAt).toUTCString())}</time></div>` : ''}
        ${isFound ? `<section class="grid" aria-label="Article context">
          <div class="panel"><b>AI summary</b><p>${escapeHtml(description)}</p></div>
          <div class="panel"><b>What happened</b><p>${escapeHtml(whatHappened)}</p></div>
          <div class="panel"><b>Why it matters</b><p>${escapeHtml(whyItMatters)}</p></div>
          <div class="panel"><b>Key facts</b><ul>${keyFacts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join('') || `<li>${escapeHtml(source)} is the original attributed source.</li>`}</ul></div>
        </section>` : ''}
        <div class="actions">
          ${isFound && article?.link ? `<a class="button" href="${escapeHtml(article.link)}" rel="nofollow noopener noreferrer">Read original publisher story</a>` : ''}
          <a class="${isFound ? 'secondary' : 'button'}" href="${escapeHtml(isFound ? app : `${siteUrl}/top-news`)}">${escapeHtml(isFound ? 'Open live Nuzenio coverage' : 'Browse latest Nuzenio headlines')}</a>
          ${isFound ? `<a class="secondary" href="${escapeHtml(sourceUrl)}" rel="nofollow noopener noreferrer">Source attribution</a>` : ''}
        </div>
        <p class="notice">Nuzenio shows copyright-safe summaries and context. Full reporting stays with the original publisher.</p>
      </div>
    </article>
  </main>
</body>
</html>`;
}

async function findArticle(articleKey, category, country, language, event) {
  const categories = [category, 'top', 'world', 'business', 'tech', 'ai', 'sports', 'health', 'science', 'entertainment'];
  for (const cat of [...new Set(categories)]) {
    const newsResponse = await newsHandler({
      httpMethod: 'GET',
      headers: event.headers || {},
      queryStringParameters: {
        category: cat,
        country,
        language,
      },
    });
    const data = JSON.parse(newsResponse.body || '{}');
    const article = data.articles?.find((item) => item.id === articleKey || articleSlug(item) === articleKey);
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

  const language = languageFromPath(event.path || '', event.queryStringParameters?.language || 'en');
  const articleId = articleIdFromPath(event.path || '');
  const requestedCategory = normalizeCategory(event.queryStringParameters?.category || 'top');
  const country = normalizeCountry(event.queryStringParameters?.country || 'US');
  const { article, category } = articleId
    ? await findArticle(articleId, requestedCategory, country, language, event)
    : { article: null, category: requestedCategory };

  return {
    statusCode: article ? 200 : 404,
    headers,
    body: htmlDocument({ article, articleId, category, country, language }),
  };
};
