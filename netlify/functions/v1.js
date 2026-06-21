const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Nuzenio-Key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

const supportedLanguages = [
  { code: 'en', name: 'English', native_name: 'English', direction: 'ltr', region: 'Global' },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', direction: 'ltr', region: 'India' },
  { code: 'es', name: 'Spanish', native_name: 'Español', direction: 'ltr', region: 'Latin America' },
  { code: 'fr', name: 'French', native_name: 'Français', direction: 'ltr', region: 'Europe / Africa' },
  { code: 'de', name: 'German', native_name: 'Deutsch', direction: 'ltr', region: 'Europe' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', direction: 'ltr', region: 'Brazil / Portugal' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', direction: 'rtl', region: 'Middle East' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', direction: 'ltr', region: 'Japan' },
  { code: 'ko', name: 'Korean', native_name: '한국어', direction: 'ltr', region: 'South Korea' },
  { code: 'zh', name: 'Chinese', native_name: '中文', direction: 'ltr', region: 'Greater China' },
  { code: 'bn', name: 'Bengali', native_name: 'বাংলা', direction: 'ltr', region: 'Bangladesh / India' },
  { code: 'ta', name: 'Tamil', native_name: 'தமிழ்', direction: 'ltr', region: 'India / Sri Lanka' },
  { code: 'te', name: 'Telugu', native_name: 'తెలుగు', direction: 'ltr', region: 'India' },
  { code: 'mr', name: 'Marathi', native_name: 'मराठी', direction: 'ltr', region: 'India' },
  { code: 'ur', name: 'Urdu', native_name: 'اردو', direction: 'rtl', region: 'Pakistan / India' },
];

const regionalEditions = [
  { slug: 'india', name: 'India', countries: ['IN'], languages: ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'ur'] },
  { slug: 'usa', name: 'USA', countries: ['US'], languages: ['en', 'es'] },
  { slug: 'uk', name: 'UK', countries: ['GB'], languages: ['en'] },
  { slug: 'canada', name: 'Canada', countries: ['CA'], languages: ['en', 'fr'] },
  { slug: 'australia', name: 'Australia', countries: ['AU'], languages: ['en'] },
  { slug: 'europe', name: 'Europe', countries: ['DE', 'FR', 'ES'], languages: ['en', 'fr', 'de', 'es', 'pt'] },
  { slug: 'middle-east', name: 'Middle East', countries: ['AE'], languages: ['en', 'ar', 'ur'] },
  { slug: 'asia-pacific', name: 'Asia-Pacific', countries: ['JP', 'KR', 'SG', 'AU'], languages: ['en', 'ja', 'ko', 'zh'] },
];

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

async function readRecommendations(url) {
  const limit = limitParam(url, 30, 60);
  const country = escapeLike(url.searchParams.get('country') || 'IN').toUpperCase();
  const categories = escapeLike(url.searchParams.get('categories') || 'top,world,business,tech,ai')
    .split(/\s*,\s*/)
    .filter(Boolean)
    .slice(0, 8);
  const categoryFilter = categories.length ? `category=in.(${categories.map(encodeURIComponent).join(',')})` : '';
  const filters = [
    `select=${articleSelect()}`,
    'order=published_at.desc',
    `limit=${limit}`,
    `country=eq.${encodeURIComponent(country)}`,
  ];
  if (categoryFilter) filters.push(categoryFilter);
  let rows = await supabaseRequest(`news_cache?${filters.join('&')}`);
  if (!rows?.length) rows = await supabaseRequest(`news_cache?select=${articleSelect()}&order=published_at.desc&limit=${limit}`);
  return {
    recommendations: (rows || []).map(rowToArticle),
    reason: 'Matched country and category preferences from the shared Nuzenio account model.',
  };
}

async function readUserCapabilities() {
  return {
    authProviders: ['google', 'apple', 'email'],
    sharedTables: ['user_preferences', 'saved_articles', 'reading_history', 'followed_topics', 'followed_sources', 'followed_entities', 'followed_authors', 'mobile_devices', 'push_subscriptions', 'offline_sync_queue'],
    sync: {
      preferences: true,
      savedArticles: true,
      readingHistory: true,
      follows: true,
      offlineQueue: true,
    },
  };
}

async function readLanguages() {
  return {
    languages: supportedLanguages,
    translationPolicy: {
      summariesOnly: true,
      preserveSourceAttribution: true,
      labelTranslatedContent: true,
      humanReviewWorkflow: true,
      confidenceScore: true,
    },
  };
}

async function readRegionalEditions() {
  return { regionalEditions };
}

async function readInfrastructureStatus() {
  const [jobs, incidents, searches] = await Promise.all([
    supabaseRequest('background_jobs?select=job_type,status,priority,scheduled_at,updated_at&order=scheduled_at.asc&limit=25'),
    supabaseRequest('system_incidents?select=severity,status,title,started_at,resolved_at&order=started_at.desc&limit=10'),
    supabaseRequest('search_queries?select=query,language,country,result_count,trend_score,created_at&order=created_at.desc&limit=25'),
  ]);
  return {
    infrastructure: {
      regions: ['North America', 'Europe', 'Asia', 'Oceania'],
      cacheLayers: ['Netlify edge', 'Supabase news_cache', 'future Redis hot cache'],
      queues: jobs || [],
      incidents: incidents || [],
      searchTelemetry: searches || [],
      targets: {
        uptime: '99.9%',
        cachedApiLatency: '<200ms p95',
        lighthouse: '95+',
      },
    },
  };
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
                  : endpoint === 'recommendations'
                    ? await readRecommendations(url)
                    : endpoint === 'user'
                      ? await readUserCapabilities(url)
                      : endpoint === 'languages'
                        ? await readLanguages(url)
                        : endpoint === 'regional-editions'
                          ? await readRegionalEditions(url)
                          : endpoint === 'infrastructure'
                            ? await readInfrastructureStatus(url)
                          : null;

    if (!data) return json(404, { ok: false, error: 'Unknown API v1 endpoint', endpoints: ['latest', 'categories', 'topics', 'entities', 'search', 'trends', 'graph', 'recommendations', 'user', 'languages', 'regional-editions', 'infrastructure'] });
    await logUsage(event, endpoint, 200);
    return json(200, { ok: true, endpoint, generatedAt: new Date().toISOString(), ...data });
  } catch (error) {
    await logUsage(event, endpoint, 500);
    return json(500, { ok: false, endpoint, error: error.message || 'API v1 failed' }, { 'Cache-Control': 'no-store' });
  }
};
