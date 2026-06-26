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

function allMatches(xml, tag, limit = 20) {
  const matches = [];
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match = pattern.exec(xml);
  while (match && matches.length < limit) {
    matches.push(match[1]);
    match = pattern.exec(xml);
  }
  return matches;
}

function itemBlocks(xml) {
  const rssItems = allMatches(xml, 'item', 40);
  const atomItems = allMatches(xml, 'entry', 40);
  return [...rssItems, ...atomItems];
}

function parseDate(value = '') {
  if (!value) return null;
  const timestamp = Date.parse(clean(value));
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function newestPublishedAt(blocks = []) {
  const dates = blocks
    .map((block) => parseDate(first(block, 'pubDate') || first(block, 'published') || first(block, 'updated')))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0] || null;
}

function itemSamples(blocks = []) {
  return blocks.slice(0, 20).map((block) => ({
    title: first(block, 'title'),
    summary: first(block, 'description') || first(block, 'summary') || first(block, 'content'),
    link: first(block, 'link'),
    date: parseDate(first(block, 'pubDate') || first(block, 'published') || first(block, 'updated')),
  }));
}

function keywordHits(text = '', terms = []) {
  const lower = text.toLowerCase();
  return terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
}

function inferCategory(samples = []) {
  const text = samples.map((item) => `${item.title} ${item.summary}`).join(' ').toLowerCase();
  const categories = [
    ['business', ['market', 'stock', 'economy', 'inflation', 'company', 'earnings', 'bank']],
    ['technology', ['ai', 'tech', 'software', 'chip', 'startup', 'cyber', 'app', 'google', 'apple']],
    ['sports', ['match', 'score', 'league', 'tournament', 'cricket', 'football', 'tennis']],
    ['health', ['health', 'doctor', 'hospital', 'disease', 'vaccine', 'medical']],
    ['science', ['space', 'science', 'climate', 'research', 'nasa', 'study']],
    ['entertainment', ['film', 'movie', 'music', 'celebrity', 'box office', 'streaming']],
    ['world', ['president', 'minister', 'war', 'election', 'global', 'country', 'border']],
  ];
  const scored = categories
    .map(([category, terms]) => [category, keywordHits(text, terms)])
    .sort((a, b) => b[1] - a[1]);
  return scored[0]?.[1] ? scored[0][0] : 'top';
}

function qualitySignals({ samples, itemCount, newestDate, duplicate }) {
  const text = samples.map((item) => `${item.title} ${item.summary} ${item.link}`).join(' ');
  const summaries = samples.map((item) => item.summary || '').filter(Boolean);
  const avgSummaryLength = summaries.length
    ? Math.round(summaries.reduce((sum, value) => sum + value.length, 0) / summaries.length)
    : 0;
  const spamTerms = ['casino', 'betting', 'loan app', 'crypto giveaway', 'adult', 'coupon code', 'free money', 'miracle cure'];
  const spamHits = keywordHits(text, spamTerms);
  const datedSamples = samples.filter((item) => item.date);
  const recentCount = datedSamples.filter((item) => Date.now() - item.date.getTime() <= 72 * 36e5).length;
  const updateFrequency = recentCount >= 8 ? 'high' : recentCount >= 3 ? 'medium' : recentCount > 0 ? 'low' : 'unknown';
  const copyrightSignal = avgSummaryLength > 1200 ? 'full-article-risk' : avgSummaryLength > 700 ? 'long-summary-review' : 'summary-safe';
  const spamRisk = spamHits >= 3 ? 'high' : spamHits ? 'medium' : 'low';
  const freshness = newestDate
    ? Date.now() - newestDate.getTime() <= 72 * 36e5 ? 'fresh' : 'stale'
    : 'unknown';
  const approvalRisk = duplicate || spamRisk === 'high' || copyrightSignal === 'full-article-risk'
    ? 'high'
    : freshness === 'stale' || updateFrequency === 'low'
      ? 'medium'
      : 'low';
  return {
    trustScore: scoreFeed({ itemCount, newestDate, duplicate }) - (spamRisk === 'high' ? 25 : spamRisk === 'medium' ? 10 : 0) - (copyrightSignal === 'full-article-risk' ? 20 : 0),
    spamRisk,
    spamHits,
    updateFrequency,
    recentItemCount: recentCount,
    freshness,
    copyrightSignal,
    averageSummaryLength: avgSummaryLength,
    suggestedCategory: inferCategory(samples),
    approvalRisk,
  };
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
    const text = await response.text().catch(() => '');
    throw new Error(text || `Supabase request failed with ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
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

async function findDuplicate(url, submissionId = '') {
  const encodedUrl = encodeURIComponent(url);
  const sourceRows = await supabaseRequest(`rss_sources?url=eq.${encodedUrl}&select=id,name,url&limit=1`);
  if (sourceRows?.[0]) {
    return { type: 'approved_source', ...sourceRows[0] };
  }
  let submissionPath = `feed_submissions?feed_url=eq.${encodedUrl}&select=id,publisher_name,feed_url,status&limit=2`;
  if (submissionId) submissionPath += `&id=neq.${encodeURIComponent(submissionId)}`;
  const submissionRows = await supabaseRequest(submissionPath);
  if (submissionRows?.[0]) {
    return {
      type: 'submitted_feed',
      id: submissionRows[0].id,
      name: submissionRows[0].publisher_name,
      url: submissionRows[0].feed_url,
      status: submissionRows[0].status,
    };
  }
  return null;
}

function scoreFeed({ itemCount, newestDate, duplicate }) {
  let score = 55;
  if (itemCount >= 10) score += 20;
  else if (itemCount >= 5) score += 12;
  else score -= 10;
  if (newestDate) {
    const ageHours = (Date.now() - newestDate.getTime()) / 36e5;
    if (ageHours <= 24) score += 20;
    else if (ageHours <= 72) score += 12;
    else if (ageHours <= 168) score += 5;
    else score -= 15;
  } else {
    score -= 8;
  }
  if (duplicate) score -= 35;
  return Math.max(0, Math.min(100, score));
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
    const blocks = itemBlocks(xml);
    const itemCount = blocks.length;
    if (!itemCount) throw new Error('No RSS items or Atom entries found');
    const newestDate = newestPublishedAt(blocks);
    const duplicate = await findDuplicate(url, body.submissionId || body.id || '');
    const qualityScore = scoreFeed({ itemCount, newestDate, duplicate });
    const samples = itemSamples(blocks);
    const signals = qualitySignals({ samples, itemCount, newestDate, duplicate });
    signals.trustScore = Math.max(0, Math.min(100, signals.trustScore));
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        feedTitle: first(xml, 'title') || body.name || 'RSS feed',
        itemCount,
        newestPublishedAt: newestDate ? newestDate.toISOString() : null,
        duplicate,
        qualityScore,
        qualitySignals: signals,
        recommendation: duplicate ? 'duplicate' : signals.approvalRisk === 'high' ? 'reject-review' : qualityScore >= 70 ? 'approve' : 'review',
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
