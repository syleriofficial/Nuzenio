const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Nuzenio-Key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

const endpointNames = [
  'latest',
  'categories',
  'topics',
  'entities',
  'search',
  'trends',
  'graph',
  'recommendations',
  'user',
  'languages',
  'regional-editions',
  'infrastructure',
  'intelligence',
  'ecosystem',
  'research',
  'marketplace',
  'enterprise',
  'integrations',
];

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

async function optionalSupabaseRequest(path, fallback = []) {
  try {
    return (await supabaseRequest(path)) || fallback;
  } catch (error) {
    return fallback;
  }
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

async function readIntelligenceDashboard(url) {
  const limit = limitParam(url, 30, 100);
  const [trends, snapshots, sentiments, entityMetrics, publisherMetrics, alertRows, articles] = await Promise.all([
    optionalSupabaseRequest('trends?select=trend_id,topic,category,country,momentum_score,status,first_seen_at,last_seen_at&order=momentum_score.desc&limit=25'),
    optionalSupabaseRequest('trend_snapshots?select=trend_id,volume,momentum_score,snapshot_at&order=snapshot_at.desc&limit=100'),
    optionalSupabaseRequest('sentiment_scores?select=article_id,entity_slug,sentiment_label,sentiment_score,confidence,created_at&order=created_at.desc&limit=100'),
    optionalSupabaseRequest('entity_metrics?select=entity_slug,entity_name,entity_type,country,mention_count,momentum_score,sentiment_score,measured_at&order=momentum_score.desc&limit=50'),
    optionalSupabaseRequest('publisher_metrics?select=publisher_slug,publisher_name,country,story_count,average_freshness_minutes,source_diversity_score,measured_at&order=story_count.desc&limit=50'),
    optionalSupabaseRequest('alerts?select=alert_type,enabled&limit=100'),
    optionalSupabaseRequest(`news_cache?select=${articleSelect()}&order=published_at.desc&limit=${limit}`),
  ]);
  const alertSummary = (alertRows || []).reduce((acc, alert) => {
    const type = alert.alert_type || 'keyword';
    acc[type] = (acc[type] || 0) + (alert.enabled === false ? 0 : 1);
    return acc;
  }, {});
  return {
    intelligence: {
      commandCenter: {
        articleVolume: articles?.length || 0,
        trendCount: trends?.length || 0,
        sentimentSignals: sentiments?.length || 0,
        activeAlerts: Object.values(alertSummary).reduce((sum, count) => sum + count, 0),
      },
      trends: trends || [],
      trendSnapshots: snapshots || [],
      sentimentScores: sentiments || [],
      entityMetrics: entityMetrics || [],
      publisherMetrics: publisherMetrics || [],
      alerts: alertSummary,
      latestArticles: (articles || []).map(rowToArticle),
      exports: ['json', 'csv', 'pdf-report'],
    },
  };
}

async function readEcosystem() {
  const [reports, products, publishers, journalists] = await Promise.all([
    optionalSupabaseRequest('research_reports?select=slug,title,topic,report_type,summary,access_level,published_at&status=eq.published&order=published_at.desc&limit=12'),
    optionalSupabaseRequest('marketplace_products?select=slug,title,product_type,description,price_cents,currency,access_level,status,metadata&status=eq.published&order=updated_at.desc&limit=20'),
    optionalSupabaseRequest('publisher_profiles?select=slug,name,country,categories,status&status=eq.active&order=updated_at.desc&limit=20'),
    optionalSupabaseRequest('journalist_profiles?select=slug,full_name,role,publisher_slug,expertise&order=updated_at.desc&limit=20'),
  ]);
  return {
    ecosystem: {
      surfaces: ['publisher-portal', 'journalist-portal', 'research-hub', 'api-marketplace', 'enterprise', 'ai-research-assistant', 'knowledge-graph', 'marketplace', 'integrations', 'brand-infrastructure'],
      reports: reports || [],
      products: products || [],
      publishers: publishers || [],
      journalists: journalists || [],
      submissionEndpoint: '/api/ecosystem',
    },
  };
}

async function readResearchHub() {
  const [reports, queries, timelines] = await Promise.all([
    optionalSupabaseRequest('research_reports?select=slug,title,topic,report_type,summary,access_level,published_at,metadata&status=eq.published&order=published_at.desc&limit=30'),
    optionalSupabaseRequest('ai_research_queries?select=mode,status,created_at&order=created_at.desc&limit=50'),
    optionalSupabaseRequest('story_timelines?select=cluster_id,event_time,event_type,title,source&order=event_time.desc&limit=30'),
  ]);
  return {
    research: {
      reports: reports || [],
      recentQueryModes: queries || [],
      timelines: timelines || [],
      downloads: ['csv', 'json', 'pdf-report'],
    },
  };
}

async function readMarketplace() {
  const products = await optionalSupabaseRequest('marketplace_products?select=slug,title,product_type,description,price_cents,currency,access_level,status,metadata&status=eq.published&order=updated_at.desc&limit=50');
  return {
    marketplace: products || [],
    disclosure: 'Marketplace products require approval, clear commercial labels, and no misleading ad placement.',
  };
}

async function readEnterprise() {
  const [accounts, integrations, reports] = await Promise.all([
    optionalSupabaseRequest('enterprise_accounts?select=plan,status,seats,created_at&order=created_at.desc&limit=50'),
    optionalSupabaseRequest('integration_connections?select=integration_type,status,last_delivery_at,created_at&order=created_at.desc&limit=50'),
    optionalSupabaseRequest('saved_reports?select=report_type,shared,created_at&order=created_at.desc&limit=50'),
  ]);
  return {
    enterprise: {
      accountSignals: accounts || [],
      integrations: integrations || [],
      savedReports: reports || [],
      features: ['custom feeds', 'organization dashboards', 'custom alerts', 'team collaboration', 'exports'],
    },
  };
}

async function readIntegrations() {
  const rows = await optionalSupabaseRequest('integration_connections?select=integration_type,name,status,last_delivery_at,metadata,created_at&order=created_at.desc&limit=50');
  return {
    integrations: rows || [],
    supported: ['slack', 'teams', 'email', 'webhook', 'crm'],
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
    const handlers = {
      latest: readLatest,
      categories: readCategories,
      topics: readTopics,
      entities: readEntities,
      search: readSearch,
      trends: readTrends,
      graph: readGraph,
      recommendations: readRecommendations,
      user: readUserCapabilities,
      languages: readLanguages,
      'regional-editions': readRegionalEditions,
      infrastructure: readInfrastructureStatus,
      intelligence: readIntelligenceDashboard,
      ecosystem: readEcosystem,
      research: readResearchHub,
      marketplace: readMarketplace,
      enterprise: readEnterprise,
      integrations: readIntegrations,
    };
    const readEndpoint = handlers[endpoint];
    if (!readEndpoint) return json(404, { ok: false, error: 'Unknown API v1 endpoint', endpoints: endpointNames });
    const data = await readEndpoint(url);
    await logUsage(event, endpoint, 200);
    return json(200, { ok: true, endpoint, generatedAt: new Date().toISOString(), ...data });
  } catch (error) {
    await logUsage(event, endpoint, 500);
    return json(500, { ok: false, endpoint, error: error.message || 'API v1 failed' }, { 'Cache-Control': 'no-store' });
  }
};
