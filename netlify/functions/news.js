import https from 'node:https';

const TOPICS = {
  world: 'WORLD',
  business: 'BUSINESS',
  tech: 'TECHNOLOGY',
  sports: 'SPORTS',
  entertainment: 'ENTERTAINMENT',
  health: 'HEALTH',
  science: 'SCIENCE',
};

const VIDEO_CATEGORIES = new Set(['video', 'live']);
const CATEGORIES = new Set(['local', 'top', ...VIDEO_CATEGORIES, ...Object.keys(TOPICS)]);
const LIVE_SOURCE_PROVIDERS = new Set(['youtube', 'twitch', 'official_embed', 'hls']);

const COUNTRY_NAMES = {
  AE: 'United Arab Emirates',
  AU: 'Australia',
  BD: 'Bangladesh',
  BR: 'Brazil',
  CA: 'Canada',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  IN: 'India',
  IT: 'Italy',
  JP: 'Japan',
  KR: 'South Korea',
  NL: 'Netherlands',
  PK: 'Pakistan',
  RU: 'Russia',
  SG: 'Singapore',
  US: 'United States',
  ZA: 'South Africa',
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=120',
  'Content-Type': 'application/json; charset=utf-8',
};

function fetchText(url, redirects = 0, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        timeout: 9000,
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml',
          'User-Agent': 'Nuzenio/1.0 (+https://nuzenio.com)',
          ...extraHeaders,
        },
      },
      (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          response.resume();
          if (redirects > 2) return reject(new Error('Too many upstream redirects'));
          return resolve(fetchText(new URL(response.headers.location, url).toString(), redirects + 1, extraHeaders));
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          return reject(new Error(`Upstream request failed with ${response.statusCode}`));
        }

        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => resolve(data));
      },
    );

    request.on('timeout', () => request.destroy(new Error('Upstream request timed out')));
    request.on('error', reject);
  });
}

function clean(value = '') {
  return value
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? clean(match[1]) : '';
}

function extractImage(item) {
  const media = item.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  const enclosure = item.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  return media?.[1] || enclosure?.[1] || '';
}

function parse(xml, category, country) {
  return (xml.match(/<item\b[\s\S]*?<\/item>/gi) || [])
    .slice(0, 60)
    .map((item, index) => {
      const title = first(item, 'title');
      const description = first(item, 'description');
      const source = first(item, 'source') || 'Google News';
      const link = first(item, 'link');
      const pubDate = first(item, 'pubDate');
      const summary = buildSummary(description || title);
      const fullBrief = clean(description || title);
      return {
        id: `${country}-${category}-${Buffer.from(`${title}${link}`).toString('base64url').slice(0, 24)}`,
        title,
        link,
        source,
        pubDate,
        category,
        country,
        image: extractImage(item),
        readTime: Math.max(1, Math.ceil((description || title).split(/\s+/).length / 180)),
        trustScore: Math.max(84, 99 - (index % 12)),
        summary,
        fullBrief,
        whatHappened: summary,
        whyItMatters: buildWhyItMatters(category, source),
      };
    })
    .filter((article) => article.title && article.link)
    .filter((article) => (VIDEO_CATEGORIES.has(category) ? isYouTubeArticle(article) : true));
}

function isYouTubeArticle(article) {
  return /youtube/i.test(`${article.source} ${article.link} ${article.title}`);
}

function parseApprovedLiveSources() {
  const raw = process.env.LIVE_NEWS_SOURCES || '[]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function approvedLiveSources({ country, language }) {
  const countryCode = normalizeCountry(country);
  const newsLanguage = normalizeLanguage(language);
  return parseApprovedLiveSources()
    .filter((source) => source && source.active !== false)
    .filter((source) => LIVE_SOURCE_PROVIDERS.has(String(source.provider || '').toLowerCase()))
    .filter((source) => {
      const sourceCountry = String(source.country || 'GLOBAL').toUpperCase();
      return sourceCountry === 'GLOBAL' || sourceCountry === countryCode;
    })
    .filter((source) => {
      const sourceLanguage = String(source.language || 'all').toLowerCase();
      return sourceLanguage === 'all' || sourceLanguage === newsLanguage;
    })
    .map((source, index) => normalizeApprovedLiveSource(source, { countryCode, newsLanguage, index }))
    .filter(Boolean)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, 24);
}

function normalizeApprovedLiveSource(source, { countryCode, newsLanguage, index }) {
  const provider = String(source.provider || '').toLowerCase();
  const name = clean(source.name || source.source || 'Live news channel');
  const title = clean(source.title || `${name} Live News`);
  const link = safeHttpsUrl(source.link || source.url);
  const priority = Number.isFinite(Number(source.priority)) ? Number(source.priority) : 0;
  let embedUrl = safeHttpsUrl(source.embedUrl);
  let videoId = '';
  let channelId = clean(source.channelId || '');
  let streamUrl = '';

  if (provider === 'youtube') {
    channelId = channelId || extractYouTubeChannelId(source.url || source.link || '');
    videoId = clean(source.videoId || '');
    if (videoId) {
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
    } else if (channelId) {
      embedUrl = `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(channelId)}`;
    }
  }

  if (provider === 'twitch') {
    const channel = clean(source.channel || source.channelId || '');
    if (!channel) return null;
    const parents = twitchParents().map((parent) => `parent=${encodeURIComponent(parent)}`).join('&');
    embedUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&${parents}&muted=true`;
  }

  if (provider === 'official_embed' && !embedUrl) return null;

  if (provider === 'hls') {
    streamUrl = safeHttpsUrl(source.streamUrl || source.url);
    if (!streamUrl || !/\.m3u8(\?|$)/i.test(streamUrl)) return null;
  }

  if (!embedUrl && !streamUrl) return null;

  const sourceLink = link || safeHttpsUrl(source.embedUrl) || streamUrl || embedUrl;
  return {
    id: `${countryCode}-live-approved-${clean(source.id || `${provider}-${name}-${index}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`,
    title,
    link: sourceLink,
    source: name,
    pubDate: 'Live now',
    category: 'live',
    country: countryCode,
    language: newsLanguage,
    image: safeHttpsUrl(source.image),
    videoId,
    videoUrl: sourceLink,
    embedUrl,
    streamUrl,
    provider,
    mediaType: 'live',
    readTime: 1,
    trustScore: 99,
    priority,
    summary: clean(source.summary || `${name} live news stream`),
    fullBrief: clean(source.description || source.summary || `${name} is available as an approved live news source on Nuzenio.`),
    whatHappened: `Watch the live news stream from ${name}.`,
    whyItMatters: `This stream is loaded from a Nuzenio-approved ${providerLabel(provider)} source with direct attribution.`,
  };
}

function providerLabel(provider) {
  return {
    youtube: 'YouTube',
    twitch: 'Twitch',
    official_embed: 'official publisher embed',
    hls: 'official HLS',
  }[provider] || 'publisher';
}

function twitchParents() {
  return (process.env.TWITCH_EMBED_PARENTS || process.env.SITE_HOSTNAME || 'nuzenio.com,newssetu.netlify.app')
    .split(',')
    .map((item) => item.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean);
}

function safeHttpsUrl(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function extractYouTubeChannelId(value = '') {
  return String(value).match(/\/channel\/(UC[\w-]{20,})/)?.[1] || '';
}

function extractYouTubeVideos(html, category, country) {
  const idPattern = /"videoId":"([\w-]{11})"/g;
  const seen = new Set();
  const videos = [];
  let match;

  while ((match = idPattern.exec(html)) && videos.length < 36) {
    const videoId = match[1];
    if (seen.has(videoId)) continue;

    const nearby = html.slice(Math.max(0, match.index - 900), match.index + 2600);
    const title = cleanJsonText(
      nearby.match(/"title":\{"runs":\[\{"text":"([^"]+)"/)?.[1]
        || nearby.match(/"accessibilityData":\{"label":"([^"]+)"/)?.[1]
        || 'YouTube news video',
    );
    const channel = cleanJsonText(
      nearby.match(/"ownerText":\{"runs":\[\{"text":"([^"]+)"/)?.[1]
        || nearby.match(/"shortBylineText":\{"runs":\[\{"text":"([^"]+)"/)?.[1]
        || 'YouTube',
    );
    if (category === 'live' && (!isReadableVideoTitle(title) || !isLiveNewsChannelResult(nearby, title, channel))) continue;
    seen.add(videoId);

    const published = cleanJsonText(nearby.match(/"publishedTimeText":\{"simpleText":"([^"]+)"/)?.[1] || 'Latest');
    const linkPath = `/watch?v=${videoId}`;
    const link = `https://www.youtube.com${linkPath}`;
    const summary = `${channel} · ${published}`;

    videos.push({
      id: `${country}-${category}-${videoId}`,
      title,
      link,
      source: channel,
      pubDate: published,
      category,
      country,
      image: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      videoId,
      videoUrl: link,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      provider: 'youtube',
      mediaType: category === 'live' ? 'live' : 'video',
      readTime: 1,
      trustScore: 90,
      summary,
      fullBrief: summary,
      whatHappened: `Watch this ${category === 'live' ? 'live ' : ''}YouTube news video from ${channel}.`,
      whyItMatters: `This YouTube news video is shown inside Nuzenio with direct source attribution and a link to the original YouTube page.`,
    });
  }

  return videos;
}

function isLiveNewsChannelResult(nearby = '', title = '', channel = '') {
  return /BADGE_STYLE_TYPE_LIVE_NOW|"label":"LIVE"|>LIVE<|watching now/i.test(nearby)
    && hasNewsChannelSignal(title, channel)
    && !/\b(streamed|premiered|replay|full match replay|music|lofi|gaming|gameplay|cricket live score)\b/i.test(`${title} ${channel}`);
}

function hasNewsChannelSignal(title = '', channel = '') {
  const text = `${title} ${channel}`;
  return /\b(news|live tv|tv live|breaking|headlines|bulletin|aaj tak|ndtv|wion|cnn|bbc|sky news|al jazeera|reuters|ani|news18|india today|times now|cnbc|fox news|abc news|cbs news|nbc news)\b/i.test(text)
    || /(समाचार|खबर|न्यूज़|সংবাদ|செய்தி|వార్తలు|बातम्या|સમાચાર|ಸುದ್ದಿ|വാർത്ത|خبر|أخبار|noticias|actualités|nachrichten|notícias|новости|新闻|ニュース|뉴스)/i.test(text);
}

function isReadableVideoTitle(title = '') {
  return title.split(/\s+/).length >= 4 && !/^(verified|live|news)$/i.test(title.trim());
}

function cleanJsonText(value = '') {
  return clean(value.replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
}

async function fetchYouTubeApiVideos({ category, country, language }) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;

  const countryCode = normalizeCountry(country);
  const newsLanguage = normalizeLanguage(language);
  const channelIds = youtubeChannelIds();
  const requests = channelIds.length
    ? channelIds.slice(0, 8).map((channelId) => youtubeApiSearchUrl({
      category,
      channelId,
      countryCode,
      key,
      newsLanguage,
    }))
    : [youtubeApiSearchUrl({ category, countryCode, key, newsLanguage })];

  const responses = await Promise.all(requests.map(async (url) => {
    const body = await fetchText(url, 0, { Accept: 'application/json' });
    const data = JSON.parse(body);
    if (data.error) throw new Error(data.error.message || 'YouTube API request failed');
    return data.items || [];
  }));

  return responses
    .flat()
    .map((item) => normalizeYouTubeApiItem(item, category, countryCode, Boolean(channelIds.length)))
    .filter(Boolean)
    .filter((article) => category !== 'live' || isReadableVideoTitle(article.title))
    .filter((article) => category !== 'live' || hasNewsChannelSignal(article.title, article.source))
    .filter((article, index, all) => all.findIndex((item) => item.videoId === article.videoId) === index)
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, 36);
}

function youtubeApiSearchUrl({ category, channelId, countryCode, key, newsLanguage }) {
  const query = [
    channelId ? '' : countryLabel(countryCode),
    category === 'live' ? liveNewsQuery(newsLanguage) : 'news latest video',
  ].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    order: 'date',
    maxResults: channelId ? '8' : '30',
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    regionCode: countryCode,
    relevanceLanguage: newsLanguage,
    q: query,
    key,
  });
  if (channelId) params.set('channelId', channelId);
  if (category === 'live') params.set('eventType', 'live');
  return `https://www.googleapis.com/youtube/v3/search?${params}`;
}

function liveNewsQuery(language = 'en') {
  const terms = {
    ar: 'قناة أخبار مباشرة بث مباشر أخبار عاجلة',
    bn: 'লাইভ সংবাদ চ্যানেল ব্রেকিং নিউজ',
    de: 'live nachrichten sender breaking news',
    es: 'canal de noticias en vivo ultima hora',
    fr: 'chaine info en direct actualites',
    gu: 'લાઇવ સમાચાર ચેનલ બ્રેકિંગ ન્યૂઝ',
    hi: 'लाइव न्यूज़ चैनल ब्रेकिंग न्यूज़',
    ja: 'ライブニュース チャンネル 速報',
    kn: 'ಲೈವ್ ಸುದ್ದಿ ಚಾನೆಲ್ ಬ್ರೇಕಿಂಗ್ ನ್ಯೂಸ್',
    ko: '라이브 뉴스 채널 속보',
    ml: 'ലൈവ് വാർത്ത ചാനൽ ബ്രേക്കിംഗ് ന്യൂസ്',
    mr: 'लाइव्ह बातम्या चॅनेल ब्रेकिंग न्यूज',
    pa: 'ਲਾਈਵ ਨਿਊਜ਼ ਚੈਨਲ ਬ੍ਰੇਕਿੰਗ ਨਿਊਜ਼',
    pt: 'canal de noticias ao vivo ultimas noticias',
    ru: 'прямой эфир новости канал срочные новости',
    ta: 'நேரலை செய்தி சேனல் பிரேக்கிங் நியூஸ்',
    te: 'లైవ్ న్యూస్ ఛానల్ బ్రేకింగ్ న్యూస్',
    ur: 'لائیو نیوز چینل بریکنگ نیوز',
    zh: '直播新闻频道 突发新闻',
  };
  return terms[language] || 'live news channel live tv breaking news';
}

function youtubeChannelIds() {
  return (process.env.YOUTUBE_NEWS_CHANNEL_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^UC[\w-]{20,}$/.test(item));
}

function normalizeYouTubeApiItem(item, category, countryCode, trustedChannelMode) {
  const videoId = item.id?.videoId;
  const snippet = item.snippet || {};
  if (!videoId || !snippet.title) return null;
  const title = clean(snippet.title);
  const source = clean(snippet.channelTitle || 'YouTube');
  const pubDate = snippet.publishedAt || '';
  const linkPath = `/watch?v=${videoId}`;
  const link = `https://www.youtube.com${linkPath}`;
  const summary = `${source} · ${formatApiDate(pubDate)}`;

  return {
    id: `${countryCode}-${category}-${videoId}`,
    title,
    link,
    source,
    pubDate,
    category,
    country: countryCode,
    image: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videoId,
    videoUrl: link,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    provider: 'youtube',
    mediaType: category === 'live' ? 'live' : 'video',
    readTime: 1,
    trustScore: trustedChannelMode ? 98 : 95,
    summary,
    fullBrief: clean(snippet.description || summary),
    whatHappened: `Watch this ${category === 'live' ? 'live ' : ''}YouTube news video from ${source}.`,
    whyItMatters: trustedChannelMode
      ? `This playable YouTube news video is loaded from a Nuzenio-approved YouTube channel with source attribution.`
      : `This playable YouTube news video is loaded through the official YouTube Data API with source attribution.`,
  };
}

async function fetchYouTubeVideos({ category, country, language }) {
  if (category === 'live') {
    const approvedSources = approvedLiveSources({ country, language });
    if (approvedSources.length) {
      return { articles: approvedSources, sourceType: 'approved-live-sources' };
    }
  }

  try {
    const apiVideos = await fetchYouTubeApiVideos({ category, country, language });
    if (apiVideos?.length) return { articles: apiVideos, sourceType: 'youtube-data-api' };
  } catch {
    // Keep the public video feed alive by falling back to live YouTube search parsing.
  }

  const countryCode = normalizeCountry(country);
  const newsLanguage = normalizeLanguage(language);
  const query = [
    countryLabel(countryCode),
    category === 'live' ? liveNewsQuery(newsLanguage) : 'news today video',
  ].join(' ');
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=${newsLanguage}&gl=${countryCode}`;
  const html = await fetchText(url, 0, {
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': `${newsLanguage}-${countryCode},${newsLanguage};q=0.9,en;q=0.8`,
    'User-Agent': 'Mozilla/5.0 Nuzenio/1.0 (+https://nuzenio.com)',
  });
  return { articles: extractYouTubeVideos(html, category, countryCode), sourceType: 'youtube-live-search' };
}

function formatApiDate(value = '') {
  if (!value) return 'Latest';
  try {
    return new Date(value).toUTCString();
  } catch {
    return value;
  }
}

function buildSummary(text) {
  const cleanText = clean(text);
  if (cleanText.length <= 260) return cleanText;
  return `${cleanText.slice(0, 257).trim()}...`;
}

function buildWhyItMatters(category, source) {
  const topic = category === 'top' || category === 'local' ? 'public interest' : category;
  return `This ${topic} report is being tracked from ${source} because it may affect readers, markets, policy, culture, or daily decisions.`;
}

function normalizeCountry(country = 'IN') {
  const value = country.toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : 'IN';
}

function countryLabel(country = 'IN') {
  const value = normalizeCountry(country);
  if (COUNTRY_NAMES[value]) return COUNTRY_NAMES[value];
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(value) || value;
  } catch {
    return value;
  }
}

function cleanRegion(region = '') {
  return region.replace(/[^\p{L}\p{N}\s.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function cleanQuery(query = '') {
  return query.replace(/[^\p{L}\p{N}\s.,'"!?&:()-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function normalizeCategory(category = 'local') {
  const value = category.toLowerCase();
  return CATEGORIES.has(value) ? value : 'local';
}

function normalizeLanguage(language = 'en') {
  const value = language.toLowerCase();
  return /^[a-z]{2}$/.test(value) ? value : 'en';
}

function googleNewsUrl({ category, country, q, region, city, language }) {
  const countryCode = normalizeCountry(country);
  const newsLanguage = normalizeLanguage(language);
  const stateRegion = cleanRegion(region);
  const cityArea = cleanRegion(city);
  const params = `hl=${newsLanguage}-${countryCode}&gl=${countryCode}&ceid=${countryCode}:${newsLanguage}`;
  if (q) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${params}`;
  }
  if (category === 'local') {
    const localQuery = [cityArea, stateRegion, countryLabel(countryCode)].filter(Boolean).join(' ');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(localQuery)}&${params}`;
  }
  if (category === 'video') {
    const videoQuery = ['site:youtube.com', 'video news', countryLabel(countryCode)].filter(Boolean).join(' ');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(videoQuery)}&${params}`;
  }
  if (category === 'live') {
    const liveQuery = ['site:youtube.com/watch', 'live news', countryLabel(countryCode)].filter(Boolean).join(' ');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(liveQuery)}&${params}`;
  }
  if (TOPICS[category]) {
    return `https://news.google.com/rss/headlines/section/topic/${TOPICS[category]}?${params}`;
  }
  return `https://news.google.com/rss?${params}`;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const category = normalizeCategory(event.queryStringParameters?.category || 'local');
    const country = normalizeCountry(event.queryStringParameters?.country || 'IN');
    const region = cleanRegion(event.queryStringParameters?.region || '');
    const city = cleanRegion(event.queryStringParameters?.city || '');
    const language = normalizeLanguage(event.queryStringParameters?.language || 'en');
    const q = cleanQuery(event.queryStringParameters?.q || '');

    if (!q && VIDEO_CATEGORIES.has(category)) {
      const { articles, sourceType } = await fetchYouTubeVideos({ category, country, language });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          category,
          country,
          countryName: countryLabel(country),
          region: region || null,
          city: city || null,
          language,
          query: null,
          total: articles.length,
          sourceType,
          updatedAt: new Date().toISOString(),
          articles,
        }),
      };
    }

    const url = googleNewsUrl({ category, country, q, region, city, language });
    const xml = await fetchText(url);
    const articles = parse(xml, category, country);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        category,
        country,
        countryName: countryLabel(country),
        region: region || null,
        city: city || null,
        language,
        query: q || null,
        total: articles.length,
        sourceType: 'live-rss',
        updatedAt: new Date().toISOString(),
        articles,
      }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ ok: false, error: error.message, sourceType: 'live-rss' }),
    };
  }
};
