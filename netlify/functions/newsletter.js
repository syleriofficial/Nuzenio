import crypto from 'node:crypto';

const siteUrl = 'https://nuzenio.com';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const digestCategories = ['top', 'local', 'business', 'tech', 'sports'];

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
}

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeCountry(value = 'GLOBAL') {
  const country = String(value || 'GLOBAL').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) || country === 'GLOBAL' ? country : 'GLOBAL';
}

function normalizeFrequency(value = 'daily') {
  return value === 'weekly' ? 'weekly' : 'daily';
}

function normalizeCategories(value) {
  const input = Array.isArray(value) ? value : digestCategories;
  const cleaned = input
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => digestCategories.includes(item));
  return cleaned.length ? [...new Set(cleaned)] : digestCategories;
}

function token() {
  return crypto.randomBytes(24).toString('base64url');
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
    throw new Error(`Supabase newsletter request failed with ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function sendOptInWebhook(payload) {
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL || '';
  if (!webhookUrl) return false;
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.ok;
}

async function subscribe(body) {
  const email = normalizeEmail(body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email address is required');
  if (!body.consent) throw new Error('Newsletter consent is required');

  const optInToken = token();
  const unsubscribeToken = token();
  const frequency = normalizeFrequency(body.frequency);
  const country = normalizeCountry(body.country);
  const categories = normalizeCategories(body.categories);
  const consentText = 'I agree to receive Nuzenio news digest emails and can unsubscribe anytime.';
  const confirmationUrl = `${siteUrl}/api/newsletter?action=confirm&token=${encodeURIComponent(optInToken)}`;
  const unsubscribeUrl = `${siteUrl}/api/newsletter?action=unsubscribe&token=${encodeURIComponent(unsubscribeToken)}`;

  await supabaseRequest('newsletter_subscribers?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{
      email,
      language: 'en',
      status: 'pending',
      frequency,
      country,
      categories,
      consent_text: consentText,
      opt_in_token: optInToken,
      unsubscribe_token: unsubscribeToken,
      unsubscribed_at: null,
      source: body.source || 'site',
    }]),
  });

  const emailQueued = await sendOptInWebhook({
    type: 'newsletter_opt_in',
    email,
    frequency,
    country,
    categories,
    confirmationUrl,
    unsubscribeUrl,
  }).catch(() => false);

  return {
    ok: true,
    status: 'pending',
    emailQueued,
    confirmationUrl,
    message: emailQueued
      ? 'Please confirm your subscription from the email we sent.'
      : 'Double opt-in is ready. Connect EMAIL_WEBHOOK_URL to send confirmation emails automatically.',
  };
}

async function confirm(tokenValue) {
  if (!tokenValue) throw new Error('Missing confirmation token');
  const rows = await supabaseRequest(`newsletter_subscribers?opt_in_token=eq.${encodeURIComponent(tokenValue)}&select=id,email,unsubscribe_token`);
  const subscriber = rows?.[0];
  if (!subscriber) throw new Error('Invalid or expired confirmation token');
  await supabaseRequest(`newsletter_subscribers?id=eq.${subscriber.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'active',
      confirmed_at: new Date().toISOString(),
      opt_in_token: null,
    }),
  });
  return {
    ok: true,
    status: 'active',
    email: subscriber.email,
    unsubscribeUrl: `${siteUrl}/api/newsletter?action=unsubscribe&token=${encodeURIComponent(subscriber.unsubscribe_token)}`,
    message: 'Newsletter subscription confirmed.',
  };
}

async function unsubscribe(tokenValue) {
  if (!tokenValue) throw new Error('Missing unsubscribe token');
  const rows = await supabaseRequest(`newsletter_subscribers?unsubscribe_token=eq.${encodeURIComponent(tokenValue)}&select=id,email`);
  const subscriber = rows?.[0];
  if (!subscriber) throw new Error('Invalid unsubscribe token');
  await supabaseRequest(`newsletter_subscribers?id=eq.${subscriber.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    }),
  });
  return { ok: true, status: 'unsubscribed', email: subscriber.email, message: 'You have been unsubscribed from Nuzenio emails.' };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  try {
    if (event.httpMethod === 'GET') {
      const action = event.queryStringParameters?.action || '';
      if (action === 'confirm') return json(200, await confirm(event.queryStringParameters?.token || ''));
      if (action === 'unsubscribe') return json(200, await unsubscribe(event.queryStringParameters?.token || ''));
      return json(400, { ok: false, error: 'Unsupported newsletter action' });
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: { ...headers, Allow: 'GET, POST, OPTIONS' }, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
    }

    const body = JSON.parse(event.body || '{}');
    return json(200, await subscribe(body));
  } catch (error) {
    return json(400, { ok: false, error: error.message });
  }
};
