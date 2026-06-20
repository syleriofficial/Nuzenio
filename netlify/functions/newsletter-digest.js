import { handler as newsHandler } from './news.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Nuzenio-Cron',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const defaultCategories = ['top', 'local', 'business', 'tech', 'sports'];

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
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
    throw new Error(`Supabase digest request failed with ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function authorized(event) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return true;
  return event.headers['x-nuzenio-cron'] === secret || event.headers['X-Nuzenio-Cron'] === secret;
}

async function fetchDigestArticles({ country, categories }) {
  const batches = await Promise.all(categories.map(async (category) => {
    const response = await newsHandler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: { category, country, language: 'en' },
    });
    const data = JSON.parse(response.body || '{}');
    return data.ok ? (data.articles || []).slice(0, 5) : [];
  }));
  const seen = new Set();
  return batches.flat().filter((article) => {
    if (!article?.id || seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  }).slice(0, 25);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  if (!authorized(event)) return json(403, { ok: false, error: 'Digest secret required' });

  try {
    const body = JSON.parse(event.body || '{}');
    const digestType = body.digestType === 'weekly' ? 'weekly' : 'daily';
    const country = String(body.country || 'IN').toUpperCase();
    const categories = Array.isArray(body.categories) && body.categories.length ? body.categories : defaultCategories;
    const subscribers = await supabaseRequest(`newsletter_subscribers?status=eq.active&frequency=eq.${digestType}&country=eq.${encodeURIComponent(country)}&select=email,categories,unsubscribe_token&limit=200`);
    const articles = await fetchDigestArticles({ country, categories });
    const subject = `Nuzenio ${digestType === 'weekly' ? 'Weekly' : 'Daily'} Brief: ${articles[0]?.title || 'Top headlines'}`;
    const logs = (subscribers || []).map((subscriber) => ({
      digest_type: digestType,
      recipient_email: subscriber.email,
      country,
      categories: subscriber.categories?.length ? subscriber.categories : categories,
      article_ids: articles.map((article) => article.id),
      subject,
      status: process.env.EMAIL_WEBHOOK_URL ? 'generated' : 'skipped',
      message: process.env.EMAIL_WEBHOOK_URL ? 'Ready for email webhook delivery.' : 'EMAIL_WEBHOOK_URL not configured.',
    }));
    if (logs.length) {
      await supabaseRequest('email_digest_logs', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(logs),
      });
    }
    return json(200, {
      ok: true,
      digestType,
      country,
      categories,
      subscriberCount: subscribers?.length || 0,
      articleCount: articles.length,
      subject,
      articles: articles.map((article) => ({ id: article.id, title: article.title, source: article.source, category: article.category })),
    });
  } catch (error) {
    return json(500, { ok: false, error: error.message });
  }
};
