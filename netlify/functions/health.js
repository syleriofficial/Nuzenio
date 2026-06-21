const startedAt = Date.now();

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
}

async function supabaseRequest(path, timeoutMs = 3500) {
  const config = supabaseConfig();
  if (!config.enabled) return { ok: false, skipped: true, reason: 'Supabase service role not configured' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    return { ok: response.ok, status: response.status, latencyMs };
  } catch (error) {
    return { ok: false, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const [cache, languages, apiUsage] = await Promise.all([
    supabaseRequest('news_cache?select=id&limit=1'),
    supabaseRequest('languages?select=code&limit=1'),
    supabaseRequest('api_usage_logs?select=id&limit=1'),
  ]);

  const components = {
    api: { ok: true, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) },
    supabaseNewsCache: cache,
    supabaseLanguages: languages,
    supabaseApiUsage: apiUsage,
    edgeCache: { ok: true, strategy: 'Netlify CDN + function cache headers' },
  };
  const ok = Object.values(components).every((component) => component.ok || component.skipped);
  return json(ok ? 200 : 503, {
    ok,
    service: 'nuzenio',
    version: process.env.COMMIT_REF || process.env.DEPLOY_ID || 'local',
    generatedAt: new Date().toISOString(),
    targets: {
      uptime: '99.9%',
      apiLatency: '<200ms p95 for cached reads',
      lighthouse: '95+',
    },
    components,
  });
};
