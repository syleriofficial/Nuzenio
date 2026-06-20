import https from 'node:https';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};

function clean(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function first(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? clean(match[1]) : '';
}

function safeHttpsUrl(value = '') {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function fetchText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        timeout: 9000,
        headers: {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
          'User-Agent': 'NuzenioAdmin/1.0 (+https://nuzenio.com)',
        },
      },
      (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          response.resume();
          if (redirects > 2) return reject(new Error('Too many RSS redirects'));
          return resolve(fetchText(new URL(response.headers.location, url).toString(), redirects + 1));
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          return reject(new Error(`RSS source returned ${response.statusCode}`));
        }
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => resolve(data));
      },
    );
    request.on('timeout', () => request.destroy(new Error('RSS source timed out')));
    request.on('error', reject);
  });
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
}

async function requireAdmin(event) {
  const config = supabaseConfig();
  if (!config.enabled) throw new Error('Supabase service role is not configured');
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing admin session');

  const userResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!userResponse.ok) throw new Error('Invalid admin session');
  const user = await userResponse.json();
  const profileResponse = await fetch(`${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  });
  if (!profileResponse.ok) throw new Error('Admin profile check failed');
  const [profile] = await profileResponse.json();
  if (profile?.role !== 'admin') throw new Error('Admin role required');
  return user;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'POST, OPTIONS' },
      body: JSON.stringify({ ok: false, error: 'Method not allowed' }),
    };
  }

  try {
    await requireAdmin(event);
    const body = JSON.parse(event.body || '{}');
    const url = safeHttpsUrl(body.url);
    if (!url) throw new Error('A valid HTTPS RSS URL is required');
    const xml = await fetchText(url);
    const itemCount = (xml.match(/<item\b/gi) || []).length + (xml.match(/<entry\b/gi) || []).length;
    if (!itemCount) throw new Error('No RSS items or Atom entries found');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        feedTitle: first(xml, 'title') || body.name || 'RSS feed',
        itemCount,
      }),
    };
  } catch (error) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ ok: false, error: error.message }),
    };
  }
};
