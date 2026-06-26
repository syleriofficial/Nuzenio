import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';

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

function cleanText(value = '', limit = 300) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanEmail(value = '') {
  const email = cleanText(value, 240).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function cleanUrl(value = '') {
  const input = cleanText(value, 600);
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function hostnameFromUrl(value = '') {
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function slugify(value = '') {
  return cleanText(value, 120)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'publisher';
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

async function findPublisher({ email, websiteUrl }) {
  const domain = hostnameFromUrl(websiteUrl);
  const rows = await supabaseRequest(`publisher_accounts?contact_email=eq.${encodeURIComponent(email)}&select=id,publisher_name,contact_email,website_url,country,verification_status,verification_notes,metadata,created_at,updated_at&order=updated_at.desc&limit=20`);
  return (rows || []).find((row) => hostnameFromUrl(row.website_url || '') === domain) || rows?.[0] || null;
}

async function createPublisher({ publisherName, email, websiteUrl, country, token, domain }) {
  const payload = {
    publisher_slug: slugify(publisherName || domain),
    publisher_name: publisherName || domain,
    contact_email: email,
    website_url: websiteUrl,
    country: cleanText(country || 'GLOBAL', 20).toUpperCase(),
    verification_status: 'reviewing',
    verification_notes: `Add DNS TXT record: nuzenio-verify=${token}`,
    metadata: {
      verification_method: 'dns_txt',
      verification_domain: domain,
      verification_token: token,
      verification_record: `nuzenio-verify=${token}`,
      verification_requested_at: new Date().toISOString(),
    },
  };
  const rows = await supabaseRequest('publisher_accounts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

async function updatePublisher(id, patch) {
  const rows = await supabaseRequest(`publisher_accounts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  return rows?.[0] || null;
}

async function txtRecordFound(domain, expected) {
  const records = await resolveTxt(domain).catch(() => []);
  const flattened = records.map((parts) => parts.join('')).map((value) => value.trim());
  return flattened.includes(expected);
}

async function startVerification(body) {
  const email = cleanEmail(body.email || body.contact_email);
  const publisherName = cleanText(body.publisher_name || body.name, 180);
  const websiteUrl = cleanUrl(body.website_url || body.domain || body.url);
  const domain = hostnameFromUrl(websiteUrl);
  if (!email || !websiteUrl || !domain) throw new Error('Valid email and publisher website are required.');
  const existing = await findPublisher({ email, websiteUrl });
  const token = existing?.metadata?.verification_token || randomBytes(16).toString('hex');
  const record = `nuzenio-verify=${token}`;
  const metadata = {
    ...(existing?.metadata || {}),
    verification_method: 'dns_txt',
    verification_domain: domain,
    verification_token: token,
    verification_record: record,
    verification_requested_at: existing?.metadata?.verification_requested_at || new Date().toISOString(),
  };
  const publisher = existing
    ? await updatePublisher(existing.id, {
      publisher_name: publisherName || existing.publisher_name,
      website_url: websiteUrl,
      verification_status: existing.verification_status === 'verified' ? 'verified' : 'reviewing',
      verification_notes: `Add DNS TXT record: ${record}`,
      metadata,
    })
    : await createPublisher({ publisherName, email, websiteUrl, country: body.country, token, domain });
  return {
    publisherId: publisher?.id || existing?.id || null,
    publisherName: publisher?.publisher_name || publisherName || domain,
    domain,
    status: publisher?.verification_status || 'reviewing',
    txtName: domain,
    txtValue: record,
    instructions: `Add a DNS TXT record on ${domain} with value ${record}, then click Check verification.`,
  };
}

async function checkVerification(body) {
  const email = cleanEmail(body.email || body.contact_email);
  const websiteUrl = cleanUrl(body.website_url || body.domain || body.url);
  if (!email || !websiteUrl) throw new Error('Valid email and publisher website are required.');
  const publisher = await findPublisher({ email, websiteUrl });
  if (!publisher) throw new Error('No verification request found for this email and website.');
  const domain = publisher.metadata?.verification_domain || hostnameFromUrl(publisher.website_url || websiteUrl);
  const record = publisher.metadata?.verification_record || `nuzenio-verify=${publisher.metadata?.verification_token || ''}`;
  if (!domain || !publisher.metadata?.verification_token) throw new Error('Verification token is missing. Start verification again.');
  const verified = await txtRecordFound(domain, record);
  const metadata = {
    ...(publisher.metadata || {}),
    verification_checked_at: new Date().toISOString(),
    verification_last_result: verified ? 'verified' : 'not_found',
  };
  const updated = await updatePublisher(publisher.id, {
    verification_status: verified ? 'verified' : 'reviewing',
    verification_notes: verified ? 'DNS TXT verification passed.' : `DNS TXT record not found yet: ${record}`,
    metadata,
  });
  return {
    publisherId: publisher.id,
    publisherName: publisher.publisher_name,
    domain,
    status: updated?.verification_status || (verified ? 'verified' : 'reviewing'),
    verified,
    txtName: domain,
    txtValue: record,
    message: verified ? 'Publisher domain verified.' : 'DNS TXT record was not found yet. DNS propagation can take time.',
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const action = cleanText(body.action || 'start', 30).toLowerCase();
    const result = action === 'check' ? await checkVerification(body) : await startVerification(body);
    return json(200, { ok: true, action, result });
  } catch (error) {
    return json(400, { ok: false, error: error.message || 'Publisher verification failed.' });
  }
};
