import crypto from 'node:crypto';

const crawlerId = `nuzenio-crawler-${Math.random().toString(36).slice(2, 8)}`;
const maxSourcesPerRun = Number(process.env.RSS_CRAWLER_SOURCE_LIMIT || 8);
const maxItemsPerSource = Number(process.env.RSS_CRAWLER_ITEM_LIMIT || 40);
const crawlTimeoutMs = Number(process.env.RSS_CRAWLER_TIMEOUT_MS || 12000);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Nuzenio-Cron',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export const config = {
  schedule: '*/15 * * * *',
};

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
}

async function authorized(event) {
  const secret = process.env.CRON_SECRET || '';
  if (secret && (event.headers['x-nuzenio-cron'] === secret || event.headers['X-Nuzenio-Cron'] === secret)) return true;
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (token) return adminAuthorized(token).catch(() => false);
  return !secret;
}

async function supabaseRequest(path, options = {}) {
  const config = supabaseConfig();
  if (!config.enabled) throw new Error('Supabase service role is not configured');
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase crawler request failed with ${response.status}${body ? `: ${body.slice(0, 220)}` : ''}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function adminAuthorized(token) {
  const config = supabaseConfig();
  if (!config.enabled) return false;
  const userResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!userResponse.ok) return false;
  const user = await userResponse.json();
  const rows = await supabaseRequest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role&limit=1`);
  return rows?.[0]?.role === 'admin';
}

function clean(value = '', limit = 500) {
  return decodeHtml(String(value || '')
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim())
    .slice(0, limit);
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, ' ')
    .replace(/&nbsp;/g, ' ');
}

function first(xml = '', tag = '') {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? clean(match[1], 1200) : '';
}

function tagAttribute(xml = '', tag = '', attr = '') {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? clean(match[1], 800) : '';
}

function safeUrl(value = '', base = '') {
  try {
    const url = new URL(String(value || '').trim(), base || undefined);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeCategory(value = 'top') {
  const cleanValue = String(value || 'top').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const aliases = { technology: 'tech', general: 'top', headlines: 'top' };
  const allowed = new Set(['top', 'local', 'world', 'business', 'tech', 'ai', 'sports', 'entertainment', 'health', 'science']);
  return allowed.has(cleanValue) ? cleanValue : aliases[cleanValue] || 'top';
}

function normalizeCountry(value = 'GLOBAL') {
  const country = String(value || 'GLOBAL').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) || country === 'GLOBAL' ? country : 'GLOBAL';
}

function normalizeLanguage(value = 'en') {
  return String(value || 'en').trim().toLowerCase().split('-')[0].replace(/[^a-z]/g, '').slice(0, 8) || 'en';
}

function sourceSelect() {
  return [
    'id,name,url,category,country,language,priority,enabled,status,health_status,last_crawled_at,last_success_at,last_error_at,last_error,consecutive_failures,crawl_interval_minutes',
  ].join('');
}

function minimalSourceSelect() {
  return 'id,name,url,category,country,language,priority,enabled';
}

function dueSource(source) {
  if (!source.enabled) return false;
  if (['rejected', 'disabled'].includes(source.status)) return false;
  const intervalMs = Math.max(5, Number(source.crawl_interval_minutes || 15)) * 60 * 1000;
  const last = new Date(source.last_crawled_at || 0).getTime();
  return !last || Date.now() - last >= intervalMs;
}

async function getDueSources(limit = maxSourcesPerRun) {
  let rows;
  try {
    rows = await supabaseRequest([
      `rss_sources?select=${sourceSelect()}`,
      'enabled=eq.true',
      'order=priority.desc',
      `limit=${Math.max(1, limit * 3)}`,
    ].join('&'));
  } catch (error) {
    if (!/column .* does not exist|42703/i.test(error.message)) throw error;
    rows = await supabaseRequest([
      `rss_sources?select=${minimalSourceSelect()}`,
      'enabled=eq.true',
      'order=priority.desc',
      `limit=${Math.max(1, limit * 3)}`,
    ].join('&'));
  }
  return (rows || []).filter(dueSource).slice(0, limit);
}

async function existingQueuedSourceIds() {
  const rows = await supabaseRequest([
    'background_jobs?select=id,payload',
    'job_type=eq.rss_ingestion',
    'status=in.(queued,running)',
    'order=scheduled_at.asc',
    'limit=100',
  ].join('&')).catch(() => []);
  return new Set((rows || []).map((job) => job.payload?.sourceId).filter(Boolean));
}

async function enqueueDueSources({ limit = maxSourcesPerRun } = {}) {
  const due = await getDueSources(limit);
  const queuedIds = await existingQueuedSourceIds();
  const jobs = due
    .filter((source) => !queuedIds.has(source.id))
    .map((source) => ({
      job_type: 'rss_ingestion',
      status: 'queued',
      priority: Math.max(1, 100 - Number(source.priority || 0)),
      region: normalizeCountry(source.country),
      payload: {
        sourceId: source.id,
        name: source.name,
        url: source.url,
        category: normalizeCategory(source.category),
        country: normalizeCountry(source.country),
        language: normalizeLanguage(source.language),
      },
      scheduled_at: new Date().toISOString(),
      max_attempts: 3,
    }));
  if (jobs.length) {
    await supabaseRequest('background_jobs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(jobs),
    });
  }
  return { dueCount: due.length, enqueuedCount: jobs.length, skippedCount: due.length - jobs.length };
}

async function claimJobs(limit = maxSourcesPerRun) {
  const now = new Date().toISOString();
  const jobs = await supabaseRequest([
    'background_jobs?select=id,attempts,max_attempts,payload,priority,scheduled_at',
    'job_type=eq.rss_ingestion',
    'status=eq.queued',
    `scheduled_at=lte.${encodeURIComponent(now)}`,
    'order=priority.asc',
    `limit=${Math.max(1, limit)}`,
  ].join('&'));

  const claimed = [];
  for (const job of jobs || []) {
    if (Number(job.attempts || 0) >= Number(job.max_attempts || 3)) {
      await updateJob(job.id, {
        status: 'failed',
        finished_at: now,
        last_error: 'Maximum crawl attempts reached before claim.',
      }).catch(() => {});
      continue;
    }
    await updateJob(job.id, {
      status: 'running',
      attempts: Number(job.attempts || 0) + 1,
      locked_at: now,
      locked_by: crawlerId,
      started_at: now,
    });
    claimed.push({ ...job, attempts: Number(job.attempts || 0) + 1 });
  }
  return claimed;
}

function updateJob(id, patch) {
  return supabaseRequest(`background_jobs?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

async function getSource(id) {
  let rows;
  try {
    rows = await supabaseRequest(`rss_sources?id=eq.${encodeURIComponent(id)}&select=${sourceSelect()}&limit=1`);
  } catch (error) {
    if (!/column .* does not exist|42703/i.test(error.message)) throw error;
    rows = await supabaseRequest(`rss_sources?id=eq.${encodeURIComponent(id)}&select=${minimalSourceSelect()}&limit=1`);
  }
  return rows?.[0] || null;
}

async function fetchFeed(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), crawlTimeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        'User-Agent': 'NuzenioCrawler/1.0 (+https://nuzenio.com/submit-source.html)',
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
    if (!/<(rss|feed|channel|item|entry)\b/i.test(text)) throw new Error('Response does not look like RSS or Atom XML');
    return { xml: text, httpStatus: response.status, durationMs: Date.now() - startedAt };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Feed crawl timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractItems(xml = '') {
  return [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
  ];
}

function extractImage(item = '') {
  const mediaContent = item.match(/<media:content\b[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/i);
  const mediaThumb = item.match(/<media:thumbnail\b[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/i);
  const enclosure = item.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*(?:type=["']image\/[^"']+["'])?[^>]*>/i);
  const htmlImage = item.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
  return safeUrl(mediaContent?.[1] || mediaThumb?.[1] || enclosure?.[1] || htmlImage?.[1] || '');
}

function hostname(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function sourceLogoUrl(link = '') {
  const host = hostname(link);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256` : '';
}

function slugify(value = '') {
  return clean(value, 180)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'news-story';
}

function articleHash({ title, link, source }) {
  const canonical = normalizeArticleKey(link) || normalizeTitleKey(title);
  return crypto.createHash('sha256').update(`${source || ''}|${canonical}`).digest('hex').slice(0, 32);
}

function normalizeArticleKey(value = '') {
  try {
    const url = new URL(value);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach((key) => url.searchParams.delete(key));
    url.hash = '';
    return `${url.hostname.replace(/^www\./, '')}${url.pathname}${url.search}`.toLowerCase().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function normalizeTitleKey(value = '') {
  return clean(value, 240).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseFeed(xml, source) {
  const items = extractItems(xml).slice(0, maxItemsPerSource);
  const categoryFallback = normalizeCategory(source.category);
  const country = normalizeCountry(source.country);
  const language = normalizeLanguage(source.language);
  const fetchedAt = new Date().toISOString();
  return items
    .map((item) => {
      const title = first(item, 'title');
      const rawLink = first(item, 'link') || tagAttribute(item, 'link', 'href') || first(item, 'guid') || first(item, 'id');
      const link = safeUrl(rawLink, source.url);
      const description = first(item, 'description') || first(item, 'summary') || first(item, 'content') || title;
      const pubDate = first(item, 'pubDate') || first(item, 'published') || first(item, 'updated') || first(item, 'dc:date') || fetchedAt;
      const itemCategory = detectCategory(`${title} ${description} ${first(item, 'category')}`, categoryFallback);
      const sourceName = clean(first(item, 'source') || source.name || hostname(link) || 'Publisher', 120);
      const image = extractImage(item);
      if (!title || !link) return null;
      const summary = safeSummary(description || title);
      const tags = detectTags(`${title} ${summary}`);
      return {
        article_id: articleHash({ title, link, source: sourceName }),
        title: clean(title, 260),
        link,
        source: sourceName,
        summary,
        image: image || sourceLogoUrl(link),
        image_kind: image ? 'photo' : 'logo',
        category: itemCategory,
        country,
        published_at: safeDate(pubDate),
        payload: {
          slug: slugify(title),
          language,
          detectedLanguage: detectLanguage(`${title} ${summary}`, language),
          tags,
          aiSummary: aiSafeSummary(title, summary, sourceName),
          aiTagging: {
            method: 'source-text-heuristic',
            categories: [itemCategory],
            tags,
            copyrightSafe: true,
          },
          sourceUrl: `https://${hostname(link)}`,
          rssSourceId: source.id,
          rssSourceName: source.name,
          rssSourceUrl: source.url,
          fetchedAt,
          trustScore: qualityScore({ source, item: { title, link, summary, image } }),
          sourceLabels: sourceLabels(source),
        },
      };
    })
    .filter(Boolean);
}

function safeSummary(value = '') {
  const text = clean(value, 520);
  if (text.length <= 260) return text;
  return `${text.slice(0, 257).trim()}...`;
}

function safeDate(value = '') {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString();
}

function detectLanguage(text = '', fallback = 'en') {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa';
  return normalizeLanguage(fallback);
}

function detectCategory(text = '', fallback = 'top') {
  const value = String(text || '').toLowerCase();
  const rules = [
    ['ai', /\b(ai|artificial intelligence|openai|chatgpt|llm|machine learning|nvidia)\b/],
    ['business', /\b(markets?|stocks?|economy|business|company|earnings|inflation|bank|crypto)\b/],
    ['tech', /\b(technology|software|startup|app|iphone|android|chip|cyber|data)\b/],
    ['sports', /\b(sports?|cricket|football|soccer|tennis|nba|olympics|match|league)\b/],
    ['health', /\b(health|medical|medicine|hospital|disease|doctor|vaccine|wellness)\b/],
    ['science', /\b(science|space|nasa|research|climate|study|discovery|moon|mars)\b/],
    ['entertainment', /\b(film|movie|music|celebrity|entertainment|box office|tv)\b/],
    ['world', /\b(world|global|international|war|diplomacy|united nations|election)\b/],
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] || normalizeCategory(fallback);
}

function detectTags(text = '') {
  const value = String(text || '').toLowerCase();
  const tags = [];
  const candidates = [
    ['breaking', /\b(breaking|urgent|developing|live update)\b/],
    ['markets', /\b(stock|market|shares|nasdaq|sensex|nifty|dow|earnings)\b/],
    ['policy', /\b(policy|government|court|law|minister|parliament|congress)\b/],
    ['ai', /\b(ai|artificial intelligence|openai|llm|chatgpt)\b/],
    ['climate', /\b(climate|weather|storm|heat|flood|emissions)\b/],
    ['health', /\b(health|hospital|doctor|medical|disease)\b/],
  ];
  candidates.forEach(([tag, pattern]) => {
    if (pattern.test(value)) tags.push(tag);
  });
  return [...new Set(tags)].slice(0, 8);
}

function aiSafeSummary(title, summary, source) {
  const base = summary || title;
  return {
    disclosure: 'Generated only from RSS title, RSS description, source name, and timestamps. No additional facts are invented.',
    threeLineSummary: [
      safeSummary(title),
      safeSummary(base),
      `Source attribution remains with ${source || 'the original publisher'}.`,
    ].filter(Boolean).slice(0, 3),
    whyItMatters: `This story may matter to readers because it is newly reported by ${source || 'a publisher'} and is part of Nuzenio's live source monitoring.`,
  };
}

function sourceLabels(source = {}) {
  const labels = ['Verified source'];
  const text = `${source.name || ''} ${source.url || ''}`.toLowerCase();
  if (/\b(gov|official|ministry|department|who|un)\b|\.gov\b/.test(text)) labels.push('Official source');
  if (normalizeCategory(source.category) === 'local') labels.push('Local source');
  return labels;
}

function qualityScore({ source, item }) {
  let score = 60;
  if (source.status === 'approved') score += 12;
  if (source.enabled) score += 8;
  if (item.image) score += 6;
  if (item.summary && item.summary.length > 60) score += 6;
  if (safeDate(item.published_at || new Date()).startsWith(new Date().toISOString().slice(0, 10))) score += 4;
  if (/\.gov\b|official/i.test(`${source.url} ${source.name}`)) score += 6;
  return Math.max(0, Math.min(100, score));
}

function dedupeArticles(articles = []) {
  const seen = new Set();
  const output = [];
  let duplicateCount = 0;
  for (const article of articles) {
    const keys = [article.article_id, normalizeArticleKey(article.link), normalizeTitleKey(article.title)].filter(Boolean);
    if (keys.some((key) => seen.has(key))) {
      duplicateCount += 1;
      continue;
    }
    keys.forEach((key) => seen.add(key));
    output.push(article);
  }
  return { articles: output, duplicateCount };
}

async function existingArticleIds(articleIds = []) {
  const ids = articleIds.filter(Boolean).slice(0, 80);
  if (!ids.length) return new Set();
  const rows = await supabaseRequest(`news_cache?select=article_id&article_id=in.(${ids.join(',')})&limit=100`).catch(() => []);
  return new Set((rows || []).map((row) => row.article_id));
}

async function upsertArticles(articles = []) {
  if (!articles.length) return { insertedCount: 0, existingCount: 0 };
  const existing = await existingArticleIds(articles.map((article) => article.article_id));
  const rows = articles.map((article) => ({
    ...article,
    payload: {
      ...article.payload,
      alreadySeenBeforeCrawl: existing.has(article.article_id),
    },
  }));
  await supabaseRequest('news_cache?on_conflict=article_id,category,country', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  return {
    insertedCount: rows.filter((row) => !existing.has(row.article_id)).length,
    existingCount: rows.filter((row) => existing.has(row.article_id)).length,
  };
}

async function insertCrawlLog(payload) {
  return supabaseRequest('rss_crawl_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  }).catch(() => null);
}

async function updateSourceHealth(source, patch) {
  return supabaseRequest(`rss_sources?id=eq.${encodeURIComponent(source.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      ...patch,
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => null);
}

async function crawlSource(source, job = {}) {
  const startedAt = Date.now();
  const logBase = {
    source_id: source.id,
    job_id: job.id || null,
    feed_url: source.url,
    status: 'started',
    metadata: { crawlerId, sourceName: source.name },
  };
  await insertCrawlLog(logBase);

  try {
    const { xml, httpStatus, durationMs } = await fetchFeed(source.url);
    const parsed = parseFeed(xml, source);
    const { articles, duplicateCount: batchDuplicates } = dedupeArticles(parsed);
    const { insertedCount, existingCount } = await upsertArticles(articles);
    const newest = articles.reduce((latest, article) => Math.max(latest, new Date(article.published_at).getTime() || 0), 0);
    const duplicateCount = batchDuplicates + existingCount;
    const healthStatus = articles.length ? (duplicateCount > articles.length * 0.8 ? 'degraded' : 'healthy') : 'degraded';
    const failures = healthStatus === 'healthy' ? 0 : Math.max(0, Number(source.consecutive_failures || 0));

    await updateSourceHealth(source, {
      status: source.status === 'pending' ? 'approved' : source.status,
      health_status: healthStatus,
      last_crawled_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      consecutive_failures: failures,
      articles_crawled_count: Number(source.articles_crawled_count || 0) + insertedCount,
      duplicate_articles_count: Number(source.duplicate_articles_count || 0) + duplicateCount,
      last_article_at: newest ? new Date(newest).toISOString() : null,
      quality_score: Math.max(40, Math.min(100, 70 + Math.min(20, insertedCount) - Math.min(25, duplicateCount))),
      crawl_metadata: {
        lastItemCount: parsed.length,
        lastInsertedCount: insertedCount,
        lastDuplicateCount: duplicateCount,
        lastDurationMs: durationMs,
        lastHttpStatus: httpStatus,
      },
    });

    await insertCrawlLog({
      ...logBase,
      status: 'completed',
      http_status: httpStatus,
      duration_ms: Date.now() - startedAt,
      item_count: parsed.length,
      inserted_count: insertedCount,
      duplicate_count: duplicateCount,
      metadata: { crawlerId, healthStatus, sourceName: source.name },
    });

    return {
      ok: true,
      sourceId: source.id,
      sourceName: source.name,
      itemCount: parsed.length,
      insertedCount,
      duplicateCount,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const failures = Number(source.consecutive_failures || 0) + 1;
    await updateSourceHealth(source, {
      health_status: failures >= 3 ? 'failing' : 'degraded',
      last_crawled_at: new Date().toISOString(),
      last_error_at: new Date().toISOString(),
      last_error: error.message,
      consecutive_failures: failures,
      crawl_metadata: {
        lastDurationMs: Date.now() - startedAt,
        lastFailure: error.message,
      },
    });
    await insertCrawlLog({
      ...logBase,
      status: 'failed',
      duration_ms: Date.now() - startedAt,
      error_message: error.message,
    });
    throw error;
  }
}

async function processQueue({ limit = maxSourcesPerRun } = {}) {
  const jobs = await claimJobs(limit);
  const results = [];
  for (const job of jobs) {
    const sourceId = job.payload?.sourceId;
    try {
      const source = sourceId ? await getSource(sourceId) : null;
      if (!source) throw new Error(`RSS source not found for job ${job.id}`);
      const result = await crawlSource(source, job);
      await updateJob(job.id, {
        status: 'completed',
        finished_at: new Date().toISOString(),
        last_error: null,
      });
      results.push({ jobId: job.id, ...result });
    } catch (error) {
      const retry = Number(job.attempts || 1) < Number(job.max_attempts || 3);
      await updateJob(job.id, {
        status: retry ? 'queued' : 'failed',
        scheduled_at: new Date(Date.now() + Math.min(60, 5 * Number(job.attempts || 1)) * 60 * 1000).toISOString(),
        finished_at: retry ? null : new Date().toISOString(),
        last_error: error.message,
      }).catch(() => {});
      results.push({ ok: false, jobId: job.id, sourceId, retry, error: error.message });
    }
  }
  return { claimedCount: jobs.length, results };
}

async function crawlSingleSource(sourceId) {
  const source = await getSource(sourceId);
  if (!source) throw new Error('RSS source not found');
  return crawlSource(source, { id: null });
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok: false, error: 'Method not allowed' });
  if (!(await authorized(event))) return json(403, { ok: false, error: 'Crawler secret or admin session required' });

  try {
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const action = body.action || event.queryStringParameters?.action || 'run';
    const limit = Math.max(1, Math.min(25, Number(body.limit || event.queryStringParameters?.limit || maxSourcesPerRun)));

    if (action === 'enqueue') {
      const enqueue = await enqueueDueSources({ limit });
      return json(200, { ok: true, action, ...enqueue, generatedAt: new Date().toISOString() });
    }

    if (action === 'source') {
      const sourceId = body.sourceId || event.queryStringParameters?.sourceId;
      if (!sourceId) throw new Error('sourceId is required');
      const result = await crawlSingleSource(sourceId);
      return json(200, { ok: true, action, result, generatedAt: new Date().toISOString() });
    }

    const enqueue = await enqueueDueSources({ limit });
    const queue = await processQueue({ limit });
    return json(200, {
      ok: true,
      action: 'run',
      crawlerId,
      enqueue,
      queue,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json(500, { ok: false, error: error.message, generatedAt: new Date().toISOString() });
  }
};
