import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe2,
  Home as HomeIcon,
  Languages,
  LogIn,
  LogOut,
  Mail,
  Newspaper,
  PlayCircle,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const categories = [
  ['local', 'Local'],
  ['top', 'Top News'],
  ['world', 'World'],
  ['business', 'Business'],
  ['tech', 'Technology'],
  ['sports', 'Sports'],
  ['entertainment', 'Entertainment'],
  ['health', 'Health'],
  ['science', 'Science'],
  ['live', 'Live News'],
  ['video', 'Video'],
];

const primarySectionRoutes = {
  local: '/local',
  live: '/live',
  video: '/video',
};

const categoryRoutes = {
  ...primarySectionRoutes,
  top: '/top-news',
  world: '/world',
  business: '/business',
  tech: '/technology',
  sports: '/sports',
  entertainment: '/entertainment',
  health: '/health',
  science: '/science',
};

const countryNames = {
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

const countryOptions = [
  'AE', 'AR', 'AT', 'AU', 'BD', 'BE', 'BR', 'CA', 'CH', 'CL', 'CN', 'CO', 'DE', 'DK', 'EG', 'ES', 'FI', 'FR',
  'GB', 'GR', 'HK', 'ID', 'IE', 'IL', 'IN', 'IT', 'JP', 'KE', 'KR', 'LK', 'MX', 'MY', 'NG', 'NL', 'NO', 'NP',
  'NZ', 'PH', 'PK', 'PL', 'PT', 'QA', 'RU', 'SA', 'SE', 'SG', 'TH', 'TR', 'TW', 'UA', 'US', 'VN', 'ZA',
].map((code) => ({ code, label: countryLabel(code) })).sort((a, b) => a.label.localeCompare(b.label));

const localPlacePresets = {
  IN: [
    ['Bihar', 'Raxaul'],
    ['Bihar', 'Patna'],
    ['Delhi', 'New Delhi'],
    ['Maharashtra', 'Mumbai'],
    ['Karnataka', 'Bengaluru'],
    ['West Bengal', 'Kolkata'],
  ],
  US: [
    ['New York', 'New York'],
    ['California', 'Los Angeles'],
    ['Illinois', 'Chicago'],
    ['Texas', 'Houston'],
    ['Florida', 'Miami'],
  ],
  GB: [
    ['England', 'London'],
    ['Scotland', 'Edinburgh'],
    ['Wales', 'Cardiff'],
    ['Northern Ireland', 'Belfast'],
  ],
  CA: [
    ['Ontario', 'Toronto'],
    ['British Columbia', 'Vancouver'],
    ['Quebec', 'Montreal'],
    ['Alberta', 'Calgary'],
  ],
  AU: [
    ['New South Wales', 'Sydney'],
    ['Victoria', 'Melbourne'],
    ['Queensland', 'Brisbane'],
    ['Western Australia', 'Perth'],
  ],
};

const languages = [
  { code: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', dir: 'ltr' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', dir: 'ltr' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', dir: 'ltr' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', dir: 'ltr' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', dir: 'ltr' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', dir: 'ltr' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', dir: 'ltr' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', dir: 'ltr' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', dir: 'ltr' },
  { code: 'ur', label: 'Urdu', native: 'اردو', dir: 'rtl' },
  { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl' },
  { code: 'es', label: 'Spanish', native: 'Español', dir: 'ltr' },
  { code: 'fr', label: 'French', native: 'Français', dir: 'ltr' },
  { code: 'de', label: 'German', native: 'Deutsch', dir: 'ltr' },
  { code: 'pt', label: 'Portuguese', native: 'Português', dir: 'ltr' },
  { code: 'ru', label: 'Russian', native: 'Русский', dir: 'ltr' },
  { code: 'zh', label: 'Chinese', native: '中文', dir: 'ltr' },
  { code: 'ja', label: 'Japanese', native: '日本語', dir: 'ltr' },
  { code: 'ko', label: 'Korean', native: '한국어', dir: 'ltr' },
];

const productionOrigin = 'https://nuzenio.com';

const translations = {
  en: {
    tagline: 'AI multilingual news bridge',
    searchPlaceholder: 'Search live news in your region...',
    search: 'Search',
    newsLanguage: 'News language',
    home: 'Home',
    saved: 'Saved',
    login: 'Google Login',
    logout: 'Logout',
    breaking: 'BREAKING',
    localNewsFor: 'Local news for',
    stateRegion: 'State / region',
    cityArea: 'City / area',
    useLocation: 'Use my location',
    latestStories: 'All Latest Stories',
    latestIntro: 'Every story shown here is pulled from the live RSS feed. Open any card for the full Nuzenio brief.',
    aiBriefReady: 'AI brief ready',
    readStory: 'Read story',
    aiBrief: 'AI Brief',
    save: 'Save',
    source: 'Source',
    trending: 'Trending Now',
    dailyBrief: 'Daily Brief',
    subscribe: 'Subscribe',
    email: 'Email address',
    brandBrief: 'Nuzenio Brief',
    fullStoryAccess: 'Full story access',
    fullStoryText: 'Nuzenio shows the complete available RSS brief, AI context, key facts, and attribution here. The full publisher article opens on the original source for copyright-safe reading.',
    whatHappened: 'What happened',
    whyItMatters: 'Why it matters',
    keyFacts: 'Key facts',
    timeline: 'Timeline',
    background: 'Background',
    quickFaq: 'Quick FAQ',
    relatedStories: 'Related stories',
    sourceAttribution: 'Source attribution',
    readOriginal: 'Read original publisher story',
    emptyFeed: 'No live stories loaded yet. Try another category, language, or location.',
    categories: {
      local: 'Local',
      top: 'Top News',
      world: 'World',
      business: 'Business',
      tech: 'Technology',
      sports: 'Sports',
      entertainment: 'Entertainment',
      health: 'Health',
      science: 'Science',
      live: 'Live News',
      video: 'Video',
    },
  },
  hi: {
    tagline: 'एआई बहुभाषी न्यूज़ ब्रिज',
    searchPlaceholder: 'अपने इलाके की लाइव खबरें खोजें...',
    search: 'खोजें',
    newsLanguage: 'न्यूज़ भाषा',
    home: 'होम',
    saved: 'सेव',
    login: 'गूगल लॉगिन',
    logout: 'लॉगआउट',
    breaking: 'ब्रेकिंग',
    localNewsFor: 'लोकल खबरें',
    stateRegion: 'राज्य / क्षेत्र',
    cityArea: 'शहर / इलाका',
    useLocation: 'मेरी लोकेशन',
    latestStories: 'ताज़ा खबरें',
    latestIntro: 'यहां हर खबर लाइव RSS फीड से आती है। पूरी Nuzenio ब्रीफ पढ़ने के लिए कार्ड खोलें।',
    aiBriefReady: 'एआई ब्रीफ तैयार',
    readStory: 'खबर पढ़ें',
    aiBrief: 'एआई ब्रीफ',
    save: 'सेव',
    source: 'स्रोत',
    trending: 'ट्रेंडिंग',
    dailyBrief: 'डेली ब्रीफ',
    subscribe: 'सब्सक्राइब',
    email: 'ईमेल पता',
    brandBrief: 'Nuzenio ब्रीफ',
    fullStoryAccess: 'पूरी खबर',
    fullStoryText: 'Nuzenio यहां उपलब्ध RSS ब्रीफ, एआई संदर्भ, मुख्य तथ्य और स्रोत दिखाता है। पूरी पब्लिशर रिपोर्ट मूल स्रोत पर खुलेगी।',
    whatHappened: 'क्या हुआ',
    whyItMatters: 'क्यों ज़रूरी है',
    keyFacts: 'मुख्य तथ्य',
    timeline: 'टाइमलाइन',
    background: 'पृष्ठभूमि',
    quickFaq: 'त्वरित सवाल',
    relatedStories: 'संबंधित खबरें',
    sourceAttribution: 'स्रोत जानकारी',
    readOriginal: 'मूल पब्लिशर खबर पढ़ें',
    emptyFeed: 'अभी लाइव खबरें लोड नहीं हुईं। दूसरी कैटेगरी, भाषा या लोकेशन आज़माएं।',
    categories: {
      local: 'लोकल',
      top: 'मुख्य खबरें',
      world: 'दुनिया',
      business: 'बिज़नेस',
      tech: 'टेक्नोलॉजी',
      sports: 'खेल',
      entertainment: 'मनोरंजन',
      health: 'स्वास्थ्य',
      science: 'विज्ञान',
      live: 'लाइव न्यूज़',
      video: 'वीडियो',
    },
  },
  ar: {
    tagline: 'جسر أخبار ذكي متعدد اللغات',
    searchPlaceholder: 'ابحث عن الأخبار المباشرة في منطقتك...',
    search: 'بحث',
    newsLanguage: 'لغة الأخبار',
    home: 'الرئيسية',
    saved: 'المحفوظات',
    login: 'تسجيل Google',
    logout: 'خروج',
    breaking: 'عاجل',
    localNewsFor: 'أخبار محلية لـ',
    stateRegion: 'الولاية / المنطقة',
    cityArea: 'المدينة / الحي',
    useLocation: 'استخدم موقعي',
    latestStories: 'آخر الأخبار',
    latestIntro: 'كل الأخبار هنا تأتي من موجز RSS مباشر. افتح أي بطاقة لقراءة ملخص Nuzenio الكامل.',
    aiBriefReady: 'ملخص ذكي جاهز',
    readStory: 'اقرأ الخبر',
    aiBrief: 'ملخص ذكي',
    save: 'حفظ',
    source: 'المصدر',
    trending: 'الأكثر تداولا',
    dailyBrief: 'الموجز اليومي',
    subscribe: 'اشتراك',
    email: 'البريد الإلكتروني',
    brandBrief: 'ملخص Nuzenio',
    fullStoryAccess: 'الوصول للقصة كاملة',
    fullStoryText: 'يعرض Nuzenio ملخص RSS المتاح والسياق والحقائق والإسناد. يفتح المقال الكامل على موقع الناشر الأصلي.',
    whatHappened: 'ماذا حدث',
    whyItMatters: 'لماذا يهم',
    keyFacts: 'حقائق رئيسية',
    timeline: 'الخط الزمني',
    background: 'الخلفية',
    quickFaq: 'أسئلة سريعة',
    relatedStories: 'أخبار ذات صلة',
    sourceAttribution: 'إسناد المصدر',
    readOriginal: 'اقرأ خبر الناشر الأصلي',
    emptyFeed: 'لم يتم تحميل أخبار مباشرة بعد. جرب فئة أو لغة أو موقعا آخر.',
    categories: {
      local: 'محلي',
      top: 'أهم الأخبار',
      world: 'العالم',
      business: 'الأعمال',
      tech: 'التقنية',
      sports: 'الرياضة',
      entertainment: 'الترفيه',
      health: 'الصحة',
      science: 'العلوم',
      live: 'أخبار مباشرة',
      video: 'فيديو',
    },
  },
  es: {
    tagline: 'Puente de noticias multilingue con IA',
    searchPlaceholder: 'Busca noticias en vivo en tu region...',
    search: 'Buscar',
    newsLanguage: 'Idioma de noticias',
    home: 'Inicio',
    saved: 'Guardados',
    login: 'Login Google',
    logout: 'Salir',
    breaking: 'ULTIMA HORA',
    localNewsFor: 'Noticias locales para',
    stateRegion: 'Estado / region',
    cityArea: 'Ciudad / zona',
    useLocation: 'Usar mi ubicacion',
    latestStories: 'Ultimas noticias',
    latestIntro: 'Todas las noticias vienen de RSS en vivo. Abre una tarjeta para leer el resumen completo.',
    aiBriefReady: 'Resumen IA listo',
    readStory: 'Leer noticia',
    aiBrief: 'Resumen IA',
    save: 'Guardar',
    source: 'Fuente',
    trending: 'Tendencias',
    dailyBrief: 'Resumen diario',
    subscribe: 'Suscribirse',
    email: 'Correo electronico',
    brandBrief: 'Resumen Nuzenio',
    fullStoryAccess: 'Historia completa',
    fullStoryText: 'Nuzenio muestra el resumen RSS disponible, contexto, datos clave y atribucion. La historia completa abre en la fuente original.',
    whatHappened: 'Que paso',
    whyItMatters: 'Por que importa',
    keyFacts: 'Datos clave',
    timeline: 'Cronologia',
    background: 'Contexto',
    quickFaq: 'FAQ rapido',
    relatedStories: 'Noticias relacionadas',
    sourceAttribution: 'Atribucion de fuente',
    readOriginal: 'Leer fuente original',
    emptyFeed: 'Aun no se cargaron noticias en vivo. Prueba otra categoria, idioma o ubicacion.',
    categories: {
      local: 'Local',
      top: 'Principales',
      world: 'Mundo',
      business: 'Negocios',
      tech: 'Tecnologia',
      sports: 'Deportes',
      entertainment: 'Entretenimiento',
      health: 'Salud',
      science: 'Ciencia',
      live: 'Noticias en vivo',
      video: 'Video',
    },
  },
};

const languageAliases = {
  bn: 'hi',
  ta: 'hi',
  te: 'hi',
  mr: 'hi',
  gu: 'hi',
  kn: 'hi',
  ml: 'hi',
  pa: 'hi',
  ur: 'ar',
  fr: 'es',
  de: 'es',
  pt: 'es',
  ru: 'es',
  zh: 'es',
  ja: 'es',
  ko: 'es',
};

function uiCopy(code) {
  return translations[code] || translations[languageAliases[code]] || translations.en;
}

function readUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function normalizedPathname() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

function isRootHomePath() {
  return normalizedPathname() === '/' && !readArticleIdFromUrl();
}

function readArticleIdFromUrl() {
  const [, articleId] = window.location.pathname.match(/^\/article\/([^/]+)\/?$/) || [];
  return articleId ? decodeURIComponent(articleId) : readUrlParam('article');
}

function initialCategory() {
  const path = normalizedPathname();
  const routeCategory = Object.entries(categoryRoutes)
    .find(([, routePath]) => path === routePath)?.[0];
  if (routeCategory) return routeCategory;
  const urlCategory = readUrlParam('category');
  return categories.some(([key]) => key === urlCategory) ? urlCategory : 'top';
}

function initialLanguage() {
  const urlLanguage = readUrlParam('language');
  const linkedLanguage = languages.find((item) => item.code === urlLanguage);
  return linkedLanguage || readLocal('nuzenio_news_language', languages[0], 'newssetu_news_language');
}

function initialLocation() {
  const urlCountry = readUrlParam('country');
  if (!urlCountry) return readLocal('nuzenio_location', detectLocaleCountry(), 'newssetu_location');
  const country = normalizeCountry(urlCountry);
  const region = readUrlParam('region') || '';
  const city = readUrlParam('city') || '';
  return {
    country,
    region,
    city,
    label: placeLabel({ country, region, city }),
    source: 'link',
  };
}

function contextUrl({ category, location, language }) {
  const url = new URL(window.location.href);
  const currentArticle = readArticleIdFromUrl();
  url.pathname = categoryRoutes[category] || '/';
  if (categoryRoutes[category]) url.searchParams.delete('category');
  else url.searchParams.set('category', category);
  url.searchParams.set('country', location.country);
  url.searchParams.set('language', language.code);
  if (category === 'local' && location.region) url.searchParams.set('region', location.region);
  else url.searchParams.delete('region');
  if (category === 'local' && location.city) url.searchParams.set('city', location.city);
  else url.searchParams.delete('city');
  if (currentArticle) url.pathname = `/article/${encodeURIComponent(currentArticle)}`;
  url.searchParams.delete('article');
  return url;
}

function homeContextUrl({ category, location, language }) {
  const url = contextUrl({ category, location, language });
  url.pathname = categoryRoutes[category] || '/';
  url.searchParams.delete('article');
  return url;
}

function articleContextUrl(article, context) {
  const url = contextUrl(context);
  url.pathname = `/article/${encodeURIComponent(article.id)}`;
  url.searchParams.delete('article');
  return url;
}

function App() {
  const [screen, setScreen] = useState('home');
  const [category, setCategory] = useState(initialCategory);
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState('Loading live news...');
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState(initialLanguage);
  const [location, setLocation] = useState(initialLocation);
  const [savedIds, setSavedIds] = useState(() => readLocal('nuzenio_saved_ids', [], 'newssetu_saved_ids'));
  const [history, setHistory] = useState(() => readLocal('nuzenio_history', [], 'newssetu_history'));
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [authNotice, setAuthNotice] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isLocalPage, setIsLocalPage] = useState(() => window.location.pathname === categoryRoutes.local);
  const [isRootHome, setIsRootHome] = useState(() => isRootHomePath());
  const newsRequestId = useRef(0);

  useEffect(() => {
    document.documentElement.dir = language.dir;
    document.documentElement.lang = language.code;
    document.documentElement.dataset.newsLanguage = language.code;
    writeLocal('nuzenio_news_language', language);
  }, [language]);

  useEffect(() => {
    if (!['manual', 'link'].includes(location.source)) {
      detectAccurateLocation(updateLocation);
    }
  }, []);

  useEffect(() => {
    loadNews(category, location.country, location.region, location.city, language.code);
  }, [category, location.country, location.region, location.city, language.code]);

  useEffect(() => {
    if (isRootHome && category === 'top') {
      setIsLocalPage(false);
      return;
    }
    const url = contextUrl({ category, location, language });
    window.history.replaceState({}, '', url);
    setIsLocalPage(category === 'local' && url.pathname === categoryRoutes.local);
  }, [category, isRootHome, location.country, location.region, location.city, language.code]);

  useEffect(() => {
    function syncArticleFromUrl() {
      setIsRootHome(isRootHomePath());
      setIsLocalPage(window.location.pathname === categoryRoutes.local);
      setCategory(initialCategory());
      const articleId = readArticleIdFromUrl();
      if (!articleId) {
        setSelected(null);
        return;
      }
      const linkedArticle = articles.find((article) => article.id === articleId);
      if (linkedArticle) setSelected(linkedArticle);
      else if (articles.length > 0) {
        setStatus('Shared story is no longer in the live feed. Showing the latest stories for this context.');
      }
    }

    syncArticleFromUrl();
    window.addEventListener('popstate', syncArticleFromUrl);
    return () => window.removeEventListener('popstate', syncArticleFromUrl);
  }, [articles]);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) syncSavedFromSupabase(session.user.id);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    updatePageSeo(selected, { category, isRootHome, location, language });
  }, [selected, category, isRootHome, location.country, location.region, location.city, language.code]);

  async function loadNews(
    cat = 'local',
    country = location.country,
    region = location.region,
    city = location.city,
    newsLanguage = language.code,
  ) {
    const requestId = newsRequestId.current + 1;
    newsRequestId.current = requestId;
    setIsLoadingNews(true);
    setStatus('Loading live RSS news...');
    setArticles([]);
    try {
      const cityParam = cat === 'local' && city ? `&city=${encodeURIComponent(city)}` : '';
      const regionParam = cat === 'local' && region ? `&region=${encodeURIComponent(region)}` : '';
      const languageParam = `&language=${encodeURIComponent(newsLanguage)}`;
      const freshParam = `&fresh=${Date.now()}`;
      const res = await fetch(
        `/api/news?category=${encodeURIComponent(cat)}&country=${encodeURIComponent(country)}${regionParam}${cityParam}${languageParam}${freshParam}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (requestId !== newsRequestId.current) return;
      if (!data.ok) throw new Error(data.error || 'News fetch failed');
      setArticles(data.articles || []);
      setLastUpdated(new Date());
      const place = cat === 'local' && data.city
        ? `${data.city}, ${data.region ? `${data.region}, ` : ''}${countryLabel(data.country)}`
        : cat === 'local' && data.region
          ? `${data.region}, ${countryLabel(data.country)}`
          : countryLabel(data.country);
      setStatus(feedStatusText({ cat, copy: uiCopy(newsLanguage), place, total: data.total }));
    } catch (error) {
      if (requestId !== newsRequestId.current) return;
      setStatus(`Live API error: ${error.message}`);
    } finally {
      if (requestId === newsRequestId.current) setIsLoadingNews(false);
    }
  }

  async function searchNews(event) {
    event?.preventDefault();
    if (!query.trim()) return loadNews(category, location.country, location.region, location.city, language.code);
    const requestId = newsRequestId.current + 1;
    newsRequestId.current = requestId;
    setIsLoadingNews(true);
    setStatus('Searching live RSS news...');
    setArticles([]);
    try {
      const res = await fetch(
        `/api/news?q=${encodeURIComponent(query.trim())}&country=${encodeURIComponent(location.country)}&language=${encodeURIComponent(language.code)}&fresh=${Date.now()}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (requestId !== newsRequestId.current) return;
      if (!data.ok) throw new Error(data.error || 'Search failed');
      setArticles(data.articles || []);
      setLastUpdated(new Date());
      setStatus(`${data.total || 0} results for "${query.trim()}"`);
    } catch (error) {
      if (requestId !== newsRequestId.current) return;
      setStatus(`Search error: ${error.message}`);
    } finally {
      if (requestId === newsRequestId.current) setIsLoadingNews(false);
    }
  }

  function refreshCurrentNews() {
    loadNews(category, location.country, location.region, location.city, language.code);
  }

  function updateLocation(next) {
    setLocation(next);
    writeLocal('nuzenio_location', next);
  }

  function navigateCategory(nextCategory) {
    setScreen('home');
    setIsRootHome(false);
    setCategory(nextCategory);
    setMobileSearchOpen(false);
    const url = homeContextUrl({ category: nextCategory, location, language });
    window.history.pushState({}, '', url);
    setIsLocalPage(nextCategory === 'local' && url.pathname === categoryRoutes.local);
  }

  function navigateHome() {
    setScreen('home');
    setCategory('top');
    setIsRootHome(true);
    setIsLocalPage(false);
    setMobileSearchOpen(false);
    window.history.pushState({}, '', '/');
  }

  async function loginWithGoogle() {
    if (!supabase) {
      setAuthNotice('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Google login.');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }

  async function syncSavedFromSupabase(userId) {
    const { data } = await supabase
      .from('saved_articles')
      .select('article_id')
      .eq('user_id', userId);
    if (data?.length) {
      const ids = data.map((item) => item.article_id);
      setSavedIds(ids);
      writeLocal('nuzenio_saved_ids', ids);
    }
  }

  async function toggleSave(article) {
    const exists = savedIds.includes(article.id);
    const next = exists ? savedIds.filter((id) => id !== article.id) : [article.id, ...savedIds];
    setSavedIds(next);
    writeLocal('nuzenio_saved_ids', next);

    if (!supabase || !user) return;
    if (exists) {
      await supabase.from('saved_articles').delete().match({ user_id: user.id, article_id: article.id });
      return;
    }
    await supabase.from('saved_articles').upsert({
      user_id: user.id,
      article_id: article.id,
      title: article.title,
      link: article.link,
      source: article.source,
      category: article.category,
      summary: article.summary,
      image_url: article.image || null,
      published_at: article.pubDate || null,
    });
  }

  async function openArticle(article) {
    setSelected(article);
    pushArticleUrl(article);
    const entry = {
      id: article.id,
      title: article.title,
      source: article.source,
      openedAt: new Date().toISOString(),
    };
    const next = [entry, ...history.filter((item) => item.id !== article.id)].slice(0, 30);
    setHistory(next);
    writeLocal('nuzenio_history', next);
    if (supabase && user) {
      await supabase.from('reading_history').insert({
        user_id: user.id,
        article_id: article.id,
        title: article.title,
        link: article.link,
        source: article.source,
        category: article.category,
      });
    }
  }

  function pushArticleUrl(article) {
    const url = articleContextUrl(article, { category, location, language });
    setIsRootHome(false);
    window.history.pushState({}, '', url);
  }

  function closeArticle() {
    setSelected(null);
    if (isRootHome && category === 'top') {
      window.history.replaceState({}, '', '/');
      return;
    }
    window.history.replaceState({}, '', homeContextUrl({ category, location, language }));
  }

  const copy = uiCopy(language.code);
  const lead = articles[0];
  const sideStories = articles.slice(1, 5);
  const feed = articles.slice(5);
  const ticker = useMemo(
    () => articles.slice(0, 6).map((article) => article.title).join(' | '),
    [articles],
  );

  return (
    <div className="appShell" data-section={category} data-local-page={isLocalPage ? 'true' : 'false'}>
      <Header
        authNotice={authNotice}
        category={category}
        copy={copy}
        language={language}
        loginWithGoogle={loginWithGoogle}
        logout={logout}
        mobileSearchOpen={mobileSearchOpen}
        isRootHome={isRootHome}
        query={query}
        screen={screen}
        searchNews={searchNews}
        navigateCategory={navigateCategory}
        navigateHome={navigateHome}
        setLanguage={setLanguage}
        setMobileSearchOpen={setMobileSearchOpen}
        setQuery={setQuery}
        user={user}
      />

      {screen === 'home' && (
        <Home
          articles={articles}
          category={category}
          copy={copy}
          feed={feed}
          language={language}
          isLoadingNews={isLoadingNews}
          isRootHome={isRootHome}
          lastUpdated={lastUpdated}
          lead={lead}
          location={location}
          navigateCategory={navigateCategory}
          setLocation={updateLocation}
          openArticle={openArticle}
          savedIds={savedIds}
          sideStories={sideStories}
          status={status}
          ticker={ticker}
          toggleSave={toggleSave}
          refreshNews={refreshCurrentNews}
        />
      )}
      {selected && (
        <ArticleModal
          article={selected}
          articles={articles}
          copy={copy}
          language={language}
          onClose={closeArticle}
          openArticle={openArticle}
          savedIds={savedIds}
          toggleSave={toggleSave}
        />
      )}
      <Footer copy={copy} />
      <MobileNav copy={copy} navigateCategory={navigateCategory} navigateHome={navigateHome} setMobileSearchOpen={setMobileSearchOpen} />
    </div>
  );
}

function Header({
  authNotice,
  category,
  copy,
  language,
  loginWithGoogle,
  logout,
  mobileSearchOpen,
  isRootHome,
  navigateCategory,
  navigateHome,
  query,
  screen,
  searchNews,
  setLanguage,
  setMobileSearchOpen,
  setQuery,
  user,
}) {
  return (
    <header className="header">
      <div className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigateHome();
          }}
          aria-label="Nuzenio home"
        >
          <div className="logo">N</div>
          <div>
            <h1>Nuzenio</h1>
            <small>{copy.tagline}</small>
          </div>
        </a>

        <form className={`searchBox ${mobileSearchOpen ? 'isOpen' : ''}`} onSubmit={searchNews}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
          <button className="searchSubmit" type="submit">
            {copy.search}
          </button>
        </form>

        <label className="newsLanguageSelect">
          <span>{copy.newsLanguage}</span>
          <select
            className="language"
            value={language.code}
            onChange={(event) => setLanguage(languages.find((item) => item.code === event.target.value))}
            aria-label="Set news language"
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.native}
              </option>
            ))}
          </select>
        </label>

        <button className="iconBtn" onClick={() => setMobileSearchOpen((value) => !value)} aria-label="Search">
          {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
        </button>
        {user ? (
          <button className="loginBtn" onClick={logout}>
            <LogOut size={17} /> {copy.logout}
          </button>
        ) : (
          <button className="loginBtn" onClick={loginWithGoogle}>
            <LogIn size={17} /> {copy.login}
          </button>
        )}
      </div>

      {authNotice && <div className="authNotice">{authNotice}</div>}

      <nav className="nav" aria-label="Primary navigation">
        <a
          href="/"
          className={screen === 'home' && isRootHome ? 'active' : ''}
          onClick={(event) => {
            event.preventDefault();
            navigateHome();
          }}
        >
          {copy.home}
        </a>
        <a
          href={categoryRoutes.local}
          className={screen === 'home' && category === 'local' ? 'active' : ''}
          onClick={(event) => {
            event.preventDefault();
            navigateCategory('local');
          }}
        >
          {copy.categories.local}
        </a>
        <a
          href={categoryRoutes.live}
          className={screen === 'home' && category === 'live' ? 'active' : ''}
          onClick={(event) => {
            event.preventDefault();
            navigateCategory('live');
          }}
        >
          {copy.categories.live}
        </a>
        <a
          href={categoryRoutes.video}
          className={screen === 'home' && category === 'video' ? 'active' : ''}
          onClick={(event) => {
            event.preventDefault();
            navigateCategory('video');
          }}
        >
          {copy.categories.video}
        </a>
      </nav>
      <nav className="newsNav" aria-label="News sections">
        {categories.filter(([key]) => !primarySectionRoutes[key]).map(([key, label]) => (
          <a
            key={key}
            href={categoryRoutes[key]}
            className={screen === 'home' && category === key && !(isRootHome && key === 'top') ? 'active' : ''}
            onClick={(event) => {
              event.preventDefault();
              navigateCategory(key);
            }}
          >
            {copy.categories[key] || label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function Home({
  articles,
  category,
  copy,
  feed,
  isRootHome,
  isLoadingNews,
  language,
  lastUpdated,
  lead,
  location,
  navigateCategory,
  openArticle,
  refreshNews,
  savedIds,
  setLocation,
  sideStories,
  status,
  ticker,
  toggleSave,
}) {
  const isVideoSection = ['live', 'video'].includes(category);
  const section = sectionContent(category, copy, location);

  if (isVideoSection) {
    return (
      <>
        <BreakingStrip label={videoSectionLabel(category, copy).toUpperCase()} text={ticker || status} />

        <main className={`main videoMain ${category === 'video' ? 'recordedVideoMain' : 'liveVideoMain'}`}>
          <section>
            <div className="videoHero">
              <div>
                <span className="badge">
                  <PlayCircle size={15} /> {category === 'live' ? 'Approved live sources' : 'Recorded news videos'}
                </span>
                <h2>{category === 'live' ? copy.categories.live : copy.categories.video}</h2>
                <p>
                  {category === 'live'
                    ? `Verified live news channels loaded for ${language.native} and your selected country. Watch inside Nuzenio.`
                    : `${language.native} recorded news videos only. Live streams stay on the Live News page.`}
                </p>
                <div className="videoHeroMeta">
                  <span>{language.native}</span>
                  <span>{category === 'live' ? 'Live channels' : 'Recorded only'}</span>
                  <span>Watch inside Nuzenio</span>
                </div>
              </div>
              <div className="videoHeroCount">
                <b>{articles.length}</b>
                <span>{category === 'live' ? 'live now' : 'videos'}</span>
              </div>
            </div>
            <VideoModeStrip category={category} language={language} location={location} status={status} />
            {articles.length > 0 ? (
              <VideoShowcase
                articles={articles}
                copy={copy}
                openArticle={openArticle}
                savedIds={savedIds}
                toggleSave={toggleSave}
              />
            ) : isLoadingNews ? (
              <VideoShowcaseSkeleton />
            ) : null}
            <AdSlot name="top-native" label="Top advertising inventory" />
            <div className="sectionHead">
              <div>
                <h2>{category === 'live' ? copy.categories.live : copy.categories.video}</h2>
                <p>{category === 'live' ? 'Playable live news streams.' : `Playable ${language.native} video news feed, excluding live streams.`}</p>
              </div>
              <SectionStatus
                isLoading={isLoadingNews}
                lastUpdated={lastUpdated}
                onRefresh={refreshNews}
                status={status}
              />
            </div>
            <div className="videoGrid">
              {articles.slice(1).map((article) => (
                <VideoCard
                  key={article.id}
                  article={article}
                  copy={copy}
                  openArticle={openArticle}
                  savedIds={savedIds}
                  toggleSave={toggleSave}
                />
              ))}
              {isLoadingNews && articles.length === 0 && <LoadingCards type="video" count={6} />}
              {!isLoadingNews && articles.length === 0 && <div className="empty">{copy.emptyFeed}</div>}
            </div>
          </section>

          <aside className="rightRail">
            <Trending articles={articles} copy={copy} openArticle={openArticle} />
            <AISummaryBox copy={copy} />
            <Newsletter copy={copy} language={language} />
            <AdSlot name="sidebar-rectangle" label="Sidebar advertising inventory" compact />
          </aside>
        </main>
      </>
    );
  }

  return (
    <>
      <BreakingStrip label={copy.breaking} text={ticker || status} />

      <main className="main">
        <section>
          {isRootHome && (
            <RootHomePanel
              copy={copy}
              language={language}
              location={location}
              navigateCategory={navigateCategory}
              status={status}
            />
          )}
          <LocationBanner copy={copy} location={location} setLocation={setLocation} status={status} />

          <div className="heroGrid">
            <button className="leadCard" onClick={() => lead && openArticle(lead)}>
              <div className="leadVisual">
                <Newspaper size={112} />
              </div>
              <div className="leadContent">
                <div className="badge">
                  <ShieldCheck size={15} /> Source attributed
                </div>
                <h2>{displayTitle(lead) || 'Loading live lead story...'}</h2>
                <p>{displaySummary(lead) || status}</p>
                <div className="leadActions">
                  <span>
                    <Sparkles size={15} /> {copy.aiBriefReady}
                  </span>
                  <span>
                    {copy.readStory} <ChevronRight size={15} />
                  </span>
                </div>
              </div>
            </button>

            <div className="sideList">
              {sideStories.map((article) => (
                <SmallStory
                  key={article.id}
                  article={article}
                  copy={copy}
                  openArticle={openArticle}
                />
              ))}
            </div>
          </div>

          <AdSlot name="top-native" label="Top advertising inventory" />

          <div className="sectionHead">
            <div>
              <h2>{section.title}</h2>
              <p>{section.intro}</p>
            </div>
            <SectionStatus
              isLoading={isLoadingNews}
              lastUpdated={lastUpdated}
              onRefresh={refreshNews}
              status={status}
            />
          </div>

          <div className="feedGrid">
            {feed.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                copy={copy}
                openArticle={openArticle}
                savedIds={savedIds}
                toggleSave={toggleSave}
              />
            ))}
            {isLoadingNews && articles.length === 0 && <LoadingCards count={6} />}
            {!isLoadingNews && articles.length === 0 && <div className="empty">{copy.emptyFeed}</div>}
          </div>
        </section>

        <aside className="rightRail">
          <Trending articles={articles} copy={copy} openArticle={openArticle} />
          <AISummaryBox copy={copy} />
          <Newsletter copy={copy} language={language} />
          <AdSlot name="sidebar-rectangle" label="Sidebar advertising inventory" compact />
        </aside>
      </main>
    </>
  );
}

function BreakingStrip({ label, text }) {
  const safeText = text || 'Loading live news...';
  const tickerText = `${safeText}   •   ${safeText}`;
  return (
    <div className="breaking" aria-label={`${label}: ${safeText}`}>
      <b>{label}</b>
      <div className="breakingViewport">
        <div className="breakingTrack">
          <span>{tickerText}</span>
          <span aria-hidden="true">{tickerText}</span>
        </div>
      </div>
    </div>
  );
}

function RootHomePanel({ copy, language, location, navigateCategory, status }) {
  const homeUrl = 'https://nuzenio.com';
  const place = countryLabel(location.country);
  return (
    <section className="rootHomePanel" aria-label="Nuzenio home">
      <div className="rootHomeCopy">
        <span className="badge">
          <ShieldCheck size={15} /> Nuzenio
        </span>
        <h2>{homeUrl}</h2>
        <p>Global news home for {place}, tuned to {language.native}.</p>
        <div className="rootHomeActions">
          <button className="primaryAction" onClick={() => navigateCategory('top')}>
            <Newspaper size={16} /> {copy.categories.top}
          </button>
          <button onClick={() => navigateCategory('local')}>
            <Globe2 size={16} /> {copy.categories.local}
          </button>
          <button onClick={() => navigateCategory('live')}>
            <PlayCircle size={16} /> {copy.categories.live}
          </button>
          <button onClick={() => navigateCategory('video')}>
            <PlayCircle size={16} /> {copy.categories.video}
          </button>
        </div>
      </div>
      <div className="rootHomeSignal">
        <b>Nuzenio.com</b>
        <span>{place}</span>
        <span>{language.native}</span>
        <small>{status}</small>
      </div>
    </section>
  );
}

function VideoModeStrip({ category, language, location, status }) {
  return (
    <div className="videoModeStrip">
      <div>
        <PlayCircle size={17} />
        <span>{category === 'live' ? 'Live news channels' : 'Recorded video news'}</span>
      </div>
      <div>
        <Languages size={17} />
        <span>{language.native}</span>
      </div>
      <div>
        <Globe2 size={17} />
        <span>{countryLabel(location.country)}</span>
      </div>
      <div>
        <ShieldCheck size={17} />
        <span>{status}</span>
      </div>
    </div>
  );
}

function SectionStatus({ isLoading, lastUpdated, onRefresh, status }) {
  return (
    <div className="sectionStatus">
      <span>{status}</span>
      {lastUpdated && <small>Updated {formatLastUpdated(lastUpdated)}</small>}
      <button onClick={onRefresh} disabled={isLoading} aria-label="Refresh news">
        <RefreshCw size={15} className={isLoading ? 'spinIcon' : ''} />
        Refresh
      </button>
    </div>
  );
}

function LoadingCards({ count = 6, type = 'article' }) {
  return Array.from({ length: count }, (_, index) => (
    <div className={`skeletonCard ${type === 'video' ? 'videoSkeleton' : ''}`} key={`loading-${type}-${index}`}>
      {type === 'video' && <div className="skeletonThumb" />}
      <span />
      <b />
      <p />
      <em />
    </div>
  ));
}

function VideoShowcaseSkeleton() {
  return (
    <section className="videoShowcase skeletonShowcase">
      <div className="featuredVideo skeletonFeature">
        <div className="featuredFrame" />
        <div className="featuredBody">
          <span />
          <b />
          <p />
        </div>
      </div>
      <div className="videoQueue skeletonQueue">
        <h3>Loading</h3>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={`queue-loading-${index}`}>
            <span />
            <b />
          </div>
        ))}
      </div>
    </section>
  );
}

function VideoShowcase({ articles, copy, openArticle, savedIds, toggleSave }) {
  const featured = articles[0];
  const queue = articles.slice(1, 6);
  const isSaved = savedIds.includes(featured.id);
  const isLive = featured.category === 'live';

  return (
    <section className="videoShowcase">
      <div className="featuredVideo">
        <div className="featuredFrame">
          <LiveVideoPlayer article={featured} autoplay={false} />
        </div>
        <div className="featuredBody">
          <div className="cardTop">
            <span className="category">{isLive ? 'LIVE NOW' : 'FEATURED VIDEO'}</span>
            <span>{featured.source}</span>
          </div>
          <h2>{displayTitle(featured)}</h2>
          <p>{displaySummary(featured)}</p>
          <div className="cardActions">
            <button className="primaryAction" onClick={() => openArticle(featured)}>
              <PlayCircle size={15} /> Theater mode
            </button>
            <button onClick={() => toggleSave(featured)}>
              <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? copy.saved : copy.save}
            </button>
            <button onClick={() => shareArticle(featured)}>
              <Share2 size={15} /> Share
            </button>
          </div>
        </div>
      </div>
      {queue.length > 0 && (
        <div className="videoQueue">
          <h3>Up next</h3>
          {queue.map((article) => (
            <button key={article.id} onClick={() => openArticle(article)}>
              <VideoThumbMedia article={article} compact />
              <span>
                <b>{displayTitle(article)}</b>
                <small>{article.source}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function VideoThumbMedia({ article, compact = false }) {
  const thumbnail = videoThumbnail(article);

  if (thumbnail) {
    return <img src={thumbnail} alt="" loading="lazy" />;
  }

  return (
    <div className={`videoThumbFallback ${compact ? 'compactThumbFallback' : ''}`} aria-hidden="true">
      <PlayCircle size={compact ? 24 : 38} />
    </div>
  );
}

function VideoCard({ article, copy, openArticle, savedIds, toggleSave }) {
  const isSaved = savedIds.includes(article.id);
  const isLive = article.category === 'live';
  return (
    <article className={`videoCard ${isLive ? 'liveCard' : ''}`}>
      <div className="inlineVideo">
        <button className="videoThumbButton" onClick={() => openArticle(article)} aria-label={`Watch ${displayTitle(article)}`}>
          <VideoThumbMedia article={article} />
          <span>
            <PlayCircle size={34} />
          </span>
        </button>
      </div>
      <div className="videoBody">
        <div className="cardTop">
          <span className="category">{isLive ? 'LIVE' : 'VIDEO'}</span>
          <span>{article.source}</span>
        </div>
        <button className="headline" onClick={() => openArticle(article)}>
          {displayTitle(article)}
        </button>
        <p>{displaySummary(article)}</p>
        <div className="cardActions">
          <button className="primaryAction" onClick={() => openArticle(article)}>
            <PlayCircle size={15} /> Watch
          </button>
          <button onClick={() => toggleSave(article)}>
            <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? copy.saved : copy.save}
          </button>
          <button onClick={() => shareArticle(article)}>
            <Share2 size={15} /> Share
          </button>
        </div>
      </div>
    </article>
  );
}

function LocationBanner({ copy, location, setLocation, status }) {
  const [draft, setDraft] = useState(location);
  const presets = localPlacePresets[draft.country] || localPlacePresets.IN;

  useEffect(() => {
    setDraft(location);
  }, [location.country, location.region, location.city, location.label, location.source]);

  function changeCountry(event) {
    const country = normalizeCountry(event.target.value);
    setDraft({ country, region: '', city: '', label: countryLabel(country), source: 'manual' });
  }

  function changeRegion(event) {
    const region = event.target.value;
    setDraft({
      ...draft,
      region,
      label: placeLabel({ ...draft, region }),
      source: 'manual',
    });
  }

  function changeCity(event) {
    const city = event.target.value;
    setDraft({
      ...draft,
      city,
      label: placeLabel({ ...draft, city }),
      source: 'manual',
    });
  }

  function applyDraft() {
    setLocation({
      ...draft,
      label: placeLabel(draft),
      source: 'manual',
    });
  }

  function applyPreset(region, city) {
    const next = {
      country: draft.country,
      region,
      city,
      label: placeLabel({ country: draft.country, region, city }),
      source: 'preset',
    };
    setDraft(next);
    setLocation(next);
  }

  if (window.location.pathname !== categoryRoutes.local) return null;

  return (
    <div className="locationBanner">
      <div className="locationSummary">
        <div>
          <Globe2 size={20} />
          <span>
            <b>{copy.localNewsFor}</b>
            <strong>{location.label}</strong>
          </span>
        </div>
        <p>{locationSourceLabel(location.source)} · {status}</p>
      </div>

      <div className="locationPanel">
        <div className="locationControls">
          <label>
            <span>Country</span>
            <select value={draft.country} onChange={changeCountry} aria-label="Set news country">
              {countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.stateRegion}</span>
            <input
              value={draft.region || ''}
              onChange={changeRegion}
              placeholder={copy.stateRegion}
              aria-label="Set state or region for local news"
            />
          </label>
          <label>
            <span>{copy.cityArea}</span>
            <input
              value={draft.city || ''}
              onChange={changeCity}
              placeholder={copy.cityArea}
              aria-label="Set city or nearby area for local news"
            />
          </label>
          <button className="primaryAction" onClick={applyDraft}>Apply local news</button>
          <button onClick={() => detectAccurateLocation(setLocation)}>{copy.useLocation}</button>
        </div>

        <div className="locationChips" aria-label="Popular local news locations">
          {presets.map(([region, city]) => (
            <button key={`${region}-${city}`} onClick={() => applyPreset(region, city)}>
              {city}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SmallStory({ article, copy, openArticle }) {
  return (
    <button className="smallStory" onClick={() => openArticle(article)}>
      <div className="miniThumb">
        <Globe2 size={28} />
      </div>
      <div>
        <b>{displayTitle(article)}</b>
        <span>
          {article.source} · {formatFreshAge(article.pubDate)}
        </span>
      </div>
    </button>
  );
}

function ArticleCard({ article, copy, openArticle, savedIds, toggleSave }) {
  const isSaved = savedIds.includes(article.id);
  return (
    <article className="articleCard">
      <div className="cardTop">
        <span className="category">{article.category?.toUpperCase()}</span>
        {['live', 'video'].includes(article.category) && (
          <span>
            <PlayCircle size={13} /> {article.category === 'live' ? 'Live' : 'YouTube'}
          </span>
        )}
        <span>
          <Clock size={13} /> {formatFreshAge(article.pubDate)}
        </span>
      </div>
      <div className="publisherLine">
        <span>
          <CheckCircle2 size={14} /> {article.source}
        </span>
        <span>{formatDate(article.pubDate)}</span>
      </div>
      <button className="headline" onClick={() => openArticle(article)}>
        {displayTitle(article)}
      </button>
      <p>{displaySummary(article)}</p>
      <div className="trustRow">
        <span>
          <ShieldCheck size={14} /> Source attributed
        </span>
        <span>
          <Clock size={14} /> {article.readTime || 2} min read
        </span>
      </div>
      <div className="cardActions">
        <button className="primaryAction" onClick={() => openArticle(article)}>
          <Sparkles size={15} /> {copy.aiBrief}
        </button>
        <button onClick={() => toggleSave(article)}>
          <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? copy.saved : copy.save}
        </button>
        <button onClick={() => shareArticle(article)}>
          <Share2 size={15} /> Share
        </button>
      </div>
      <button className="sourceAction" onClick={() => openArticle(article)}>
        {copy.readStory} <ChevronRight size={14} />
      </button>
    </article>
  );
}

function Trending({ articles, copy, openArticle }) {
  return (
    <div className="railCard">
      <h3>
        <TrendingUp size={18} /> {copy.trending}
      </h3>
      {articles.slice(0, 5).map((article, index) => (
        <button className="trend" key={article.id} onClick={() => openArticle(article)}>
          <b>{index + 1}</b>
          <span>{displayTitle(article)}</span>
        </button>
      ))}
    </div>
  );
}

function AISummaryBox({ copy }) {
  return (
    <div className="railCard aiBox">
      <h3>
        <Sparkles size={18} /> AI News Companion
      </h3>
      <p>Article pages include summary, context, key facts, and source attribution.</p>
      <span className="statusPill">{copy.aiBrief}</span>
    </div>
  );
}

function Newsletter({ copy, language }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  async function subscribe(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage('Enter a valid email address.');
      return;
    }
    if (supabase) {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert({ email: normalizedEmail, language: language.code });
      if (error && error.code !== '23505') {
        setMessage('Subscription could not be saved. Please try again.');
        return;
      }
    }
    setMessage('Subscribed for the daily brief.');
    setEmail('');
  }

  return (
    <form className="railCard" onSubmit={subscribe}>
      <h3>
        <Mail size={18} /> {copy.dailyBrief}
      </h3>
      <p>Top stories in your selected language every morning.</p>
      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.email} />
      <button type="submit">{copy.subscribe}</button>
      {message && <small>{message}</small>}
    </form>
  );
}

function ArticleModal({ article, articles, copy, onClose, openArticle, savedIds, toggleSave }) {
  const facts = buildKeyFacts(article);
  const timeline = buildTimeline(article);
  const faqs = buildFaq(article);
  const isVideo = isVideoArticle(article);
  const related = articles
    .filter((item) => item.id !== article.id && (item.category === article.category || item.source === article.source))
    .slice(0, 4);
  return (
    <div className="modalOverlay" onClick={onClose}>
      <article className="articleModal" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close article">
          <X size={20} />
        </button>
        <div className="progress" />
        <div className="articleTopline">
          <span className="category">{article.category?.toUpperCase()}</span>
        </div>
        <h1>{displayTitle(article)}</h1>
        <div className="articleMeta">
          <span>
            <CheckCircle2 size={15} /> {article.source}
          </span>
          <span>
            <Clock size={15} /> {formatFreshAge(article.pubDate)}
          </span>
          <span>{formatDate(article.pubDate)}</span>
          <span>
            <ShieldCheck size={15} /> Source attributed
          </span>
        </div>
        {isVideo && (
          <div className="videoPlayer">
            <LiveVideoPlayer article={article} />
          </div>
        )}
        <div className="summaryPanel">
          <h3>
            <Sparkles size={18} /> {isVideo ? 'Video brief' : copy.brandBrief}
          </h3>
          <p>{displayFullBrief(article)}</p>
        </div>
        <div className="fullStoryPanel">
          <div>
            <h3>{copy.fullStoryAccess}</h3>
            <p>{copy.fullStoryText}</p>
          </div>
        </div>
        <div className="infoGrid">
          <div>
            <h3>{copy.whatHappened}</h3>
            <p>{article.whatHappened || displaySummary(article)}</p>
          </div>
          <div>
            <h3>{copy.whyItMatters}</h3>
            <p>{article.whyItMatters}</p>
          </div>
          <div>
            <h3>{copy.keyFacts}</h3>
            <ul>
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="explainerGrid">
          <section className="timelinePanel">
            <h3>{copy.timeline}</h3>
            {timeline.map((item) => (
              <div className="timelineItem" key={item.label}>
                <b>{item.label}</b>
                <span>{item.text}</span>
              </div>
            ))}
          </section>
          <section className="backgroundPanel">
            <h3>{copy.background}</h3>
            <p>{buildBackground(article)}</p>
          </section>
        </div>
        <section className="faqPanel">
          <h3>{copy.quickFaq}</h3>
          {faqs.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </section>
        {related.length > 0 && (
          <section className="relatedPanel">
            <h3>{copy.relatedStories}</h3>
            <div>
              {related.map((item) => (
                <button key={item.id} onClick={() => openArticle(item)}>
                  <span>{item.source}</span>
                  <b>{item.title}</b>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="sourceBox">
          <h3>{copy.sourceAttribution}</h3>
          <p>
            This story is sourced from <b>{article.source}</b> via {isVideo ? sourceProviderLabel(article) : 'live RSS'}.
            Published {formatFreshAge(article.pubDate)}. Nuzenio links back to the original publisher for the full report.
          </p>
        </div>
        <AdSlot name="article-inline" label="Article advertising inventory" />
        <div className="sourceBox affiliateDisclosureBox">
          <h3>Affiliate disclosure</h3>
          <p>
            Nuzenio keeps editorial RSS stories separate from commercial placements. Any paid or affiliate link must be
            labeled before publication.
          </p>
        </div>
        <div className="readerTools">
          <button onClick={() => toggleSave(article)}>
            <Bookmark size={16} /> {savedIds.includes(article.id) ? copy.saved : copy.save}
          </button>
          <button onClick={() => shareArticle(article)}>
            <Share2 size={16} /> Share
          </button>
        </div>
        <a className="original" href={article.link} target="_blank" rel="noreferrer">
          {isVideo ? 'Open original source' : copy.readOriginal} <ExternalLink size={16} />
        </a>
      </article>
    </div>
  );
}

function MobileNav({ copy, navigateCategory, navigateHome, setMobileSearchOpen }) {
  return (
    <div className="mobileNav">
      <a href="/" onClick={(event) => {
        event.preventDefault();
        navigateHome();
      }}>
        <HomeIcon size={18} /> {copy.home}
      </a>
      <a href={categoryRoutes.local} onClick={(event) => {
        event.preventDefault();
        navigateCategory('local');
      }}>
        <Globe2 size={18} /> {copy.categories.local}
      </a>
      <a href={categoryRoutes.live} onClick={(event) => {
        event.preventDefault();
        navigateCategory('live');
      }}>
        <PlayCircle size={18} /> {copy.categories.live}
      </a>
      <a href={categoryRoutes.video} onClick={(event) => {
        event.preventDefault();
        navigateCategory('video');
      }}>
        <PlayCircle size={18} /> {copy.categories.video}
      </a>
      <button onClick={() => setMobileSearchOpen((value) => !value)}>
        <Search size={18} /> {copy.search}
      </button>
    </div>
  );
}

function Footer({ copy }) {
  return (
    <footer className="footer">
      <b>Nuzenio</b>
      <a href="/about.html">About</a>
      <a href="/sources.html">Sources</a>
      <a href="/editorial-policy.html">Editorial Policy</a>
      <a href="/contact.html">Contact</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="/affiliate-disclosure.html">Affiliate Disclosure</a>
      <span>{copy.tagline}</span>
    </footer>
  );
}

function AdSlot({ compact = false, label, name }) {
  return (
    <div className={`adSlot ${compact ? 'sideAd' : ''}`} data-ad-slot={name}>
      <span>{label}</span>
      <small>Advertisement space</small>
    </div>
  );
}

function displayTitle(article) {
  if (!article) return '';
  return article.title;
}

function displaySummary(article) {
  if (!article) return '';
  return article.summary;
}

function displayFullBrief(article) {
  if (!article) return '';
  return article.fullBrief || article.summary;
}

function isVideoArticle(article) {
  return ['live', 'video'].includes(article?.category) && Boolean(article?.videoId || article?.embedUrl || article?.streamUrl);
}

function videoSectionLabel(category, copy) {
  if (category === 'live') return copy.categories.live;
  return copy.categories.video;
}

function sectionContent(category, copy, location) {
  const label = copy.categories[category] || copy.latestStories;
  const place = location?.label || countryLabel(location?.country || 'IN');
  const intros = {
    local: `Local headlines and nearby updates for ${place}. Change country, state, or city to tune this page.`,
    top: 'Top headlines from the live news feed, refreshed for your selected country and language.',
    world: 'Global headlines from the world news section, separated from local and business feeds.',
    business: 'Business, markets, economy, companies, and money headlines from dedicated business sources.',
    tech: 'Technology, startups, AI, gadgets, platforms, and science-adjacent innovation headlines.',
    sports: 'Sports headlines, match updates, teams, leagues, and athlete news from the sports feed.',
    entertainment: 'Entertainment, film, television, music, celebrity, and culture stories in one feed.',
    health: 'Health, medicine, public health, wellness, and research headlines from the health feed.',
    science: 'Science, space, climate, discoveries, and research headlines from the science feed.',
  };
  return {
    title: localizedSectionTitle(category, copy, label),
    intro: intros[category] || copy.latestIntro,
  };
}

function feedStatusText({ cat, copy, place, total }) {
  if (copy === translations.hi) {
    if (cat === 'live') return `${place} के लिए ${total} लाइव न्यूज़ स्ट्रीम`;
    if (cat === 'video') return `${place} के लिए ${total} न्यूज़ वीडियो`;
    return `${place} के लिए ${total} ताज़ा खबरें`;
  }
  if (copy === translations.ar) {
    if (cat === 'live') return `${total} بثا إخباريا مباشرا لـ ${place}`;
    if (cat === 'video') return `${total} فيديو إخباريا لـ ${place}`;
    return `${total} خبرا حديثا لـ ${place}`;
  }
  if (copy === translations.es) {
    if (cat === 'live') return `${total} canales de noticias en vivo para ${place}`;
    if (cat === 'video') return `${total} videos de noticias para ${place}`;
    return `${total} noticias recientes para ${place}`;
  }
  const categoryLabel = copy.categories?.[cat] || cat;
  if (cat === 'live') return `${total} live news streams for ${place}`;
  if (cat === 'video') return `${total} news videos for ${place}`;
  return `${total} ${categoryLabel.toLowerCase()} articles for ${place}`;
}

function localizedSectionTitle(category, copy, label) {
  if (category === 'top') return copy.latestStories;
  if (category === 'live' || category === 'video') return label;
  if (copy === translations.ar) return `أخبار ${label}`;
  if (copy === translations.hi) return `${label} खबरें`;
  if (copy === translations.es) return `Noticias de ${label}`;
  return `${label} News`;
}

function LiveVideoPlayer({ article, autoplay = true, lazy = false }) {
  if (article?.streamUrl) {
    return (
      <video
        title={displayTitle(article)}
        src={article.streamUrl}
        poster={videoThumbnail(article)}
        controls
        playsInline
        muted={autoplay}
        autoPlay={autoplay}
        preload={lazy ? 'metadata' : 'auto'}
      />
    );
  }

  return (
    <iframe
      title={displayTitle(article)}
      src={mediaEmbedUrl(article, { autoplay })}
      loading={lazy ? 'lazy' : undefined}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

function mediaEmbedUrl(article, options = {}) {
  const autoplay = options.autoplay ?? true;
  const baseUrl = article?.embedUrl || `https://www.youtube-nocookie.com/embed/${article.videoId}`;
  const joiner = baseUrl.includes('?') ? '&' : '?';
  if (/player\.twitch\.tv/i.test(baseUrl)) {
    return `${baseUrl}${joiner}autoplay=${autoplay ? 'true' : 'false'}`;
  }
  if (/youtube(?:-nocookie)?\.com/i.test(baseUrl)) {
    return `${baseUrl}${joiner}autoplay=${autoplay ? '1' : '0'}&rel=0&modestbranding=1`;
  }
  return `${baseUrl}${joiner}autoplay=${autoplay ? '1' : '0'}`;
}

function videoThumbnail(article) {
  if (article?.image) return article.image;
  return article?.videoId ? `https://i.ytimg.com/vi/${article.videoId}/hqdefault.jpg` : '';
}

function sourceProviderLabel(article) {
  const labels = {
    youtube: 'YouTube',
    twitch: 'Twitch',
    official_embed: 'official publisher embed',
    hls: 'official HLS stream',
  };
  return labels[article?.provider] || 'approved video source';
}

function buildKeyFacts(article) {
  return [
    `Source: ${article.source || 'RSS publisher'}`,
    `Published: ${formatDate(article.pubDate)}`,
    `Category: ${article.category || 'top'}`,
  ];
}

function buildTimeline(article) {
  return [
    {
      label: 'Published',
      text: `${article.source || 'The publisher'} published this update at ${formatDate(article.pubDate)}.`,
    },
    {
      label: 'Now',
      text: 'Nuzenio is tracking the live RSS update and summarizing the available brief.',
    },
    {
      label: 'Next',
      text: 'Open the original publisher link for the latest full report, corrections, images, and live updates.',
    },
  ];
}

function buildBackground(article) {
  const category = article.category === 'local' ? 'local public-interest' : article.category || 'news';
  return `This is a ${category} story from ${article.source || 'a verified RSS source'}. Nuzenio adds context, key facts, and a safe path to the original report so readers can understand the story quickly without losing source attribution.`;
}

function buildFaq(article) {
  return [
    {
      q: 'Is this the full publisher article?',
      a: 'Nuzenio shows the full available RSS brief and context. The complete publisher article opens through the original source link.',
    },
    {
      q: 'Why not copy the full article here?',
      a: 'Copying full publisher articles without a license can create copyright and monetization problems. Nuzenio keeps attribution clear and links readers to the source.',
    },
    {
      q: 'Can I get news in another language?',
      a: 'Use the News language selector in the header. Nuzenio reloads the RSS feed in the selected language when the source supports it.',
    },
  ];
}

function detectLocaleCountry() {
  const locale = navigator.language || navigator.languages?.[0] || 'en-IN';
  const localeCountry = locale.split('-')[1]?.toUpperCase();
  const timezoneCountry = inferCountryFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const country = normalizeCountry(localeCountry || timezoneCountry || 'IN');
  return {
    country,
    region: '',
    city: '',
    label: countryLabel(country),
    source: localeCountry ? 'browser locale' : 'timezone',
  };
}

async function detectAccurateLocation(setLocation) {
  try {
    const res = await fetch('/api/location');
    const data = await res.json();
    if (data.ok) {
      setLocation(formatLocation(data));
    }
  } catch {
    // Locale fallback remains active when the location API is unavailable.
  }

  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const res = await fetch(
          `/api/location?lat=${encodeURIComponent(position.coords.latitude)}&lon=${encodeURIComponent(position.coords.longitude)}`,
        );
        const data = await res.json();
        if (data.ok) {
          setLocation(formatLocation(data));
        }
      } catch {
        // Keep the IP-based or locale-based country.
      }
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 1000 * 60 * 60 * 12, timeout: 4500 },
  );
}

function formatLocation(data) {
  const country = normalizeCountry(data.country);
  const region = data.region || '';
  const city = data.city || '';
  return {
    country,
    region,
    city,
    label: placeLabel({ country, region, city }),
    source: data.source || 'ip',
  };
}

function placeLabel({ country, region = '', city = '' }) {
  return [city, region, countryLabel(country)].filter(Boolean).join(', ');
}

function locationSourceLabel(source) {
  if (source === 'gps') return 'Detected from browser GPS';
  if (source === 'ip') return 'Detected from network location';
  if (source === 'preset') return 'Selected from popular locations';
  if (source === 'manual') return 'Set manually';
  if (source === 'fallback') return 'Using default location';
  return 'Detected from browser region';
}

function normalizeCountry(country) {
  const value = (country || 'IN').toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : 'IN';
}

function countryLabel(country) {
  const code = normalizeCountry(country);
  if (countryNames[code]) return countryNames[code];
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

function inferCountryFromTimezone(timeZone = '') {
  if (timeZone.includes('Kolkata') || timeZone.includes('Calcutta')) return 'IN';
  if (timeZone.includes('Dubai')) return 'AE';
  if (timeZone.includes('London')) return 'GB';
  if (timeZone.includes('Toronto') || timeZone.includes('Vancouver')) return 'CA';
  if (timeZone.includes('Sydney') || timeZone.includes('Melbourne')) return 'AU';
  if (timeZone.includes('Berlin')) return 'DE';
  if (timeZone.includes('Paris')) return 'FR';
  if (timeZone.includes('Madrid')) return 'ES';
  if (timeZone.includes('Rome')) return 'IT';
  if (timeZone.includes('Amsterdam')) return 'NL';
  if (timeZone.includes('Singapore')) return 'SG';
  if (timeZone.includes('Sao_Paulo')) return 'BR';
  if (timeZone.includes('Johannesburg')) return 'ZA';
  if (timeZone.includes('Tokyo')) return 'JP';
  if (timeZone.includes('Seoul')) return 'KR';
  if (timeZone.includes('Moscow')) return 'RU';
  if (timeZone.includes('New_York') || timeZone.includes('Chicago') || timeZone.includes('Los_Angeles')) return 'US';
  return 'IN';
}

function formatDate(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function formatFreshAge(value) {
  if (!value) return 'Latest';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(value);
}

function formatLastUpdated(value) {
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function readLocal(key, fallback, legacyKey = '') {
  try {
    const value = localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : '');
    return JSON.parse(value || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the app usable when storage is blocked or full.
  }
}

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    if (selector.includes('property=')) {
      element.setAttribute('property', selector.match(/property="([^"]+)"/)?.[1] || '');
    } else {
      element.setAttribute('name', selector.match(/name="([^"]+)"/)?.[1] || '');
    }
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
}

function setCanonical(url) {
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', url);
}

function setJsonLd(article, url, { context, description, image, title }) {
  const existing = document.getElementById('nuzenio-jsonld');
  if (existing) existing.remove();

  const script = document.createElement('script');
  script.id = 'nuzenio-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(article ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: displayTitle(article),
    description: displaySummary(article),
    datePublished: article.pubDate || undefined,
    dateModified: article.pubDate || undefined,
    image,
    mainEntityOfPage: url,
    publisher: organizationSchema(),
    isBasedOn: article.link,
    citation: article.source,
  } : pageJsonLd(url, { context, description, image, title }));
  document.head.appendChild(script);
}

function updatePageSeo(article, context) {
  const url = article ? articleContextUrl(article, context) : contextUrlForSeo(context);
  const canonicalUrl = productionUrl(url);
  const title = article ? `${displayTitle(article)} | Nuzenio` : pageSeoTitle(context);
  const description = article
    ? displaySummary(article)
    : pageSeoDescription(context);
  const image = seoImage(article);

  document.title = title;
  setCanonical(canonicalUrl);
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:type"]', 'content', article ? 'article' : 'website');
  setMeta('meta[property="og:url"]', 'content', canonicalUrl);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:image"]', 'content', image);
  setMeta('meta[property="article:published_time"]', 'content', article?.pubDate || '');
  setMeta('meta[property="article:section"]', 'content', article?.category || context.category || 'top');
  setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', description);
  setMeta('meta[name="twitter:image"]', 'content', image);
  setAlternateLinks(article ? null : context);
  setJsonLd(article, canonicalUrl, { context, description, image, title });
}

function contextUrlForSeo(context) {
  if (context.isRootHome) {
    return new URL('/', window.location.href);
  }
  return homeContextUrl(context);
}

function productionUrl(url) {
  const output = new URL(url.toString());
  output.protocol = 'https:';
  output.hostname = 'nuzenio.com';
  output.port = '';
  return output.toString();
}

function setAlternateLinks(context) {
  document.head.querySelectorAll('link[data-nuzenio-alternate="true"]').forEach((link) => link.remove());
  if (!context) return;

  if (context.isRootHome) {
    const rootLink = document.createElement('link');
    rootLink.rel = 'alternate';
    rootLink.hreflang = 'x-default';
    rootLink.href = `${productionOrigin}/`;
    rootLink.dataset.nuzenioAlternate = 'true';
    document.head.appendChild(rootLink);
    return;
  }

  for (const alternateLanguage of languages) {
    const url = homeContextUrl({ ...context, language: alternateLanguage });
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = alternateLanguage.code;
    link.href = productionUrl(url);
    link.dataset.nuzenioAlternate = 'true';
    document.head.appendChild(link);
  }

  const defaultUrl = homeContextUrl({ ...context, language: languages[0] });
  const defaultLink = document.createElement('link');
  defaultLink.rel = 'alternate';
  defaultLink.hreflang = 'x-default';
  defaultLink.href = productionUrl(defaultUrl);
  defaultLink.dataset.nuzenioAlternate = 'true';
  document.head.appendChild(defaultLink);
}

function pageSeoTitle({ category, isRootHome, location, language }) {
  if (isRootHome) return 'Nuzenio - Global News Home';
  const copy = uiCopy(language.code);
  const sectionTitle = sectionContent(category, copy, location).title;
  const place = pageSeoPlace(category, location);
  if (copy === translations.hi) return `${sectionTitle} - ${place} | Nuzenio`;
  if (copy === translations.ar) return `${sectionTitle} - ${place} | Nuzenio`;
  if (copy === translations.es) return `${sectionTitle} de ${place} | Nuzenio`;
  return `${sectionTitle} for ${place} | Nuzenio`;
}

function pageSeoDescription({ category, isRootHome, location, language }) {
  if (isRootHome) {
    return 'Nuzenio is the global news home for live RSS headlines, local news, video news, live news, multilingual reading, and AI context.';
  }
  const copy = uiCopy(language.code);
  const sectionTitle = sectionContent(category, copy, location).title;
  const place = pageSeoPlace(category, location);
  const nativeLanguage = language.native || language.name || language.code;
  const isMediaPage = category === 'video' || category === 'live';

  if (copy === translations.hi) {
    const action = isMediaPage ? 'देखें' : 'पढ़ें';
    return `${place} के लिए ${sectionTitle} ${action}। Nuzenio पर लाइव RSS खबरें, AI summary, source attribution, video और live news ${nativeLanguage} में देखें।`;
  }
  if (copy === translations.ar) {
    const action = isMediaPage ? 'شاهد' : 'اقرأ';
    return `${action} ${sectionTitle} لـ ${place} على Nuzenio مع أخبار RSS مباشرة وملخصات AI وإسناد المصادر والفيديو والبث المباشر باللغة ${nativeLanguage}.`;
  }
  if (copy === translations.es) {
    const action = isMediaPage ? 'Mira' : 'Lee';
    return `${action} ${sectionTitle} de ${place} en Nuzenio con noticias RSS en vivo, resumen de AI, atribución de fuentes, videos y noticias en directo en ${nativeLanguage}.`;
  }
  const action = isMediaPage ? 'Watch' : 'Read';
  return `${action} ${sectionTitle} for ${place} on Nuzenio with live RSS news, AI summaries, source attribution, video news, and live news in ${nativeLanguage}.`;
}

function pageJsonLd(url, { context, description, image, title }) {
  const sectionTitle = context.isRootHome
    ? 'Global News Home'
    : sectionContent(context.category, uiCopy(context.language.code), context.location).title;
  const place = pageSeoPlace(context.category, context.location);
  const websiteId = `${productionOrigin}/#website`;
  const organizationId = `${productionOrigin}/#organization`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        ...organizationSchema(),
        logo: `${productionOrigin}/og-image.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: 'Nuzenio',
        url: productionOrigin,
        publisher: { '@id': organizationId },
        inLanguage: context.language.code,
      },
      {
        '@type': 'CollectionPage',
        '@id': url,
        url,
        name: title,
        description,
        image,
        isPartOf: { '@id': websiteId },
        publisher: { '@id': organizationId },
        inLanguage: context.language.code,
        about: sectionTitle,
        spatialCoverage: {
          '@type': 'Place',
          name: place,
        },
      },
    ],
  };
}

function organizationSchema() {
  return {
    '@type': 'Organization',
    name: 'Nuzenio',
    url: productionOrigin,
    sameAs: ['https://github.com/syleriofficial/Nuzenio'],
  };
}

function pageSeoPlace(category, location) {
  if (category === 'local') {
    return [location?.city, location?.region, countryLabel(location?.country || 'IN')].filter(Boolean).join(', ');
  }
  return countryLabel(location?.country || 'IN');
}

function seoImage(article) {
  const image = article?.image || videoThumbnail(article);
  if (image && /^https:\/\//i.test(image)) return image;
  return `${productionOrigin}/og-image.svg`;
}

async function shareArticle(article) {
  const shareUrl = shareArticleUrl(article).toString();
  const shareText = `${article.source || 'Nuzenio'} · ${formatFreshAge(article.pubDate)}\n${displaySummary(article)}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: article.title, text: shareText, url: shareUrl });
      return;
    }
    await navigator.clipboard?.writeText(shareUrl);
  } catch {
    await navigator.clipboard?.writeText(shareUrl);
  }
}

function shareArticleUrl(article) {
  const url = new URL(window.location.href);
  url.pathname = `/article/${encodeURIComponent(article.id)}`;
  url.searchParams.delete('article');
  url.hash = '';
  if (!url.searchParams.get('country')) url.searchParams.set('country', article.country || 'IN');
  if (!url.searchParams.get('language')) url.searchParams.set('language', document.documentElement.lang || 'en');
  if (article.category && categoryRoutes[article.category]) {
    url.searchParams.delete('category');
  } else if (article.category) {
    url.searchParams.set('category', article.category);
  }
  return url;
}

createRoot(document.getElementById('root')).render(<App />);
