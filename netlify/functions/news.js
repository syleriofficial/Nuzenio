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

const SUPPORTED_LANGUAGES = new Set(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur', 'ar', 'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ja', 'ko']);

const DEFAULT_RSS_SOURCES = [
  {
    id: 'bbc-world',
    name: 'BBC News',
    rssUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    homepage: 'https://www.bbc.com/news',
    country: 'GLOBAL',
    language: 'en',
    category: 'world',
    priority: 95,
  },
  {
    id: 'bbc-top',
    name: 'BBC News',
    rssUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
    homepage: 'https://www.bbc.com/news',
    country: 'GLOBAL',
    language: 'en',
    category: 'news',
    priority: 92,
  },
  {
    id: 'bbc-business',
    name: 'BBC News',
    rssUrl: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    homepage: 'https://www.bbc.com/news/business',
    country: 'GLOBAL',
    language: 'en',
    category: 'business',
    priority: 90,
  },
  {
    id: 'bbc-health',
    name: 'BBC News',
    rssUrl: 'https://feeds.bbci.co.uk/news/health/rss.xml',
    homepage: 'https://www.bbc.com/news/health',
    country: 'GLOBAL',
    language: 'en',
    category: 'health',
    priority: 90,
  },
  {
    id: 'bbc-science',
    name: 'BBC News',
    rssUrl: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    homepage: 'https://www.bbc.com/news/science_and_environment',
    country: 'GLOBAL',
    language: 'en',
    category: 'science',
    priority: 90,
  },
  {
    id: 'bbc-entertainment',
    name: 'BBC News',
    rssUrl: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
    homepage: 'https://www.bbc.com/news/entertainment_and_arts',
    country: 'GLOBAL',
    language: 'en',
    category: 'entertainment',
    priority: 90,
  },
  {
    id: 'bbc-sport',
    name: 'BBC Sport',
    rssUrl: 'https://feeds.bbci.co.uk/sport/rss.xml',
    homepage: 'https://www.bbc.com/sport',
    country: 'GLOBAL',
    language: 'en',
    category: 'sports',
    priority: 92,
  },
  {
    id: 'guardian-world',
    name: 'The Guardian',
    rssUrl: 'https://www.theguardian.com/world/rss',
    homepage: 'https://www.theguardian.com/world',
    country: 'GLOBAL',
    language: 'en',
    category: 'world',
    priority: 90,
  },
  {
    id: 'guardian-tech',
    name: 'The Guardian',
    rssUrl: 'https://www.theguardian.com/technology/rss',
    homepage: 'https://www.theguardian.com/technology',
    country: 'GLOBAL',
    language: 'en',
    category: 'tech',
    priority: 86,
  },
  {
    id: 'guardian-business',
    name: 'The Guardian',
    rssUrl: 'https://www.theguardian.com/business/rss',
    homepage: 'https://www.theguardian.com/business',
    country: 'GLOBAL',
    language: 'en',
    category: 'business',
    priority: 86,
  },
  {
    id: 'guardian-sport',
    name: 'The Guardian',
    rssUrl: 'https://www.theguardian.com/sport/rss',
    homepage: 'https://www.theguardian.com/sport',
    country: 'GLOBAL',
    language: 'en',
    category: 'sports',
    priority: 86,
  },
  {
    id: 'guardian-science',
    name: 'The Guardian',
    rssUrl: 'https://www.theguardian.com/science/rss',
    homepage: 'https://www.theguardian.com/science',
    country: 'GLOBAL',
    language: 'en',
    category: 'science',
    priority: 86,
  },
  {
    id: 'guardian-health',
    name: 'The Guardian',
    rssUrl: 'https://www.theguardian.com/society/health/rss',
    homepage: 'https://www.theguardian.com/society/health',
    country: 'GLOBAL',
    language: 'en',
    category: 'health',
    priority: 84,
  },
  {
    id: 'guardian-culture',
    name: 'The Guardian',
    rssUrl: 'https://www.theguardian.com/culture/rss',
    homepage: 'https://www.theguardian.com/culture',
    country: 'GLOBAL',
    language: 'en',
    category: 'entertainment',
    priority: 84,
  },
  {
    id: 'aljazeera-all',
    name: 'Al Jazeera',
    rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    homepage: 'https://www.aljazeera.com',
    country: 'GLOBAL',
    language: 'en',
    category: 'news',
    priority: 88,
  },
  {
    id: 'ap-top',
    name: 'AP News',
    rssUrl: 'https://apnews.com/hub/ap-top-news?output=rss',
    homepage: 'https://apnews.com',
    country: 'GLOBAL',
    language: 'en',
    category: 'news',
    priority: 94,
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    rssUrl: 'https://techcrunch.com/feed/',
    homepage: 'https://techcrunch.com',
    country: 'GLOBAL',
    language: 'en',
    category: 'tech',
    priority: 84,
  },
  {
    id: 'the-hindu-national',
    name: 'The Hindu',
    rssUrl: 'https://www.thehindu.com/news/national/feeder/default.rss',
    homepage: 'https://www.thehindu.com',
    country: 'IN',
    language: 'en',
    category: 'news',
    priority: 90,
  },
  {
    id: 'the-hindu-business',
    name: 'The Hindu BusinessLine',
    rssUrl: 'https://www.thehindubusinessline.com/feeder/default.rss',
    homepage: 'https://www.thehindubusinessline.com',
    country: 'IN',
    language: 'en',
    category: 'business',
    priority: 84,
  },
  {
    id: 'ndtv-latest',
    name: 'NDTV',
    rssUrl: 'https://feeds.feedburner.com/ndtvnews-latest',
    homepage: 'https://www.ndtv.com',
    country: 'IN',
    language: 'en',
    category: 'news',
    priority: 86,
  },
  {
    id: 'ndtv-world',
    name: 'NDTV',
    rssUrl: 'https://feeds.feedburner.com/ndtvnews-world-news',
    homepage: 'https://www.ndtv.com/world-news',
    country: 'IN',
    language: 'en',
    category: 'world',
    priority: 82,
  },
  {
    id: 'ndtv-tech',
    name: 'Gadgets 360',
    rssUrl: 'https://feeds.feedburner.com/gadgets360-latest',
    homepage: 'https://www.gadgets360.com',
    country: 'IN',
    language: 'en',
    category: 'tech',
    priority: 82,
  },
];

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
  ai: {
    en: 'artificial intelligence AI news OpenAI Google Anthropic Nvidia models tools policy',
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
const CATEGORIES = new Set(['local', 'top', ...VIDEO_CATEGORIES, ...Object.keys(TOPICS), 'ai']);
const CATEGORY_ALIASES = {
  news: 'top',
  headlines: 'top',
  'top-news': 'top',
  latest: 'top',
  'latest-news': 'top',
  breaking: 'top',
  'breaking-news': 'top',
  localnews: 'local',
  'local-news': 'local',
  technology: 'tech',
  'technology-news': 'tech',
  technews: 'tech',
  videos: 'video',
  'video-news': 'video',
  'live-news': 'live',
  worldnews: 'world',
  'world-news': 'world',
  businessnews: 'business',
  'business-news': 'business',
  financenews: 'business',
  'finance-news': 'business',
  marketnews: 'business',
  'market-news': 'business',
  startupnews: 'business',
  'startup-news': 'business',
  sportsnews: 'sports',
  'sports-news': 'sports',
  entertainmentnews: 'entertainment',
  'entertainment-news': 'entertainment',
  politicsnews: 'top',
  'politics-news': 'top',
  healthnews: 'health',
  'health-news': 'health',
  sciencenews: 'science',
  'science-news': 'science',
  climatenews: 'science',
  'climate-news': 'science',
  spacenews: 'science',
  'space-news': 'science',
  ainews: 'ai',
  'ai-news': 'ai',
};
const LIVE_SOURCE_PROVIDERS = new Set(['youtube', 'twitch', 'official_embed', 'hls']);
const MAX_RSS_AGE_DAYS = 14;
const CATEGORY_MAX_AGE_DAYS = {
  top: 3,
  world: 5,
  business: 5,
  tech: 5,
  ai: 7,
  sports: 5,
  entertainment: 7,
  health: 7,
  science: 7,
};

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
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
};

const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
const MEMORY_STALE_TTL_MS = 60 * 60 * 1000;
const SUPABASE_CACHE_TTL_MS = 15 * 60 * 1000;
const SUPABASE_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const SUPABASE_REQUEST_TIMEOUT_MS = 4500;
const memoryNewsCache = globalThis.__nuzenioNewsCache || (globalThis.__nuzenioNewsCache = new Map());

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

function slugifyTitle(value = '') {
  const slug = clean(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');
  return slug || 'news-story';
}

function first(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? clean(match[1]) : '';
}

function tagAttribute(item, tag, attribute) {
  const tagMatch = item.match(new RegExp(`<${tag}\\b[^>]*>`, 'i'));
  if (!tagMatch) return '';
  const attrMatch = tagMatch[0].match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'));
  return attrMatch ? decodeHtml(attrMatch[1]).trim() : '';
}

function extractImage(item) {
  const media = item.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  const thumbnail = item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  const enclosure = item.match(/<enclosure[^>]+(?:type=["']image\/[^"']+["'][^>]+)?url=["']([^"']+)["']/i);
  const imageTag = item.match(/<image>\s*<url>([\s\S]*?)<\/url>\s*<\/image>/i);
  const itunesImage = item.match(/<itunes:image[^>]+href=["']([^"']+)["']/i);
  const contentEncoded = first(item, 'content:encoded');
  const rawHtml = decodeHtml(item);
  const htmlImage = rawHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  const contentImage = decodeHtml(contentEncoded).match(/<img[^>]+src=["']([^"']+)["']/i);
  return normalizeImageUrl(
    media?.[1]
    || thumbnail?.[1]
    || enclosure?.[1]
    || imageTag?.[1]
    || itunesImage?.[1]
    || htmlImage?.[1]
    || contentImage?.[1]
    || '',
  );
}

function publisherLogoUrl(sourceUrl = '') {
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, '');
    if (!hostname) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=256`;
  } catch {
    return '';
  }
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeImageUrl(value = '') {
  const url = decodeHtml(value).trim();
  if (!url) return '';
  const httpsUrl = url.startsWith('//')
    ? `https:${url}`
    : url.startsWith('http://')
      ? `https://${url.slice(7)}`
      : url;
  return /^https:\/\//i.test(httpsUrl) ? upgradePublisherImageUrl(httpsUrl) : '';
}

function upgradePublisherImageUrl(value = '') {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');

    if (host.endsWith('guim.co.uk')) {
      const width = Number(url.searchParams.get('width') || 0);
      if (!width || width < 640) url.searchParams.set('width', '640');
      if (!url.searchParams.has('quality')) url.searchParams.set('quality', '85');
      if (!url.searchParams.has('auto')) url.searchParams.set('auto', 'format');
      return url.toString();
    }

    if (host.endsWith('bbci.co.uk')) {
      url.pathname = url.pathname.replace('/standard/240/', '/standard/976/');
      return url.toString();
    }

    return value;
  } catch {
    return value;
  }
}

function parse(xml, category, country, language = 'en', sourceConfig = {}) {
  const newsLanguage = normalizeLanguage(language);
  const fetchedAt = new Date().toISOString();
  const entries = [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
  ];
  return entries
    .slice(0, 60)
    .map((item, index) => {
      const title = first(item, 'title');
      const description = first(item, 'description') || first(item, 'summary') || first(item, 'content');
      const source = first(item, 'source') || clean(sourceConfig.name || sourceConfig.source || '') || 'Google News';
      const sourceUrl = normalizeImageUrl(tagAttribute(item, 'source', 'url') || sourceConfig.homepage || sourceConfig.link || '');
      const link = first(item, 'link') || normalizeImageUrl(tagAttribute(item, 'link', 'href'));
      const pubDate = first(item, 'pubDate') || first(item, 'published') || first(item, 'updated');
      const summary = buildSummary(description || title);
      const rssImage = extractImage(item);
      return {
        id: `${country}-${category}-${Buffer.from(`${title}${link}`).toString('base64url').slice(0, 24)}`,
        slug: slugifyTitle(title),
        title,
        link,
        source,
        sourceUrl,
        pubDate,
        category,
        country,
        language: newsLanguage,
        image: rssImage || publisherLogoUrl(sourceUrl),
        imageKind: rssImage ? 'photo' : 'logo',
        readTime: Math.max(1, Math.ceil((description || title).split(/\s+/).length / 180)),
        trustScore: Math.max(84, 99 - (index % 12)),
        summary,
        fullBrief: summary,
        whatHappened: summary,
        whyItMatters: buildWhyItMatters(category, source, newsLanguage),
        rssSourceId: sourceConfig.id || '',
        rssSourceName: sourceConfig.name || 'Google News RSS',
        rssSourceUrl: sourceConfig.rssUrl || sourceConfig.url || '',
        fetchedAt,
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

function compactDuplicateArticles(articles) {
  const seen = new Map();
  const compacted = [];
  for (const article of articles) {
    const linkKey = normalizeUrlKey(article.link);
    const titleKey = normalizeTitleKey(article.title);
    const keys = [linkKey, titleKey].filter(Boolean);
    const duplicateKey = keys.find((key) => seen.has(key));
    if (duplicateKey) {
      const primary = seen.get(duplicateKey);
      const alsoReportedBy = primary.alsoReportedBy || [];
      if (article.source && !alsoReportedBy.some((item) => normalizeSourceKey(item.source) === normalizeSourceKey(article.source))) {
        alsoReportedBy.push({
          source: article.source,
          link: article.link,
          publishedAt: article.pubDate,
          rssSourceName: article.rssSourceName || '',
        });
      }
      primary.alsoReportedBy = alsoReportedBy.slice(0, 6);
      primary.clusterSize = 1 + primary.alsoReportedBy.length;
      primary.trustScore = Math.min(99, Math.max(primary.trustScore || 90, article.trustScore || 90) + Math.min(4, primary.clusterSize - 1));
      if (shouldUpgradeArticleImage(primary, article)) {
        primary.image = article.image;
        primary.imageKind = article.imageKind;
      }
      keys.forEach((key) => seen.set(key, primary));
      continue;
    }
    const next = { ...article, alsoReportedBy: article.alsoReportedBy || [], clusterSize: article.clusterSize || 1 };
    keys.forEach((key) => seen.set(key, next));
    compacted.push(next);
  }
  return compacted;
}

function shouldUpgradeArticleImage(primary = {}, candidate = {}) {
  return primary.imageKind !== 'photo'
    && candidate.imageKind === 'photo'
    && /^https:\/\//i.test(candidate.image || '');
}

function diversifySources(articles, perSourceLimit = 12) {
  const counts = new Map();
  const primary = [];
  const overflow = [];

  for (const article of articles) {
    const source = articleSourceGroupKey(article);
    const count = counts.get(source) || 0;
    counts.set(source, count + 1);
    if (count < perSourceLimit) primary.push(article);
    else overflow.push(article);
  }

  return [...primary, ...overflow];
}

function interleaveSources(articles, perSourceLimit = 12) {
  const groups = [];
  const indexBySource = new Map();

  for (const article of articles) {
    const source = articleSourceGroupKey(article);
    if (!indexBySource.has(source)) {
      indexBySource.set(source, groups.length);
      groups.push({ source, items: [] });
    }
    groups[indexBySource.get(source)].items.push(article);
  }

  const counts = new Map();
  const primary = [];
  const overflow = [];
  let hasItems = true;

  while (hasItems) {
    hasItems = false;
    for (const group of groups) {
      const article = group.items.shift();
      if (!article) continue;
      hasItems = true;
      const count = counts.get(group.source) || 0;
      if (count < perSourceLimit) {
        primary.push(article);
        counts.set(group.source, count + 1);
      } else {
        overflow.push(article);
      }
    }
  }

  return [...primary, ...overflow];
}

function articleSourceGroupKey(article = {}) {
  const rssSource = normalizeSourceKey(article.rssSourceName);
  if (rssSource === 'google news rss') return 'google-news-rss';
  return normalizeSourceKey(article.rssSourceName || article.source);
}

const CATEGORY_RELEVANCE = {
  tech: {
    boost: /\b(ai|artificial intelligence|technology|tech|software|app|apps|startup|startups|cyber|security|privacy|data|cloud|chip|chips|semiconductor|robot|robots|phone|smartphone|iphone|android|google|apple|microsoft|openai|nvidia|meta|tesla|spacex)\b/i,
    penalty: /\b(personality test|horoscope|astrology|recipe|movie review|celebrity gossip)\b/i,
  },
  entertainment: {
    boost: /\b(entertainment|film|movie|cinema|box office|actor|actress|celebrity|bollywood|hollywood|ott|streaming|music|album|series|trailer|netflix|prime video|disney)\b/i,
    penalty: /\b(police|arrest|fir|crime|assault|murder|killed|court|land dispute|attack)\b/i,
  },
  business: {
    boost: /\b(business|market|markets|stock|stocks|economy|economic|company|companies|earnings|revenue|profit|bank|banking|finance|inflation|trade|investor|ipo)\b/i,
    penalty: /\b(movie|sports|celebrity|recipe|weather)\b/i,
  },
  sports: {
    boost: /\b(sport|sports|match|score|cricket|football|soccer|tennis|nba|fifa|olympic|world cup|goal|league|tournament|player|team)\b/i,
    penalty: /\b(stock|market|movie|election|policy)\b/i,
  },
  health: {
    boost: /\b(health|medical|medicine|disease|doctor|hospital|study|research|wellness|fitness|vaccine|virus|cancer|heart|brain|mental health)\b/i,
    penalty: /\b(stock|market|movie|sports score)\b/i,
  },
  science: {
    boost: /\b(science|space|nasa|research|study|scientist|discovery|climate|physics|astronomy|planet|moon|mars|quantum|biology|archaeology)\b/i,
    penalty: /\b(stock|market|movie|celebrity)\b/i,
  },
  ai: {
    boost: /\b(ai|artificial intelligence|machine learning|large language model|llm|openai|anthropic|google deepmind|chatgpt|nvidia|model|models|automation)\b/i,
    penalty: /\b(movie|sports|celebrity|recipe)\b/i,
  },
};

function categoryRelevanceScore(article, category) {
  const rules = CATEGORY_RELEVANCE[category];
  let score = article.imageKind === 'photo' ? 9 : 0;
  if (article.rssSourceName && article.rssSourceName !== 'Google News RSS') score += 4;
  if (!rules) return score;
  const text = `${article.title || ''} ${article.summary || ''} ${article.source || ''}`;
  if (rules.boost.test(text)) score += 35;
  if (rules.penalty.test(text)) score -= 45;
  return score;
}

function rankCategoryArticles(articles, category) {
  return articles
    .map((article, index) => ({ article, index, score: categoryRelevanceScore(article, category) }))
    .sort((a, b) => (b.score - a.score) || (articleTime(b.article.pubDate) - articleTime(a.article.pubDate)) || (a.index - b.index))
    .map(({ article }) => article);
}

function polishFeed(articles, { days = 14, language = 'en', perSourceLimit = 12 } = {}) {
  return diversifySources(
    sortByNewest(
      compactDuplicateArticles(articles)
        .filter((article) => isRecentArticle(article, days))
        .filter((article) => articleMatchesLanguage(article, language)),
    ),
    perSourceLimit,
  );
}

function articleMatchesLanguage(article = {}, language = 'en') {
  const newsLanguage = normalizeLanguage(language);
  if (article.language && normalizeLanguage(article.language) !== newsLanguage) return false;
  if (newsLanguage !== 'en') return true;

  const text = `${article.title || ''} ${article.summary || ''}`.trim();
  if (!text) return true;
  const nonEnglishScript = /[\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0a80-\u0aff\u0b80-\u0bff\u0c00-\u0cff\u0d00-\u0d7f\u0600-\u06ff\u0400-\u04ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;
  if (nonEnglishScript.test(text)) return false;

  const lower = ` ${text.toLowerCase()} `;
  const foreignSignals = [
    /\b(und|oder|nicht|für|über|nachrichten|aktuell|wirtschaft|politik)\b/i,
    /\b(le|la|les|des|du|une|avec|pour|actualites|actualité|monde)\b/i,
    /\b(noticias|ultima|última|mercado|economia|gobierno|mundo)\b/i,
    /\b(notícias|ultimas|últimas|mercado|economia|governo|mundo)\b/i,
  ].filter((pattern) => pattern.test(lower)).length;
  const englishSignals = /\b(news|live|breaking|report|reports|update|updates|market|business|tech|technology|world|health|science|sports|ai|says|after|before|with|from|for|in|on|at)\b/i.test(lower);
  return foreignSignals < 2 || englishSignals;
}

function maxAgeDaysForCategory(category, fallback = MAX_RSS_AGE_DAYS) {
  return CATEGORY_MAX_AGE_DAYS[category] || fallback;
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

function approvedRssSources({ category, country, language }) {
  const countryCode = normalizeCountry(country);
  const newsLanguage = normalizeLanguage(language);
  return mergeApprovedSourceConfigs(DEFAULT_RSS_SOURCES, parseApprovedLiveSources())
    .filter((source) => source && source.enabled !== false && source.active !== false)
    .filter((source) => {
      const type = String(source.type || source.kind || source.provider || '').toLowerCase();
      return type === 'rss' || !type || Boolean(source.rssUrl || source.feedUrl);
    })
    .map((source, index) => normalizeApprovedRssSource(source, { index }))
    .filter(Boolean)
    .filter((source) => {
      const sourceCountry = String(source.country || 'GLOBAL').toUpperCase();
      return sourceCountry === 'GLOBAL' || sourceCountry === countryCode;
    })
    .filter((source) => {
      const sourceLanguage = String(source.language || 'all').toLowerCase();
      return sourceLanguage === 'all' || sourceLanguage === newsLanguage;
    })
    .filter((source) => {
      const sourceCategory = String(source.category || 'all').toLowerCase();
      return sourceCategory === 'all' || sourceCategory === category || (category === 'top' && sourceCategory === 'news');
    })
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
    .slice(0, 10);
}

function mergeApprovedSourceConfigs(defaultSources = [], configuredSources = []) {
  const seen = new Set();
  const merged = [];
  for (const source of [...configuredSources, ...defaultSources]) {
    const key = sourceConfigKey(source);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(source);
  }
  return merged;
}

function sourceConfigKey(source = {}) {
  const urlKey = safeHttpsUrl(source.rssUrl || source.feedUrl || source.url);
  if (urlKey) return `url:${urlKey}`;
  const idKey = clean(source.id || source.name || source.source || '').toLowerCase();
  return idKey ? `id:${idKey}` : '';
}

function normalizeApprovedRssSource(source, { index }) {
  const rssUrl = safeHttpsUrl(source.rssUrl || source.feedUrl || source.url);
  const name = clean(source.name || source.source || source.title || '');
  if (!rssUrl || !name) return null;
  return {
    id: clean(source.id || `rss-${index}-${name}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name,
    rssUrl,
    country: String(source.country || 'GLOBAL').toUpperCase(),
    language: String(source.language || 'en').toLowerCase(),
    category: String(source.category || 'all').toLowerCase(),
    priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 0,
    homepage: safeHttpsUrl(source.homepage || source.link || ''),
  };
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
    && !hasStaleExplicitVideoDate(title)
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

function hasStaleExplicitVideoDate(title = '') {
  const monthMatch = String(title || '').match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+([0-3]?\d)(?:,\s*(20\d{2}))?\b/i,
  );
  if (!monthMatch) return false;

  const monthIndex = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  }[monthMatch[1].slice(0, 3).toLowerCase()];
  if (monthIndex === undefined) return false;

  const now = new Date();
  const year = Number(monthMatch[3] || now.getUTCFullYear());
  const date = new Date(Date.UTC(year, monthIndex, Number(monthMatch[2]), 23, 59, 59));
  if (Number.isNaN(date.getTime()) || date > now) return false;

  const ageDays = (now.getTime() - date.getTime()) / 86400000;
  return ageDays > 14;
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
    // Keep public media feeds alive by falling back to YouTube search parsing.
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
    if (articles.length) return { articles, sourceType: youtubeSearchSourceType(category) };
  }

  return { articles: [], sourceType: youtubeSearchSourceType(category) };
}

function youtubeSearchSourceType(category) {
  return category === 'video' ? 'youtube-video-search' : 'youtube-live-search';
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
  const templates = {
    ar: `يتم تتبع هذا الخبر من ${source} لأنه قد يؤثر في القراء أو الأسواق أو السياسات أو الثقافة أو القرارات اليومية.`,
    bn: `${source} থেকে এই জনস্বার্থের খবরটি ট্র্যাক করা হচ্ছে, কারণ এটি পাঠক, বাজার, নীতি, সংস্কৃতি বা দৈনন্দিন সিদ্ধান্তে প্রভাব ফেলতে পারে।`,
    de: `Dieser Bericht von ${source} wird verfolgt, weil er Leser, Märkte, Politik, Kultur oder Alltagsentscheidungen betreffen kann.`,
    es: `Esta noticia se sigue desde ${source} porque puede afectar a lectores, mercados, políticas, cultura o decisiones diarias.`,
    fr: `Ce sujet de ${source} est suivi car il peut affecter les lecteurs, les marchés, les politiques publiques, la culture ou les décisions quotidiennes.`,
    gu: `${source} માંથી આ જનહિતની ખબર ટ્રેક કરવામાં આવી રહી છે, કારણ કે તે વાચકો, બજારો, નીતિ, સંસ્કૃતિ અથવા રોજિંદા નિર્ણયોને અસર કરી શકે છે.`,
    hi: `यह ${category === 'top' || category === 'local' ? 'जनहित' : topic} खबर ${source} से ट्रैक की गई है क्योंकि इसका असर पाठकों, बाजार, नीति, संस्कृति या रोजमर्रा के फैसलों पर पड़ सकता है।`,
    ja: `${source} のこのニュースは、読者、市場、政策、文化、日々の判断に影響する可能性があるため追跡されています。`,
    kn: `${source} ನಿಂದ ಈ ಸಾರ್ವಜನಿಕ ಹಿತಾಸಕ್ತಿ ಸುದ್ದಿಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಲಾಗುತ್ತಿದೆ, ಏಕೆಂದರೆ ಇದು ಓದುಗರಿಗೆ, ಮಾರುಕಟ್ಟೆಗಳಿಗೆ, ನೀತಿಗೆ, ಸಂಸ್ಕೃತಿಗೆ ಅಥವಾ ದೈನಂದಿನ ನಿರ್ಧಾರಗಳಿಗೆ ಪರಿಣಾಮ ಬೀರುವ ಸಾಧ್ಯತೆ ಇದೆ.`,
    ko: `${source}의 이 뉴스는 독자, 시장, 정책, 문화 또는 일상적 판단에 영향을 줄 수 있어 추적됩니다.`,
    ml: `${source}ൽ നിന്നുള്ള ഈ പൊതുതാൽപ്പര്യ വാർത്ത വായനക്കാരെയും വിപണികളെയും നയങ്ങളെയും സംസ്കാരത്തെയും ദൈനംദിന തീരുമാനങ്ങളെയും ബാധിക്കാവുന്നതിനാൽ ട്രാക്ക് ചെയ്യുന്നു.`,
    mr: `${source} कडील ही जनहिताची बातमी वाचक, बाजार, धोरण, संस्कृती किंवा दैनंदिन निर्णयांवर परिणाम करू शकते म्हणून ट्रॅक केली जात आहे.`,
    pa: `${source} ਤੋਂ ਇਹ ਜਨ-ਹਿੱਤ ਖਬਰ ਟ੍ਰੈਕ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ ਕਿਉਂਕਿ ਇਹ ਪਾਠਕਾਂ, ਬਾਜ਼ਾਰਾਂ, ਨੀਤੀ, ਸਭਿਆਚਾਰ ਜਾਂ ਰੋਜ਼ਾਨਾ ਫੈਸਲਿਆਂ ਨੂੰ ਪ੍ਰਭਾਵਿਤ ਕਰ ਸਕਦੀ ਹੈ।`,
    pt: `Esta notícia de ${source} é acompanhada porque pode afetar leitores, mercados, políticas, cultura ou decisões diárias.`,
    ru: `Этот материал от ${source} отслеживается, потому что он может повлиять на читателей, рынки, политику, культуру или повседневные решения.`,
    ta: `${source} இலிருந்து இந்த பொதுநலச் செய்தி கண்காணிக்கப்படுகிறது; இது வாசகர்கள், சந்தைகள், கொள்கை, கலாசாரம் அல்லது தினசரி முடிவுகளை பாதிக்கலாம்.`,
    te: `${source} నుండి ఈ ప్రజాహిత వార్తను ట్రాక్ చేస్తున్నారు, ఎందుకంటే ఇది పాఠకులు, మార్కెట్లు, విధానం, సంస్కృతి లేదా రోజువారీ నిర్ణయాలపై ప్రభావం చూపవచ్చు.`,
    ur: `${source} سے اس عوامی دلچسپی کی خبر کو ٹریک کیا جا رہا ہے کیونکہ یہ قارئین، بازاروں، پالیسی، ثقافت یا روزمرہ فیصلوں پر اثر ڈال سکتی ہے۔`,
    zh: `Nuzenio 正在跟踪来自 ${source} 的这条公共关注报道，因为它可能影响读者、市场、政策、文化或日常决策。`,
  };
  if (templates[language]) return templates[language];
  return `This ${topic} report is being tracked from ${source} because it may affect readers, markets, policy, culture, or daily decisions.`;
}

function localizedLiveSummary(name, language = 'en') {
  const templates = {
    ar: `بث إخباري مباشر من ${name}`,
    bn: `${name} লাইভ সংবাদ স্ট্রিম`,
    de: `${name} Live-Nachrichtenstream`,
    es: `Transmisión de noticias en vivo de ${name}`,
    fr: `Flux d'actualités en direct de ${name}`,
    gu: `${name} લાઈવ સમાચાર સ્ટ્રીમ`,
    hi: `${name} लाइव न्यूज़ स्ट्रीम`,
    ja: `${name} ライブニュース配信`,
    kn: `${name} ಲೈವ್ ಸುದ್ದಿ ಸ್ಟ್ರೀಮ್`,
    ko: `${name} 라이브 뉴스 스트림`,
    ml: `${name} ലൈവ് വാർത്ത സ്ട്രീം`,
    mr: `${name} लाइव्ह न्यूज स्ट्रीम`,
    pa: `${name} ਲਾਈਵ ਨਿਊਜ਼ ਸਟ੍ਰੀਮ`,
    pt: `Transmissão de notícias ao vivo de ${name}`,
    ru: `Прямая новостная трансляция ${name}`,
    ta: `${name} நேரலை செய்தி ஸ்ட்ரீம்`,
    te: `${name} లైవ్ న్యూస్ స్ట్రీమ్`,
    ur: `${name} لائیو نیوز اسٹریم`,
    zh: `${name} 直播新闻`,
  };
  if (templates[language]) return templates[language];
  return `${name} live news stream`;
}

function localizedApprovedLiveBrief(name, language = 'en') {
  const templates = {
    ar: `${name} متاح على Nuzenio كمصدر إخباري مباشر معتمد.`,
    bn: `${name} Nuzenio-তে অনুমোদিত লাইভ সংবাদ উৎস হিসেবে উপলব্ধ।`,
    de: `${name} ist auf Nuzenio als geprüfte Live-Nachrichtenquelle verfügbar.`,
    es: `${name} está disponible en Nuzenio como fuente aprobada de noticias en vivo.`,
    fr: `${name} est disponible sur Nuzenio comme source d'actualité en direct approuvée.`,
    gu: `${name} Nuzenio પર મંજૂર લાઈવ સમાચાર સ્ત્રોત તરીકે ઉપલબ્ધ છે.`,
    hi: `${name} Nuzenio पर स्वीकृत लाइव न्यूज़ स्रोत के रूप में उपलब्ध है।`,
    ja: `${name} はNuzenioで承認済みライブニュースソースとして利用できます。`,
    kn: `${name} Nuzenio ನಲ್ಲಿ ಅನುಮೋದಿತ ಲೈವ್ ಸುದ್ದಿ ಮೂಲವಾಗಿ ಲಭ್ಯವಿದೆ.`,
    ko: `${name}은 Nuzenio에서 승인된 라이브 뉴스 출처로 제공됩니다.`,
    ml: `${name} Nuzenioയിൽ അംഗീകൃത ലൈവ് വാർത്ത ഉറവിടമായി ലഭ്യമാണ്.`,
    mr: `${name} Nuzenio वर मंजूर लाइव्ह न्यूज स्रोत म्हणून उपलब्ध आहे.`,
    pa: `${name} Nuzenio ਉੱਤੇ ਮਨਜ਼ੂਰਸ਼ੁਦਾ ਲਾਈਵ ਨਿਊਜ਼ ਸਰੋਤ ਵਜੋਂ ਉਪਲਬਧ ਹੈ।`,
    pt: `${name} está disponível no Nuzenio como fonte aprovada de notícias ao vivo.`,
    ru: `${name} доступен на Nuzenio как одобренный источник прямых новостей.`,
    ta: `${name} Nuzenio-வில் அங்கீகரிக்கப்பட்ட நேரலை செய்தி மூலமாக கிடைக்கிறது.`,
    te: `${name} Nuzenioలో ఆమోదించిన లైవ్ న్యూస్ మూలంగా అందుబాటులో ఉంది.`,
    ur: `${name} Nuzenio پر منظور شدہ لائیو نیوز ذریعہ کے طور پر دستیاب ہے۔`,
    zh: `${name} 是 Nuzenio 已批准的直播新闻来源。`,
  };
  if (templates[language]) return templates[language];
  return `${name} is available as an approved live news source on Nuzenio.`;
}

function localizedLiveWhatHappened(name, language = 'en') {
  const templates = {
    ar: `شاهد البث الإخباري المباشر من ${name}.`,
    bn: `${name}-এর লাইভ সংবাদ স্ট্রিম দেখুন।`,
    de: `Sehen Sie den Live-Nachrichtenstream von ${name}.`,
    es: `Mira la transmisión de noticias en vivo de ${name}.`,
    fr: `Regardez le direct d'actualité de ${name}.`,
    gu: `${name} નો લાઈવ સમાચાર સ્ટ્રીમ જુઓ.`,
    hi: `${name} का लाइव न्यूज़ स्ट्रीम देखें।`,
    ja: `${name} のライブニュース配信をご覧ください。`,
    kn: `${name} ನ ಲೈವ್ ಸುದ್ದಿ ಸ್ಟ್ರೀಮ್ ನೋಡಿ.`,
    ko: `${name}의 라이브 뉴스 스트림을 시청하세요.`,
    ml: `${name}യുടെ ലൈവ് വാർത്ത സ്ട്രീം കാണുക.`,
    mr: `${name} चे लाइव्ह न्यूज स्ट्रीम पहा.`,
    pa: `${name} ਦਾ ਲਾਈਵ ਨਿਊਜ਼ ਸਟ੍ਰੀਮ ਵੇਖੋ।`,
    pt: `Assista à transmissão de notícias ao vivo de ${name}.`,
    ru: `Смотрите прямую новостную трансляцию ${name}.`,
    ta: `${name} நேரலை செய்தி ஸ்ட்ரீமைப் பாருங்கள்.`,
    te: `${name} లైవ్ న్యూస్ స్ట్రీమ్ చూడండి.`,
    ur: `${name} کی لائیو نیوز اسٹریم دیکھیں۔`,
    zh: `观看 ${name} 的直播新闻。`,
  };
  if (templates[language]) return templates[language];
  return `Watch the live news stream from ${name}.`;
}

function localizedApprovedLiveWhyItMatters(provider, language = 'en') {
  const label = providerLabel(provider);
  const templates = {
    ar: `يتم تحميل هذا البث من مصدر ${label} معتمد في Nuzenio مع إسناد مباشر للمصدر.`,
    bn: `এই স্ট্রিমটি Nuzenio-অনুমোদিত ${label} উৎস থেকে সরাসরি উৎস-স্বীকৃতিসহ লোড করা হয়েছে।`,
    de: `Dieser Stream wird von einer von Nuzenio geprüften ${label}-Quelle mit direkter Quellenangabe geladen.`,
    es: `Esta transmisión se carga desde una fuente ${label} aprobada por Nuzenio con atribución directa.`,
    fr: `Ce direct est chargé depuis une source ${label} approuvée par Nuzenio avec attribution directe.`,
    gu: `આ સ્ટ્રીમ Nuzenio દ્વારા મંજૂર ${label} સ્ત્રોતથી સીધી source attribution સાથે લોડ થાય છે.`,
    hi: `यह स्ट्रीम सीधे स्रोत attribution के साथ Nuzenio-approved ${label} स्रोत से लोड की गई है।`,
    ja: `この配信はNuzenio承認済みの${label}ソースから、直接の出典表示付きで読み込まれます。`,
    kn: `ಈ ಸ್ಟ್ರೀಮ್ Nuzenio ಅನುಮೋದಿತ ${label} ಮೂಲದಿಂದ ನೇರ ಮೂಲ ಉಲ್ಲೇಖದೊಂದಿಗೆ ಲೋಡ್ ಆಗಿದೆ.`,
    ko: `이 스트림은 Nuzenio 승인 ${label} 출처에서 직접 출처 표시와 함께 로드됩니다.`,
    ml: `ഈ സ്ട്രീം Nuzenio അംഗീകൃത ${label} ഉറവിടത്തിൽ നിന്ന് നേരിട്ടുള്ള ഉറവിട പരാമർശത്തോടെയാണ് ലോഡ് ചെയ്യുന്നത്.`,
    mr: `हा स्ट्रीम Nuzenio-मंजूर ${label} स्रोतावरून थेट स्रोत attribution सह लोड केला आहे.`,
    pa: `ਇਹ ਸਟ੍ਰੀਮ Nuzenio-ਮਨਜ਼ੂਰ ${label} ਸਰੋਤ ਤੋਂ ਸਿੱਧੀ ਸਰੋਤ attribution ਨਾਲ ਲੋਡ ਹੁੰਦੀ ਹੈ।`,
    pt: `Esta transmissão é carregada de uma fonte ${label} aprovada pelo Nuzenio com atribuição direta.`,
    ru: `Эта трансляция загружается из одобренного Nuzenio источника ${label} с прямой ссылкой на источник.`,
    ta: `இந்த ஸ்ட்ரீம் Nuzenio அங்கீகரித்த ${label} மூலத்திலிருந்து நேரடி source attribution உடன் ஏற்றப்படுகிறது.`,
    te: `ఈ స్ట్రీమ్ Nuzenio ఆమోదించిన ${label} మూలం నుండి ప్రత్యక్ష source attributionతో లోడ్ అవుతుంది.`,
    ur: `یہ اسٹریم Nuzenio سے منظور شدہ ${label} ذریعہ سے براہ راست source attribution کے ساتھ لوڈ ہوتی ہے۔`,
    zh: `此直播来自 Nuzenio 批准的 ${label} 来源，并带有直接来源标注。`,
  };
  if (templates[language]) return templates[language];
  return `This stream is loaded from a Nuzenio-approved ${label} source with direct attribution.`;
}

function localizedVideoWhatHappened(category, source, language = 'en') {
  const liveWord = category === 'live';
  const templates = {
    ar: `شاهد فيديو أخبار ${liveWord ? 'مباشرا ' : ''}على YouTube من ${source}.`,
    bn: `${source}-এর ${liveWord ? 'লাইভ ' : ''}YouTube সংবাদ ভিডিও দেখুন।`,
    de: `Sehen Sie dieses ${liveWord ? 'Live-' : ''}YouTube-Nachrichtenvideo von ${source}.`,
    es: `Mira este video de noticias ${liveWord ? 'en vivo ' : ''}de YouTube de ${source}.`,
    fr: `Regardez cette vidéo d'actualité ${liveWord ? 'en direct ' : ''}sur YouTube de ${source}.`,
    gu: `${source} નું ${liveWord ? 'લાઈવ ' : ''}YouTube સમાચાર વિડિયો જુઓ.`,
    hi: `${source} का ${liveWord ? 'लाइव ' : ''}YouTube न्यूज़ वीडियो देखें।`,
    ja: `${source} の${liveWord ? 'ライブ' : ''}YouTubeニュース動画をご覧ください。`,
    kn: `${source} ನ ${liveWord ? 'ಲೈವ್ ' : ''}YouTube ಸುದ್ದಿ ವೀಡಿಯೊ ನೋಡಿ.`,
    ko: `${source}의 ${liveWord ? '라이브 ' : ''}YouTube 뉴스 영상을 시청하세요.`,
    ml: `${source}യുടെ ${liveWord ? 'ലൈവ് ' : ''}YouTube വാർത്ത വീഡിയോ കാണുക.`,
    mr: `${source} चे ${liveWord ? 'लाइव्ह ' : ''}YouTube न्यूज व्हिडिओ पहा.`,
    pa: `${source} ਦਾ ${liveWord ? 'ਲਾਈਵ ' : ''}YouTube ਨਿਊਜ਼ ਵੀਡੀਓ ਵੇਖੋ।`,
    pt: `Assista a este video de notícias ${liveWord ? 'ao vivo ' : ''}no YouTube de ${source}.`,
    ru: `Смотрите ${liveWord ? 'прямое ' : ''}новостное видео YouTube от ${source}.`,
    ta: `${source} இன் ${liveWord ? 'நேரலை ' : ''}YouTube செய்தி வீடியோவைப் பாருங்கள்.`,
    te: `${source} యొక్క ${liveWord ? 'లైవ్ ' : ''}YouTube వార్తల వీడియో చూడండి.`,
    ur: `${source} کی ${liveWord ? 'لائیو ' : ''}YouTube نیوز ویڈیو دیکھیں۔`,
    zh: `观看来自 ${source} 的${liveWord ? '直播' : ''} YouTube 新闻视频。`,
  };
  if (templates[language]) return templates[language];
  return `Watch this ${category === 'live' ? 'live ' : ''}YouTube news video from ${source}.`;
}

function localizedVideoWhyItMatters(trustedChannelMode, language = 'en') {
  const trustedTemplates = {
    ar: 'يتم تحميل فيديو الأخبار القابل للتشغيل من قناة YouTube معتمدة في Nuzenio مع إسناد المصدر.',
    bn: 'এই প্লেয়েবল YouTube সংবাদ ভিডিওটি Nuzenio-অনুমোদিত YouTube চ্যানেল থেকে উৎস-স্বীকৃতিসহ লোড হয়েছে।',
    de: 'Dieses abspielbare YouTube-Nachrichtenvideo wird von einem von Nuzenio geprüften YouTube-Kanal mit Quellenangabe geladen.',
    es: 'Este video de noticias reproducible se carga desde un canal de YouTube aprobado por Nuzenio con atribución de fuente.',
    fr: 'Cette vidéo YouTube d’actualité est chargée depuis une chaîne approuvée par Nuzenio avec attribution de source.',
    gu: 'આ playable YouTube સમાચાર વિડિયો Nuzenio-approved YouTube channel પરથી source attribution સાથે લોડ થાય છે.',
    hi: 'यह playable YouTube न्यूज़ वीडियो Nuzenio-approved YouTube channel से source attribution के साथ लोड किया गया है।',
    ja: 'この再生可能なYouTubeニュース動画は、Nuzenio承認済みYouTubeチャンネルから出典表示付きで読み込まれます。',
    kn: 'ಈ ಪ್ಲೇ ಆಗುವ YouTube ಸುದ್ದಿ ವೀಡಿಯೊ Nuzenio ಅನುಮೋದಿತ YouTube ಚಾನೆಲ್‌ನಿಂದ ಮೂಲ ಉಲ್ಲೇಖದೊಂದಿಗೆ ಲೋಡ್ ಆಗಿದೆ.',
    ko: '이 재생 가능한 YouTube 뉴스 영상은 Nuzenio 승인 YouTube 채널에서 출처 표시와 함께 로드됩니다.',
    ml: 'ഈ പ്ലേ ചെയ്യാവുന്ന YouTube വാർത്ത വീഡിയോ Nuzenio അംഗീകൃത YouTube ചാനലിൽ നിന്ന് ഉറവിട പരാമർശത്തോടെയാണ് ലോഡ് ചെയ്യുന്നത്.',
    mr: 'हा playable YouTube न्यूज व्हिडिओ Nuzenio-मंजूर YouTube channel वरून source attribution सह लोड केला आहे.',
    pa: 'ਇਹ playable YouTube ਨਿਊਜ਼ ਵੀਡੀਓ Nuzenio-ਮਨਜ਼ੂਰ YouTube channel ਤੋਂ source attribution ਨਾਲ ਲੋਡ ਹੁੰਦੀ ਹੈ।',
    pt: 'Este video de notícias reproduzível é carregado de um canal do YouTube aprovado pelo Nuzenio com atribuição de fonte.',
    ru: 'Это воспроизводимое новостное видео YouTube загружается с одобренного Nuzenio канала YouTube с указанием источника.',
    ta: 'இந்த playable YouTube செய்தி வீடியோ Nuzenio அங்கீகரித்த YouTube channel-இலிருந்து source attribution உடன் ஏற்றப்படுகிறது.',
    te: 'ఈ playable YouTube వార్తల వీడియో Nuzenio ఆమోదించిన YouTube channel నుండి source attributionతో లోడ్ అవుతుంది.',
    ur: 'یہ playable YouTube نیوز ویڈیو Nuzenio سے منظور شدہ YouTube channel سے source attribution کے ساتھ لوڈ ہوتی ہے۔',
    zh: '此可播放的 YouTube 新闻视频来自 Nuzenio 批准的 YouTube 频道，并带有来源标注。',
  };
  const apiTemplates = {
    ar: 'يتم تحميل فيديو الأخبار القابل للتشغيل عبر واجهة YouTube Data API الرسمية مع إسناد المصدر.',
    bn: 'এই প্লেয়েবল YouTube সংবাদ ভিডিওটি অফিসিয়াল YouTube Data API দিয়ে উৎস-স্বীকৃতিসহ লোড হয়েছে।',
    de: 'Dieses abspielbare YouTube-Nachrichtenvideo wird über die offizielle YouTube Data API mit Quellenangabe geladen.',
    es: 'Este video de noticias reproducible se carga mediante la API oficial de YouTube Data con atribución de fuente.',
    fr: 'Cette vidéo YouTube d’actualité est chargée via l’API officielle YouTube Data avec attribution de source.',
    gu: 'આ playable YouTube સમાચાર વિડિયો official YouTube Data API દ્વારા source attribution સાથે લોડ થાય છે.',
    hi: 'यह playable YouTube न्यूज़ वीडियो official YouTube Data API से source attribution के साथ लोड किया गया है।',
    ja: 'この再生可能なYouTubeニュース動画は、公式YouTube Data API経由で出典表示付きで読み込まれます。',
    kn: 'ಈ ಪ್ಲೇ ಆಗುವ YouTube ಸುದ್ದಿ ವೀಡಿಯೊ ಅಧಿಕೃತ YouTube Data API ಮೂಲಕ ಮೂಲ ಉಲ್ಲೇಖದೊಂದಿಗೆ ಲೋಡ್ ಆಗಿದೆ.',
    ko: '이 재생 가능한 YouTube 뉴스 영상은 공식 YouTube Data API를 통해 출처 표시와 함께 로드됩니다.',
    ml: 'ഈ പ്ലേ ചെയ്യാവുന്ന YouTube വാർത്ത വീഡിയോ ഔദ്യോഗിക YouTube Data API വഴി ഉറവിട പരാമർശത്തോടെയാണ് ലോഡ് ചെയ്യുന്നത്.',
    mr: 'हा playable YouTube न्यूज व्हिडिओ official YouTube Data API मधून source attribution सह लोड केला आहे.',
    pa: 'ਇਹ playable YouTube ਨਿਊਜ਼ ਵੀਡੀਓ official YouTube Data API ਰਾਹੀਂ source attribution ਨਾਲ ਲੋਡ ਹੁੰਦੀ ਹੈ।',
    pt: 'Este video de notícias reproduzível é carregado pela API oficial YouTube Data com atribuição de fonte.',
    ru: 'Это воспроизводимое новостное видео YouTube загружается через официальный YouTube Data API с указанием источника.',
    ta: 'இந்த playable YouTube செய்தி வீடியோ official YouTube Data API வழியாக source attribution உடன் ஏற்றப்படுகிறது.',
    te: 'ఈ playable YouTube వార్తల వీడియో official YouTube Data API ద్వారా source attributionతో లోడ్ అవుతుంది.',
    ur: 'یہ playable YouTube نیوز ویڈیو official YouTube Data API کے ذریعے source attribution کے ساتھ لوڈ ہوتی ہے۔',
    zh: '此可播放的 YouTube 新闻视频通过官方 YouTube Data API 加载，并带有来源标注。',
  };
  if (trustedChannelMode && trustedTemplates[language]) return trustedTemplates[language];
  if (!trustedChannelMode && apiTemplates[language]) return apiTemplates[language];
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
  const templates = {
    ar: 'يتم عرض فيديو الأخبار من YouTube داخل Nuzenio مع إسناد مباشر للمصدر ورابط YouTube الأصلي.',
    bn: 'এই YouTube সংবাদ ভিডিওটি Nuzenio-এর ভেতরে সরাসরি উৎস-স্বীকৃতি এবং আসল YouTube লিঙ্কসহ দেখানো হয়েছে।',
    de: 'Dieses YouTube-Nachrichtenvideo wird in Nuzenio mit direkter Quellenangabe und Original-YouTube-Link angezeigt.',
    es: 'Este video de noticias de YouTube se muestra dentro de Nuzenio con atribución directa y enlace al video original.',
    fr: 'Cette vidéo YouTube d’actualité est affichée dans Nuzenio avec attribution directe et lien YouTube original.',
    gu: 'આ YouTube સમાચાર વિડિયો Nuzenio અંદર સીધી source attribution અને original YouTube link સાથે બતાવવામાં આવે છે.',
    hi: 'यह YouTube न्यूज़ वीडियो Nuzenio के अंदर सीधे source attribution और original YouTube link के साथ दिखाया गया है।',
    ja: 'このYouTubeニュース動画は、Nuzenio内で直接の出典表示と元のYouTubeリンク付きで表示されます。',
    kn: 'ಈ YouTube ಸುದ್ದಿ ವೀಡಿಯೊ Nuzenio ಒಳಗೆ ನೇರ ಮೂಲ ಉಲ್ಲೇಖ ಮತ್ತು ಮೂಲ YouTube ಲಿಂಕ್ ಜೊತೆಗೆ ತೋರಿಸಲಾಗುತ್ತದೆ.',
    ko: '이 YouTube 뉴스 영상은 Nuzenio 안에서 직접 출처 표시와 원본 YouTube 링크와 함께 표시됩니다.',
    ml: 'ഈ YouTube വാർത്ത വീഡിയോ Nuzenioയിൽ നേരിട്ടുള്ള ഉറവിട പരാമർശത്തോടെയും യഥാർത്ഥ YouTube ലിങ്കോടെയും കാണിക്കുന്നു.',
    mr: 'हा YouTube न्यूज व्हिडिओ Nuzenio मध्ये थेट source attribution आणि original YouTube link सह दाखवला आहे.',
    pa: 'ਇਹ YouTube ਨਿਊਜ਼ ਵੀਡੀਓ Nuzenio ਦੇ ਅੰਦਰ ਸਿੱਧੀ source attribution ਅਤੇ original YouTube link ਨਾਲ ਦਿਖਾਈ ਜਾਂਦੀ ਹੈ।',
    pt: 'Este video de notícias do YouTube é exibido dentro do Nuzenio com atribuição direta e link original do YouTube.',
    ru: 'Это новостное видео YouTube показывается внутри Nuzenio с прямым указанием источника и ссылкой на оригинал YouTube.',
    ta: 'இந்த YouTube செய்தி வீடியோ Nuzenio-விற்குள் நேரடி source attribution மற்றும் original YouTube link உடன் காட்டப்படுகிறது.',
    te: 'ఈ YouTube వార్తల వీడియో Nuzenio లోపల ప్రత్యక్ష source attribution మరియు original YouTube linkతో చూపబడుతుంది.',
    ur: 'یہ YouTube نیوز ویڈیو Nuzenio کے اندر براہ راست source attribution اور original YouTube link کے ساتھ دکھائی جاتی ہے۔',
    zh: '此 YouTube 新闻视频在 Nuzenio 内显示，并带有直接来源标注和原始 YouTube 链接。',
  };
  if (templates[language]) return templates[language];
  return 'This YouTube news video is shown inside Nuzenio with direct source attribution and a link to the original YouTube page.';
}

function normalizeCountry(country = 'US') {
  const value = country.toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : 'US';
}

function countryLabel(country = 'US') {
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
  const value = String(category || '').toLowerCase().trim();
  if (CATEGORY_ALIASES[value]) return CATEGORY_ALIASES[value];
  return CATEGORIES.has(value) ? value : 'local';
}

function normalizeLanguage(language = 'en') {
  const value = String(language || 'en').toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.has(value) ? value : 'en';
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
  if (category === 'ai') {
    const aiQuery = `${CATEGORY_SEARCH_TERMS.ai.en} ${countryLabel(countryCode)} when:7d`;
    return `https://news.google.com/rss/search?q=${encodeURIComponent(aiQuery)}&${params}`;
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
  const statePlace = [stateRegion, countryLabel(countryCode)].filter(Boolean).join(' ');
  const base = place || countryLabel(countryCode);
  const countryName = countryLabel(countryCode);
  return [
    `${base} local news when:1d`,
    `${base} breaking news latest updates when:1d`,
    cityArea && stateRegion ? `${cityArea} ${stateRegion} news today when:3d` : '',
    nearby ? `${nearby} city news local updates when:3d` : `${base} latest local news when:3d`,
    cityArea ? `${cityArea} ${stateRegion} police weather traffic civic news when:7d` : `${base} local updates when:7d`,
    statePlace ? `${statePlace} latest news today when:1d` : '',
    statePlace ? `${statePlace} breaking news when:1d` : '',
    statePlace ? `${statePlace} district local news when:3d` : '',
    statePlace ? `${statePlace} state news local headlines when:3d` : `${base} news when:7d`,
    `${countryName} regional local news when:1d`,
  ].filter(Boolean);
}

function tokenizeLocalText(value = '') {
  return String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function localRelevanceScore(article, { country, region, city }) {
  const countryName = countryLabel(normalizeCountry(country));
  const stateRegion = cleanRegion(region);
  const cityArea = cleanRegion(city);
  const text = `${article.title || ''} ${article.summary || ''} ${article.source || ''}`.toLowerCase();
  const exactCity = cityArea && text.includes(cityArea.toLowerCase());
  const exactRegion = stateRegion && text.includes(stateRegion.toLowerCase());
  const exactCountry = countryName && text.includes(countryName.toLowerCase());
  const cityTokens = tokenizeLocalText(cityArea);
  const regionTokens = tokenizeLocalText(stateRegion);
  let score = 0;

  if (exactCity) score += 45;
  if (exactRegion) score += 26;
  if (exactCountry) score += 8;

  score += cityTokens.filter((token) => text.includes(token)).length * 12;
  score += regionTokens.filter((token) => text.includes(token)).length * 7;

  if (/\b(local|nearby|city|district|state|municipal|civic|traffic|weather|police|school|hospital|market|rail|road|metro|airport)\b/i.test(text)) {
    score += 12;
  }

  const ageMs = Date.now() - articleTime(article.pubDate);
  if (Number.isFinite(ageMs)) {
    if (ageMs <= 12 * 60 * 60 * 1000) score += 18;
    else if (ageMs <= 24 * 60 * 60 * 1000) score += 13;
    else if (ageMs <= 3 * 24 * 60 * 60 * 1000) score += 7;
    else score -= 10;
  }

  if ((cityArea || stateRegion) && !exactCity && !exactRegion && !cityTokens.some((token) => text.includes(token)) && !regionTokens.some((token) => text.includes(token))) {
    score -= 22;
  }

  return score;
}

function rankLocalArticles(articles, context) {
  const minimumScore = minimumLocalRelevanceScore(context);
  return articles
    .map((article, index) => ({
      article,
      index,
      score: localRelevanceScore(article, context),
    }))
    .filter(({ score }) => score >= minimumScore)
    .sort((a, b) => (b.score - a.score) || (articleTime(b.article.pubDate) - articleTime(a.article.pubDate)) || (a.index - b.index))
    .map(({ article }) => article);
}

function minimumLocalRelevanceScore({ region, city } = {}) {
  if (cleanRegion(city)) return 24;
  if (cleanRegion(region)) return 18;
  return 0;
}

function localFeedMetadata(articles, { country, region, city, queries = [] }) {
  const scored = articles.map((article) => localRelevanceScore(article, { country, region, city }));
  const strongMatches = scored.filter((score) => score >= 30).length;
  const freshToday = articles.filter((article) => Date.now() - articleTime(article.pubDate) <= 24 * 60 * 60 * 1000).length;
  return {
    place: [cleanRegion(city), cleanRegion(region), countryLabel(normalizeCountry(country))].filter(Boolean).join(', '),
    precision: cleanRegion(city) ? 'city' : cleanRegion(region) ? 'state' : 'country',
    strongMatches,
    freshToday,
    queries: queries.slice(0, 4),
  };
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

function newsCacheKey({ category, country, region, city, language, q }) {
  return JSON.stringify({
    category: normalizeCategory(category),
    country: normalizeCountry(country),
    region: cleanRegion(region || ''),
    city: cleanRegion(city || ''),
    language: normalizeLanguage(language),
    q: cleanQuery(q || ''),
  });
}

function readMemoryCache(key, { allowStale = false } = {}) {
  const hit = memoryNewsCache.get(key);
  if (!hit) return null;
  const ageMs = Date.now() - hit.cachedAt;
  if (ageMs <= MEMORY_CACHE_TTL_MS || (allowStale && ageMs <= MEMORY_STALE_TTL_MS)) {
    return { ...hit, ageMs, stale: ageMs > MEMORY_CACHE_TTL_MS };
  }
  memoryNewsCache.delete(key);
  return null;
}

function writeMemoryCache(key, payload) {
  memoryNewsCache.set(key, {
    ...payload,
    cachedAt: Date.now(),
  });
  if (memoryNewsCache.size > 120) {
    const oldestKey = [...memoryNewsCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0]?.[0];
    if (oldestKey) memoryNewsCache.delete(oldestKey);
  }
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, enabled: Boolean(url && key) };
}

async function supabaseRequest(path, options = {}) {
  const config = supabaseConfig();
  if (!config.enabled) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase news cache failed with ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function canUseSupabaseNewsCache({ category, q }) {
  return !q && category !== 'local' && !VIDEO_CATEGORIES.has(category);
}

function rowToArticle(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const summary = buildSummary(row.summary || row.title);
  return {
    id: row.article_id,
    slug: payload.slug || slugifyTitle(row.title),
    title: row.title,
    link: row.link,
    source: row.source || payload.source || 'Publisher',
    sourceUrl: payload.sourceUrl || '',
    pubDate: row.published_at,
    category: row.category,
    country: row.country,
    language: payload.language || 'en',
    image: row.image || '',
    imageKind: row.image_kind || payload.imageKind || 'logo',
    readTime: payload.readTime || 1,
    trustScore: payload.trustScore || 90,
    sourceLabels: payload.sourceLabels || [],
    alsoReportedBy: payload.alsoReportedBy || [],
    clusterSize: payload.clusterSize || 1,
    rssSourceName: payload.rssSourceName || 'Supabase news cache',
    rssSourceUrl: payload.rssSourceUrl || '',
    fetchedAt: payload.fetchedAt || row.updated_at || '',
    correctionNotice: payload.correctionNotice || '',
    summary,
    fullBrief: summary,
    whatHappened: summary,
    whyItMatters: payload.whyItMatters || buildWhyItMatters(row.category, row.source || 'Publisher', 'en'),
  };
}

async function readSupabaseNewsCache({ category, country, language, q }, { allowStale = false } = {}) {
  if (!canUseSupabaseNewsCache({ category, q })) return null;
  try {
    const path = [
      'news_cache?select=article_id,title,link,source,summary,image,image_kind,category,country,published_at,updated_at,payload',
      `category=eq.${encodeURIComponent(category)}`,
      `country=eq.${encodeURIComponent(country)}`,
      'order=published_at.desc',
      'limit=60',
    ].join('&');
    const rows = await supabaseRequest(path);
    if (!Array.isArray(rows) || rows.length < 6) return null;
    const updatedAt = rows.reduce((latest, row) => Math.max(latest, new Date(row.updated_at || row.published_at).getTime() || 0), 0);
    const ageMs = Date.now() - updatedAt;
    if (ageMs <= SUPABASE_CACHE_TTL_MS || (allowStale && ageMs <= SUPABASE_STALE_TTL_MS)) {
      const articles = rows.map(rowToArticle).filter((article) => articleMatchesLanguage(article, language));
      if (articles.length < 6) return null;
      return {
        articles,
        updatedAt: new Date(updatedAt || Date.now()).toISOString(),
        stale: ageMs > SUPABASE_CACHE_TTL_MS,
        ageMs,
      };
    }
  } catch (error) {
    console.error('Supabase news cache read skipped:', error.message);
  }
  return null;
}

async function writeSupabaseNewsCache({ category, country, language, q, articles }) {
  if (!canUseSupabaseNewsCache({ category, q }) || !articles.length) return;
  try {
    const rows = articles.slice(0, 60).map((article) => {
      const summary = buildSummary(article.summary || article.fullBrief || article.title);
      return {
        article_id: article.id,
        title: article.title,
        link: article.link,
        source: article.source || 'Publisher',
        summary,
        image: article.image || null,
        image_kind: article.imageKind || 'logo',
        category,
        country,
        published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString(),
        payload: {
          sourceUrl: article.sourceUrl || '',
          slug: article.slug || slugifyTitle(article.title),
          readTime: article.readTime || 1,
          trustScore: article.trustScore || 90,
          sourceLabels: article.sourceLabels || sourceCredibilityLabels(article),
          alsoReportedBy: article.alsoReportedBy || [],
          clusterSize: article.clusterSize || 1,
          rssSourceName: article.rssSourceName || '',
          rssSourceUrl: article.rssSourceUrl || '',
          fetchedAt: article.fetchedAt || new Date().toISOString(),
          correctionNotice: article.correctionNotice || '',
          whyItMatters: article.whyItMatters || '',
          language: article.language || normalizeLanguage(language || 'en'),
        },
      };
    });
    await supabaseRequest('news_cache?on_conflict=article_id,category,country', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
  } catch (error) {
    console.error('Supabase news cache write skipped:', error.message);
  }
}

function copyrightSafeArticles(articles = []) {
  return articles.map((article) => {
    const summary = buildSummary(article.summary || article.fullBrief || article.title);
    const enriched = enrichTrustMetadata(article);
    return {
      ...enriched,
      summary,
      fullBrief: summary,
      whatHappened: article.whatHappened ? buildSummary(article.whatHappened) : summary,
    };
  });
}

function sourceCredibilityLabels(article = {}) {
  const labels = [];
  const sourceText = `${article.source || ''} ${article.sourceUrl || ''} ${article.link || ''}`.toLowerCase();
  const titleText = String(article.title || '').toLowerCase();
  const trustScore = Number(article.trustScore || 0);
  if (trustScore >= 90 || article.rssSourceName) labels.push('Verified source');
  if (/\b(gov|government|official|ministry|department|who|un|sec|federal|parliament|court|police)\b|\.gov\b/.test(sourceText)) {
    labels.push('Official source');
  }
  if (article.category === 'local') labels.push('Local source');
  if (/\b(live|breaking|developing|updates?)\b/i.test(titleText) || Date.now() - articleTime(article.pubDate) < 3 * 60 * 60 * 1000) {
    labels.push('Developing story');
  }
  return [...new Set(labels)].slice(0, 4);
}

function enrichTrustMetadata(article = {}) {
  const alsoReportedBy = Array.isArray(article.alsoReportedBy) ? article.alsoReportedBy.slice(0, 6) : [];
  return {
    ...article,
    sourceLabels: article.sourceLabels?.length ? article.sourceLabels : sourceCredibilityLabels(article),
    alsoReportedBy,
    clusterSize: article.clusterSize || (alsoReportedBy.length ? alsoReportedBy.length + 1 : 1),
    rssSourceName: article.rssSourceName || 'Google News RSS',
    rssSourceUrl: article.rssSourceUrl || '',
    fetchedAt: article.fetchedAt || new Date().toISOString(),
    correctionNotice: article.correctionNotice || '',
  };
}

function newsPayload({ category, country, region, city, language, q, articles, sourceType, updatedAt = new Date().toISOString(), stale = false, localMeta = null }) {
  const safeArticles = copyrightSafeArticles(articles);
  return {
    ok: true,
    category,
    country,
    countryName: countryLabel(country),
    region: region || null,
    city: city || null,
    language,
    query: q || null,
    total: safeArticles.length,
    sourceType,
    updatedAt,
    stale,
    localMeta: category === 'local' ? (localMeta || localFeedMetadata(safeArticles, { country, region, city })) : null,
    articles: safeArticles,
  };
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
    const fresh = rankLocalArticles(polishFeed(batches, { days: 10, language, perSourceLimit: 10 }), { country, region, city });
    const meta = localFeedMetadata(fresh, { country, region, city, queries });
    const hasHealthyCityFeed = meta.precision === 'city' && (meta.strongMatches >= 6 || meta.freshToday >= 8);
    const hasHealthyRegionalFeed = meta.precision !== 'city' && fresh.length >= 24;
    if (fresh.length >= 28 || (fresh.length >= 18 && (hasHealthyCityFeed || hasHealthyRegionalFeed))) {
      const articles = fresh.slice(0, 60);
      return {
        articles,
        localMeta: localFeedMetadata(articles, { country, region, city, queries }),
      };
    }
  }

  const finalArticles = rankLocalArticles(polishFeed(batches, { days: MAX_RSS_AGE_DAYS, language, perSourceLimit: 10 }), { country, region, city }).slice(0, 60);
  if (!finalArticles.length && lastError) throw lastError;
  return {
    articles: finalArticles,
    localMeta: localFeedMetadata(finalArticles, { country, region, city, queries }),
  };
}

async function fetchApprovedPublisherArticles({ category, country, language }) {
  const sources = approvedRssSources({ category, country, language });
  if (!sources.length) return { articles: [], sourceType: 'publisher-rss-empty', errors: [] };

  const settled = await Promise.allSettled(sources.map(async (source) => {
    const xml = await fetchText(source.rssUrl);
    return parse(xml, category, country, language, source).map((article) => ({
      ...article,
      source: source.name || article.source,
      sourceUrl: source.homepage || article.sourceUrl,
      trustScore: Math.min(99, (article.trustScore || 90) + Math.max(0, Math.min(5, Math.floor(source.priority / 20)))),
      rssSourceId: source.id || article.rssSourceId || '',
      rssSourceName: source.name || article.rssSourceName || 'Approved publisher RSS',
      rssSourceUrl: source.rssUrl || article.rssSourceUrl || '',
    }));
  }));

  const articles = [];
  const errors = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') articles.push(...result.value);
    else errors.push(`${sources[index]?.name || 'RSS source'}: ${result.reason?.message || 'failed'}`);
  });

  return {
    articles: polishFeed(articles, { days: maxAgeDaysForCategory(category), language, perSourceLimit: 6 }).slice(0, 60),
    sourceType: errors.length && articles.length ? 'publisher-rss-partial' : 'publisher-rss',
    errors,
  };
}

async function fetchGoogleNewsArticles({ category, country, region, city, language, q }) {
  if (q) {
    return polishFeed(
      parse(await fetchText(googleNewsUrl({ category, country, q, region, city, language })), category, country, language),
      { days: maxAgeDaysForCategory(category), language },
    );
  }

  if (category === 'local') {
    const localResult = await fetchFreshLocalArticles({ country, region, city, language });
    return localResult.articles;
  }

  const urls = [
    googleNewsUrl({ category, country, q, region, city, language }),
    ...categorySearchQueries({ category, country, language }).map((query) => googleNewsSearchUrl({ country, language, q: query })),
  ];
  const settled = await Promise.allSettled(urls.map((url) => fetchText(url)));
  const batches = [];
  let lastError = null;
  settled.forEach((result) => {
    if (result.status === 'fulfilled') batches.push(...parse(result.value, category, country, language));
    else lastError = result.reason;
  });

  const finalArticles = interleaveSources(
    rankCategoryArticles(polishFeed(batches, { days: maxAgeDaysForCategory(category), language }), category),
    12,
  ).slice(0, 60);
  if (!finalArticles.length && lastError) throw lastError;
  return finalArticles;
}

async function fetchFreshNewsArticles({ category, country, region, city, language, q }) {
  let googleArticles = [];
  let publisherArticles = [];
  let googleError = null;
  let publisherError = null;

  try {
    if (!q && category === 'local') {
      const localResult = await fetchFreshLocalArticles({ country, region, city, language });
      googleArticles = localResult.articles;
      return {
        articles: googleArticles,
        sourceType: 'fresh-local-rss',
        localMeta: localResult.localMeta,
      };
    }
    if (!q && category !== 'local') {
      const [googleResult, publisherResult] = await Promise.allSettled([
        fetchGoogleNewsArticles({ category, country, region, city, language, q }),
        fetchApprovedPublisherArticles({ category, country, language }),
      ]);
      if (googleResult.status === 'fulfilled') {
        googleArticles = googleResult.value;
      } else {
        googleError = googleResult.reason;
      }
      if (publisherResult.status === 'fulfilled') {
        publisherArticles = publisherResult.value.articles;
        if (!publisherArticles.length && publisherResult.value.errors.length) {
          publisherError = new Error(publisherResult.value.errors.join('; '));
        }
      } else {
        publisherError = publisherResult.reason;
      }
    } else {
      googleArticles = await fetchGoogleNewsArticles({ category, country, region, city, language, q });
    }
  } catch (error) {
    googleError = error;
  }

  const merged = interleaveSources(
    rankCategoryArticles(polishFeed([...googleArticles, ...publisherArticles], {
      days: maxAgeDaysForCategory(category),
      language,
      perSourceLimit: 12,
    }), category),
    12,
  ).slice(0, 60);

  if (merged.length) {
    return {
      articles: merged,
      sourceType: googleArticles.length && publisherArticles.length
        ? 'google-and-publisher-rss'
        : publisherArticles.length
          ? 'publisher-rss'
          : (!q && category === 'local' ? 'fresh-local-rss' : 'fresh-rss'),
    };
  }

  throw googleError || publisherError || new Error('No live RSS articles available');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        Allow: 'GET, OPTIONS',
      },
      body: JSON.stringify({ ok: false, error: 'Method not allowed' }),
    };
  }

  try {
    const category = normalizeCategory(event.queryStringParameters?.category || 'local');
    const country = normalizeCountry(event.queryStringParameters?.country || 'US');
    const region = cleanRegion(event.queryStringParameters?.region || '');
    const city = cleanRegion(event.queryStringParameters?.city || '');
    const language = normalizeLanguage(event.queryStringParameters?.language || 'en');
    const q = cleanQuery(event.queryStringParameters?.q || '');
    const forceFresh = Boolean(event.queryStringParameters?.fresh);
    const key = newsCacheKey({ category, country, region, city, language, q });

    if (!q && VIDEO_CATEGORIES.has(category)) {
      const { articles, sourceType } = await fetchYouTubeVideos({ category, country, language });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(newsPayload({
          category,
          country,
          region,
          city,
          language,
          q,
          articles,
          sourceType,
        })),
      };
    }

    if (!forceFresh) {
      const memoryHit = readMemoryCache(key);
      if (memoryHit) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(newsPayload({
            category,
            country,
            region,
            city,
            language,
            q,
            articles: memoryHit.articles,
            sourceType: memoryHit.sourceType || 'memory-cache',
            updatedAt: memoryHit.updatedAt,
            stale: memoryHit.stale,
            localMeta: memoryHit.localMeta,
          })),
        };
      }

      const supabaseHit = await readSupabaseNewsCache({ category, country, language, q });
      if (supabaseHit) {
        writeMemoryCache(key, {
          articles: supabaseHit.articles,
          sourceType: 'supabase-cache',
          updatedAt: supabaseHit.updatedAt,
        });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(newsPayload({
            category,
            country,
            region,
            city,
            language,
            q,
            articles: supabaseHit.articles,
            sourceType: 'supabase-cache',
            updatedAt: supabaseHit.updatedAt,
            stale: supabaseHit.stale,
          })),
        };
      }
    }

    const freshResult = await fetchFreshNewsArticles({ category, country, region, city, language, q });
    const articles = freshResult.articles;
    const updatedAt = new Date().toISOString();
    const sourceType = freshResult.sourceType || (!q && category === 'local' ? 'fresh-local-rss' : 'fresh-rss');
    writeMemoryCache(key, { articles, sourceType, updatedAt, localMeta: freshResult.localMeta });
    await writeSupabaseNewsCache({ category, country, language, q, articles });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(newsPayload({
        category,
        country,
        region,
        city,
        language,
        articles,
        sourceType,
        updatedAt,
        localMeta: freshResult.localMeta,
      })),
    };
  } catch (error) {
    const category = normalizeCategory(event.queryStringParameters?.category || 'local');
    const country = normalizeCountry(event.queryStringParameters?.country || 'US');
    const region = cleanRegion(event.queryStringParameters?.region || '');
    const city = cleanRegion(event.queryStringParameters?.city || '');
    const language = normalizeLanguage(event.queryStringParameters?.language || 'en');
    const q = cleanQuery(event.queryStringParameters?.q || '');
    const key = newsCacheKey({ category, country, region, city, language, q });
    const memoryFallback = readMemoryCache(key, { allowStale: true });
    if (memoryFallback) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(newsPayload({
          category,
          country,
          region,
          city,
          language,
          q,
          articles: memoryFallback.articles,
          sourceType: 'stale-memory-cache',
          updatedAt: memoryFallback.updatedAt,
          stale: true,
          localMeta: memoryFallback.localMeta,
        })),
      };
    }
    const supabaseFallback = await readSupabaseNewsCache({ category, country, language, q }, { allowStale: true });
    if (supabaseFallback) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(newsPayload({
          category,
          country,
          region,
          city,
          language,
          q,
          articles: supabaseFallback.articles,
          sourceType: 'stale-supabase-cache',
          updatedAt: supabaseFallback.updatedAt,
          stale: true,
        })),
      };
    }
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        ok: false,
        error: error.message,
        sourceType: 'live-rss',
        articles: [],
      }),
    };
  }
};
