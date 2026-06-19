import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  Bookmark,
  BriefcaseBusiness,
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
  Stethoscope,
  Trophy,
  TrendingUp,
  X,
  Zap,
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
  ['ai', 'AI'],
  ['sports', 'Sports'],
  ['entertainment', 'Entertainment'],
  ['health', 'Health'],
  ['science', 'Science'],
  ['live', 'Live News'],
  ['video', 'Video'],
];

const primarySectionRoutes = {
  local: '/local',
  ai: '/ai',
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
];

const productionOrigin = 'https://nuzenio.com';

const translations = {
  en: {
    tagline: 'AI global news bridge',
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
    emptyFeed: 'No live stories loaded yet. Try another category or location.',
    categories: {
      local: 'Local',
      top: 'Top News',
      world: 'World',
      business: 'Business',
      tech: 'Technology',
      ai: 'AI',
      sports: 'Sports',
      entertainment: 'Entertainment',
      health: 'Health',
      science: 'Science',
      live: 'Live News',
      video: 'Video',
    },
  },
};

function uiCopy() {
  return translations.en;
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
  return languages[0];
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

function contextUrl({ category, location }) {
  const url = new URL(window.location.href);
  const currentArticle = readArticleIdFromUrl();
  url.pathname = categoryRoutes[category] || '/';
  if (categoryRoutes[category]) url.searchParams.delete('category');
  else url.searchParams.set('category', category);
  url.searchParams.set('country', location.country);
  url.searchParams.delete('language');
  if (category === 'local' && location.region) url.searchParams.set('region', location.region);
  else url.searchParams.delete('region');
  if (category === 'local' && location.city) url.searchParams.set('city', location.city);
  else url.searchParams.delete('city');
  if (currentArticle) {
    url.pathname = `/article/${encodeURIComponent(currentArticle)}`;
    url.searchParams.set('category', category);
  }
  url.searchParams.delete('article');
  return url;
}

function homeContextUrl({ category, location }) {
  const url = contextUrl({ category, location });
  url.pathname = categoryRoutes[category] || '/';
  url.searchParams.delete('article');
  return url;
}

function articleContextUrl(article, context) {
  const url = contextUrl(context);
  url.pathname = `/article/${encodeURIComponent(article.id)}`;
  url.searchParams.set('category', article.category || context.category || 'top');
  url.searchParams.delete('article');
  return url;
}

function App() {
  const [screen, setScreen] = useState('home');
  const [category, setCategory] = useState(initialCategory);
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState('Loading live news...');
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [isLoadingHomeSections, setIsLoadingHomeSections] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [query, setQuery] = useState(() => readUrlParam('q') || '');
  const language = initialLanguage();
  const [location, setLocation] = useState(initialLocation);
  const [savedIds, setSavedIds] = useState(() => readLocal('nuzenio_saved_ids', [], 'newssetu_saved_ids'));
  const [history, setHistory] = useState(() => readLocal('nuzenio_history', [], 'newssetu_history'));
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [authNotice, setAuthNotice] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isLocalPage, setIsLocalPage] = useState(() => window.location.pathname === categoryRoutes.local);
  const [isRootHome, setIsRootHome] = useState(() => isRootHomePath());
  const [analyticsConsent, setAnalyticsConsent] = useState(() => readLocal('nuzenio_analytics_consent', ''));
  const [homeSectionFeeds, setHomeSectionFeeds] = useState({});
  const newsRequestId = useRef(0);
  const homeSectionsRequestId = useRef(0);

  useEffect(() => {
    document.documentElement.dir = language.dir;
    document.documentElement.lang = language.code;
    document.documentElement.dataset.newsLanguage = 'en';
    localStorage.removeItem('nuzenio_news_language');
    localStorage.removeItem('newssetu_news_language');
  }, []);

  useEffect(() => {
    updateGoogleConsent(analyticsConsent);
  }, [analyticsConsent]);

  useEffect(() => {
    if (!['manual', 'link'].includes(location.source)) {
      detectAccurateLocation(updateLocation);
    }
  }, []);

  useEffect(() => {
    const urlQuery = (readUrlParam('q') || '').trim();
    if (urlQuery) {
      setQuery(urlQuery);
      searchNewsByTerm(urlQuery, { updateUrl: false });
      return;
    }
    loadNews(category, location.country, location.region, location.city, 'en');
  }, [category, location.country, location.region, location.city]);

  useEffect(() => {
    if (!isRootHome) {
      setHomeSectionFeeds({});
      return;
    }
    loadHomeSectionFeeds(location.country);
  }, [isRootHome, location.country]);

  useEffect(() => {
    if (isRootHome && category === 'top') {
      setIsLocalPage(false);
      return;
    }
    const url = contextUrl({ category, location });
    window.history.replaceState({}, '', url);
    setIsLocalPage(category === 'local' && url.pathname === categoryRoutes.local);
  }, [category, isRootHome, location.country, location.region, location.city]);

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
    updatePageSeo(selected, { category, isRootHome, location, language, articles, searchTerm: (readUrlParam('q') || query).trim() });
  }, [selected, articles, category, isRootHome, query, location.country, location.region, location.city]);

  useEffect(() => {
    document.body.classList.toggle('articleModalOpen', Boolean(selected));
    function closeOnEscape(event) {
      if (event.key === 'Escape') closeArticle();
    }
    if (selected) window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('articleModalOpen');
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selected]);

  async function loadNews(
    cat = 'local',
    country = location.country,
    region = location.region,
    city = location.city,
    newsLanguage = 'en',
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
    const searchTerm = query.trim();
    if (!searchTerm) {
      clearSearchUrl();
      return loadNews(category, location.country, location.region, location.city, 'en');
    }
    return searchNewsByTerm(searchTerm, { updateUrl: true });
  }

  async function searchNewsByTerm(searchTerm, { updateUrl = true } = {}) {
    const requestId = newsRequestId.current + 1;
    newsRequestId.current = requestId;
    setIsLoadingNews(true);
    setStatus('Searching live RSS news...');
    setArticles([]);
    if (updateUrl) writeSearchUrl(searchTerm);
    try {
      const res = await fetch(
        `/api/news?q=${encodeURIComponent(searchTerm)}&country=${encodeURIComponent(location.country)}&language=en&fresh=${Date.now()}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (requestId !== newsRequestId.current) return;
      if (!data.ok) throw new Error(data.error || 'Search failed');
      setArticles(data.articles || []);
      setLastUpdated(new Date());
      setStatus(`${data.total || 0} results for "${searchTerm}"`);
      trackEvent('search', {
        search_term: searchTerm,
        results_count: data.total || 0,
        country: location.country,
      });
    } catch (error) {
      if (requestId !== newsRequestId.current) return;
      setStatus(`Search error: ${error.message}`);
    } finally {
      if (requestId === newsRequestId.current) setIsLoadingNews(false);
    }
  }

  async function loadHomeSectionFeeds(country = location.country) {
    const requestId = homeSectionsRequestId.current + 1;
    homeSectionsRequestId.current = requestId;
    const sectionCategories = {
      world: 'world',
      aiTech: 'ai',
      business: 'business',
      sports: 'sports',
      science: 'science',
      health: 'health',
      entertainment: 'entertainment',
    };
    setIsLoadingHomeSections(true);
    try {
      const results = await Promise.all(Object.entries(sectionCategories).map(async ([key, cat]) => {
        const res = await fetch(
          `/api/news?category=${encodeURIComponent(cat)}&country=${encodeURIComponent(country)}&language=en&fresh=${Date.now()}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        return [key, data.ok ? data.articles || [] : []];
      }));
      if (requestId === homeSectionsRequestId.current) {
        setHomeSectionFeeds(Object.fromEntries(results));
      }
    } catch {
      if (requestId === homeSectionsRequestId.current) setHomeSectionFeeds({});
    } finally {
      if (requestId === homeSectionsRequestId.current) setIsLoadingHomeSections(false);
    }
  }

  function refreshCurrentNews() {
    trackEvent('refresh_news', {
      category,
      country: location.country,
    });
    const activeSearch = (readUrlParam('q') || query).trim();
    if (activeSearch) {
      searchNewsByTerm(activeSearch, { updateUrl: true });
      return;
    }
    loadNews(category, location.country, location.region, location.city, 'en');
    if (isRootHome) loadHomeSectionFeeds(location.country);
  }

  function updateLocation(next) {
    setLocation(next);
    writeLocal('nuzenio_location', next);
    trackEvent('set_location', {
      country: next.country,
      region: next.region || '',
      city: next.city || '',
      source: next.source || '',
    });
  }

  function writeSearchUrl(searchTerm) {
    const url = homeContextUrl({ category, location });
    url.searchParams.set('q', searchTerm);
    window.history.replaceState({}, '', url);
  }

  function clearSearchUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function navigateCategory(nextCategory) {
    setScreen('home');
    setIsRootHome(false);
    setCategory(nextCategory);
    setQuery('');
    setMobileSearchOpen(false);
    const url = homeContextUrl({ category: nextCategory, location });
    url.searchParams.delete('q');
    window.history.pushState({}, '', url);
    setIsLocalPage(nextCategory === 'local' && url.pathname === categoryRoutes.local);
    trackEvent('select_content', {
      content_type: 'category',
      item_id: nextCategory,
    });
  }

  function navigateHome() {
    setScreen('home');
    setCategory('top');
    setIsRootHome(true);
    setIsLocalPage(false);
    setQuery('');
    setMobileSearchOpen(false);
    window.history.pushState({}, '', '/');
    trackEvent('select_content', {
      content_type: 'home',
      item_id: 'home',
    });
  }

  function chooseAnalyticsConsent(nextConsent) {
    setAnalyticsConsent(nextConsent);
    writeLocal('nuzenio_analytics_consent', nextConsent);
    updateGoogleConsent(nextConsent);
    if (nextConsent === 'granted') {
      trackEvent('analytics_consent_granted', { method: 'banner' });
      trackCurrentPageView();
    }
  }

  function reopenAnalyticsConsent() {
    setAnalyticsConsent('');
    writeLocal('nuzenio_analytics_consent', '');
  }

  function trackCurrentPageView() {
    const context = { category, isRootHome, location, language, searchTerm: (readUrlParam('q') || query).trim() };
    const url = selected ? articleContextUrl(selected, context) : contextUrlForSeo(context);
    const title = selected ? `${displayTitle(selected)} | Nuzenio` : pageSeoTitle(context);
    trackPageView(productionUrl(url), title);
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
    trackEvent(exists ? 'unsave_article' : 'save_article', articleEventParams(article));

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
    trackEvent('select_content', {
      content_type: article.category || 'article',
      item_id: article.id,
      source: article.source || '',
      title: article.title || '',
    });
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
    window.history.replaceState({}, '', homeContextUrl({ category, location }));
  }

  const copy = translations.en;
  const lead = articles[0];
  const sideStories = articles.slice(1, 5);
  const feed = articles.slice(5);
  const ticker = useMemo(
    () => articles.slice(0, 6).map((article) => article.title).join(' | '),
    [articles],
  );
  const modalArticles = uniqueArticles([...articles, ...Object.values(homeSectionFeeds).flat()]);
  const breakingLabel = ['live', 'video'].includes(category)
    ? videoSectionLabel(category, copy).toUpperCase()
    : copy.breaking;

  return (
    <div className="appShell" data-section={category} data-local-page={isLocalPage ? 'true' : 'false'}>
      <a className="skipLink" href="#main-content">Skip to main content</a>
      <Header
        authNotice={authNotice}
        breakingLabel={breakingLabel}
        breakingText={ticker || status}
        category={category}
        copy={copy}
        loginWithGoogle={loginWithGoogle}
        logout={logout}
        mobileSearchOpen={mobileSearchOpen}
        isRootHome={isRootHome}
        query={query}
        screen={screen}
        searchNews={searchNews}
        navigateCategory={navigateCategory}
        navigateHome={navigateHome}
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
          homeSectionFeeds={homeSectionFeeds}
          isRootHome={isRootHome}
          isLoadingHomeSections={isLoadingHomeSections}
          language={language}
          isLoadingNews={isLoadingNews}
          lastUpdated={lastUpdated}
          lead={lead}
          location={location}
          setLocation={updateLocation}
          openArticle={openArticle}
          savedIds={savedIds}
          sideStories={sideStories}
          status={status}
          toggleSave={toggleSave}
          refreshNews={refreshCurrentNews}
          searchTerm={(readUrlParam('q') || query).trim()}
          clearSearch={() => {
            setQuery('');
            clearSearchUrl();
            loadNews(category, location.country, location.region, location.city, 'en');
          }}
        />
      )}
      {selected && (
        <ArticleModal
          article={selected}
          articles={modalArticles}
          copy={copy}
          language={language}
          onClose={closeArticle}
          openArticle={openArticle}
          savedIds={savedIds}
          toggleSave={toggleSave}
        />
      )}
      {!analyticsConsent && (
        <AnalyticsConsentBanner onAccept={() => chooseAnalyticsConsent('granted')} onDecline={() => chooseAnalyticsConsent('denied')} />
      )}
      <Footer copy={copy} onPrivacySettings={reopenAnalyticsConsent} />
      <MobileNav copy={copy} navigateCategory={navigateCategory} navigateHome={navigateHome} setMobileSearchOpen={setMobileSearchOpen} />
    </div>
  );
}

function AnalyticsConsentBanner({ onAccept, onDecline }) {
  return (
    <div className="consentBanner" role="dialog" aria-label="Analytics privacy choice">
      <div>
        <b>Privacy choice</b>
        <p>Nuzenio uses Google Analytics to understand page views, searches, and article engagement. You can keep browsing without analytics cookies.</p>
      </div>
      <div className="consentActions">
        <button className="primaryAction" onClick={onAccept}>Accept analytics</button>
        <button onClick={onDecline}>Keep private</button>
      </div>
    </div>
  );
}

function Header({
  authNotice,
  breakingLabel,
  breakingText,
  category,
  copy,
  loginWithGoogle,
  logout,
  mobileSearchOpen,
  isRootHome,
  navigateCategory,
  navigateHome,
  query,
  screen,
  searchNews,
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
            aria-label="Search live news"
          />
          <button className="searchSubmit" type="submit">
            {copy.search}
          </button>
        </form>

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
          href={categoryRoutes.ai}
          className={screen === 'home' && category === 'ai' ? 'active' : ''}
          onClick={(event) => {
            event.preventDefault();
            navigateCategory('ai');
          }}
        >
          {copy.categories.ai}
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
      <BreakingStrip label={breakingLabel} text={breakingText} />
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
  homeSectionFeeds,
  isLoadingHomeSections,
  isLoadingNews,
  isRootHome,
  language,
  lastUpdated,
  lead,
  location,
  openArticle,
  refreshNews,
  searchTerm,
  clearSearch,
  savedIds,
  setLocation,
  sideStories,
  status,
  toggleSave,
}) {
  const isVideoSection = ['live', 'video'].includes(category);
  const section = sectionContent(category, copy, location);
  const localPreview = articles.find((article) => article.category === 'local') || articles[1];
  const videoPreview = articles.find((article) => article.category === 'video' || isVideoArticle(article)) || articles[2];
  const livePreview = articles.find((article) => article.category === 'live') || articles[3];

  if (isVideoSection) {
    return (
      <main id="main-content" className={`main videoMain ${category === 'video' ? 'recordedVideoMain' : 'liveVideoMain'}`} tabIndex="-1">
        <section>
          <div className="videoHero">
            <div>
              <span className="badge">
                <PlayCircle size={15} /> {category === 'live' ? 'Approved live sources' : 'Recorded news videos'}
              </span>
              <h2>{category === 'live' ? copy.categories.live : copy.categories.video}</h2>
              <p>
                {category === 'live'
                  ? 'Verified English live news channels loaded for your selected country. Watch inside Nuzenio.'
                  : 'English recorded news videos only. Live streams stay on the Live News page.'}
              </p>
              <div className="videoHeroMeta">
                <span>English</span>
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
                <p>{category === 'live' ? 'Playable live news streams.' : 'Playable English video news feed, excluding live streams.'}</p>
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
          <TopicRail />
          <Newsletter copy={copy} language={language} />
          <AdSlot name="sidebar-rectangle" label="Sidebar advertising inventory" compact />
        </aside>
      </main>
    );
  }

  return (
    <main id="main-content" className="main" tabIndex="-1">
      <section>
        <LocationBanner copy={copy} location={location} setLocation={setLocation} status={status} />

        <div className="heroGrid">
          <a
            className="leadCard"
            href={lead ? articleHref(lead) : '#'}
            onClick={(event) => lead && openArticleFromLink(event, lead, openArticle)}
          >
            <div className="leadVisual">
              <ImageWithFallback
                src={lead?.image}
                alt={lead ? `${lead.source || 'Publisher'} image for ${displayTitle(lead)}` : 'Nuzenio lead story image'}
                imageKind={lead?.imageKind}
                logoLabel={lead?.source}
                logoSize="large"
                loading="eager"
                fetchPriority="high"
                fallback={(
                <NewsFallbackVisual article={lead} size="large" />
                )}
              />
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
          </a>

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

        <TrustStrip articles={articles} lastUpdated={lastUpdated} location={location} />
        <NewsBriefingPanel
          articles={articles}
          lastUpdated={lastUpdated}
          location={location}
          refreshNews={refreshNews}
          status={status}
          isLoading={isLoadingNews || isLoadingHomeSections}
        />

        <QuickSectionGrid
          copy={copy}
          localPreview={localPreview}
          livePreview={livePreview}
          openArticle={openArticle}
          videoPreview={videoPreview}
        />

        <AdSlot name="top-native" label="Top advertising inventory" />

        {searchTerm && (
          <SearchResultPanel
            articles={articles}
            clearSearch={clearSearch}
            isLoading={isLoadingNews}
            location={location}
            searchTerm={searchTerm}
          />
        )}

        {isRootHome ? (
          <HomeSectionStack
            articles={articles}
            copy={copy}
            homeSectionFeeds={homeSectionFeeds}
            isLoadingHomeSections={isLoadingHomeSections}
            isLoadingNews={isLoadingNews}
            lastUpdated={lastUpdated}
            openArticle={openArticle}
            refreshNews={refreshNews}
            savedIds={savedIds}
            status={status}
            toggleSave={toggleSave}
          />
        ) : (
          <>
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
              {!isLoadingNews && articles.length === 0 && (
                <EmptyFeedState
                  copy={copy}
                  refreshNews={refreshNews}
                  searchTerm={searchTerm}
                />
              )}
            </div>
          </>
        )}
      </section>

      <aside className="rightRail">
        <Trending articles={articles} copy={copy} openArticle={openArticle} />
        <AISummaryBox copy={copy} />
        <TopicRail />
        <Newsletter copy={copy} language={language} />
        <AdSlot name="sidebar-rectangle" label="Sidebar advertising inventory" compact />
      </aside>
    </main>
  );
}

function EmptyFeedState({ copy, refreshNews, searchTerm }) {
  if (!searchTerm) return <div className="empty">{copy.emptyFeed}</div>;
  return (
    <div className="empty searchEmptyState">
      <b>No live results for "{searchTerm}"</b>
      <p>Try a broader keyword, check spelling, or refresh the live RSS search.</p>
      <button className="primaryAction" onClick={refreshNews}>
        <RefreshCw size={15} /> Refresh search
      </button>
    </div>
  );
}

function SearchResultPanel({ articles, clearSearch, isLoading, location, searchTerm }) {
  return (
    <section className="searchResultPanel" aria-label={`Search results for ${searchTerm}`}>
      <div>
        <span>
          <Search size={15} /> Search results
        </span>
        <h2>{searchTerm}</h2>
        <p>
          {isLoading ? 'Searching live publisher feeds...' : `${articles.length} live results for ${countryLabel(location.country)}.`}
        </p>
      </div>
      <button onClick={clearSearch}>
        <X size={15} /> Clear search
      </button>
    </section>
  );
}

function NewsBriefingPanel({ articles, lastUpdated, location, refreshNews, status, isLoading }) {
  const publishers = new Set(articles.map((article) => article.source).filter(Boolean)).size;
  const latest = articles
    .map((article) => new Date(article.pubDate).getTime())
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const latestLabel = latest ? formatFreshAge(new Date(latest).toISOString()) : 'Updating';
  const focusCountry = countryLabel(location.country);
  const stats = [
    { label: 'Live articles', value: articles.length || '...' },
    { label: 'Publishers', value: publishers || '...' },
    { label: 'Freshest story', value: latestLabel },
    { label: 'Focus', value: focusCountry },
  ];

  return (
    <section className="newsBriefingPanel" aria-label="Live Nuzenio briefing">
      <div className="newsBriefingCopy">
        <span>
          <Sparkles size={15} /> Live briefing
        </span>
        <h2>Everything important, organized before you scroll.</h2>
        <p>{status || `Latest English headlines for ${focusCountry}, refreshed from publisher RSS sources.`}</p>
      </div>
      <div className="newsBriefingStats">
        {stats.map((item) => (
          <div key={item.label}>
            <b>{item.value}</b>
            <small>{item.label}</small>
          </div>
        ))}
      </div>
      <div className="newsBriefingActions">
        <button className="primaryAction" onClick={refreshNews} disabled={isLoading}>
          <RefreshCw size={15} className={isLoading ? 'spin' : ''} /> {isLoading ? 'Refreshing' : 'Refresh'}
        </button>
        <a href={categoryRoutes.world}>
          World <ChevronRight size={14} />
        </a>
        <a href={categoryRoutes.ai}>
          AI <ChevronRight size={14} />
        </a>
      </div>
    </section>
  );
}

function TrustStrip({ articles, lastUpdated, location }) {
  const publishers = new Set(articles.map((article) => article.source).filter(Boolean)).size;
  return (
    <div className="trustStrip" aria-label="Nuzenio trust signals">
      <div>
        <ShieldCheck size={18} />
        <span>Publisher sourced</span>
      </div>
      <div>
        <Globe2 size={18} />
        <span>{location.label || countryLabel(location.country)} coverage</span>
      </div>
      <div>
        <Zap size={18} />
        <span>{articles.length} live stories</span>
      </div>
      <div>
        <CheckCircle2 size={18} />
        <span>{publishers || 'Verified'} sources</span>
      </div>
      <div>
        <Clock size={18} />
        <span>{lastUpdated ? `Updated ${formatLastUpdated(lastUpdated)}` : 'Refreshing live'}</span>
      </div>
    </div>
  );
}

function QuickSectionGrid({ copy, localPreview, livePreview, openArticle, videoPreview }) {
  const cards = [
    {
      title: copy.categories.local,
      text: localPreview ? displayTitle(localPreview) : 'Nearby headlines tuned by location.',
      href: categoryRoutes.local,
      icon: Globe2,
      article: localPreview,
    },
    {
      title: copy.categories.video,
      text: videoPreview ? displayTitle(videoPreview) : 'Watch recorded news videos inside Nuzenio.',
      href: categoryRoutes.video,
      icon: PlayCircle,
      article: videoPreview,
    },
    {
      title: copy.categories.live,
      text: livePreview ? displayTitle(livePreview) : 'Live news channels from approved sources.',
      href: categoryRoutes.live,
      icon: Zap,
      article: livePreview,
    },
  ];

  return (
    <div className="quickSectionGrid" aria-label="Featured Nuzenio sections">
      {cards.map(({ article, href, icon: Icon, text, title }) => (
        <a
          key={title}
          className="quickSectionCard"
          href={article ? articleHref(article) : href}
          onClick={(event) => article && openArticleFromLink(event, article, openArticle)}
        >
          <span>
            <Icon size={20} />
          </span>
          <b>{title}</b>
          <p>{text}</p>
          <small>Open <ChevronRight size={14} /></small>
        </a>
      ))}
    </div>
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

function VideoModeStrip({ category, language, location, status }) {
  return (
    <div className="videoModeStrip">
      <div>
        <PlayCircle size={17} />
        <span>{category === 'live' ? 'Live news channels' : 'Recorded video news'}</span>
      </div>
      <div>
        <Languages size={17} />
        <span>English</span>
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

const homeSectionConfigs = [
  {
    key: 'top',
    title: 'Top Stories',
    intro: 'The most important live headlines in your selected region.',
    href: categoryRoutes.top,
    match: ['breaking', 'latest', 'top', 'headline', 'exclusive', 'update'],
  },
  {
    key: 'trending',
    title: 'Trending Now',
    intro: 'Fast-moving stories readers are likely to follow next.',
    href: categoryRoutes.top,
    match: ['viral', 'trend', 'breaking', 'live', 'update', 'market', 'election'],
  },
  {
    key: 'world',
    title: 'World Headlines',
    intro: 'Global developments and international updates.',
    href: categoryRoutes.world,
    match: ['world', 'global', 'international', 'war', 'summit', 'diplomacy', 'border', 'europe', 'china', 'us ', 'russia'],
  },
  {
    key: 'aiTech',
    title: 'AI & Technology',
    intro: 'AI, technology, chips, startups, products, platforms, and research.',
    href: categoryRoutes.ai,
    match: ['ai', 'artificial intelligence', 'openai', 'google', 'anthropic', 'nvidia', 'chip', 'tech', 'startup', 'model'],
  },
  {
    key: 'business',
    title: 'Business & Markets',
    intro: 'Markets, companies, economy, money, jobs, and business policy.',
    href: categoryRoutes.business,
    match: ['business', 'market', 'stock', 'economy', 'company', 'bank', 'trade', 'rupee', 'dollar', 'profit'],
  },
  {
    key: 'sports',
    title: 'Sports Highlights',
    intro: 'Matches, teams, scores, tournaments, and sports personalities.',
    href: categoryRoutes.sports,
    match: ['sport', 'match', 'cricket', 'football', 'tennis', 'score', 'league', 'cup', 'team', 'player'],
  },
  {
    key: 'science',
    title: 'Science & Space',
    intro: 'Science, space, climate, discoveries, and research updates.',
    href: categoryRoutes.science,
    match: ['science', 'space', 'nasa', 'isro', 'climate', 'research', 'study', 'moon', 'mars', 'discovery'],
  },
  {
    key: 'health',
    title: 'Health Updates',
    intro: 'Public health, medicine, wellness, hospitals, and research.',
    href: categoryRoutes.health,
    match: ['health', 'medicine', 'doctor', 'hospital', 'disease', 'virus', 'wellness', 'medical', 'study'],
  },
  {
    key: 'entertainment',
    title: 'Entertainment',
    intro: 'Film, streaming, music, celebrity, culture, and media stories.',
    href: categoryRoutes.entertainment,
    match: ['entertainment', 'film', 'movie', 'bollywood', 'hollywood', 'music', 'actor', 'celebrity', 'ott'],
  },
];

function HomeSectionStack({
  articles,
  copy,
  homeSectionFeeds,
  isLoadingHomeSections,
  isLoadingNews,
  lastUpdated,
  openArticle,
  refreshNews,
  savedIds,
  status,
  toggleSave,
}) {
  const sections = buildHomeSections(articles, homeSectionFeeds);
  const mustReadArticles = buildMustReadStories(articles, homeSectionFeeds);
  return (
    <div className="homeSectionStack">
      <div className="sectionHead">
        <div>
          <h2>Latest News Sections</h2>
          <p>Browse live coverage across top stories, trending news, world, AI, business, sports, science, health, and entertainment.</p>
        </div>
        <SectionStatus
          isLoading={isLoadingNews || isLoadingHomeSections}
          lastUpdated={lastUpdated}
          onRefresh={refreshNews}
          status={status}
        />
      </div>
      <MustReadBand
        articles={mustReadArticles}
        copy={copy}
        openArticle={openArticle}
        savedIds={savedIds}
        toggleSave={toggleSave}
      />
      {sections.map((section) => (
        <section className="homeTopicSection" key={section.key}>
          <div className="homeTopicHead">
            <div>
              <h3>{section.title}</h3>
              <p>{section.intro}</p>
            </div>
            <a href={section.href}>
              View all <ChevronRight size={14} />
            </a>
          </div>
          <div className="homeSectionGrid">
            {section.articles.map((article) => (
              <ArticleCard
                key={`${section.key}-${article.id}`}
                article={article}
                copy={copy}
                openArticle={openArticle}
                savedIds={savedIds}
                toggleSave={toggleSave}
              />
            ))}
          </div>
        </section>
      ))}
      {isLoadingNews && articles.length === 0 && <LoadingCards count={6} />}
      {!isLoadingNews && articles.length === 0 && <div className="empty">{copy.emptyFeed}</div>}
    </div>
  );
}

function MustReadBand({ articles, copy, openArticle, savedIds, toggleSave }) {
  if (!articles.length) return null;
  const [lead, ...items] = articles.slice(0, 4);
  const leadSaved = savedIds.includes(lead.id);
  return (
    <section className="mustReadBand" aria-label="Must read live news">
      <div className="mustReadHead">
        <div>
          <span>Must Read</span>
          <h3>Start with the biggest live stories right now</h3>
        </div>
        <a href={categoryRoutes.top}>
          More top news <ChevronRight size={14} />
        </a>
      </div>
      <div className="mustReadGrid">
        <article className="mustReadLead">
          <a className="mustReadLeadVisual" href={articleHref(lead)} onClick={(event) => openArticleFromLink(event, lead, openArticle)}>
            <ImageWithFallback
              src={lead.image}
              alt={`${lead.source || 'Publisher'} image for ${displayTitle(lead)}`}
              imageKind={lead.imageKind}
              logoLabel={lead.source}
              logoSize="large"
              fallback={<NewsFallbackVisual article={lead} size="large" />}
            />
          </a>
          <div className="mustReadLeadBody">
            <div className="cardTop">
              <span className="category">{lead.category?.toUpperCase()}</span>
              <span>
                <Clock size={13} /> {formatFreshAge(lead.pubDate)}
              </span>
            </div>
            <a className="headline" href={articleHref(lead)} onClick={(event) => openArticleFromLink(event, lead, openArticle)}>
              {displayTitle(lead)}
            </a>
            <p>{displaySummary(lead)}</p>
            <div className="cardActions">
              <button className="primaryAction" onClick={() => openArticle(lead)}>
                <Sparkles size={15} /> {copy.aiBrief}
              </button>
              <button onClick={() => toggleSave(lead)}>
                <Bookmark size={15} fill={leadSaved ? 'currentColor' : 'none'} /> {leadSaved ? copy.saved : copy.save}
              </button>
            </div>
          </div>
        </article>
        <div className="mustReadList">
          {items.map((article) => (
            <a className="mustReadItem" key={article.id} href={articleHref(article)} onClick={(event) => openArticleFromLink(event, article, openArticle)}>
              <div className="mustReadItemThumb">
                <ImageWithFallback
                  src={article.image}
                  alt={`${article.source || 'Publisher'} image for ${displayTitle(article)}`}
                  imageKind={article.imageKind}
                  logoLabel={article.source}
                  logoSize="small"
                  fallback={<NewsFallbackVisual article={article} size="small" />}
                />
              </div>
              <div>
                <span>{article.source} · {formatFreshAge(article.pubDate)}</span>
                <b>{displayTitle(article)}</b>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function buildHomeSections(articles, homeSectionFeeds = {}) {
  const fallback = articles.slice(0, 6);
  return homeSectionConfigs
    .map((section, index) => {
      const matched = section.key === 'top'
        ? articles.slice(0, 6)
        : section.key === 'trending'
          ? articles.slice(1, 7)
          : homeSectionFeeds[section.key]?.length
            ? homeSectionFeeds[section.key]
            : articles.filter((article) => articleMatchesHomeSection(article, section.match));
      return {
        ...section,
        articles: uniqueArticles(matched.length ? matched : fallback.slice(index % 3, index % 3 + 3)).slice(0, 3),
      };
    })
    .filter((section) => section.articles.length > 0);
}

function buildMustReadStories(articles, homeSectionFeeds = {}) {
  const priorityFeeds = ['world', 'aiTech', 'business', 'science', 'health', 'entertainment', 'sports']
    .flatMap((key) => (homeSectionFeeds[key] || []).slice(0, 2));
  return uniqueArticles([...articles.slice(0, 8), ...priorityFeeds]).slice(0, 4);
}

function articleMatchesHomeSection(article, keywords) {
  const text = `${article?.category || ''} ${article?.title || ''} ${article?.summary || ''} ${article?.source || ''}`.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
}

function uniqueArticles(articles) {
  const seen = new Set();
  return articles.filter((article) => {
    if (!article?.id || seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
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
            <a key={article.id} href={articleHref(article)} onClick={(event) => openArticleFromLink(event, article, openArticle)}>
              <VideoThumbMedia article={article} compact />
              <span>
                <b>{displayTitle(article)}</b>
                <small>{article.source}</small>
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function VideoThumbMedia({ article, compact = false }) {
  const thumbnail = videoThumbnail(article);

  const fallback = (
    <div className={`videoThumbFallback ${compact ? 'compactThumbFallback' : ''}`} aria-hidden="true">
      <PlayCircle size={compact ? 24 : 38} />
    </div>
  );

  return <ImageWithFallback src={thumbnail} alt={`${article.source || 'Publisher'} video thumbnail for ${displayTitle(article)}`} fallback={fallback} />;
}

function VideoCard({ article, copy, openArticle, savedIds, toggleSave }) {
  const isSaved = savedIds.includes(article.id);
  const isLive = article.category === 'live';
  return (
    <article className={`videoCard ${isLive ? 'liveCard' : ''}`}>
      <div className="inlineVideo">
        <a
          className="videoThumbButton"
          href={articleHref(article)}
          onClick={(event) => openArticleFromLink(event, article, openArticle)}
          aria-label={`Watch ${displayTitle(article)}`}
        >
          <VideoThumbMedia article={article} />
          <span>
            <PlayCircle size={34} />
          </span>
        </a>
      </div>
      <div className="videoBody">
        <div className="cardTop">
          <span className="category">{isLive ? 'LIVE' : 'VIDEO'}</span>
          <span>{article.source}</span>
        </div>
        <a className="headline" href={articleHref(article)} onClick={(event) => openArticleFromLink(event, article, openArticle)}>
          {displayTitle(article)}
        </a>
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
    <a className="smallStory" href={articleHref(article)} onClick={(event) => openArticleFromLink(event, article, openArticle)}>
      <div className="miniThumb">
        <ImageWithFallback
          src={article.image}
          alt={`${article.source || 'Publisher'} image for ${displayTitle(article)}`}
          imageKind={article.imageKind}
          logoLabel={article.source}
          logoSize="small"
          fallback={(
          <NewsFallbackVisual article={article} size="small" />
          )}
        />
      </div>
      <div>
        <b>{displayTitle(article)}</b>
        <span>
          {article.source} · {formatFreshAge(article.pubDate)}
        </span>
      </div>
    </a>
  );
}

function ArticleCard({ article, copy, openArticle, savedIds, toggleSave }) {
  const isSaved = savedIds.includes(article.id);
  const image = article.image || videoThumbnail(article);
  return (
    <article className="articleCard">
      <a className="articleThumb" href={articleHref(article)} onClick={(event) => openArticleFromLink(event, article, openArticle)}>
        <ImageWithFallback
          src={image}
          alt={`${article.source || 'Publisher'} image for ${displayTitle(article)}`}
          imageKind={article.imageKind}
          logoLabel={article.source}
          fallback={(
          <NewsFallbackVisual article={article} />
          )}
        />
      </a>
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
      <a className="headline" href={articleHref(article)} onClick={(event) => openArticleFromLink(event, article, openArticle)}>
        {displayTitle(article)}
      </a>
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
      <a className="sourceAction" href={articleHref(article)} onClick={(event) => openArticleFromLink(event, article, openArticle)}>
        {copy.readStory} <ChevronRight size={14} />
      </a>
    </article>
  );
}

function NewsFallbackVisual({ article, size = 'default' }) {
  const category = article?.category || 'news';
  const source = article?.source || 'Nuzenio';
  return (
    <div className={`newsFallbackVisual ${size === 'large' ? 'largeFallback' : ''} ${size === 'small' ? 'smallFallback' : ''}`}>
      <Newspaper size={size === 'small' ? 20 : 34} />
      <span>{category.toUpperCase()}</span>
      {size !== 'small' && <b>{source}</b>}
    </div>
  );
}

function ImageWithFallback({
  src,
  alt = '',
  imageKind = 'photo',
  loading = 'lazy',
  fetchPriority,
  fallback,
  logoLabel = '',
  logoSize = 'default',
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (!src || broken) return fallback || null;
  if (imageKind === 'logo') {
    return (
      <div className={`publisherLogoVisual ${logoSize === 'large' ? 'largePublisherLogo' : ''} ${logoSize === 'small' ? 'smallPublisherLogo' : ''}`}>
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
        {logoLabel && <span>{logoLabel}</span>}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      data-image-kind={imageKind}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

function Trending({ articles, copy, openArticle }) {
  return (
    <div className="railCard">
      <h3>
        <TrendingUp size={18} /> {copy.trending}
      </h3>
      {articles.slice(0, 5).map((article, index) => (
        <a className="trend" key={article.id} href={articleHref(article)} onClick={(event) => openArticleFromLink(event, article, openArticle)}>
          <b>{index + 1}</b>
          <span>{displayTitle(article)}</span>
        </a>
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

function TopicRail() {
  const topics = [
    { label: 'Business', icon: BriefcaseBusiness, path: categoryRoutes.business },
    { label: 'Technology', icon: Zap, path: categoryRoutes.tech },
    { label: 'Sports', icon: Trophy, path: categoryRoutes.sports },
    { label: 'Health', icon: Stethoscope, path: categoryRoutes.health },
  ];

  return (
    <div className="railCard topicRail">
      <h3>
        <Newspaper size={18} /> Explore
      </h3>
      <div>
        {topics.map(({ icon: Icon, label, path }) => (
          <a key={label} href={path}>
            <Icon size={16} /> {label}
          </a>
        ))}
      </div>
    </div>
  );
}

function Newsletter({ copy, language }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function subscribe(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage('Enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    try {
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
      trackEvent('newsletter_subscribe', {
        method: supabase ? 'supabase' : 'local',
        language: language.code,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="railCard" onSubmit={subscribe}>
      <h3>
        <Mail size={18} /> {copy.dailyBrief}
      </h3>
      <p>Top English stories every morning.</p>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={copy.email}
        type="email"
        autoComplete="email"
        aria-label="Email address for Nuzenio daily brief"
      />
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Subscribing...' : copy.subscribe}</button>
      <small className="newsletterNote">No spam. Unsubscribe anytime.</small>
      {message && <small>{message}</small>}
    </form>
  );
}

function ArticleModal({ article, articles, copy, onClose, openArticle, savedIds, toggleSave }) {
  const facts = buildKeyFacts(article);
  const timeline = buildTimeline(article);
  const faqs = buildFaq(article);
  const isVideo = isVideoArticle(article);
  const related = buildRelatedArticles(article, articles, 4);
  return (
    <div className="modalOverlay" onClick={onClose}>
      <article
        className="articleModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="article-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close" onClick={onClose} aria-label="Close article">
          <X size={20} />
        </button>
        <div className="progress" />
        <div className="articleTopline">
          <span className="category">{article.category?.toUpperCase()}</span>
        </div>
        <h1 id="article-modal-title">{displayTitle(article)}</h1>
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
        <div className="articleActionBar" aria-label="Article actions">
          <button onClick={() => toggleSave(article)}>
            <Bookmark size={16} /> {savedIds.includes(article.id) ? copy.saved : copy.save}
          </button>
          <button onClick={() => shareArticle(article)}>
            <Share2 size={16} /> Share
          </button>
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent('publisher_outbound_click', articleEventParams(article))}
          >
            <ExternalLink size={16} /> Publisher
          </a>
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
                <RelatedStoryCard key={item.id} article={item} openArticle={openArticle} />
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
        <a
          className="original"
          href={article.link}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent('publisher_outbound_click', articleEventParams(article))}
        >
          {isVideo ? 'Open original source' : copy.readOriginal} <ExternalLink size={16} />
        </a>
      </article>
    </div>
  );
}

function RelatedStoryCard({ article, openArticle }) {
  const image = article.image || videoThumbnail(article);
  return (
    <button className="relatedStoryCard" onClick={() => openArticle(article)}>
      <div className="relatedThumb">
        <ImageWithFallback
          src={image}
          alt={`${article.source || 'Publisher'} image for ${displayTitle(article)}`}
          imageKind={article.imageKind}
          logoLabel={article.source}
          logoSize="small"
          fallback={(
          <NewsFallbackVisual article={article} size="small" />
          )}
        />
      </div>
      <div>
        <span>{article.source} · {formatFreshAge(article.pubDate)}</span>
        <b>{displayTitle(article)}</b>
      </div>
    </button>
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

function Footer({ copy, onPrivacySettings }) {
  return (
    <footer className="footer">
      <b>Nuzenio</b>
      <a href="/about.html">About</a>
      <a href="/sources.html">Sources</a>
      <a href="/editorial-policy.html">Editorial Policy</a>
      <a href="/contact.html">Contact</a>
      <a href="/advertise.html">Advertise</a>
      <a href="/feed.xml">RSS</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="/affiliate-disclosure.html">Affiliate Disclosure</a>
      <button onClick={onPrivacySettings}>Privacy settings</button>
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
    top: 'Top headlines from the live news feed, refreshed for your selected country.',
    world: 'Global headlines from the world news section, separated from local and business feeds.',
    business: 'Business, markets, economy, companies, and money headlines from dedicated business sources.',
    tech: 'Technology, startups, AI, gadgets, platforms, and science-adjacent innovation headlines.',
    ai: 'Artificial intelligence headlines, AI companies, models, tools, policy, chips, research, and product launches.',
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
  const categoryLabel = copy.categories?.[cat] || cat;
  if (cat === 'live') return `${total} live news streams for ${place}`;
  if (cat === 'video') return `${total} news videos for ${place}`;
  return `${total} ${categoryLabel.toLowerCase()} articles for ${place}`;
}

function localizedSectionTitle(category, copy, label) {
  if (category === 'top') return copy.latestStories;
  if (category === 'live' || category === 'video') return label;
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

function buildRelatedArticles(article, articles, limit = 4) {
  const seen = new Set([article?.id]);
  const candidates = [];
  const addMatches = (items) => {
    items.forEach((item) => {
      if (!item?.id || seen.has(item.id)) return;
      seen.add(item.id);
      candidates.push(item);
    });
  };

  addMatches(articles.filter((item) => item.category === article.category || item.source === article.source));
  addMatches(articles.filter((item) => item.image || videoThumbnail(item)));
  addMatches(articles);

  return candidates.slice(0, limit);
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
      q: 'Why is Nuzenio English-only?',
      a: 'Nuzenio is English-only for launch so the reading flow, SEO, ads review, and source quality stay consistent.',
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
  script.textContent = JSON.stringify(article
    ? articleJsonLd(article, url, { context, description, image, title })
    : pageJsonLd(url, { context, description, image, title }));
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
  trackPageView(canonicalUrl, title);
}

function trackPageView(url, title) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_location: url,
    page_title: title,
    send_to: 'G-7TQQHY9XDV',
  });
}

function trackEvent(name, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', name, {
    send_to: 'G-7TQQHY9XDV',
    ...params,
  });
}

function updateGoogleConsent(consent) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const granted = consent === 'granted';
  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: granted ? 'granted' : 'denied',
    ad_user_data: granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
  });
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

  const defaultUrl = context.isRootHome ? new URL('/', window.location.href) : homeContextUrl(context);
  const link = document.createElement('link');
  link.rel = 'alternate';
  link.hreflang = 'x-default';
  link.href = productionUrl(defaultUrl);
  link.dataset.nuzenioAlternate = 'true';
  document.head.appendChild(link);
}

function pageSeoTitle({ category, isRootHome, location, language, searchTerm }) {
  if (searchTerm) return `Search results for "${searchTerm}" | Nuzenio`;
  if (isRootHome) return 'Nuzenio - Global News, Local News, Live News & Video News';
  const copy = uiCopy(language.code);
  const sectionTitle = sectionContent(category, copy, location).title;
  const place = pageSeoPlace(category, location);
  return `${sectionTitle} for ${place} | Nuzenio`;
}

function pageSeoDescription({ category, isRootHome, location, language, articles = [], searchTerm }) {
  if (searchTerm) {
    const place = pageSeoPlace(category, location);
    const count = articles.length ? `${articles.length} live results` : 'Live news results';
    return `${count} for "${searchTerm}" on Nuzenio, focused on ${place}, with English RSS headlines, source attribution, and AI-powered news context.`;
  }
  if (isRootHome) {
    return 'Nuzenio is a professional English news platform for local news, world headlines, live news channels, video news, source attribution, and AI-powered context.';
  }
  const copy = uiCopy(language.code);
  const sectionTitle = sectionContent(category, copy, location).title;
  const place = pageSeoPlace(category, location);
  const nativeLanguage = language.native || language.name || language.code;
  const isMediaPage = category === 'video' || category === 'live';
  const action = isMediaPage ? 'Watch' : 'Read';
  return `${action} ${sectionTitle} for ${place} on Nuzenio with live RSS news, AI summaries, source attribution, video news, and live news in ${nativeLanguage}.`;
}

function pageJsonLd(url, { context, description, image, title }) {
  const sectionTitle = context.searchTerm
    ? `Search results for ${context.searchTerm}`
    : (context.isRootHome
      ? 'Global News Home'
      : sectionContent(context.category, uiCopy(context.language.code), context.location).title);
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
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: 'Nuzenio',
        alternateName: 'Nuzenio News',
        url: productionOrigin,
        publisher: { '@id': organizationId },
        inLanguage: context.language.code,
        availableLanguage: ['en'],
        hasPart: siteNavigationSchema(),
        potentialAction: {
          '@type': 'SearchAction',
          target: `${productionOrigin}/top-news?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
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
        mainEntity: itemListSchema(context.articles || [], context),
      },
      itemListSchema(context.articles || [], context),
      breadcrumbSchema(context, url, title),
    ],
  };
}

function articleJsonLd(article, url, { context, description, image, title }) {
  const organizationId = `${productionOrigin}/#organization`;
  const websiteId = `${productionOrigin}/#website`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        ...organizationSchema(),
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
        '@type': 'NewsArticle',
        '@id': `${url}#article`,
        headline: displayTitle(article),
        description,
        datePublished: article.pubDate || undefined,
        dateModified: article.pubDate || undefined,
        image,
        url,
        mainEntityOfPage: url,
        isPartOf: { '@id': websiteId },
        publisher: { '@id': organizationId },
        author: {
          '@type': 'Organization',
          name: article.source || 'RSS publisher',
        },
        articleSection: article.category || context.category || 'top',
        inLanguage: context.language.code,
        isBasedOn: article.link,
        citation: article.source,
      },
      breadcrumbSchema(context, url, title, article),
    ],
  };
}

function siteNavigationSchema() {
  return [
    ['Top News', '/top-news'],
    ['Local News', '/local'],
    ['World News', '/world'],
    ['Business News', '/business'],
    ['Technology News', '/technology'],
    ['AI News', '/ai'],
    ['Sports News', '/sports'],
    ['Entertainment News', '/entertainment'],
    ['Health News', '/health'],
    ['Science News', '/science'],
    ['Live News', '/live'],
    ['Video News', '/video'],
  ].map(([name, path]) => ({
    '@type': 'SiteNavigationElement',
    name,
    url: `${productionOrigin}${path}`,
  }));
}

function itemListSchema(articles, context) {
  const items = uniqueArticles(articles || []).slice(0, 12).map((article, index) => {
    const itemUrl = productionUrl(new URL(articleHref(article), window.location.origin));
    return {
      '@type': 'ListItem',
      position: index + 1,
      url: itemUrl,
      item: {
        '@type': isVideoArticle(article) ? 'VideoObject' : 'NewsArticle',
        '@id': `${itemUrl}#article`,
        headline: displayTitle(article),
        name: displayTitle(article),
        description: displaySummary(article),
        datePublished: article.pubDate || undefined,
        image: seoImage(article),
        publisher: {
          '@type': 'Organization',
          name: article.source || 'RSS publisher',
        },
      },
    };
  });

  return {
    '@type': 'ItemList',
    '@id': `${productionUrl(homeContextUrl(context))}#live-headlines`,
    name: context.searchTerm
      ? `Search results for ${context.searchTerm}`
      : `${sectionContent(context.category, uiCopy(context.language.code), context.location).title} live headlines`,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: items.length,
    itemListElement: items,
  };
}

function breadcrumbSchema(context, url, title, article = null) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Nuzenio',
      item: productionOrigin,
    },
  ];

  if (!context.isRootHome) {
    const sectionUrl = productionUrl(homeContextUrl(context));
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: sectionContent(context.category, uiCopy(context.language.code), context.location).title,
      item: article ? sectionUrl : url,
    });
  }

  if (article) {
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: displayTitle(article),
      item: url,
    });
  }

  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    name: title,
    itemListElement: items,
  };
}

function organizationSchema() {
  return {
    '@type': 'NewsMediaOrganization',
    name: 'Nuzenio',
    alternateName: ['Nuzenio News', 'Nuzenio.com'],
    url: productionOrigin,
    logo: {
      '@type': 'ImageObject',
      url: `${productionOrigin}/icon.svg`,
      width: 512,
      height: 512,
    },
    image: `${productionOrigin}/og-image.svg`,
    description: 'Nuzenio is a professional English news platform for local news, world headlines, live news, video news, source attribution, and AI-powered context.',
    slogan: 'Trusted news, simplified.',
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
  if (article?.imageKind === 'logo') return `${productionOrigin}/og-image.svg`;
  const image = article?.image || videoThumbnail(article);
  if (image && /^https:\/\//i.test(image)) return image;
  return `${productionOrigin}/og-image.svg`;
}

async function shareArticle(article) {
  const shareUrl = shareArticleUrl(article).toString();
  const shareText = `${article.source || 'Nuzenio'} · ${formatFreshAge(article.pubDate)}\n${displaySummary(article)}`;
  trackEvent('share_article', articleEventParams(article));
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

function articleEventParams(article) {
  return {
    item_id: article.id,
    title: article.title || '',
    source: article.source || '',
    category: article.category || '',
    country: article.country || '',
  };
}

function shareArticleUrl(article) {
  const url = new URL(window.location.href);
  url.pathname = `/article/${encodeURIComponent(article.id)}`;
  url.searchParams.delete('article');
  url.hash = '';
  if (!url.searchParams.get('country')) url.searchParams.set('country', article.country || 'IN');
  url.searchParams.delete('language');
  url.searchParams.set('category', article.category || 'top');
  return url;
}

function articleHref(article) {
  const url = new URL(`/article/${encodeURIComponent(article.id)}`, window.location.origin);
  url.searchParams.set('country', article.country || 'IN');
  url.searchParams.set('category', article.category || 'top');
  return `${url.pathname}${url.search}`;
}

function openArticleFromLink(event, article, openArticle) {
  event.preventDefault();
  openArticle(article);
}

createRoot(document.getElementById('root')).render(<App />);
