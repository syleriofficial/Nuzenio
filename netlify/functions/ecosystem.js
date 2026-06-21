const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

function cleanText(value = '', limit = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanUrl(value = '') {
  const input = cleanText(value, 600);
  if (!input) return '';
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.href;
  } catch {
    return '';
  }
}

function cleanEmail(value = '') {
  const email = cleanText(value, 240).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function slugify(value = '') {
  return cleanText(value, 120)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'nuzenio-request';
}

async function supabaseInsert(table, payload) {
  const config = supabaseConfig();
  if (!config.enabled) {
    throw new Error('Supabase service role key is required for ecosystem submissions.');
  }
  const response = await fetch(`${config.url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase insert failed with ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
  }
  const rows = await response.json().catch(() => []);
  return rows?.[0] || null;
}

function buildPayload(type, body) {
  const email = cleanEmail(body.email || body.contact_email);
  if (!email) throw new Error('Valid email is required.');

  if (type === 'publisher') {
    const publisherName = cleanText(body.publisher_name || body.name, 180);
    const feedUrl = cleanUrl(body.feed_url || body.rss_url);
    if (!publisherName || !feedUrl) throw new Error('Publisher name and RSS feed URL are required.');
    return {
      table: 'feed_submissions',
      payload: {
        publisher_name: publisherName,
        feed_url: feedUrl,
        category: cleanText(body.category || 'top', 40),
        country: cleanText(body.country || 'GLOBAL', 20).toUpperCase(),
        language: cleanText(body.language || 'en', 12).toLowerCase(),
        submitted_by_email: email,
        status: 'submitted',
      },
    };
  }

  if (type === 'publisher-account') {
    const publisherName = cleanText(body.publisher_name || body.name, 180);
    if (!publisherName) throw new Error('Publisher name is required.');
    return {
      table: 'publisher_accounts',
      payload: {
        publisher_slug: slugify(publisherName),
        publisher_name: publisherName,
        contact_email: email,
        website_url: cleanUrl(body.website_url || body.homepage_url) || null,
        country: cleanText(body.country || 'GLOBAL', 20).toUpperCase(),
        verification_status: 'submitted',
        metadata: {
          categories: cleanText(body.categories || '', 300),
          notes: cleanText(body.notes || '', 500),
        },
      },
    };
  }

  if (type === 'journalist') {
    const fullName = cleanText(body.full_name || body.name, 180);
    if (!fullName) throw new Error('Journalist name is required.');
    return {
      table: 'journalist_accounts',
      payload: {
        full_name: fullName,
        email,
        publisher_name: cleanText(body.publisher_name || '', 180) || null,
        author_slug: slugify(fullName),
        portfolio_url: cleanUrl(body.portfolio_url || body.website_url) || null,
        verification_status: 'submitted',
        metadata: {
          expertise: cleanText(body.expertise || '', 300),
          notes: cleanText(body.notes || '', 500),
        },
      },
    };
  }

  if (type === 'enterprise') {
    const organizationName = cleanText(body.organization_name || body.company, 180);
    if (!organizationName) throw new Error('Organization name is required.');
    return {
      table: 'enterprise_accounts',
      payload: {
        organization_name: organizationName,
        contact_email: email,
        plan: cleanText(body.plan || 'trial', 40),
        status: 'lead',
        seats: Number(body.seats || 1) || 1,
        custom_feeds: [{ request: cleanText(body.custom_feeds || body.use_case || '', 500) }],
        alert_rules: [{ request: cleanText(body.alerts || '', 500) }],
        metadata: {
          use_case: cleanText(body.use_case || '', 500),
          region: cleanText(body.region || '', 100),
        },
      },
    };
  }

  if (type === 'integration') {
    const name = cleanText(body.name || body.organization_name || 'Integration request', 180);
    const integrationType = cleanText(body.integration_type || 'webhook', 40).toLowerCase();
    return {
      table: 'integration_connections',
      payload: {
        integration_type: ['slack', 'teams', 'email', 'webhook', 'crm'].includes(integrationType) ? integrationType : 'webhook',
        name,
        status: 'requested',
        endpoint_url: cleanUrl(body.endpoint_url || body.webhook_url) || null,
        metadata: {
          contact_email: email,
          notes: cleanText(body.notes || body.use_case || '', 500),
        },
      },
    };
  }

  if (type === 'research') {
    const query = cleanText(body.query || body.topic || body.question, 700);
    if (!query) throw new Error('Research question or topic is required.');
    return {
      table: 'ai_research_queries',
      payload: {
        query,
        mode: cleanText(body.mode || 'question', 40),
        status: 'queued',
        metadata: {
          contact_email: email,
          topic: cleanText(body.topic || '', 180),
          requested_sources: cleanText(body.sources || '', 300),
        },
      },
    };
  }

  throw new Error('Unsupported ecosystem request type.');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const type = cleanText(body.type || 'publisher', 60).toLowerCase();
    const { table, payload } = buildPayload(type, body);
    const row = await supabaseInsert(table, payload);
    return json(200, {
      ok: true,
      type,
      table,
      id: row?.id || null,
      message: 'Request received. Nuzenio will review it before publishing, approving, or enabling integrations.',
    });
  } catch (error) {
    return json(400, { ok: false, error: error.message || 'Ecosystem submission failed.' });
  }
};
