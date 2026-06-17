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

const CATEGORY_SEARCH_TERMS = {
  top: {
    en: 'top news breaking headlines',
    hi: 'आज की बड़ी खबर ताजा खबर ब्रेकिंग न्यूज़',
  },
  world: {
    en: 'world news international breaking',
    hi: 'दुनिया की खबर अंतरराष्ट्रीय समाचार',
  },
  business: {
    en: 'business news market economy company',
    hi: 'बिजनेस खबर बाजार अर्थव्यवस्था कंपनी',
  },
  tech: {
    en: 'technology news AI smartphone startup',
    hi: 'टेक्नोलॉजी खबर एआई मोबाइल स्टार्टअप',
  },
  sports: {
    en: 'sports news match score cricket football',
    hi: 'खेल समाचार मैच स्कोर क्रिकेट',
  },
  entertainment: {
    en: 'entertainment news film bollywood celebrity',
    hi: 'मनोरंजन खबर फिल्म बॉलीवुड',
  },
  health: {
    en: 'health news medicine wellness study',
    hi: 'स्वास्थ्य खबर बीमारी दवा सेहत अध्ययन',
  },
  science: {
    en: 'science news space climate research discovery',
    hi: 'विज्ञान खबर अंतरिक्ष जलवायु शोध खोज',
  },
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
  'Cache-Control': 'public, max-age=180, stale-while-revalidate=60',
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

function parse(xml, category, country, language = 'en') {
  const newsLanguage = normalizeLanguage(language);
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
        whyItMatters: buildWhyItMatters(category, source, newsLanguage),
      };
    })
    .filter((article) => article.title && article.link)
    .filter((article) => (VIDEO_CATEGORIES.has(category) ? isYouTubeArticle(article) : true));
}

function isYouTubeArticle(article) {
  return /youtube/i.test(`${article.source} ${article.link} ${article.title}`);
}

function sortByNewest(articles) {
  return [...articles].sort((a, b) => articleTime(b.pubDate) - articleTime(a.pubDate));
}

function articleTime(value = '') {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isRecentArticle(article, days = 14) {
  const time = articleTime(article.pubDate);
  if (!time) return true;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function dedupeArticles(articles) {
  const seen = new Set();
  return articles.filter((article) => {
    const linkKey = normalizeUrlKey(article.link);
    const titleKey = normalizeTitleKey(article.title);
    const keys = [linkKey, titleKey].filter(Boolean);
    if (!keys.length || keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}

function diversifySources(articles, perSourceLimit = 12) {
  const counts = new Map();
  const primary = [];
  const overflow = [];

  for (const article of articles) {
    const source = normalizeSourceKey(article.source);
    const count = counts.get(source) || 0;
    counts.set(source, count + 1);
    if (count < perSourceLimit) primary.push(article);
    else overflow.push(article);
  }

  return [...primary, ...overflow];
}

function polishFeed(articles, { days = 14, perSourceLimit = 12 } = {}) {
  return diversifySources(sortByNewest(dedupeArticles(articles).filter((article) => isRecentArticle(article, days))), perSourceLimit);
}

function normalizeUrlKey(value = '') {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.searchParams.delete('utm_source');
    url.searchParams.delete('utm_medium');
    url.searchParams.delete('utm_campaign');
    url.searchParams.delete('utm_content');
    url.searchParams.delete('utm_term');
    return `url:${url.origin}${url.pathname}${url.search}`;
  } catch {
    return `url:${String(value).trim()}`;
  }
}

function normalizeTitleKey(value = '') {
  const title = clean(value)
    .replace(/\s+-\s+[^-]{2,80}$/u, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return title.length >= 18 ? `title:${title.slice(0, 180)}` : '';
}

function normalizeSourceKey(value = '') {
  return clean(value).toLowerCase().replace(/\s+/g, ' ').trim() || 'unknown';
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
    .sort((a, b) => (b.languageScore || 0) - (a.languageScore || 0) || (b.priority || 0) - (a.priority || 0))
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
    languageScore: languageRelevanceScore(`${title} ${name} ${source.language || ''} ${source.summary || ''}`, newsLanguage)
      + (String(source.language || 'all').toLowerCase() === newsLanguage ? 5 : 0),
    summary: clean(source.summary || localizedLiveSummary(name, newsLanguage)),
    fullBrief: clean(source.description || source.summary || localizedApprovedLiveBrief(name, newsLanguage)),
    whatHappened: localizedLiveWhatHappened(name, newsLanguage),
    whyItMatters: localizedApprovedLiveWhyItMatters(provider, newsLanguage),
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

function extractYouTubeVideos(html, category, country, language = 'en') {
  const newsLanguage = normalizeLanguage(language);
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
    if (category === 'video' && (hasLiveVideoSignal(nearby, title, channel) || !hasNewsChannelSignal(title, channel))) continue;
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
      whatHappened: localizedVideoWhatHappened(category, channel, newsLanguage),
      whyItMatters: localizedYouTubeSearchWhyItMatters(newsLanguage),
    });
  }

  return videos;
}

function isLiveNewsChannelResult(nearby = '', title = '', channel = '') {
  return hasLiveVideoSignal(nearby, title, channel)
    && hasNewsChannelSignal(title, channel)
    && !/\b(streamed|premiered|replay|full match replay|music|lofi|gaming|gameplay|cricket live score)\b/i.test(`${title} ${channel}`);
}

function hasLiveVideoSignal(nearby = '', title = '', channel = '') {
  return /BADGE_STYLE_TYPE_LIVE_NOW|"label":"LIVE"|>LIVE<|watching now|live now|live stream|live tv|watch live/i.test(nearby)
    || /\b(live now|live stream|watch live|live tv|live news|breaking live)\b/i.test(`${title} ${channel}`);
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
    .map((item) => normalizeYouTubeApiItem(item, category, countryCode, Boolean(channelIds.length), newsLanguage))
    .filter(Boolean)
    .filter((article) => category !== 'live' || isReadableVideoTitle(article.title))
    .filter((article) => category !== 'live' || hasNewsChannelSignal(article.title, article.source))
    .filter((article) => category !== 'video' || hasNewsChannelSignal(article.title, article.source))
    .filter((article, index, all) => all.findIndex((item) => item.videoId === article.videoId) === index)
    .sort((a, b) => (b.languageScore || 0) - (a.languageScore || 0) || new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, 36);
}

function youtubeApiSearchUrl({ category, channelId, countryCode, key, newsLanguage }) {
  const query = [
    channelId ? '' : countryLabel(countryCode),
    category === 'live' ? liveNewsQuery(newsLanguage) : videoNewsQuery(newsLanguage),
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
  if (category === 'video') params.set('eventType', 'completed');
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

function videoNewsQuery(language = 'en') {
  const terms = {
    ar: 'فيديو أخبار اليوم تقارير أخبار عاجلة قناة إخبارية',
    bn: 'আজকের সংবাদ ভিডিও ব্রেকিং নিউজ প্রতিবেদন সংবাদ চ্যানেল',
    de: 'nachrichten video heute breaking news bericht nachrichtensender',
    es: 'videos de noticias de hoy ultima hora informe canal noticias',
    fr: 'video actualites aujourd hui derniere minute reportage chaine info',
    gu: 'આજના સમાચાર વિડિયો બ્રેકિંગ ન્યૂઝ રિપોર્ટ સમાચાર ચેનલ',
    hi: 'आज की खबर वीडियो ब्रेकिंग न्यूज़ रिपोर्ट न्यूज़ चैनल',
    ja: '今日のニュース 動画 速報 レポート ニュースチャンネル',
    kn: 'ಇಂದಿನ ಸುದ್ದಿ ವಿಡಿಯೋ ಬ್ರೇಕಿಂಗ್ ನ್ಯೂಸ್ ವರದಿ ಸುದ್ದಿ ಚಾನೆಲ್',
    ko: '오늘 뉴스 영상 속보 리포트 뉴스 채널',
    ml: 'ഇന്നത്തെ വാർത്ത വീഡിയോ ബ്രേക്കിംഗ് ന്യൂസ് റിപ്പോർട്ട് വാർത്ത ചാനൽ',
    mr: 'आजच्या बातम्या व्हिडिओ ब्रेकिंग न्यूज रिपोर्ट न्यूज चॅनेल',
    pa: 'ਅੱਜ ਦੀਆਂ ਖਬਰਾਂ ਵੀਡੀਓ ਬ੍ਰੇਕਿੰਗ ਨਿਊਜ਼ ਰਿਪੋਰਟ ਨਿਊਜ਼ ਚੈਨਲ',
    pt: 'videos de noticias de hoje ultimas noticias reportagem canal noticias',
    ru: 'видео новости сегодня срочные новости репортаж новостной канал',
    ta: 'இன்றைய செய்தி வீடியோ பிரேக்கிங் நியூஸ் அறிக்கை செய்தி சேனல்',
    te: 'ఈరోజు వార్తలు వీడియో బ్రేకింగ్ న్యూస్ రిపోర్ట్ న్యూస్ ఛానల్',
    ur: 'آج کی خبریں ویڈیو بریکنگ نیوز رپورٹ نیوز چینل',
    zh: '今日新闻 视频 突发新闻 报道 新闻频道',
  };
  return terms[language] || 'today news video latest headlines report news channel';
}

function youtubeChannelIds() {
  return (process.env.YOUTUBE_NEWS_CHANNEL_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^UC[\w-]{20,}$/.test(item));
}

function normalizeYouTubeApiItem(item, category, countryCode, trustedChannelMode, newsLanguage = 'en') {
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
    languageScore: languageRelevanceScore(`${title} ${source} ${snippet.description || ''}`, newsLanguage),
    summary,
    fullBrief: clean(snippet.description || summary),
    whatHappened: localizedVideoWhatHappened(category, source, newsLanguage),
    whyItMatters: localizedVideoWhyItMatters(trustedChannelMode, newsLanguage),
  };
}

function languageRelevanceScore(text = '', language = 'en') {
  const value = text.toLowerCase();
  const scripts = {
    ar: /[\u0600-\u06ff]/,
    bn: /[\u0980-\u09ff]/,
    gu: /[\u0a80-\u0aff]/,
    hi: /[\u0900-\u097f]/,
    ja: /[\u3040-\u30ff\u3400-\u9fff]/,
    kn: /[\u0c80-\u0cff]/,
    ko: /[\uac00-\ud7af]/,
    ml: /[\u0d00-\u0d7f]/,
    mr: /[\u0900-\u097f]/,
    pa: /[\u0a00-\u0a7f]/,
    ru: /[\u0400-\u04ff]/,
    ta: /[\u0b80-\u0bff]/,
    te: /[\u0c00-\u0c7f]/,
    ur: /[\u0600-\u06ff]/,
    zh: /[\u3400-\u9fff]/,
  };
  const keywords = {
    de: ['nachrichten', 'aktuell', 'bericht'],
    en: ['news', 'headlines', 'report', 'breaking'],
    es: ['noticias', 'ultima hora', 'informe'],
    fr: ['actualites', 'info', 'reportage'],
    pt: ['noticias', 'ultimas', 'reportagem'],
  };
  const scriptScore = scripts[language]?.test(text) ? 3 : 0;
  const keywordScore = (keywords[language] || []).some((word) => value.includes(word)) ? 2 : 0;
  const newsScore = hasNewsChannelSignal(text, '') ? 1 : 0;
  return scriptScore + keywordScore + newsScore;
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
    category === 'live' ? liveNewsQuery(newsLanguage) : videoNewsQuery(newsLanguage),
  ].join(' ');
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=${newsLanguage}&gl=${countryCode}`;
  const html = await fetchText(url, 0, {
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': `${newsLanguage}-${countryCode},${newsLanguage};q=0.9,en;q=0.8`,
    'User-Agent': 'Mozilla/5.0 Nuzenio/1.0 (+https://nuzenio.com)',
  });
  return { articles: extractYouTubeVideos(html, category, countryCode, newsLanguage), sourceType: 'youtube-live-search' };
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

function buildWhyItMatters(category, source, language = 'en') {
  const topic = category === 'top' || category === 'local' ? 'public interest' : category;
  if (language === 'hi') {
    const hindiTopic = category === 'top' || category === 'local' ? 'जनहित' : category;
    return `यह ${hindiTopic} खबर ${source} से ट्रैक की गई है क्योंकि इसका असर पाठकों, बाजार, नीति, संस्कृति या रोजमर्रा के फैसलों पर पड़ सकता है।`;
  }
  if (language === 'ar') {
    return `يتم تتبع هذا الخبر من ${source} لأنه قد يؤثر في القراء أو الأسواق أو السياسات أو الثقافة أو القرارات اليومية.`;
  }
  if (language === 'es') {
    return `Esta noticia se sigue desde ${source} porque puede afectar a lectores, mercados, políticas, cultura o decisiones diarias.`;
  }
  return `This ${topic} report is being tracked from ${source} because it may affect readers, markets, policy, culture, or daily decisions.`;
}

function localizedLiveSummary(name, language = 'en') {
  if (language === 'hi') return `${name} लाइव न्यूज़ स्ट्रीम`;
  if (language === 'ar') return `بث إخباري مباشر من ${name}`;
  if (language === 'es') return `Transmisión de noticias en vivo de ${name}`;
  return `${name} live news stream`;
}

function localizedApprovedLiveBrief(name, language = 'en') {
  if (language === 'hi') return `${name} Nuzenio पर स्वीकृत लाइव न्यूज़ स्रोत के रूप में उपलब्ध है।`;
  if (language === 'ar') return `${name} متاح على Nuzenio كمصدر إخباري مباشر معتمد.`;
  if (language === 'es') return `${name} está disponible en Nuzenio como fuente aprobada de noticias en vivo.`;
  return `${name} is available as an approved live news source on Nuzenio.`;
}

function localizedLiveWhatHappened(name, language = 'en') {
  if (language === 'hi') return `${name} का लाइव न्यूज़ स्ट्रीम देखें।`;
  if (language === 'ar') return `شاهد البث الإخباري المباشر من ${name}.`;
  if (language === 'es') return `Mira la transmisión de noticias en vivo de ${name}.`;
  return `Watch the live news stream from ${name}.`;
}

function localizedApprovedLiveWhyItMatters(provider, language = 'en') {
  const label = providerLabel(provider);
  if (language === 'hi') return `यह स्ट्रीम सीधे स्रोत attribution के साथ Nuzenio-approved ${label} स्रोत से लोड की गई है।`;
  if (language === 'ar') return `يتم تحميل هذا البث من مصدر ${label} معتمد في Nuzenio مع إسناد مباشر للمصدر.`;
  if (language === 'es') return `Esta transmisión se carga desde una fuente ${label} aprobada por Nuzenio con atribución directa.`;
  return `This stream is loaded from a Nuzenio-approved ${label} source with direct attribution.`;
}

function localizedVideoWhatHappened(category, source, language = 'en') {
  if (language === 'hi') return `${source} का ${category === 'live' ? 'लाइव ' : ''}YouTube न्यूज़ वीडियो देखें।`;
  if (language === 'ar') return `شاهد فيديو أخبار ${category === 'live' ? 'مباشرا ' : ''}على YouTube من ${source}.`;
  if (language === 'es') return `Mira este video de noticias ${category === 'live' ? 'en vivo ' : ''}de YouTube de ${source}.`;
  return `Watch this ${category === 'live' ? 'live ' : ''}YouTube news video from ${source}.`;
}

function localizedVideoWhyItMatters(trustedChannelMode, language = 'en') {
  if (language === 'hi') {
    return trustedChannelMode
      ? 'यह playable YouTube न्यूज़ वीडियो Nuzenio-approved YouTube channel से source attribution के साथ लोड किया गया है।'
      : 'यह playable YouTube न्यूज़ वीडियो official YouTube Data API से source attribution के साथ लोड किया गया है।';
  }
  if (language === 'ar') {
    return trustedChannelMode
      ? 'يتم تحميل فيديو الأخبار القابل للتشغيل من قناة YouTube معتمدة في Nuzenio مع إسناد المصدر.'
      : 'يتم تحميل فيديو الأخبار القابل للتشغيل عبر واجهة YouTube Data API الرسمية مع إسناد المصدر.';
  }
  if (language === 'es') {
    return trustedChannelMode
      ? 'Este video de noticias reproducible se carga desde un canal de YouTube aprobado por Nuzenio con atribución de fuente.'
      : 'Este video de noticias reproducible se carga mediante la API oficial de YouTube Data con atribución de fuente.';
  }
  return trustedChannelMode
    ? 'This playable YouTube news video is loaded from a Nuzenio-approved YouTube channel with source attribution.'
    : 'This playable YouTube news video is loaded through the official YouTube Data API with source attribution.';
}

function localizedYouTubeSearchWhyItMatters(language = 'en') {
  if (language === 'hi') {
    return 'यह YouTube न्यूज़ वीडियो Nuzenio के अंदर सीधे source attribution और original YouTube link के साथ दिखाया गया है।';
  }
  if (language === 'ar') {
    return 'يتم عرض فيديو الأخبار من YouTube داخل Nuzenio مع إسناد مباشر للمصدر ورابط YouTube الأصلي.';
  }
  if (language === 'es') {
    return 'Este video de noticias de YouTube se muestra dentro de Nuzenio con atribución directa y enlace al video original.';
  }
  return 'This YouTube news video is shown inside Nuzenio with direct source attribution and a link to the original YouTube page.';
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
    const videoQuery = ['site:youtube.com/watch', videoNewsQuery(newsLanguage), countryLabel(countryCode)].filter(Boolean).join(' ');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(videoQuery)}&${params}`;
  }
  if (category === 'live') {
    const liveQuery = ['site:youtube.com/watch', liveNewsQuery(newsLanguage), countryLabel(countryCode)].filter(Boolean).join(' ');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(liveQuery)}&${params}`;
  }
  if (TOPICS[category]) {
    return `https://news.google.com/rss/headlines/section/topic/${TOPICS[category]}?${params}`;
  }
  return `https://news.google.com/rss?${params}`;
}

function googleNewsSearchUrl({ country, language, q }) {
  const countryCode = normalizeCountry(country);
  const newsLanguage = normalizeLanguage(language);
  const params = `hl=${newsLanguage}-${countryCode}&gl=${countryCode}&ceid=${countryCode}:${newsLanguage}`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${params}`;
}

function localSearchQueries({ country, region, city }) {
  const countryCode = normalizeCountry(country);
  const stateRegion = cleanRegion(region);
  const cityArea = cleanRegion(city);
  const place = [cityArea, stateRegion, countryLabel(countryCode)].filter(Boolean).join(' ');
  const nearby = [cityArea, stateRegion].filter(Boolean).join(' ');
  const base = place || countryLabel(countryCode);
  return [
    `${base} local news when:1d`,
    `${base} latest news when:3d`,
    nearby ? `${nearby} news when:7d` : `${base} news when:7d`,
  ];
}

function categorySearchQueries({ category, country, language }) {
  const countryCode = normalizeCountry(country);
  const terms = CATEGORY_SEARCH_TERMS[category] || CATEGORY_SEARCH_TERMS.top;
  const languageTerms = terms[language] || terms.en;
  const countryName = countryLabel(countryCode);
  return [
    `${languageTerms} ${countryName} when:1d`,
    `${languageTerms} ${countryName} when:3d`,
    `${languageTerms} when:7d`,
  ];
}

async function fetchFreshLocalArticles({ country, region, city, language }) {
  const queries = localSearchQueries({ country, region, city });
  const batches = [];

  for (const query of queries) {
    const xml = await fetchText(googleNewsSearchUrl({ country, language, q: query }));
    batches.push(...parse(xml, 'local', country, language));
    const fresh = polishFeed(batches, { days: 14, perSourceLimit: 10 });
    if (fresh.length >= 18) return fresh.slice(0, 60);
  }

  return polishFeed(batches, { days: 30, perSourceLimit: 10 }).slice(0, 60);
}

async function fetchFreshNewsArticles({ category, country, region, city, language, q }) {
  if (q) {
    return polishFeed(parse(await fetchText(googleNewsUrl({ category, country, q, region, city, language })), category, country, language), { days: 30 });
  }

  if (category === 'local') {
    return fetchFreshLocalArticles({ country, region, city, language });
  }

  const batches = [];
  const topicXml = await fetchText(googleNewsUrl({ category, country, q, region, city, language }));
  batches.push(...parse(topicXml, category, country, language));
  let fresh = polishFeed(batches, { days: 14 });
  if (fresh.length >= 24) return fresh.slice(0, 60);

  for (const query of categorySearchQueries({ category, country, language })) {
    const xml = await fetchText(googleNewsSearchUrl({ country, language, q: query }));
    batches.push(...parse(xml, category, country, language));
    fresh = polishFeed(batches, { days: 14 });
    if (fresh.length >= 24) return fresh.slice(0, 60);
  }

  return polishFeed(batches, { days: 30 }).slice(0, 60);
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

    const articles = await fetchFreshNewsArticles({ category, country, region, city, language, q });

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
        sourceType: !q && category === 'local' ? 'fresh-local-rss' : 'fresh-rss',
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
