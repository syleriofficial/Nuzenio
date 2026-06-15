import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart3,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe2,
  Home as HomeIcon,
  Languages,
  LayoutDashboard,
  Link as LinkIcon,
  LogIn,
  LogOut,
  Mail,
  Newspaper,
  PlayCircle,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
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
  ['video', 'Video'],
  ['shorts', 'Shorts'],
];

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

const translations = {
  en: {
    tagline: 'AI multilingual news bridge',
    searchPlaceholder: 'Search live news in your region...',
    search: 'Search',
    newsLanguage: 'News language',
    home: 'Home',
    saved: 'Saved',
    admin: 'Admin',
    analytics: 'Analytics',
    monetize: 'Monetize',
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
    savedArticlesTitle: 'Saved Articles',
    savedArticlesIntro: 'Your read-later library and reading history sync with Supabase when login is enabled.',
    emptySaved: 'No saved articles from the current feed yet.',
    emptyFeed: 'No live stories loaded yet. Try another category, language, or location.',
    readingHistory: 'Reading History',
    noHistory: 'No reading history yet.',
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
      video: 'Video',
      shorts: 'Shorts',
    },
  },
  hi: {
    tagline: 'एआई बहुभाषी न्यूज़ ब्रिज',
    searchPlaceholder: 'अपने इलाके की लाइव खबरें खोजें...',
    search: 'खोजें',
    newsLanguage: 'न्यूज़ भाषा',
    home: 'होम',
    saved: 'सेव',
    admin: 'एडमिन',
    analytics: 'एनालिटिक्स',
    monetize: 'कमाई',
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
    savedArticlesTitle: 'सेव की गई खबरें',
    savedArticlesIntro: 'आपकी रीड-लेटर लाइब्रेरी और रीडिंग हिस्ट्री लॉगिन होने पर Supabase से सिंक होती है।',
    emptySaved: 'इस फीड से अभी कोई सेव खबर नहीं है।',
    emptyFeed: 'अभी लाइव खबरें लोड नहीं हुईं। दूसरी कैटेगरी, भाषा या लोकेशन आज़माएं।',
    readingHistory: 'रीडिंग हिस्ट्री',
    noHistory: 'अभी कोई रीडिंग हिस्ट्री नहीं है।',
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
      video: 'वीडियो',
      shorts: 'शॉर्ट्स',
    },
  },
  ar: {
    tagline: 'جسر أخبار ذكي متعدد اللغات',
    searchPlaceholder: 'ابحث عن الأخبار المباشرة في منطقتك...',
    search: 'بحث',
    newsLanguage: 'لغة الأخبار',
    home: 'الرئيسية',
    saved: 'المحفوظات',
    admin: 'الإدارة',
    analytics: 'التحليلات',
    monetize: 'الربح',
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
    savedArticlesTitle: 'الأخبار المحفوظة',
    savedArticlesIntro: 'مكتبة القراءة لاحقا وسجل القراءة تتزامن مع Supabase عند تسجيل الدخول.',
    emptySaved: 'لا توجد أخبار محفوظة من هذا الموجز بعد.',
    emptyFeed: 'لم يتم تحميل أخبار مباشرة بعد. جرب فئة أو لغة أو موقعا آخر.',
    readingHistory: 'سجل القراءة',
    noHistory: 'لا يوجد سجل قراءة بعد.',
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
      video: 'فيديو',
      shorts: 'شورتس',
    },
  },
  es: {
    tagline: 'Puente de noticias multilingue con IA',
    searchPlaceholder: 'Busca noticias en vivo en tu region...',
    search: 'Buscar',
    newsLanguage: 'Idioma de noticias',
    home: 'Inicio',
    saved: 'Guardados',
    admin: 'Admin',
    analytics: 'Analitica',
    monetize: 'Monetizar',
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
    savedArticlesTitle: 'Noticias guardadas',
    savedArticlesIntro: 'Tu biblioteca para leer despues y el historial se sincronizan con Supabase al iniciar sesion.',
    emptySaved: 'Aun no hay noticias guardadas de este feed.',
    emptyFeed: 'Aun no se cargaron noticias en vivo. Prueba otra categoria, idioma o ubicacion.',
    readingHistory: 'Historial de lectura',
    noHistory: 'Aun no hay historial de lectura.',
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
      video: 'Video',
      shorts: 'Shorts',
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

function readArticleIdFromUrl() {
  const [, articleId] = window.location.pathname.match(/^\/article\/([^/]+)\/?$/) || [];
  return articleId ? decodeURIComponent(articleId) : readUrlParam('article');
}

function initialCategory() {
  const urlCategory = readUrlParam('category');
  return categories.some(([key]) => key === urlCategory) ? urlCategory : 'local';
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
  url.pathname = '/';
  url.searchParams.set('category', category);
  url.searchParams.set('country', location.country);
  url.searchParams.set('language', language.code);
  if (location.region) url.searchParams.set('region', location.region);
  else url.searchParams.delete('region');
  if (location.city) url.searchParams.set('city', location.city);
  else url.searchParams.delete('city');
  if (currentArticle) url.pathname = `/article/${encodeURIComponent(currentArticle)}`;
  url.searchParams.delete('article');
  return url;
}

function homeContextUrl({ category, location, language }) {
  const url = contextUrl({ category, location, language });
  url.pathname = '/';
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
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState(initialLanguage);
  const [location, setLocation] = useState(initialLocation);
  const [savedIds, setSavedIds] = useState(() => readLocal('nuzenio_saved_ids', [], 'newssetu_saved_ids'));
  const [history, setHistory] = useState(() => readLocal('nuzenio_history', [], 'newssetu_history'));
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [authNotice, setAuthNotice] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
    const url = contextUrl({ category, location, language });
    window.history.replaceState({}, '', url);
  }, [category, location.country, location.region, location.city, language.code]);

  useEffect(() => {
    function syncArticleFromUrl() {
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
    updatePageSeo(selected, { category, location, language });
  }, [selected, category, location.country, location.region, location.city, language.code]);

  async function loadNews(
    cat = 'local',
    country = location.country,
    region = location.region,
    city = location.city,
    newsLanguage = language.code,
  ) {
    setStatus('Loading live RSS news...');
    try {
      const cityParam = city ? `&city=${encodeURIComponent(city)}` : '';
      const regionParam = region ? `&region=${encodeURIComponent(region)}` : '';
      const languageParam = `&language=${encodeURIComponent(newsLanguage)}`;
      const res = await fetch(`/api/news?category=${encodeURIComponent(cat)}&country=${encodeURIComponent(country)}${regionParam}${cityParam}${languageParam}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'News fetch failed');
      setArticles(data.articles || []);
      const place = data.city
        ? `${data.city}, ${data.region ? `${data.region}, ` : ''}${countryLabel(data.country)}`
        : data.region
          ? `${data.region}, ${countryLabel(data.country)}`
          : countryLabel(data.country);
      const itemLabel = cat === 'video' ? 'live videos' : cat === 'shorts' ? 'live shorts' : 'live articles';
      setStatus(`${data.total} ${itemLabel} for ${place}`);
    } catch (error) {
      setStatus(`Live API error: ${error.message}`);
    }
  }

  async function searchNews(event) {
    event?.preventDefault();
    if (!query.trim()) return loadNews(category, location.country, location.region, location.city, language.code);
    setStatus('Searching live RSS news...');
    try {
      const res = await fetch(
        `/api/news?q=${encodeURIComponent(query.trim())}&country=${encodeURIComponent(location.country)}&language=${encodeURIComponent(language.code)}`,
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Search failed');
      setArticles(data.articles || []);
      setStatus(`${data.total || 0} results for "${query.trim()}"`);
    } catch (error) {
      setStatus(`Search error: ${error.message}`);
    }
  }

  function updateLocation(next) {
    setLocation(next);
    writeLocal('nuzenio_location', next);
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
    window.history.pushState({}, '', url);
  }

  function closeArticle() {
    setSelected(null);
    const url = homeContextUrl({ category, location, language });
    window.history.replaceState({}, '', url);
  }

  const copy = uiCopy(language.code);
  const lead = articles[0];
  const sideStories = articles.slice(1, 5);
  const feed = articles.slice(5);
  const savedArticles = articles.filter((article) => savedIds.includes(article.id));
  const ticker = useMemo(
    () => articles.slice(0, 6).map((article) => article.title).join(' | '),
    [articles],
  );

  return (
    <div className="appShell">
      <Header
        authNotice={authNotice}
        category={category}
        copy={copy}
        language={language}
        loginWithGoogle={loginWithGoogle}
        logout={logout}
        mobileSearchOpen={mobileSearchOpen}
        query={query}
        screen={screen}
        searchNews={searchNews}
        setCategory={setCategory}
        setLanguage={setLanguage}
        setMobileSearchOpen={setMobileSearchOpen}
        setQuery={setQuery}
        setScreen={setScreen}
        user={user}
      />

      {screen === 'home' && (
        <Home
          articles={articles}
          category={category}
          copy={copy}
          feed={feed}
          language={language}
          lead={lead}
          location={location}
          setLocation={updateLocation}
          openArticle={openArticle}
          savedIds={savedIds}
          sideStories={sideStories}
          status={status}
          ticker={ticker}
          toggleSave={toggleSave}
        />
      )}
      {screen === 'saved' && (
        <Saved
          articles={savedArticles}
          copy={copy}
          history={history}
          openArticle={openArticle}
          savedIds={savedIds}
          toggleSave={toggleSave}
        />
      )}
      {screen === 'admin' && <Admin user={user} />}
      {screen === 'analytics' && <Analytics articles={articles} history={history} savedIds={savedIds} />}
      {screen === 'monetize' && <Monetize />}

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
      <MobileNav copy={copy} setCategory={setCategory} setScreen={setScreen} setMobileSearchOpen={setMobileSearchOpen} />
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
  query,
  screen,
  searchNews,
  setCategory,
  setLanguage,
  setMobileSearchOpen,
  setQuery,
  setScreen,
  user,
}) {
  return (
    <header className="header">
      <div className="topbar">
        <button className="brand" onClick={() => setScreen('home')} aria-label="Nuzenio home">
          <div className="logo">N</div>
          <div>
            <h1>Nuzenio</h1>
            <small>{copy.tagline}</small>
          </div>
        </button>

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
        <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}>
          {copy.home}
        </button>
        <button className={screen === 'saved' ? 'active' : ''} onClick={() => setScreen('saved')}>
          {copy.saved}
        </button>
        <button className={screen === 'admin' ? 'active' : ''} onClick={() => setScreen('admin')}>
          {copy.admin}
        </button>
        <button className={screen === 'analytics' ? 'active' : ''} onClick={() => setScreen('analytics')}>
          {copy.analytics}
        </button>
        <button className={screen === 'monetize' ? 'active' : ''} onClick={() => setScreen('monetize')}>
          {copy.monetize}
        </button>
      </nav>
      <nav className="newsNav" aria-label="News sections">
        {categories.map(([key, label]) => (
          <button
            key={key}
            className={screen === 'home' && category === key ? 'active' : ''}
            onClick={() => {
              setScreen('home');
              setCategory(key);
            }}
          >
            {copy.categories[key] || label}
          </button>
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
  language,
  lead,
  location,
  openArticle,
  savedIds,
  setLocation,
  sideStories,
  status,
  ticker,
  toggleSave,
}) {
  const isVideoSection = ['video', 'shorts'].includes(category);

  if (isVideoSection) {
    return (
      <>
        <div className="breaking">
          <b>{category === 'shorts' ? 'SHORTS' : copy.categories.video.toUpperCase()}</b>
          <span>{ticker || status}</span>
        </div>
        <RevenueStrip />

        <main className="main">
          <section>
            <LocationBanner copy={copy} location={location} setLocation={setLocation} status={status} />
            <ProductTrustBar />
            <div className={`videoHero ${category === 'shorts' ? 'shortsHero' : ''}`}>
              <div>
                <span className="badge">
                  <PlayCircle size={15} /> YouTube live source
                </span>
                <h2>{category === 'shorts' ? 'News Shorts' : 'News Videos'}</h2>
                <p>
                  Real YouTube videos loaded for your selected country and language. Tap any video to watch inside Nuzenio.
                </p>
              </div>
              <b>{articles.length}</b>
            </div>
            <AdSlot name="top-native" label="Top advertising inventory" />
            <div className="sectionHead">
              <div>
                <h2>{category === 'shorts' ? 'Latest Shorts' : 'Latest Videos'}</h2>
                <p>No article cards here. This section only shows playable YouTube video results.</p>
              </div>
              <span>{status}</span>
            </div>
            <div className={`videoGrid ${category === 'shorts' ? 'shortsGrid' : ''}`}>
              {articles.map((article) => (
                <VideoCard
                  key={article.id}
                  article={article}
                  copy={copy}
                  openArticle={openArticle}
                  savedIds={savedIds}
                  toggleSave={toggleSave}
                />
              ))}
              {articles.length === 0 && <div className="empty">{copy.emptyFeed}</div>}
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
      <div className="breaking">
        <b>{copy.breaking}</b>
        <span>{ticker || status}</span>
      </div>
      <RevenueStrip />

      <main className="main">
        <section>
          <LocationBanner copy={copy} location={location} setLocation={setLocation} status={status} />
          <ProductTrustBar />

          <div className="heroGrid">
            <button className="leadCard" onClick={() => lead && openArticle(lead)}>
              <div className="leadVisual">
                <Newspaper size={112} />
              </div>
              <div className="leadContent">
                <div className="badge">
                  <ShieldCheck size={15} /> Live RSS verified
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
              <h2>{copy.latestStories}</h2>
              <p>{copy.latestIntro}</p>
            </div>
            <span>{status}</span>
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
            {articles.length === 0 && <div className="empty">{copy.emptyFeed}</div>}
          </div>
        </section>

        <aside className="rightRail">
          <Trending articles={articles} copy={copy} openArticle={openArticle} />
          <AISummaryBox copy={copy} />
          <AffiliatePanel />
          <Newsletter copy={copy} language={language} />
          <AdSlot name="sidebar-rectangle" label="Sidebar advertising inventory" compact />
        </aside>
      </main>
    </>
  );
}

function VideoCard({ article, copy, openArticle, savedIds, toggleSave }) {
  const isSaved = savedIds.includes(article.id);
  const isShort = article.category === 'shorts';
  return (
    <article className={`videoCard ${isShort ? 'shortCard' : ''}`}>
      <button className="videoThumb" onClick={() => openArticle(article)} aria-label={`Play ${displayTitle(article)}`}>
        <img src={videoThumbnail(article)} alt="" loading="lazy" />
        <span>
          <PlayCircle size={34} /> Play
        </span>
      </button>
      <div className="videoBody">
        <div className="cardTop">
          <span className="category">{isShort ? 'SHORTS' : 'VIDEO'}</span>
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

function RevenueStrip() {
  return (
    <section className="revenueStrip" aria-label="Nuzenio revenue and trust model">
      <div>
        <b>Live RSS</b>
        <span>Publisher sourced</span>
      </div>
      <div>
        <b>Ad policy</b>
        <span>Scripts disabled</span>
      </div>
      <div>
        <b>Affiliate policy</b>
        <span>Approval required</span>
      </div>
      <div>
        <b>AI layer</b>
        <span>Summary and context</span>
      </div>
    </section>
  );
}

function ProductTrustBar() {
  return (
    <div className="productTrustBar">
      <div>
        <ShieldCheck size={18} />
        <span>Verified publisher attribution</span>
      </div>
      <div>
        <Sparkles size={18} />
        <span>AI summaries separated from source links</span>
      </div>
      <div>
        <LinkIcon size={18} />
        <span>Commercial links require admin approval</span>
      </div>
    </div>
  );
}

function LocationBanner({ copy, location, setLocation, status }) {
  function changeCountry(event) {
    const country = normalizeCountry(event.target.value);
    setLocation({ country, region: '', city: '', label: countryLabel(country), source: 'manual' });
  }

  function changeRegion(event) {
    const region = event.target.value;
    setLocation({
      ...location,
      region,
      label: placeLabel({ ...location, region }),
      source: 'manual',
    });
  }

  function changeCity(event) {
    const city = event.target.value;
    setLocation({
      ...location,
      city,
      label: placeLabel({ ...location, city }),
      source: 'manual',
    });
  }

  return (
    <div className="locationBanner">
      <div>
        <Globe2 size={18} />
        <b>{copy.localNewsFor} {location.label}</b>
      </div>
      <div className="locationControls">
        <span>{locationSourceLabel(location.source)} · {status}</span>
        <select value={location.country} onChange={changeCountry} aria-label="Set news country">
          {countryOptions.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>
        <input
          value={location.region || ''}
          onChange={changeRegion}
          placeholder={copy.stateRegion}
          aria-label="Set state or region for local news"
        />
        <input
          value={location.city || ''}
          onChange={changeCity}
          placeholder={copy.cityArea}
          aria-label="Set city or nearby area for local news"
        />
        <button onClick={() => detectAccurateLocation(setLocation)}>{copy.useLocation}</button>
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
          {article.source} · {formatDate(article.pubDate)}
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
        {['video', 'shorts'].includes(article.category) && (
          <span>
            <PlayCircle size={13} /> {article.category === 'shorts' ? 'Shorts' : 'YouTube'}
          </span>
        )}
        <span>
          <Clock size={13} /> {article.readTime || 2} min read
        </span>
      </div>
      <button className="headline" onClick={() => openArticle(article)}>
        {displayTitle(article)}
      </button>
      <p>{displaySummary(article)}</p>
      <div className="trustRow">
        <span>
          <ShieldCheck size={14} /> Trust {article.trustScore || 91}%
        </span>
        <span>
          <CheckCircle2 size={14} /> {article.source}
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

function AffiliatePanel() {
  return (
    <div className="railCard affiliatePanel">
      <h3>
        <LinkIcon size={18} /> Commercial Policy
      </h3>
      <p>Affiliate links are hidden until reviewed, labeled, and separated from editorial RSS coverage.</p>
      <div className="affiliateDisclosure">Disclosure policy active</div>
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
          {article.source} · {formatDate(article.pubDate)} · <ShieldCheck size={14} /> Verified RSS
        </div>
        {isVideo && (
          <div className={`videoPlayer ${article.category === 'shorts' ? 'shortPlayer' : ''}`}>
            <iframe
              title={displayTitle(article)}
              src={youtubeEmbedUrl(article)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
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
            This story is sourced from <b>{article.source}</b> via live RSS. Nuzenio links back to the original
            publisher for the full report.
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
          {copy.readOriginal} <ExternalLink size={16} />
        </a>
      </article>
    </div>
  );
}

function Saved({ articles, copy, history, openArticle, savedIds, toggleSave }) {
  return (
    <main className="single">
      <section>
        <div className="pageHero">
          <h2>{copy.savedArticlesTitle}</h2>
          <p>{copy.savedArticlesIntro}</p>
        </div>
        <div className="feedGrid">
          {articles.length ? (
            articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                copy={copy}
                openArticle={openArticle}
                savedIds={savedIds}
                toggleSave={toggleSave}
              />
            ))
          ) : (
            <div className="empty">{copy.emptySaved}</div>
          )}
        </div>
        <div className="historyPanel">
          <h3>{copy.readingHistory}</h3>
          {history.length ? (
            history.slice(0, 8).map((item) => (
              <div className="historyItem" key={`${item.id}-${item.openedAt}`}>
                <b>{item.title}</b>
                <span>
                  {item.source} · {formatDate(item.openedAt)}
                </span>
              </div>
            ))
          ) : (
            <p>{copy.noHistory}</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Admin({ user }) {
  const rssRows = categories.map(([key, label]) => ({ key, label, status: 'Live RSS', health: 'Configured' }));
  const adSlots = ['top-native', 'sidebar-rectangle', 'article-inline', 'mobile-feed'];
  return (
    <main className="single">
      <section>
        <div className="pageHero adminHero">
          <div>
            <h2>Admin Dashboard</h2>
            <p>Production controls for sources, ads, newsletter, analytics, and SEO readiness.</p>
          </div>
          <span>{user ? 'Authenticated admin session' : 'Connect Supabase auth for admin roles'}</span>
        </div>

        <div className="managerGrid">
          <Manager title="RSS Source Manager" icon={<Newspaper size={18} />}>
            {rssRows.map((row) => (
              <div className="managerRow" key={row.key}>
                <b>{row.label}</b>
                <span>{row.status}</span>
                <em>{row.health}</em>
              </div>
            ))}
          </Manager>

          <Manager title="AdSense Slot Manager" icon={<LayoutDashboard size={18} />}>
            {adSlots.map((slot) => (
              <div className="managerRow" key={slot}>
                <b>{slot}</b>
                <span>Reserved inventory</span>
                <em>Script disabled</em>
              </div>
            ))}
          </Manager>

          <Manager title="Affiliate Link Manager" icon={<LinkIcon size={18} />}>
            <div className="managerMetric">
              <b>No public affiliate links</b>
              <span>Add approved rows to public.affiliate_links with enabled=true.</span>
            </div>
            <p className="managerNote">Commercial links remain hidden until reviewed, labeled, and stored in Supabase.</p>
          </Manager>

          <Manager title="Newsletter Manager" icon={<Mail size={18} />}>
            <div className="managerMetric">
              <b>Subscribers table</b>
              <span>public.newsletter_subscribers</span>
            </div>
            <p className="managerNote">Export subscribers from Supabase Table Editor or a protected server function.</p>
          </Manager>

          <Manager title="Analytics Dashboard" icon={<BarChart3 size={18} />}>
            <div className="miniStats">
              <span>Views</span>
              <b>Client + Supabase ready</b>
            </div>
            <div className="miniStats">
              <span>Saves</span>
              <b>Tracked per user</b>
            </div>
          </Manager>

          <Manager title="SEO Checklist" icon={<CheckCircle2 size={18} />}>
            {['robots.txt', 'sitemap.xml', 'Open Graph tags', 'Canonical URL', 'RSS indexable routes'].map((item) => (
              <div className="checkRow" key={item}>
                <CheckCircle2 size={16} /> {item}
              </div>
            ))}
          </Manager>

          <Manager title="Language Manager" icon={<Languages size={18} />}>
            <div className="languageCloud">
              {languages.map((item) => (
                <span key={item.code}>{item.native}</span>
              ))}
            </div>
          </Manager>
        </div>
      </section>
    </main>
  );
}

function Manager({ children, icon, title }) {
  return (
    <div className="managerCard">
      <h3>
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function Analytics({ articles, history, savedIds }) {
  const sourceCount = new Set(articles.map((article) => article.source)).size;
  const readinessChecks = [
    articles.length > 0,
    sourceCount > 0,
    history.length > 0,
    savedIds.length > 0,
    Boolean(supabase),
  ];
  const revenueReadiness = Math.round((readinessChecks.filter(Boolean).length / readinessChecks.length) * 100);
  return (
    <main className="single">
      <section>
        <div className="pageHero">
          <h2>Analytics Dashboard</h2>
          <p>Engagement, content coverage, and monetization readiness for the live feed.</p>
        </div>
        <div className="stats">
          <div>
            <b>{articles.length}</b>
            <span>Live Articles</span>
          </div>
          <div>
            <b>{savedIds.length}</b>
            <span>Saved</span>
          </div>
          <div>
            <b>{history.length}</b>
            <span>Reads</span>
          </div>
          <div>
            <b>{sourceCount}</b>
            <span>Sources</span>
          </div>
          <div>
            <b>{revenueReadiness}%</b>
            <span>Readiness</span>
          </div>
        </div>
        <div className="revenueFunnel">
          <h3>Revenue Funnel</h3>
          <div><span>Search traffic</span><b>SEO + sitemap</b></div>
          <div><span>Engagement</span><b>AI brief + save</b></div>
          <div><span>Monetization</span><b>AdSense + affiliate</b></div>
          <div><span>Retention</span><b>Newsletter + history</b></div>
        </div>
      </section>
    </main>
  );
}

function Monetize() {
  const channels = [
    ['AdSense Slots', 'Top banner, sidebar, article inline, and mobile feed inventory are reserved without loading ad scripts.'],
    ['Affiliate Links', 'Public links stay hidden until they are reviewed, labeled, enabled, and separated from editorial RSS.'],
    ['Newsletter Sponsorship', 'Subscriber storage is ready in Supabase; sponsorships need a protected campaign workflow before launch.'],
    ['Premium AI Summaries', 'Article intelligence can become paid only after subscription, billing, and access controls are added.'],
    ['Sponsored Stories', 'Paid posts must use a separate content type and visible sponsorship labels.'],
    ['SEO Revenue Loop', 'Sitemap, metadata, source links, and shareable topic URLs support search acquisition.'],
  ];
  const checklist = [
    'Apply for AdSense after enough original UI, policy pages, and stable traffic.',
    'Add privacy policy, terms, contact, and affiliate disclosure pages before ad approval.',
    'Use server-side affiliate redirect tracking instead of hiding destination URLs.',
    'Keep ads away from navigation buttons and breaking labels to avoid accidental clicks.',
  ];
  return (
    <main className="single">
      <section>
        <div className="pageHero monetizationHero">
          <div>
            <h2>Monetization Engine</h2>
            <p>AdSense, affiliate, newsletter, and premium AI revenue structure with editorial RSS separated from commercial placements.</p>
          </div>
          <div className="moneyScore">
            <b>{channels.length}</b>
            <span>Revenue channels</span>
          </div>
        </div>
        <div className="adminGrid">
          {channels.map(([title, body]) => (
            <div className="adminCard" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
              <span className="statusPill">Policy ready</span>
            </div>
          ))}
        </div>
        <div className="launchChecklist">
          <h3>Before earning money</h3>
          {checklist.map((item) => (
            <div className="checkRow" key={item}>
              <CheckCircle2 size={16} /> {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function MobileNav({ copy, setCategory, setScreen, setMobileSearchOpen }) {
  return (
    <div className="mobileNav">
      <button onClick={() => setScreen('home')}>
        <HomeIcon size={18} /> {copy.home}
      </button>
      <button
        onClick={() => {
          setCategory('video');
          setScreen('home');
        }}
      >
        <PlayCircle size={18} /> {copy.categories.video}
      </button>
      <button
        onClick={() => {
          setCategory('shorts');
          setScreen('home');
        }}
      >
        <PlayCircle size={18} /> {copy.categories.shorts}
      </button>
      <button onClick={() => setScreen('saved')}>
        <Bookmark size={18} /> {copy.saved}
      </button>
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
      <small>Reserved ad inventory. Publisher script disabled until approval.</small>
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
  return ['video', 'shorts'].includes(article?.category) && Boolean(article?.videoId || article?.embedUrl);
}

function youtubeEmbedUrl(article) {
  if (article?.embedUrl) return article.embedUrl;
  return `https://www.youtube-nocookie.com/embed/${article.videoId}`;
}

function videoThumbnail(article) {
  if (article?.image) return article.image;
  return article?.videoId ? `https://i.ytimg.com/vi/${article.videoId}/hqdefault.jpg` : '';
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
    const res = await fetch('/.netlify/functions/location');
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
          `/.netlify/functions/location?lat=${encodeURIComponent(position.coords.latitude)}&lon=${encodeURIComponent(position.coords.longitude)}`,
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

function setJsonLd(article, url) {
  const existing = document.getElementById('nuzenio-jsonld');
  if (existing) existing.remove();
  if (!article) return;

  const script = document.createElement('script');
  script.id = 'nuzenio-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: displayTitle(article),
    description: displaySummary(article),
    datePublished: article.pubDate || undefined,
    dateModified: article.pubDate || undefined,
    mainEntityOfPage: url,
    publisher: {
      '@type': 'Organization',
      name: 'Nuzenio',
      url: 'https://nuzenio.com/',
    },
    isBasedOn: article.link,
    citation: article.source,
  });
  document.head.appendChild(script);
}

function updatePageSeo(article, context) {
  const url = article ? articleContextUrl(article, context) : homeContextUrl(context);
  const title = article ? `${displayTitle(article)} | Nuzenio` : 'Nuzenio - Trusted News, Simplified';
  const description = article
    ? displaySummary(article)
    : 'Nuzenio is an AI-powered multilingual news platform with trusted sources, summaries, saved articles and global news coverage.';

  document.title = title;
  setCanonical(url.toString());
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:url"]', 'content', url.toString());
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', description);
  setJsonLd(article, url.toString());
}

async function shareArticle(article) {
  const url = new URL(window.location.href);
  url.pathname = `/article/${encodeURIComponent(article.id)}`;
  url.searchParams.delete('article');
  const shareUrl = url.toString();
  if (navigator.share) {
    await navigator.share({ title: article.title, url: shareUrl });
    return;
  }
  await navigator.clipboard?.writeText(shareUrl);
}

createRoot(document.getElementById('root')).render(<App />);
