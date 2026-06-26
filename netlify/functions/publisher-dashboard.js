const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function json(statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

function cleanEmail(value = '') {
  const email = String(value || '').trim().toLowerCase().slice(0, 240);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function cleanUrl(value = '') {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
}

async function supabaseRequest(path, options = {}) {
  const config = supabaseConfig();
  if (!config.enabled) throw new Error('Supabase service role key is required.');
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
    const text = await response.text().catch(() => '');
    throw new Error(text || `Supabase request failed with ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function supabaseCount(path) {
  const config = supabaseConfig();
  if (!config.enabled) throw new Error('Supabase service role key is required.');
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: 'HEAD',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Prefer: 'count=exact',
    },
  });
  if (!response.ok) return 0;
  const range = response.headers.get('content-range') || '';
  const total = Number(range.split('/').pop());
  return Number.isFinite(total) ? total : 0;
}

async function fetchSubmissions(email) {
  const base = `feed_submissions?submitted_by_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=100`;
  const rich = `${base}&select=id,publisher_name,feed_url,category,country,language,status,test_result,created_at,updated_at`;
  try {
    return await supabaseRequest(rich);
  } catch (error) {
    if (!/test_result|column/i.test(error.message || '')) throw error;
    return supabaseRequest(`${base}&select=id,publisher_name,feed_url,category,country,language,status,created_at,updated_at`);
  }
}

async function fetchSourceByUrl(url) {
  const clean = cleanUrl(url);
  if (!clean) return null;
  const rows = await supabaseRequest(`rss_sources?url=eq.${encodeURIComponent(clean)}&select=id,name,url,category,country,language,status,enabled,health_status,last_crawled_at,last_success_at,last_error_at,last_error,articles_crawled_count,duplicate_articles_count,last_article_at,quality_score&limit=1`)
    .catch(async (error) => {
      if (!/status|health_status|last_|articles_crawled|duplicate_articles|quality_score|column/i.test(error.message || '')) throw error;
      return supabaseRequest(`rss_sources?url=eq.${encodeURIComponent(clean)}&select=id,name,url,category,country,language,enabled,priority,created_at,updated_at&limit=1`);
    });
  return rows?.[0] || null;
}

async function countArticlesForSource(source) {
  if (!source?.name) return 0;
  return supabaseCount(`news_cache?source=eq.${encodeURIComponent(source.name)}&select=id`).catch(() => 0);
}

async function buildDashboard(email) {
  const submissions = await fetchSubmissions(email);
  const enriched = await Promise.all((submissions || []).map(async (submission) => {
    const source = await fetchSourceByUrl(submission.feed_url);
    const articleCount = await countArticlesForSource(source);
    return {
      id: submission.id,
      publisherName: submission.publisher_name,
      feedUrl: submission.feed_url,
      category: submission.category || source?.category || 'top',
      country: submission.country || source?.country || 'GLOBAL',
      language: submission.language || source?.language || 'en',
      status: source?.enabled ? 'approved' : submission.status || 'submitted',
      submittedAt: submission.created_at,
      updatedAt: submission.updated_at,
      testResult: submission.test_result || null,
      source: source ? {
        id: source.id,
        name: source.name,
        enabled: source.enabled !== false,
        status: source.status || (source.enabled ? 'approved' : 'disabled'),
        healthStatus: source.health_status || 'unknown',
        lastCrawledAt: source.last_crawled_at || null,
        lastSuccessAt: source.last_success_at || null,
        lastErrorAt: source.last_error_at || null,
        lastError: source.last_error || null,
        lastArticleAt: source.last_article_at || null,
        articlesCrawledCount: source.articles_crawled_count || articleCount,
        duplicateArticlesCount: source.duplicate_articles_count || 0,
        qualityScore: source.quality_score ?? null,
      } : null,
    };
  }));
  return {
    email,
    totalSubmissions: enriched.length,
    approvedSources: enriched.filter((item) => item.status === 'approved').length,
    pendingSources: enriched.filter((item) => ['submitted', 'testing'].includes(item.status)).length,
    rejectedSources: enriched.filter((item) => item.status === 'rejected').length,
    sources: enriched,
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const email = cleanEmail(body.email);
    if (!email) throw new Error('Valid publisher email is required.');
    const dashboard = await buildDashboard(email);
    return json(200, { ok: true, dashboard });
  } catch (error) {
    return json(400, { ok: false, error: error.message || 'Publisher dashboard could not load.' });
  }
};
