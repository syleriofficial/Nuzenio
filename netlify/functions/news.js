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
    ar: 'أهم الأخبار العاجلة اليوم',
    bn: 'সর্বশেষ প্রধান খবর ব্রেকিং নিউজ',
    de: 'aktuelle top nachrichten eilnachrichten',
    en: 'top news breaking headlines',
    es: 'noticias principales ultima hora titulares',
    fr: 'principales actualites derniere minute titres',
    gu: 'તાજા મુખ્ય સમાચાર બ્રેકિંગ ન્યૂઝ',
    hi: 'आज की बड़ी खबर ताजा खबर ब्रेकिंग न्यूज़',
    ja: '最新 主要 ニュース 速報',
    kn: 'ಇತ್ತೀಚಿನ ಪ್ರಮುಖ ಸುದ್ದಿ ಬ್ರೇಕಿಂಗ್ ನ್ಯೂಸ್',
    ko: '최신 주요 뉴스 속보',
    ml: 'പുതിയ പ്രധാന വാർത്ത ബ്രേക്കിംഗ് ന്യൂസ്',
    mr: 'ताज्या मुख्य बातम्या ब्रेकिंग न्यूज',
    pa: 'ਤਾਜ਼ਾ ਮੁੱਖ ਖ਼ਬਰਾਂ ਬ੍ਰੇਕਿੰਗ ਨਿਊਜ਼',
    pt: 'principais noticias de hoje ultimas noticias',
    ru: 'главные новости сегодня срочные новости',
    ta: 'சமீபத்திய முக்கிய செய்திகள் பிரேக்கிங் நியூஸ்',
    te: 'తాజా ప్రధాన వార్తలు బ్రేకింగ్ న్యూస్',
    ur: 'تازہ اہم خبریں بریکنگ نیوز',
    zh: '最新 头条 新闻 突发 新闻',
  },
  world: {
    ar: 'أخبار العالم الأخبار الدولية العاجلة',
    bn: 'বিশ্ব সংবাদ আন্তর্জাতিক ব্রেকিং খবর',
    de: 'weltnachrichten internationale nachrichten aktuell',
    en: 'world news international breaking',
    es: 'noticias mundiales internacionales ultima hora',
    fr: 'actualites monde internationales derniere minute',
    gu: 'વિશ્વ સમાચાર આંતરરાષ્ટ્રીય તાજા સમાચાર',
    hi: 'दुनिया की खबर अंतरराष्ट्रीय समाचार',
    ja: '世界 ニュース 国際 速報',
    kn: 'ವಿಶ್ವ ಸುದ್ದಿ ಅಂತರಾಷ್ಟ್ರೀಯ ಸುದ್ದಿ',
    ko: '세계 뉴스 국제 속보',
    ml: 'ലോക വാർത്ത അന്താരാഷ്ട്ര വാർത്ത',
    mr: 'जागतिक बातम्या आंतरराष्ट्रीय बातम्या',
    pa: 'ਵਿਸ਼ਵ ਖ਼ਬਰਾਂ ਅੰਤਰਰਾਸ਼ਟਰੀ ਖ਼ਬਰਾਂ',
    pt: 'noticias do mundo internacionais ultimas',
    ru: 'мировые новости международные новости',
    ta: 'உலக செய்திகள் சர்வதேச செய்திகள்',
    te: 'ప్రపంచ వార్తలు అంతర్జాతీయ వార్తలు',
    ur: 'دنیا کی خبریں بین الاقوامی خبریں',
    zh: '世界 新闻 国际 新闻 速報',
  },
  business: {
    ar: 'أخبار الأعمال الأسواق الاقتصاد الشركات',
    bn: 'ব্যবসা খবর বাজার অর্থনীতি কোম্পানি',
    de: 'wirtschaft nachrichten markt unternehmen',
    en: 'business news market economy company',
    es: 'noticias negocios mercado economia empresas',
    fr: 'actualites economie marche entreprises',
    gu: 'બિઝનેસ સમાચાર બજાર અર્થતંત્ર કંપની',
    hi: 'बिजनेस खबर बाजार अर्थव्यवस्था कंपनी',
    ja: 'ビジネス ニュース 市場 経済 企業',
    kn: 'ವ್ಯಾಪಾರ ಸುದ್ದಿ ಮಾರುಕಟ್ಟೆ ಆರ್ಥಿಕತೆ ಕಂಪನಿ',
    ko: '비즈니스 뉴스 시장 경제 기업',
    ml: 'ബിസിനസ് വാർത്ത വിപണി സമ്പദ്‌വ്യവസ്ഥ കമ്പനി',
    mr: 'व्यवसाय बातम्या बाजार अर्थव्यवस्था कंपनी',
    pa: 'ਕਾਰੋਬਾਰ ਖ਼ਬਰਾਂ ਮਾਰਕੀਟ ਅਰਥਵਿਵਸਥਾ ਕੰਪਨੀ',
    pt: 'noticias negocios mercado economia empresas',
    ru: 'бизнес новости рынок экономика компании',
    ta: 'வணிக செய்திகள் சந்தை பொருளாதாரம் நிறுவனம்',
    te: 'బిజినెస్ వార్తలు మార్కెట్ ఆర్థిక వ్యవస్థ కంపెనీ',
    ur: 'کاروباری خبریں مارکیٹ معیشت کمپنی',
    zh: '商业 新闻 市场 经济 公司',
  },
  tech: {
    ar: 'أخبار التكنولوجيا الذكاء الاصطناعي الهواتف الشركات الناشئة',
    bn: 'প্রযুক্তি খবর AI স্মার্টফোন স্টার্টআপ',
    de: 'technologie nachrichten KI smartphone startups',
    en: 'technology news AI smartphone startup',
    es: 'noticias tecnologia IA smartphone startups',
    fr: 'actualites technologie IA smartphone startups',
    gu: 'ટેકનોલોજી સમાચાર AI સ્માર્ટફોન સ્ટાર્ટઅપ',
    hi: 'टेक्नोलॉजी खबर एआई मोबाइल स्टार्टअप',
    ja: 'テクノロジー ニュース AI スマートフォン スタートアップ',
    kn: 'ತಂತ್ರಜ್ಞಾನ ಸುದ್ದಿ AI ಸ್ಮಾರ್ಟ್‌ಫೋನ್ ಸ್ಟಾರ್ಟಪ್',
    ko: '기술 뉴스 AI 스마트폰 스타트업',
    ml: 'ടെക്നോളജി വാർത്ത AI സ്മാർട്ട്ഫോൺ സ്റ്റാർട്ടപ്പ്',
    mr: 'तंत्रज्ञान बातम्या AI स्मार्टफोन स्टार्टअप',
    pa: 'ਤਕਨਾਲੋਜੀ ਖ਼ਬਰਾਂ AI ਸਮਾਰਟਫੋਨ ਸਟਾਰਟਅਪ',
    pt: 'noticias tecnologia IA smartphone startups',
    ru: 'технологии новости ИИ смартфоны стартапы',
    ta: 'தொழில்நுட்ப செய்திகள் AI ஸ்மார்ட்போன் ஸ்டார்ட்அப்',
    te: 'టెక్నాలజీ వార్తలు AI స్మార్ట్‌ఫోన్ స్టార్టప్',
    ur: 'ٹیکنالوجی خبریں AI اسمارٹ فون اسٹارٹ اپ',
    zh: '科技 新闻 AI 智能手机 创业公司',
  },
  sports: {
    ar: 'أخبار الرياضة مباراة نتيجة كرة القدم كريكيت',
    bn: 'খেলার খবর ম্যাচ স্কোর ক্রিকেট ফুটবল',
    de: 'sport nachrichten spiel ergebnis fußball cricket',
    en: 'sports news match score cricket football',
    es: 'noticias deportes partido marcador futbol cricket',
    fr: 'actualites sport match score football cricket',
    gu: 'રમતગમત સમાચાર મેચ સ્કોર ક્રિકેટ ફૂટબોલ',
    hi: 'खेल समाचार मैच स्कोर क्रिकेट',
    ja: 'スポーツ ニュース 試合 結果 サッカー クリケット',
    kn: 'ಕ್ರೀಡೆ ಸುದ್ದಿ ಪಂದ್ಯ ಸ್ಕೋರ್ ಕ್ರಿಕೆಟ್ ಫುಟ್ಬಾಲ್',
    ko: '스포츠 뉴스 경기 점수 축구 크리켓',
    ml: 'കായിക വാർത്ത മത്സരം സ്കോർ ക്രിക്കറ്റ് ഫുട്ബോൾ',
    mr: 'क्रीडा बातम्या सामना स्कोर क्रिकेट फुटबॉल',
    pa: 'ਖੇਡ ਖ਼ਬਰਾਂ ਮੈਚ ਸਕੋਰ ਕ੍ਰਿਕਟ ਫੁੱਟਬਾਲ',
    pt: 'noticias esportes jogo placar futebol cricket',
    ru: 'спорт новости матч счет футбол крикет',
    ta: 'விளையாட்டு செய்திகள் போட்டி ஸ்கோர் கிரிக்கெட் கால்பந்து',
    te: 'క్రీడా వార్తలు మ్యాచ్ స్కోర్ క్రికెట్ ఫుట్‌బాల్',
    ur: 'کھیل خبریں میچ اسکور کرکٹ فٹبال',
    zh: '体育 新闻 比赛 比分 足球 板球',
  },
  entertainment: {
    ar: 'أخبار الترفيه السينما المشاهير',
    bn: 'বিনোদন খবর সিনেমা সেলিব্রিটি',
    de: 'unterhaltung nachrichten film promi',
    en: 'entertainment news film bollywood celebrity',
    es: 'noticias entretenimiento cine celebridades',
    fr: 'actualites divertissement cinema celebrites',
    gu: 'મનોરંજન સમાચાર ફિલ્મ સેલિબ્રિટી',
    hi: 'मनोरंजन खबर फिल्म बॉलीवुड',
    ja: 'エンタメ ニュース 映画 芸能人',
    kn: 'ಮನರಂಜನೆ ಸುದ್ದಿ ಸಿನಿಮಾ ಸೆಲೆಬ್ರಿಟಿ',
    ko: '엔터테인먼트 뉴스 영화 연예인',
    ml: 'വിനോദ വാർത്ത സിനിമ സെലിബ്രിറ്റി',
    mr: 'मनोरंजन बातम्या चित्रपट सेलिब्रिटी',
    pa: 'ਮਨੋਰੰਜਨ ਖ਼ਬਰਾਂ ਫਿਲਮ ਸੈਲੀਬ੍ਰਿਟੀ',
    pt: 'noticias entretenimento cinema celebridades',
    ru: 'развлечения новости кино знаменитости',
    ta: 'பொழுதுபோக்கு செய்திகள் திரைப்படம் பிரபலங்கள்',
    te: 'వినోద వార్తలు సినిమా సెలబ్రిటీ',
    ur: 'تفریح خبریں فلم مشہور شخصیات',
    zh: '娱乐 新闻 电影 名人',
  },
  health: {
    ar: 'أخبار الصحة الطب العافية دراسة',
    bn: 'স্বাস্থ্য খবর চিকিৎসা সুস্থতা গবেষণা',
    de: 'gesundheit nachrichten medizin studie',
    en: 'health news medicine wellness study',
    es: 'noticias salud medicina bienestar estudio',
    fr: 'actualites sante medecine bien etre etude',
    gu: 'આરોગ્ય સમાચાર દવા તંદુરસ્તી અભ્યાસ',
    hi: 'स्वास्थ्य खबर बीमारी दवा सेहत अध्ययन',
    ja: '健康 ニュース 医療 研究',
    kn: 'ಆರೋಗ್ಯ ಸುದ್ದಿ ಔಷಧಿ ಅಧ್ಯಯನ',
    ko: '건강 뉴스 의학 연구',
    ml: 'ആരോഗ്യ വാർത്ത മരുന്ന് പഠനം',
    mr: 'आरोग्य बातम्या औषध आरोग्य अभ्यास',
    pa: 'ਸਿਹਤ ਖ਼ਬਰਾਂ ਦਵਾਈ ਅਧਿਐਨ',
    pt: 'noticias saude medicina bem estar estudo',
    ru: 'здоровье новости медицина исследование',
    ta: 'சுகாதார செய்திகள் மருந்து ஆய்வு',
    te: 'ఆరోగ్య వార్తలు వైద్యం అధ్యయనం',
    ur: 'صحت خبریں دوا تحقیق',
    zh: '健康 新闻 医学 研究',
  },
  science: {
    ar: 'أخبار العلوم الفضاء المناخ البحث اكتشاف',
    bn: 'বিজ্ঞান খবর মহাকাশ জলবায়ু গবেষণা আবিষ্কার',
    de: 'wissenschaft nachrichten weltraum klima forschung entdeckung',
    en: 'science news space climate research discovery',
    es: 'noticias ciencia espacio clima investigacion descubrimiento',
    fr: 'actualites science espace climat recherche decouverte',
    gu: 'વિજ્ઞાન સમાચાર અંતરિક્ષ હવામાન સંશોધન શોધ',
    hi: 'विज्ञान खबर अंतरिक्ष जलवायु शोध खोज',
    ja: '科学 ニュース 宇宙 気候 研究 発見',
    kn: 'ವಿಜ್ಞಾನ ಸುದ್ದಿ ಬಾಹ್ಯಾಕಾಶ ಹವಾಮಾನ ಸಂಶೋಧನೆ ಕಂಡುಹಿಡಿತ',
    ko: '과학 뉴스 우주 기후 연구 발견',
    ml: 'ശാസ്ത്ര വാർത്ത ബഹിരാകാശം കാലാവസ്ഥ ഗവേഷണം കണ്ടെത്തൽ',
    mr: 'विज्ञान बातम्या अवकाश हवामान संशोधन शोध',
    pa: 'ਵਿਗਿਆਨ ਖ਼ਬਰਾਂ ਅੰਤਰਿਕਸ਼ ਜਲਵਾਯੂ ਖੋਜ',
    pt: 'noticias ciencia espaco clima pesquisa descoberta',
    ru: 'наука новости космос климат исследование открытие',
    ta: 'அறிவியல் செய்திகள் விண்வெளி காலநிலை ஆராய்ச்சி கண்டுபிடிப்பு',
    te: 'సైన్స్ వార్తలు అంతరిక్షం వాతావరణం పరిశోధన ఆవిష్కరణ',
    ur: 'سائنس خبریں خلا آب و ہوا تحقیق دریافت',
    zh: '科学 新闻 太空 气候 研究 发现',
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
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
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
  const seenTitles = new Set();
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
    const published = cleanJsonText(nearby.match(/"publishedTimeText":\{"simpleText":"([^"]+)"/)?.[1] || 'Latest');
    if (category === 'live' && (!isReadableVideoTitle(title) || !isLiveNewsChannelResult(nearby, title, channel, published))) continue;
    if (category === 'video' && (!isRecordedNewsVideoResult(nearby, title, channel, published))) continue;
    const titleKey = normalizeTitleKey(title);
    if (titleKey && seenTitles.has(titleKey)) continue;
    seen.add(videoId);
    if (titleKey) seenTitles.add(titleKey);

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

function isLiveNewsChannelResult(nearby = '', title = '', channel = '', published = '') {
  return hasLiveVideoSignal(nearby, title, channel)
    && hasNewsChannelSignal(title, channel)
    && isReadableVideoTitle(title)
    && !isRecordedOrReplayVideo(nearby, title, channel, published);
}

function isRecordedNewsVideoResult(nearby = '', title = '', channel = '', published = '') {
  return hasNewsChannelSignal(title, channel)
    && isReadableVideoTitle(title)
    && !hasLiveVideoSignal(nearby, title, channel)
    && !isLiveTitleSignal(title, channel)
    && !isShortsSignal(nearby, title)
    && !isOldYouTubePublished(published)
    && !isRecordedOrReplayVideo(nearby, title, channel, published);
}

function hasLiveVideoSignal(nearby = '', title = '', channel = '') {
  const text = `${nearby} ${title} ${channel}`;
  return /BADGE_STYLE_TYPE_LIVE_NOW|"label":"LIVE"|>LIVE<|watching now|live now|live stream|live tv|tv live|watch live/i.test(text)
    || /\b(live now|live stream|watch live|live tv|tv live|live news|breaking live|en direct|directo|ao vivo|em directo|en vivo|canli|canlı|livestream)\b/i.test(text)
    || /(مباشر|بث مباشر|على الهواء|लाइव|সরাসরি|நேரலை|ప్రత్యక్ష|ಲೈವ್|ലൈവ്|ਲਾਈਵ|براہ راست|生放送|ライブ配信|直播|실시간|라이브)/i.test(text);
}

function isLiveTitleSignal(title = '', channel = '') {
  const text = `${title} ${channel}`;
  return /\b(live|live tv|tv live|live news|watch live|breaking live|en direct|directo|ao vivo|em directo|en vivo|livestream)\b/i.test(text)
    || /(مباشر|بث مباشر|على الهواء|लाइव|সরাসরি|நேரலை|ప్రత్యక్ష|ಲೈವ್|ലൈവ്|ਲਾਈਵ|براہ راست|生放送|ライブ配信|直播|실시간|라이브)/i.test(text);
}

function isRecordedOrReplayVideo(nearby = '', title = '', channel = '', published = '') {
  return /\b(streamed|premiered|replay|full match replay|lofi|gaming|gameplay|cricket live score)\b/i.test(`${nearby} ${title} ${channel} ${published}`);
}

function isShortsSignal(nearby = '', title = '') {
  return /#shorts\b|\/shorts\/|SHORTS_LOCKUP|shorts_shelf/i.test(`${nearby} ${title}`);
}

function isOldYouTubePublished(published = '') {
  return /\b(month|months|year|years)\s+ago\b/i.test(published)
    || /\b(mois|mes|meses|monat|monate|jahr|jahre|anno|anni|ano|anos)\b/i.test(published)
    || /(महीने|माह|साल|বছর|মাস|மாத|ஆண்டு|నెల|సంవత్సరం|ತಿಂಗಳು|ವರ್ಷ|മാസം|വർഷം|ਮਹੀਨੇ|ਸਾਲ|مہینے|سال|شهر|أشهر|سنة|سنوات|ヶ月前|年前|개월 전|년 전|个月前|年前)/i.test(published);
}

function hasNewsChannelSignal(title = '', channel = '') {
  const text = `${title} ${channel}`;
  return /\b(news|live tv|tv live|breaking|headlines|bulletin|aaj tak|ndtv|wion|cnn|bbc|sky news|al jazeera|reuters|ani|news18|india today|times now|cnbc|fox news|abc news|cbs news|nbc news)\b/i.test(text)
    || /(समाचार|खबर|न्यूज़|সংবাদ|செய்தி|వార్తలు|बातम्या|સમાચાર|ಸುದ್ದಿ|വാർത്ത|خبر|أخبار|noticias|actualités|nachrichten|notícias|новости|新闻|ニュース|뉴스)/i.test(text);
}

function isReadableVideoTitle(title = '') {
  const cleanTitle = title.trim();
  return cleanTitle.split(/\s+/).length >= 4
    && !/^(verified|live|news)$/i.test(cleanTitle)
    && !isDurationOnlyTitle(cleanTitle)
    && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(cleanTitle);
}

function isDurationOnlyTitle(title = '') {
  return /^\d+\s+(second|seconds|minute|minutes|hour|hours)(,\s*\d+\s+(second|seconds|minute|minutes|hour|hours))*$/i.test(title)
    || /^\d+\s+(seconde|secondes|minute|minutes|heure|heures)(,?\s*(et)?\s*\d+\s+(seconde|secondes|minute|minutes|heure|heures))*$/i.test(title)
    || /^\d+\s*(segundo|segundos|minuto|minutos|hora|horas|sekunde|sekunden|minute|minuten|stunde|stunden)(,?\s*(y|e|und)?\s*\d+\s*(segundo|segundos|minuto|minutos|hora|horas|sekunde|sekunden|minute|minuten|stunde|stunden))*$/i.test(title)
    || /^\d+\s*(ثانية|ثواني|دقيقة|دقائق|ساعة|ساعات)(\s*و\s*\d+\s*(ثانية|ثواني|دقيقة|دقائق|ساعة|ساعات))*$/i.test(title);
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

function recordedVideoNewsQuery(language = 'en') {
  const terms = {
    ar: 'تقرير إخباري فيديو أخبار اليوم تحليل',
    bn: 'আজকের সংবাদ প্রতিবেদন ভিডিও বিশ্লেষণ',
    de: 'nachrichten bericht video analyse heute',
    es: 'reporte de noticias video analisis hoy',
    fr: 'reportage actualites video analyse aujourd hui',
    gu: 'સમાચાર રિપોર્ટ વિડિયો વિશ્લેષણ આજે',
    hi: 'आज की खबर रिपोर्ट वीडियो विश्लेषण',
    ja: '今日 ニュース レポート 動画 解説',
    kn: 'ಇಂದಿನ ಸುದ್ದಿ ವರದಿ ವಿಡಿಯೋ ವಿಶ್ಲೇಷಣೆ',
    ko: '오늘 뉴스 리포트 영상 분석',
    ml: 'ഇന്നത്തെ വാർത്ത റിപ്പോർട്ട് വീഡിയോ വിശകലനം',
    mr: 'आजच्या बातम्या रिपोर्ट व्हिडिओ विश्लेषण',
    pa: 'ਅੱਜ ਦੀ ਖ਼ਬਰ ਰਿਪੋਰਟ ਵੀਡੀਓ ਵਿਸ਼ਲੇਸ਼ਣ',
    pt: 'reportagem noticias video analise hoje',
    ru: 'новости репортаж видео анализ сегодня',
    ta: 'இன்றைய செய்தி அறிக்கை வீடியோ பகுப்பாய்வு',
    te: 'ఈరోజు వార్తలు రిపోర్ట్ వీడియో విశ్లేషణ',
    ur: 'آج کی خبر رپورٹ ویڈیو تجزیہ',
    zh: '今日 新闻 报道 视频 分析',
  };
  return terms[language] || 'latest news report video analysis today';
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
  const queries = youtubeFallbackQueries(category, countryCode, newsLanguage);

  for (const query of queries) {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=${newsLanguage}&gl=${countryCode}`;
    const html = await fetchText(url, 0, {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': `${newsLanguage}-${countryCode},${newsLanguage};q=0.9,en;q=0.8`,
      'User-Agent': 'Mozilla/5.0 Nuzenio/1.0 (+https://nuzenio.com)',
    });
    const articles = extractYouTubeVideos(html, category, countryCode, newsLanguage);
    if (articles.length) return { articles, sourceType: 'youtube-live-search' };
  }

  return { articles: [], sourceType: 'youtube-live-search' };
}

function youtubeFallbackQueries(category, countryCode, newsLanguage) {
  const countryName = countryLabel(countryCode);
  if (category === 'live') {
    return [
      [countryName, liveNewsQuery(newsLanguage)].join(' '),
      [countryName, 'live news channel live tv breaking news'].join(' '),
      'international live news channel live tv breaking news',
    ];
  }
  return [
    [countryName, videoNewsQuery(newsLanguage)].join(' '),
    [countryName, recordedVideoNewsQuery(newsLanguage)].join(' '),
    [countryName, 'latest news report headlines interview analysis'].join(' '),
    'international news report latest headlines analysis',
  ];
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
  let lastError = null;

  for (const query of queries) {
    try {
      const xml = await fetchText(googleNewsSearchUrl({ country, language, q: query }));
      batches.push(...parse(xml, 'local', country, language));
    } catch (error) {
      lastError = error;
      continue;
    }
    const fresh = polishFeed(batches, { days: 14, perSourceLimit: 10 });
    if (fresh.length >= 18) return fresh.slice(0, 60);
  }

  const finalArticles = polishFeed(batches, { days: 30, perSourceLimit: 10 }).slice(0, 60);
  if (!finalArticles.length && lastError) throw lastError;
  return finalArticles;
}

async function fetchFreshNewsArticles({ category, country, region, city, language, q }) {
  if (q) {
    return polishFeed(parse(await fetchText(googleNewsUrl({ category, country, q, region, city, language })), category, country, language), { days: 30 });
  }

  if (category === 'local') {
    return fetchFreshLocalArticles({ country, region, city, language });
  }

  const batches = [];
  let lastError = null;
  try {
    const topicXml = await fetchText(googleNewsUrl({ category, country, q, region, city, language }));
    batches.push(...parse(topicXml, category, country, language));
  } catch (error) {
    lastError = error;
  }
  let fresh = polishFeed(batches, { days: 14 });
  if (fresh.length >= 24) return fresh.slice(0, 60);

  for (const query of categorySearchQueries({ category, country, language })) {
    try {
      const xml = await fetchText(googleNewsSearchUrl({ country, language, q: query }));
      batches.push(...parse(xml, category, country, language));
    } catch (error) {
      lastError = error;
      continue;
    }
    fresh = polishFeed(batches, { days: 14 });
    if (fresh.length >= 24) return fresh.slice(0, 60);
  }

  const finalArticles = polishFeed(batches, { days: 30 }).slice(0, 60);
  if (!finalArticles.length && lastError) throw lastError;
  return finalArticles;
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
