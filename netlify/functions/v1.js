const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Nuzenio-Key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
}

async function supabaseRequest(path, options = {}) {
  const config = supabaseConfig();
  if (!config.enabled) return null;
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
    throw new Error(`Supabase API failed with ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(payload),
  };
}

function limitParam(url, fallback = 30, max = 100) {
  const value = Number(url.searchParams.get('limit') || fallback);
  return Math.min(Math.max(Number.isFinite(value) ? value : fallback, 1), max);
}

function escapeLike(value = '') {
  return String(value).replace(/[%*,]/g, ' ').trim();
}

function articleSelect() {
  return 'article_id,title,link,source,summary,image,image_kind,category,country,published_at,updated_at,payload';
}

function rowToArticle(row) {
  return {
    id: row.article_id,
    title: row.title,
    link: row.link,
    source: row.source,
    summary: row.summary,
    image: row.image,
    imageKind: row.image_kind,
    category: row.category,
    country: row.country,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    slug: row.payload?.slug,
  };
}

async function readLatest(url) {
  const limit = limitParam(url, 30, 100);
  const category = escapeLike(url.searchParams.get('category') || '');
  const country = escapeLike(url.searchParams.get('country') || '');
  const filters = [
    `select=${articleSelect()}`,
    'order=published_at.desc',
    `limit=${limit}`,
  ];
  if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
  if (country) filters.push(`country=eq.${encodeURIComponent(country.toUpperCase())}`);
  const rows = await supabaseRequest(`news_cache?${filters.join('&')}`);
  return { articles: (rows || []).map(rowToArticle), total: rows?.length || 0 };
}

async function readSearch(url) {
  const limit = limitParam(url, 30, 100);
  const query = escapeLike(url.searchParams.get('q') || url.searchParams.get('query') || '');
  const country = escapeLike(url.searchParams.get('country') || '');
  const publisher = escapeLike(url.searchParams.get('publisher') || '');
  const from = escapeLike(url.searchParams.get('from') || '');
  const to = escapeLike(url.searchParams.get('to') || '');
  const filters = [
    `select=${articleSelect()}`,
    'order=published_at.desc',
    `limit=${limit}`,
  ];
  if (query) filters.push(`or=(title.ilike.*${encodeURIComponent(query)}*,summary.ilike.*${encodeURIComponent(query)}*,source.ilike.*${encodeURIComponent(query)}*)`);
  if (country) filters.push(`country=eq.${encodeURIComponent(country.toUpperCase())}`);
  if (publisher) filters.push(`source=ilike.*${encodeURIComponent(publisher)}*`);
  if (from) filters.push(`published_at=gte.${encodeURIComponent(from)}`);
  if (to) filters.push(`published_at=lte.${encodeURIComponent(to)}`);
  const rows = await supabaseRequest(`news_cache?${filters.join('&')}`);
  return { articles: (rows || []).map(rowToArticle), total: rows?.length || 0 };
}

async function readCategories() {
  const rows = await supabaseRequest('news_cache?select=category&limit=1000');
  const counts = (rows || []).reduce((acc, row) => {
    const key = row.category || 'top';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return { categories: Object.entries(counts).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count) };
}

async function readTopics() {
  const rows = await supabaseRequest('story_clusters?select=topic,cluster_size,updated_at&order=updated_at.desc&limit=100');
  return { topics: rows || [] };
}

async function readEntities(url) {
  const limit = limitParam(url, 50, 100);
  const type = escapeLike(url.searchParams.get('type') || '');
  const filters = [
    'select=slug,name,entity_type,country,description,confidence,updated_at',
    'order=updated_at.desc',
    `limit=${limit}`,
  ];
  if (type) filters.push(`entity_type=eq.${encodeURIComponent(type)}`);
  const rows = await supabaseRequest(`entities?${filters.join('&')}`);
  return { entities: rows || [] };
}

async function readTrends() {
  const rows = await supabaseRequest('story_clusters?select=cluster_id,title,topic,country,cluster_size,trending_score,updated_at&order=trending_score.desc&limit=30');
  return { trends: rows || [] };
}

async function readGraph(url) {
  const entity = escapeLike(url.searchParams.get('entity') || '');
  const filters = [
    'select=source_entity_slug,relationship_type,target_entity_slug,confidence,updated_at',
    'order=updated_at.desc',
    'limit=100',
  ];
  if (entity) filters.push(`or=(source_entity_slug.eq.${encodeURIComponent(entity)},target_entity_slug.eq.${encodeURIComponent(entity)})`);
  const rows = await supabaseRequest(`entity_relationships?${filters.join('&')}`);
  return { relationships: rows || [] };
}

async function logUsage(event, endpoint, statusCode) {
  const key = event.headers['x-nuzenio-key'] || event.headers['X-Nuzenio-Key'] || '';
  if (!key) return;
  await supabaseRequest('api_usage_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      api_key_prefix: String(key).slice(0, 12),
      endpoint,
      method: event.httpMethod,
      status_code: statusCode,
      metadata: { user_agent: event.headers['user-agent'] || '' },
    }),
  }).catch(() => {});
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const config = supabaseConfig();
  if (!config.enabled) {
    return json(503, {
      ok: false,
      error: 'Supabase service role key is required for Nuzenio API v1.',
      docs: '/data-platform',
    });
  }

  const url = new URL(event.rawUrl || `https://nuzenio.com${event.path}?${event.rawQuery || ''}`);
  const endpoint = (url.searchParams.get('endpoint') || url.pathname.replace(/^\/api\/v1\/?/, '') || 'latest').replace(/^\/+/, '') || 'latest';

  try {
    const data = endpoint === 'latest'
      ? await readLatest(url)
      : endpoint === 'categories'
        ? await readCategories(url)
        : endpoint === 'topics'
          ? await readTopics(url)
          : endpoint === 'entities'
            ? await readEntities(url)
            : endpoint === 'search'
              ? await readSearch(url)
              : endpoint === 'trends'
                ? await readTrends(url)
                : endpoint === 'graph'
                  ? await readGraph(url)
                  : null;

    if (!data) return json(404, { ok: false, error: 'Unknown API v1 endpoint', endpoints: ['latest', 'categories', 'topics', 'entities', 'search', 'trends', 'graph'] });
    await logUsage(event, endpoint, 200);
    return json(200, { ok: true, endpoint, generatedAt: new Date().toISOString(), ...data });
  } catch (error) {
    await logUsage(event, endpoint, 500);
    return json(500, { ok: false, endpoint, error: error.message || 'API v1 failed' }, { 'Cache-Control': 'no-store' });
  }
};
