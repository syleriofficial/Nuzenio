import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
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
  Megaphone,
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
import { AdSlot } from './components/AdSlot.jsx';
import { useDocumentLanguage } from './hooks/useDocumentLanguage.js';
import { fetchNewsJson } from './services/newsApi.js';
import { productionOrigin } from './constants/site.js';
import { parseConfiguredAffiliateLinks } from './utils/affiliate.js';
import { formatDate, formatFreshAge, formatLastUpdated } from './utils/format.js';
import { readLocal, writeLocal } from './utils/storage.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredAffiliateLinks = parseConfiguredAffiliateLinks(import.meta.env.VITE_AFFILIATE_LINKS);
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const AdminDashboard = lazy(() => import('./components/AdminDashboard.jsx'));
const defaultAiSettings = {
  enabled: true,
  categories: ['top', 'world', 'business', 'tech', 'ai', 'sports', 'health', 'science', 'entertainment', 'local'],
  simpleBriefEnabled: true,
  comparisonEnabled: true,
};

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

const intelligenceCountries = [
  { slug: 'us', code: 'US', label: 'United States' },
  { slug: 'uk', code: 'GB', label: 'United Kingdom' },
  { slug: 'in', code: 'IN', label: 'India' },
  { slug: 'ca', code: 'CA', label: 'Canada' },
  { slug: 'au', code: 'AU', label: 'Australia' },
  { slug: 'de', code: 'DE', label: 'Germany' },
  { slug: 'fr', code: 'FR', label: 'France' },
  { slug: 'jp', code: 'JP', label: 'Japan' },
  { slug: 'kr', code: 'KR', label: 'South Korea' },
  { slug: 'br', code: 'BR', label: 'Brazil' },
];

const topicIntelligence = [
  { slug: 'ai', label: 'AI', category: 'ai', query: 'artificial intelligence AI chips models startups policy' },
  { slug: 'economy', label: 'Economy', category: 'business', query: 'economy inflation jobs GDP central bank' },
  { slug: 'markets', label: 'Markets', category: 'business', query: 'markets stocks bonds commodities currency' },
  { slug: 'climate', label: 'Climate', category: 'science', query: 'climate change weather emissions energy transition' },
  { slug: 'energy', label: 'Energy', category: 'business', query: 'energy oil gas solar power electricity' },
  { slug: 'space', label: 'Space', category: 'science', query: 'space NASA rocket satellite moon mars' },
  { slug: 'science', label: 'Science', category: 'science', query: 'science research discovery study space climate' },
  { slug: 'startups', label: 'Startups', category: 'business', query: 'startups venture capital funding technology founders' },
];

const seoLandingPages = [
  { slug: 'latest-news', label: 'Latest News', category: 'top', query: '', intent: 'Fresh live headlines and top stories from verified publishers.' },
  { slug: 'breaking-news', label: 'Breaking News', category: 'top', query: 'breaking news live developing updates', intent: 'Fast-moving breaking news clusters and live developing stories.' },
  { slug: 'world-news', label: 'World News', category: 'world', query: '', intent: 'International headlines, diplomacy, conflicts, policy, and global affairs.' },
  { slug: 'technology-news', label: 'Technology News', category: 'tech', query: '', intent: 'Technology, AI, gadgets, startups, platforms, chips, and product news.' },
  { slug: 'business-news', label: 'Business News', category: 'business', query: '', intent: 'Business, economy, markets, companies, jobs, money, and policy news.' },
  { slug: 'sports-news', label: 'Sports News', category: 'sports', query: '', intent: 'Sports headlines, match updates, leagues, teams, and athlete news.' },
  { slug: 'ai-news', label: 'AI News', category: 'ai', query: '', intent: 'Artificial intelligence companies, models, chips, research, tools, and policy.' },
  { slug: 'science-news', label: 'Science News', category: 'science', query: '', intent: 'Science, space, discoveries, research, climate, and innovation updates.' },
  { slug: 'health-news', label: 'Health News', category: 'health', query: '', intent: 'Health, medicine, public health, wellness, research, and hospital updates.' },
];

const evergreenHubs = [
  { slug: 'ai', aliases: ['ai-hub'], label: 'AI Hub', category: 'ai', query: 'artificial intelligence AI OpenAI Google Anthropic Nvidia chips models policy startups', intent: 'Evergreen AI intelligence hub for models, chips, tools, policy, companies, and research.' },
  { slug: 'space', aliases: ['space-hub'], label: 'Space Hub', category: 'science', query: 'space NASA rocket satellite moon mars astronomy launch mission', intent: 'Evergreen space intelligence hub for launches, satellites, missions, NASA, moon, Mars, and astronomy.' },
  { slug: 'climate', aliases: ['climate-hub'], label: 'Climate Hub', category: 'science', query: 'climate change weather emissions energy transition heat floods policy', intent: 'Evergreen climate intelligence hub for climate science, policy, weather, emissions, and energy transition.' },
  { slug: 'economy', aliases: ['economy-hub'], label: 'Economy Hub', category: 'business', query: 'economy inflation jobs GDP central bank interest rates trade recession growth', intent: 'Evergreen economy intelligence hub for inflation, jobs, GDP, central banks, trade, and growth.' },
  { slug: 'startup', aliases: ['startup-hub', 'startups-hub'], label: 'Startup Hub', category: 'business', query: 'startups startup venture capital funding founders IPO technology companies', intent: 'Evergreen startup intelligence hub for funding, founders, venture capital, IPOs, and startup markets.' },
];

const publisherDirectory = [
  {
    slug: 'reuters',
    name: 'Reuters',
    country: 'GLOBAL',
    homepage: 'https://www.reuters.com/',
    logo: 'https://www.google.com/s2/favicons?domain=reuters.com&sz=256',
    categories: ['World', 'Business', 'Markets'],
    credibility: ['Verified publisher', 'Global wire service', 'Multi-region coverage'],
    profile: 'Reuters is tracked on Nuzenio as a global publisher source for breaking, business, markets, and international news signals.',
  },
  {
    slug: 'associated-press',
    name: 'Associated Press',
    country: 'US',
    homepage: 'https://apnews.com/',
    logo: 'https://www.google.com/s2/favicons?domain=apnews.com&sz=256',
    categories: ['World', 'Politics', 'Sports'],
    credibility: ['Verified publisher', 'Wire service', 'Original reporting'],
    profile: 'Associated Press coverage is used for source comparison, fast reporting signals, and broad public-interest news discovery.',
  },
  {
    slug: 'bbc-news',
    name: 'BBC News',
    country: 'GB',
    homepage: 'https://www.bbc.com/news',
    logo: 'https://www.google.com/s2/favicons?domain=bbc.com&sz=256',
    categories: ['World', 'UK', 'Science'],
    credibility: ['Verified publisher', 'Public service broadcaster', 'International desk'],
    profile: 'BBC News is tracked for international, public-service, science, business, and culture coverage across regions.',
  },
  {
    slug: 'the-guardian',
    name: 'The Guardian',
    country: 'GB',
    homepage: 'https://www.theguardian.com/',
    logo: 'https://www.google.com/s2/favicons?domain=theguardian.com&sz=256',
    categories: ['World', 'Climate', 'Culture'],
    credibility: ['Verified publisher', 'Editorial transparency', 'Global coverage'],
    profile: 'The Guardian is tracked for global reporting, climate, culture, politics, and long-running developing stories.',
  },
  {
    slug: 'al-jazeera',
    name: 'Al Jazeera',
    country: 'GLOBAL',
    homepage: 'https://www.aljazeera.com/',
    logo: 'https://www.google.com/s2/favicons?domain=aljazeera.com&sz=256',
    categories: ['World', 'Middle East', 'Live'],
    credibility: ['Verified publisher', 'International coverage', 'Developing stories'],
    profile: 'Al Jazeera is tracked for international coverage, live updates, and developing stories across major regions.',
  },
  {
    slug: 'the-hindu',
    name: 'The Hindu',
    country: 'IN',
    homepage: 'https://www.thehindu.com/',
    logo: 'https://www.google.com/s2/favicons?domain=thehindu.com&sz=256',
    categories: ['India', 'Business', 'Science'],
    credibility: ['Verified publisher', 'India source', 'Editorial archive'],
    profile: 'The Hindu is tracked for India-focused public-interest reporting, policy, business, science, and regional coverage.',
  },
  {
    slug: 'ndtv',
    name: 'NDTV',
    country: 'IN',
    homepage: 'https://www.ndtv.com/',
    logo: 'https://www.google.com/s2/favicons?domain=ndtv.com&sz=256',
    categories: ['India', 'Live', 'Video'],
    credibility: ['Verified publisher', 'India source', 'Video coverage'],
    profile: 'NDTV is tracked for India headlines, live news, video signals, local interest, and national developing stories.',
  },
  {
    slug: 'nikkei-asia',
    name: 'Nikkei Asia',
    country: 'JP',
    homepage: 'https://asia.nikkei.com/',
    logo: 'https://www.google.com/s2/favicons?domain=asia.nikkei.com&sz=256',
    categories: ['Asia', 'Business', 'Technology'],
    credibility: ['Verified publisher', 'Asia business focus', 'Markets coverage'],
    profile: 'Nikkei Asia is tracked for Asia business, markets, geopolitics, technology, and company intelligence.',
  },
  {
    slug: 'cbc-news',
    name: 'CBC News',
    country: 'CA',
    homepage: 'https://www.cbc.ca/news',
    logo: 'https://www.google.com/s2/favicons?domain=cbc.ca&sz=256',
    categories: ['Canada', 'World', 'Local'],
    credibility: ['Verified publisher', 'Public broadcaster', 'Local coverage'],
    profile: 'CBC News is tracked for Canadian public-interest reporting, local coverage, national affairs, and world headlines.',
  },
  {
    slug: 'abc-news-au',
    name: 'ABC News Australia',
    country: 'AU',
    homepage: 'https://www.abc.net.au/news',
    logo: 'https://www.google.com/s2/favicons?domain=abc.net.au&sz=256',
    categories: ['Australia', 'World', 'Science'],
    credibility: ['Verified publisher', 'Public broadcaster', 'Regional coverage'],
    profile: 'ABC News Australia is tracked for Australian public-interest reporting, regional coverage, science, and world news.',
  },
];

const authorDirectory = [
  {
    slug: 'nuzenio-news-desk',
    name: 'Nuzenio News Desk',
    role: 'Editorial desk',
    publisher: 'Nuzenio',
    expertise: ['Live RSS curation', 'Source attribution', 'Breaking news routing'],
    bio: 'The Nuzenio News Desk maintains publisher attribution, story routing, live feed quality, corrections, and reader-first news presentation.',
  },
  {
    slug: 'nuzenio-analysis-team',
    name: 'Nuzenio Analysis Team',
    role: 'Analysis desk',
    publisher: 'Nuzenio',
    expertise: ['Explainers', 'Context', 'Timeline analysis'],
    bio: 'The Nuzenio Analysis Team prepares original analysis and explainers when editorial approval and source evidence are available.',
  },
  {
    slug: 'nuzenio-fact-check-desk',
    name: 'Nuzenio Fact-Check Desk',
    role: 'Fact-check desk',
    publisher: 'Nuzenio',
    expertise: ['Claims', 'Corrections', 'Verification status'],
    bio: 'The Nuzenio Fact-Check Desk owns correction review, claim context, source comparison, and fact-check labeling workflows.',
  },
  {
    slug: 'nuzenio-research-desk',
    name: 'Nuzenio Research Desk',
    role: 'Research desk',
    publisher: 'Nuzenio',
    expertise: ['Research reports', 'Topic hubs', 'Source intelligence'],
    bio: 'The Nuzenio Research Desk supports premium reports, research hubs, source intelligence, and partner publisher programs.',
  },
];

const entitySeeds = [
  'OpenAI',
  'Google',
  'Microsoft',
  'Nvidia',
  'Apple',
  'Tesla',
  'Amazon',
  'Meta',
  'United Nations',
  'World Health Organization',
  'Federal Reserve',
  'European Union',
  'NASA',
  'India',
  'United States',
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

function isAdminPath() {
  return normalizedPathname() === '/admin';
}

function readIntelligenceRoute(path = normalizedPathname()) {
  const cleanPath = path.replace(/^\//, '');
  const landing = seoLandingPages.find((item) => item.slug === cleanPath);
  if (landing) {
    return { type: 'landing', ...landing };
  }
  const hubAlias = evergreenHubs.find((item) => item.aliases?.includes(cleanPath));
  if (hubAlias) {
    return { type: 'hub', ...hubAlias };
  }
  const hubMatch = path.match(/^\/hub\/([^/]+)$/);
  if (hubMatch) {
    const hub = evergreenHubs.find((item) => item.slug === hubMatch[1].toLowerCase());
    return hub ? { type: 'hub', ...hub } : null;
  }
  const countryMatch = path.match(/^\/country\/([^/]+)$/);
  if (countryMatch) {
    const country = intelligenceCountries.find((item) => item.slug === countryMatch[1].toLowerCase());
    return country ? { type: 'country', slug: country.slug, country: country.code, label: country.label } : null;
  }
  const topicMatch = path.match(/^\/topic\/([^/]+)$/);
  if (topicMatch) {
    const topic = topicIntelligence.find((item) => item.slug === topicMatch[1].toLowerCase());
    return topic ? { type: 'topic', ...topic } : null;
  }
  const entityMatch = path.match(/^\/entity\/([^/]+)$/);
  if (entityMatch) {
    const slug = entityMatch[1].toLowerCase();
    return { type: 'entity', slug, label: titleFromSlug(slug), query: titleFromSlug(slug) };
  }
  const publisherMatch = path.match(/^\/publisher\/([^/]+)$/);
  if (publisherMatch) {
    const publisher = publisherDirectory.find((item) => item.slug === publisherMatch[1].toLowerCase());
    return publisher ? { type: 'publisher', label: publisher.name, query: publisher.name, ...publisher } : null;
  }
  const authorMatch = path.match(/^\/author\/([^/]+)$/);
  if (authorMatch) {
    const author = authorDirectory.find((item) => item.slug === authorMatch[1].toLowerCase());
    return author ? { type: 'author', label: author.name, query: author.name, ...author } : null;
  }
  return null;
}

function titleFromSlug(slug = '') {
  return slug.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || 'Entity';
}

function readArticleIdFromUrl() {
  const [, articleId] = window.location.pathname.match(/^\/article\/([^/]+)\/?$/) || [];
  return articleId ? decodeURIComponent(articleId) : readUrlParam('article');
}

function slugifyTitle(value = '') {
  const slug = String(value || '')
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

function articleSlug(article) {
  return article?.slug || slugifyTitle(article?.title || article?.id || 'news-story');
}

function initialCategory() {
  const path = normalizedPathname();
  const intelligenceRoute = readIntelligenceRoute(path);
  if (['topic', 'hub', 'landing'].includes(intelligenceRoute?.type)) return intelligenceRoute.category || 'top';
  if (intelligenceRoute?.type === 'entity') return 'top';
  if (['publisher', 'author'].includes(intelligenceRoute?.type)) return 'top';
  if (intelligenceRoute?.type === 'country') return 'top';
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
  const intelligenceRoute = readIntelligenceRoute();
  if (intelligenceRoute?.type === 'country') {
    return {
      country: intelligenceRoute.country,
      region: '',
      city: '',
      label: intelligenceRoute.label,
      source: 'link',
    };
  }
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
  const url = new URL('/', window.location.origin);
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
  url.pathname = `/article/${encodeURIComponent(articleSlug(article))}`;
  url.searchParams.set('category', article.category || context.category || 'top');
  url.searchParams.delete('article');
  return url;
}

function App() {
  const [screen, setScreen] = useState(() => (isAdminPath() ? 'admin' : 'home'));
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
  const [isRootHome, setIsRootHome] = useState(() => !isAdminPath() && isRootHomePath());
  const [intelligenceRoute, setIntelligenceRoute] = useState(() => readIntelligenceRoute());
  const [analyticsConsent, setAnalyticsConsent] = useState(() => readLocal('nuzenio_analytics_consent', ''));
  const [homeSectionFeeds, setHomeSectionFeeds] = useState({});
  const [affiliateLinks, setAffiliateLinks] = useState(configuredAffiliateLinks);
  const [adSlots, setAdSlots] = useState(null);
  const [sponsoredBlocks, setSponsoredBlocks] = useState([]);
  const [aiSettings, setAiSettings] = useState(defaultAiSettings);
  const newsRequestId = useRef(0);
  const homeSectionsRequestId = useRef(0);

  useDocumentLanguage(language);

  useEffect(() => {
    updateGoogleConsent(analyticsConsent);
  }, [analyticsConsent]);

  useEffect(() => {
    loadMonetization();
    loadAiSettings();
  }, []);

  useEffect(() => {
    if (!['manual', 'link'].includes(location.source)) {
      detectAccurateLocation(updateLocation);
    }
  }, []);

  useEffect(() => {
    if (intelligenceRoute) {
      loadIntelligenceRoute(intelligenceRoute);
      return;
    }
    const urlQuery = (readUrlParam('q') || '').trim();
    if (urlQuery) {
      setQuery(urlQuery);
      searchNewsByTerm(urlQuery, { updateUrl: false });
      return;
    }
    loadNews(category, location.country, location.region, location.city, 'en');
  }, [category, location.country, location.region, location.city, intelligenceRoute?.type, intelligenceRoute?.slug]);

  useEffect(() => {
    if (!isRootHome) {
      setHomeSectionFeeds({});
      return;
    }
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1200));
    const cancel = window.cancelIdleCallback || window.clearTimeout;
    const handle = schedule(() => loadHomeSectionFeeds(location.country));
    return () => cancel(handle);
  }, [isRootHome, location.country]);

  useEffect(() => {
    if (intelligenceRoute) {
      setIsLocalPage(false);
      return;
    }
    if (isRootHome && category === 'top') {
      setIsLocalPage(false);
      return;
    }
    const url = contextUrl({ category, location });
    window.history.replaceState({}, '', url);
    setIsLocalPage(category === 'local' && url.pathname === categoryRoutes.local);
  }, [category, isRootHome, location.country, location.region, location.city, intelligenceRoute?.type, intelligenceRoute?.slug]);

  useEffect(() => {
    function syncArticleFromUrl() {
      if (isAdminPath()) {
        setScreen('admin');
        setSelected(null);
        setIsRootHome(false);
        setIntelligenceRoute(null);
        return;
      }
      setScreen('home');
      const nextIntelligenceRoute = readIntelligenceRoute();
      setIntelligenceRoute(nextIntelligenceRoute);
      setIsRootHome(isRootHomePath());
      setIsLocalPage(window.location.pathname === categoryRoutes.local);
      setCategory(initialCategory());
      const articleKey = readArticleIdFromUrl();
      if (!articleKey) {
        setSelected(null);
        return;
      }
      const linkedArticle = articles.find((article) => article.id === articleKey || articleSlug(article) === articleKey);
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
    updatePageSeo(selected, { category, intelligenceRoute, isRootHome, location, language, articles, searchTerm: (readUrlParam('q') || query).trim() });
  }, [selected, articles, category, intelligenceRoute?.type, intelligenceRoute?.slug, isRootHome, query, location.country, location.region, location.city]);

  useEffect(() => {
    if (screen !== 'admin') return;
    document.title = 'Admin | Nuzenio';
    setMeta('meta[name="robots"]', 'content', 'noindex, nofollow');
  }, [screen]);

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
    { forceFresh = false } = {},
  ) {
    const requestId = newsRequestId.current + 1;
    newsRequestId.current = requestId;
    setIsLoadingNews(true);
    setStatus('Loading live RSS news...');
    setArticles([]);
    try {
      const data = await fetchNewsJson({
        category: cat,
        country,
        region,
        city,
        language: newsLanguage,
        forceFresh,
      });
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
    setIsRootHome(false);
    setIsLoadingNews(true);
    setStatus('Searching live RSS news...');
    setArticles([]);
    if (updateUrl) writeSearchUrl(searchTerm);
    try {
      const data = await fetchNewsJson({
        q: searchTerm,
        country: location.country,
        language: 'en',
      });
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

  async function loadHomeSectionFeeds(country = location.country, { forceFresh = false } = {}) {
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
        const data = await fetchNewsJson({
          category: cat,
          country,
          language: 'en',
          forceFresh,
        });
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

  async function loadIntelligenceRoute(route) {
    if (!route) return;
    setIsRootHome(false);
    setIsLocalPage(false);
    setQuery('');
    if (route.type === 'country') {
      const nextLocation = {
        country: route.country,
        region: '',
        city: '',
        label: route.label,
        source: 'link',
      };
      if (location.country !== nextLocation.country || location.region || location.city) setLocation(nextLocation);
      if (category !== 'top') setCategory('top');
      await loadNews('top', route.country, '', '', 'en');
      loadHomeSectionFeeds(route.country);
      return;
    }
    const topicCategory = route.category || 'top';
    if (category !== topicCategory) setCategory(topicCategory);
    if (route.type === 'landing' && !route.query) {
      await loadNews(topicCategory, location.country, '', '', 'en');
      return;
    }
    if (route.type === 'author') {
      await loadNews('top', location.country, '', '', 'en');
      return;
    }
    await loadIntelligenceSearch(route.query || route.label, topicCategory);
  }

  async function loadIntelligenceSearch(searchTerm, routeCategory = 'top') {
    const requestId = newsRequestId.current + 1;
    newsRequestId.current = requestId;
    setIsLoadingNews(true);
    setStatus(`Loading intelligence for ${searchTerm}...`);
    setArticles([]);
    try {
      const data = await fetchNewsJson({
        q: searchTerm,
        country: location.country,
        language: 'en',
      });
      if (requestId !== newsRequestId.current) return;
      setArticles((data.articles || []).map((article) => ({ ...article, category: routeCategory })));
      setLastUpdated(new Date());
      setStatus(`${data.total || 0} intelligence stories for ${searchTerm}`);
    } catch (error) {
      if (requestId !== newsRequestId.current) return;
      setStatus(`Intelligence error: ${error.message}`);
    } finally {
      if (requestId === newsRequestId.current) setIsLoadingNews(false);
    }
  }

  async function loadMonetization() {
    if (!supabase) return;
    const [affiliateResult, adResult, sponsoredResult] = await Promise.all([
      supabase
        .from('affiliate_links')
        .select('id,title,category,destination_url,disclosure,network,image_url')
        .eq('enabled', true)
        .order('updated_at', { ascending: false })
        .limit(12),
      supabase
        .from('adsense_slots')
        .select('slot_key,placement,format,enabled,notes')
        .order('updated_at', { ascending: false }),
      supabase
        .from('sponsored_blocks')
        .select('id,title,sponsor_name,category,placement,destination_url,image_url,disclosure,label,start_at,end_at')
        .eq('enabled', true)
        .order('updated_at', { ascending: false })
        .limit(8),
    ]);
    if (!adResult.error) setAdSlots(adResult.data || []);
    if (!sponsoredResult.error) setSponsoredBlocks(sponsoredResult.data || []);
    if (affiliateResult.error || !affiliateResult.data?.length) return;
    setAffiliateLinks(affiliateResult.data.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category || 'news',
      url: item.destination_url,
      network: item.network || 'direct',
      image: item.image_url || '',
      disclosure: item.disclosure || 'Nuzenio may earn a commission from this link.',
    })));
  }

  async function loadAiSettings() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('ai_settings')
      .select('enabled,categories,simple_brief_enabled,comparison_enabled')
      .eq('key', 'global')
      .maybeSingle();
    if (error || !data) return;
    setAiSettings({
      enabled: data.enabled !== false,
      categories: Array.isArray(data.categories) && data.categories.length ? data.categories : defaultAiSettings.categories,
      simpleBriefEnabled: data.simple_brief_enabled !== false,
      comparisonEnabled: data.comparison_enabled !== false,
    });
  }

  function refreshCurrentNews() {
    if (intelligenceRoute) {
      loadIntelligenceRoute(intelligenceRoute);
      return;
    }
    trackEvent('refresh_news', {
      category,
      country: location.country,
    });
    const activeSearch = (readUrlParam('q') || query).trim();
    if (activeSearch) {
      searchNewsByTerm(activeSearch, { updateUrl: true });
      return;
    }
    loadNews(category, location.country, location.region, location.city, 'en', { forceFresh: true });
    if (isRootHome) loadHomeSectionFeeds(location.country, { forceFresh: true });
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
    setIntelligenceRoute(null);
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
    setIntelligenceRoute(null);
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

  function navigateAdmin() {
    setScreen('admin');
    setIntelligenceRoute(null);
    setSelected(null);
    setIsRootHome(false);
    setMobileSearchOpen(false);
    window.history.pushState({}, '', '/admin');
    trackEvent('select_content', {
      content_type: 'admin',
      item_id: 'admin',
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
    const context = { category, intelligenceRoute, isRootHome, location, language, searchTerm: (readUrlParam('q') || query).trim() };
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
  const breakingArticles = useMemo(() => articles.slice(0, 6), [articles]);
  const ticker = useMemo(
    () => breakingArticles.map((article) => article.title).join(' | '),
    [breakingArticles],
  );
  const modalArticles = uniqueArticles([...articles, ...Object.values(homeSectionFeeds).flat()]);
  const breakingLabel = ['live', 'video'].includes(category)
    ? videoSectionLabel(category, copy).toUpperCase()
    : copy.breaking;
  const currentSearchTerm = (readUrlParam('q') || query).trim();
  const semanticPageTitle = pageSeoTitle({
    category,
    intelligenceRoute,
    isRootHome,
    location,
    language,
    searchTerm: currentSearchTerm,
  }).replace(/\s\|\sNuzenio$/, '');

  if (screen === 'admin') {
    return (
      <div className="appShell" data-section="admin">
        <a className="skipLink" href="#main-content">Skip to main content</a>
        <Suspense fallback={<main id="main-content" className="adminMain"><div className="adminGate"><h1>Loading admin</h1><p>Preparing Nuzenio control center...</p></div></main>}>
          <AdminDashboard
            supabase={supabase}
            user={user}
            onBack={navigateHome}
            onLogin={loginWithGoogle}
            onLogout={logout}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="appShell" data-section={category} data-local-page={isLocalPage ? 'true' : 'false'}>
      <a className="skipLink" href="#main-content">Skip to main content</a>
      <Header
        authNotice={authNotice}
        breakingArticles={breakingArticles}
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
        openArticle={openArticle}
        navigateCategory={navigateCategory}
        navigateHome={navigateHome}
        navigateAdmin={navigateAdmin}
        setMobileSearchOpen={setMobileSearchOpen}
        setQuery={setQuery}
        user={user}
      />
      <AdSlot slots={adSlots} name="header-leaderboard" label="Header advertising inventory" />
      {!selected && <h1 className="srOnly">{semanticPageTitle}</h1>}

      {screen === 'home' && intelligenceRoute && (
        <IntelligencePage
          articles={articles}
          copy={copy}
          homeSectionFeeds={homeSectionFeeds}
          isLoading={isLoadingNews || isLoadingHomeSections}
          lastUpdated={lastUpdated}
          location={location}
          openArticle={openArticle}
          refreshNews={refreshCurrentNews}
          route={intelligenceRoute}
          savedIds={savedIds}
          status={status}
          toggleSave={toggleSave}
        />
      )}
      {screen === 'home' && !intelligenceRoute && (
        <Home
          articles={articles}
          category={category}
          copy={copy}
          feed={feed}
          homeSectionFeeds={homeSectionFeeds}
          adSlots={adSlots}
          affiliateLinks={affiliateLinks}
          sponsoredBlocks={sponsoredBlocks}
          isRootHome={isRootHome}
          isLoadingHomeSections={isLoadingHomeSections}
          language={language}
          isLoadingNews={isLoadingNews}
          lastUpdated={lastUpdated}
          lead={lead}
          location={location}
          user={user}
          setLocation={updateLocation}
          openArticle={openArticle}
          savedIds={savedIds}
          sideStories={sideStories}
          status={status}
          toggleSave={toggleSave}
          refreshNews={refreshCurrentNews}
          searchTerm={currentSearchTerm}
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
          affiliateLinks={affiliateLinks}
          adSlots={adSlots}
          aiSettings={aiSettings}
          sponsoredBlocks={sponsoredBlocks}
        />
      )}
      {!analyticsConsent && (
        <AnalyticsConsentBanner onAccept={() => chooseAnalyticsConsent('granted')} onDecline={() => chooseAnalyticsConsent('denied')} />
      )}
      <PWAInstallPrompt />
      <AdSlot slots={adSlots} name="footer-banner" label="Footer advertising inventory" />
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

function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);
  const [dismissed, setDismissed] = useState(() => readLocal('nuzenio_install_prompt_dismissed', false));

  useEffect(() => {
    function handlePrompt(event) {
      event.preventDefault();
      setInstallEvent(event);
    }
    function handleInstalled() {
      setIsInstalled(true);
      setInstallEvent(null);
    }
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    setDismissed(true);
    writeLocal('nuzenio_install_prompt_dismissed', true);
  }

  function dismiss() {
    setDismissed(true);
    writeLocal('nuzenio_install_prompt_dismissed', true);
  }

  if (isInstalled || dismissed || !installEvent) return null;

  return (
    <div className="installPrompt" role="dialog" aria-label="Install Nuzenio app">
      <div>
        <b>Install Nuzenio</b>
        <span>Faster launch, offline shell, and mobile app navigation.</span>
      </div>
      <button className="primaryAction" onClick={installApp}>Install</button>
      <button onClick={dismiss} aria-label="Dismiss install prompt">Later</button>
    </div>
  );
}

function Header({
  authNotice,
  breakingArticles,
  breakingLabel,
  breakingText,
  category,
  copy,
  loginWithGoogle,
  logout,
  mobileSearchOpen,
  isRootHome,
  openArticle,
  navigateCategory,
  navigateHome,
  navigateAdmin,
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
          <div>
            <img className="brandLogo" src="/logo.svg" alt="Nuzenio" width="171" height="44" />
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
          href="/admin"
          className={screen === 'admin' ? 'active' : ''}
          onClick={(event) => {
            event.preventDefault();
            navigateAdmin();
          }}
        >
          Admin
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
      <BreakingStrip articles={breakingArticles} label={breakingLabel} onOpenArticle={openArticle} text={breakingText} />
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
  adSlots,
  articles,
  affiliateLinks,
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
  sponsoredBlocks,
  status,
  toggleSave,
  user,
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
          <AdSlot slots={adSlots} name="top-native" label="In-feed native advertising inventory" />
          <SponsoredBlock blocks={sponsoredBlocks} context={category} placement="feed" />
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
          <AffiliateRail links={affiliateLinks} context={category} />
          <SponsoredBlock blocks={sponsoredBlocks} context={category} placement="sidebar" />
          <Newsletter copy={copy} language={language} location={location} />
          <RetentionPanel location={location} user={user} />
          <AdSlot slots={adSlots} name="sidebar-rectangle" label="Sidebar advertising inventory" compact />
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

        <AdSlot slots={adSlots} name="top-native" label="In-feed native advertising inventory" />
        <SponsoredBlock blocks={sponsoredBlocks} context={category} placement="feed" />

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
          <AffiliateRail links={affiliateLinks} context={category} />
          <SponsoredBlock blocks={sponsoredBlocks} context={category} placement="sidebar" />
          <Newsletter copy={copy} language={language} location={location} />
          <RetentionPanel location={location} user={user} />
          <AdSlot slots={adSlots} name="sidebar-rectangle" label="Sidebar advertising inventory" compact />
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

function BreakingStrip({ articles = [], label, onOpenArticle, text }) {
  const safeText = text || 'Loading live news...';
  const isLong = safeText.length > 220;
  const canClickHeadlines = typeof onOpenArticle === 'function';
  const clickableArticles = canClickHeadlines ? articles.filter(Boolean) : [];
  const firstArticle = clickableArticles[0];
  const canOpenArticle = Boolean(firstArticle);
  const headlineText = clickableArticles.length
    ? clickableArticles.map((item) => displayTitle(item)).join('   •   ')
    : safeText;

  return (
    <div className={`breaking${isLong ? ' isLong' : ''}`} aria-label={`${label}: ${safeText}`}>
      <button
        className="breakingLabel"
        type="button"
        disabled={!canOpenArticle}
        onClick={() => {
          if (canOpenArticle) onOpenArticle(firstArticle);
        }}
      >
        <b>{label}</b>
      </button>
      <button
        className="breakingTickerButton"
        type="button"
        disabled={!canOpenArticle}
        aria-label={canOpenArticle ? `Open breaking story: ${displayTitle(firstArticle)}` : safeText}
        onClick={() => {
          if (canOpenArticle) onOpenArticle(firstArticle);
        }}
      >
        <div className="breakingViewport">
          <div className="breakingTrack">
            <span className="breakingGroup">
              <span className="breakingHeadlineText">{headlineText}</span>
            </span>
            <span className="breakingGroup" aria-hidden="true">
              <span className="breakingHeadlineText">{headlineText}</span>
            </span>
          </div>
        </div>
      </button>
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

function IntelligencePage({
  articles,
  copy,
  homeSectionFeeds,
  isLoading,
  lastUpdated,
  location,
  openArticle,
  refreshNews,
  route,
  savedIds,
  status,
  toggleSave,
}) {
  const isCountry = route.type === 'country';
  const isTopic = route.type === 'topic';
  const isLanding = route.type === 'landing';
  const isHub = route.type === 'hub';
  const isPublisher = route.type === 'publisher';
  const isAuthor = route.type === 'author';
  const title = isCountry
    ? `${route.label} News Intelligence`
    : isPublisher
      ? `${route.label} Publisher Profile`
      : isAuthor
        ? `${route.label} Author Profile`
        : isTopic || isHub
      ? `${route.label} Topic Intelligence`
      : isLanding
        ? route.label
      : `${route.label} Entity Intelligence`;
  const intro = isCountry
    ? `Top headlines, business, technology, sports, health, politics, and trend signals for ${route.label}.`
    : isPublisher
      ? `${route.label} source profile, credibility signals, active coverage, latest RSS stories, and attribution transparency on Nuzenio.`
      : isAuthor
        ? `${route.label} editorial profile, desk responsibilities, published-work foundation, and Nuzenio E-E-A-T transparency.`
        : isTopic || isHub
      ? `Live RSS intelligence for ${route.label}, with related entities, countries, clusters, and source comparisons.`
      : isLanding
        ? `${route.intent} Built for fast mobile reading, source transparency, Google Discover readiness, and internal discovery.`
      : `Live news intelligence for ${route.label}, including related topics, countries, organizations, and stories.`;
  const sections = buildIntelligenceSections(route, articles, homeSectionFeeds);
  const trends = detectTrendSignals(articles);
  const topics = extractTrendingTopics(articles);
  const entities = extractEntities(articles);
  const relatedCountries = relatedCountryLinks(route, articles);
  const relatedTopics = relatedTopicLinks(route, articles);

  return (
    <main id="main-content" className="main intelligenceMain" tabIndex="-1">
      <section>
        <section className="intelligenceHero">
          <div>
            <span className="badge">
              <Globe2 size={15} /> Global News Intelligence
            </span>
            <h2>{title}</h2>
            <p>{intro}</p>
            <div className="intelligenceMeta">
              <span>{articles.length} live stories</span>
              <span>{new Set(articles.map((article) => article.source).filter(Boolean)).size || 'Verified'} sources</span>
              <span>{lastUpdated ? `Updated ${formatLastUpdated(lastUpdated)}` : 'Refreshing'}</span>
            </div>
          </div>
          <div className="intelligenceScore">
            <b>{trends.breaking.length + trends.growing.length + trends.spikes.length}</b>
            <span>signals</span>
          </div>
        </section>

        <div className="intelligenceLinkBar">
          {intelligenceCountries.slice(0, 10).map((country) => (
            <a key={country.slug} className={route.type === 'country' && route.slug === country.slug ? 'active' : ''} href={`/country/${country.slug}`}>
              {country.label}
            </a>
          ))}
        </div>
        <div className="intelligenceLinkBar topicLinks">
          {topicIntelligence.map((topic) => (
            <a key={topic.slug} className={route.type === 'topic' && route.slug === topic.slug ? 'active' : ''} href={`/topic/${topic.slug}`}>
              {topic.label}
            </a>
          ))}
        </div>
        <div className="intelligenceLinkBar topicLinks">
          {publisherDirectory.slice(0, 6).map((publisher) => (
            <a key={publisher.slug} className={route.type === 'publisher' && route.slug === publisher.slug ? 'active' : ''} href={`/publisher/${publisher.slug}`}>
              {publisher.name}
            </a>
          ))}
          {authorDirectory.slice(0, 2).map((author) => (
            <a key={author.slug} className={route.type === 'author' && route.slug === author.slug ? 'active' : ''} href={`/author/${author.slug}`}>
              {author.name}
            </a>
          ))}
        </div>

        <TrendSignalPanel trends={trends} openArticle={openArticle} />
        {isPublisher && <PublisherProfilePanel publisher={route} articles={articles} />}
        {isAuthor && <AuthorProfilePanel author={route} />}
        <SourceIntelligencePanel articles={articles} route={route} />
        <DiscoverReadinessPanel articles={articles} route={route} />
        {(isPublisher || isAuthor) && <OriginalJournalismPanel />}
        {(isPublisher || isAuthor) && <EditorialTransparencyPanel route={route} articles={articles} />}

        {sections.map((section) => (
          <section className="intelligenceSection" key={section.key}>
            <div className="homeTopicHead">
              <div>
                <h3>{section.title}</h3>
                <p>{section.intro}</p>
              </div>
              {section.href && <a href={section.href}>Explore <ChevronRight size={14} /></a>}
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

        <InternalLinkGraph
          entities={entities}
          relatedCountries={relatedCountries}
          relatedTopics={relatedTopics}
          topics={topics}
        />

        {isLoading && articles.length === 0 && <LoadingCards count={6} />}
        {!isLoading && articles.length === 0 && <EmptyFeedState copy={copy} refreshNews={refreshNews} />}
      </section>

      <aside className="rightRail">
        <Trending articles={articles} copy={copy} openArticle={openArticle} />
        <AISummaryBox copy={copy} />
        <TopicRail />
        <div className="railCard">
          <h3><ShieldCheck size={18} /> Intelligence status</h3>
          <p>{status}</p>
          <button onClick={refreshNews}>Refresh intelligence</button>
        </div>
      </aside>
    </main>
  );
}

function buildIntelligenceSections(route, articles, homeSectionFeeds = {}) {
  if (route.type === 'landing') {
    const trending = detectTrendSignals(articles);
    return [
      { key: 'lead', title: `${route.label} today`, intro: route.intent || 'Live publisher-sourced headlines updated throughout the day.', articles: articles.slice(0, 6), href: route.category ? categoryRoutes[route.category] : '/top-news' },
      { key: 'breaking', title: 'Breaking and developing', intro: 'Fresh stories with live, breaking, developing, or update signals.', articles: trending.breaking.slice(0, 6) },
      { key: 'clusters', title: 'Multi-source clusters', intro: 'Stories also reported by more than one source.', articles: trending.growing.slice(0, 6) },
      { key: 'fresh', title: 'Fresh updates', intro: 'Recently published stories with strong timestamp signals.', articles: trending.spikes.slice(0, 6) },
    ].filter((section) => section.articles.length);
  }

  if (route.type === 'hub') {
    const queryTerms = route.query.split(/\s+/);
    const matched = filterByKeywords(articles, queryTerms);
    return [
      { key: 'overview', title: `${route.label} live brief`, intro: route.intent, articles: articles.slice(0, 6) },
      { key: 'companies', title: 'Companies and organizations', intro: 'Entities and organizations shaping this topic.', articles: filterByKeywords(articles, ['company', 'startup', 'organization', 'funding', 'policy', 'research']).slice(0, 6) },
      { key: 'context', title: 'Background context', intro: 'Evergreen reading around the topic, refreshed from live RSS.', articles: matched.slice(0, 6) },
      { key: 'discover', title: 'Discover-ready reads', intro: 'Large-image, source-attributed stories with clear timestamps.', articles: articles.filter((article) => article.image).slice(0, 6) },
    ].filter((section) => section.articles.length);
  }

  if (route.type === 'country') {
    return [
      { key: 'top', title: 'Top headlines', intro: 'The most important stories right now.', articles: articles.slice(0, 6), href: `/country/${route.slug}` },
      { key: 'politics', title: 'Politics', intro: 'Government, policy, elections, courts, and public affairs.', articles: filterByKeywords(articles, ['government', 'election', 'minister', 'policy', 'court', 'president', 'parliament']).slice(0, 6) },
      { key: 'business', title: 'Business', intro: 'Companies, economy, markets, and money.', articles: (homeSectionFeeds.business || filterByKeywords(articles, ['business', 'market', 'stock', 'economy', 'bank'])).slice(0, 6), href: '/business' },
      { key: 'tech', title: 'Technology', intro: 'Technology, AI, startups, chips, apps, and platforms.', articles: (homeSectionFeeds.aiTech || filterByKeywords(articles, ['technology', 'ai', 'startup', 'chip', 'software'])).slice(0, 6), href: '/technology' },
      { key: 'sports', title: 'Sports', intro: 'Sports highlights and match updates.', articles: (homeSectionFeeds.sports || filterByKeywords(articles, ['sports', 'match', 'league', 'cricket', 'football'])).slice(0, 6), href: '/sports' },
      { key: 'health', title: 'Health', intro: 'Health, medicine, hospitals, and wellness.', articles: (homeSectionFeeds.health || filterByKeywords(articles, ['health', 'medical', 'hospital', 'doctor', 'disease'])).slice(0, 6), href: '/health' },
    ].filter((section) => section.articles.length);
  }

  if (route.type === 'publisher') {
    const publisherArticles = articles.filter((article) => sourceMatchesPublisher(article.source, route.name));
    const sourceSet = publisherArticles.length ? publisherArticles : articles;
    return [
      { key: 'publisher-latest', title: `Latest from ${route.name}`, intro: 'Fresh source-attributed stories currently visible in live RSS results.', articles: sourceSet.slice(0, 8) },
      { key: 'publisher-breaking', title: 'Developing coverage', intro: 'Stories with live, breaking, developing, or update signals from this source context.', articles: detectTrendSignals(sourceSet).breaking.slice(0, 6) },
      { key: 'publisher-images', title: 'Discover-ready stories', intro: 'Stories with large-image candidates and clear timestamps for mobile readers.', articles: sourceSet.filter((article) => article.image).slice(0, 6) },
    ].filter((section) => section.articles.length);
  }

  if (route.type === 'author') {
    return [
      { key: 'author-context', title: 'Editorial desk context', intro: 'Live stories this Nuzenio desk can curate, explain, fact-check, or analyze after editorial approval.', articles: articles.slice(0, 6) },
      { key: 'author-developing', title: 'Stories needing context', intro: 'Developing stories that may need timelines, source comparison, or simple explainers.', articles: detectTrendSignals(articles).breaking.slice(0, 6) },
    ].filter((section) => section.articles.length);
  }

  const keywordArticles = filterByKeywords(articles, route.type === 'topic' ? route.query.split(/\s+/) : [route.label]);
  return [
    { key: 'top', title: 'Top intelligence', intro: 'Most relevant live stories for this page.', articles: articles.slice(0, 6) },
    { key: 'clusters', title: 'Breaking clusters', intro: 'Stories with multiple reports, source overlap, or rapid freshness.', articles: detectTrendSignals(articles).breaking.slice(0, 6) },
    { key: 'context', title: 'Background and context', intro: 'Useful related reading around this topic or entity.', articles: keywordArticles.slice(0, 6) },
  ].filter((section) => section.articles.length);
}

function filterByKeywords(articles, keywords = []) {
  const terms = keywords.map((term) => String(term).toLowerCase()).filter((term) => term.length > 2);
  if (!terms.length) return [];
  return articles.filter((article) => {
    const text = `${article.title || ''} ${article.summary || ''} ${article.source || ''}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

function detectTrendSignals(articles = []) {
  const now = Date.now();
  const recent = articles.filter((article) => {
    const time = new Date(article.pubDate).getTime();
    return Number.isFinite(time) && now - time < 6 * 60 * 60 * 1000;
  });
  return {
    growing: articles.filter((article) => (article.clusterSize || 1) > 1 || (article.alsoReportedBy || []).length).slice(0, 6),
    breaking: articles.filter((article) => /breaking|live|developing|alert|updates?/i.test(`${article.title} ${article.summary}`)).slice(0, 6),
    spikes: recent.slice(0, 6),
  };
}

function extractTrendingTopics(articles = []) {
  const stop = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'after', 'over', 'into', 'news', 'says']);
  const counts = new Map();
  articles.forEach((article) => {
    String(`${article.title || ''} ${article.summary || ''}`)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 4 && !stop.has(word))
      .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, count]) => ({ label, count }));
}

function extractEntities(articles = []) {
  const counts = new Map();
  const seedLabels = entitySeeds;
  articles.forEach((article) => {
    const text = `${article.title || ''} ${article.summary || ''} ${article.source || ''}`;
    seedLabels.forEach((label) => {
      if (text.toLowerCase().includes(label.toLowerCase())) counts.set(label, (counts.get(label) || 0) + 1);
    });
    const properNames = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) || [];
    properNames.slice(0, 8).forEach((label) => {
      if (label.length > 3 && !['The', 'This', 'That'].includes(label)) counts.set(label, (counts.get(label) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([label, count]) => ({
    label,
    count,
    href: `/entity/${slugifyTitle(label)}`,
  }));
}

function relatedCountryLinks(route, articles = []) {
  const articleCountries = new Set(articles.map((article) => article.country).filter(Boolean));
  return intelligenceCountries
    .filter((country) => route.type !== 'country' || country.slug !== route.slug)
    .filter((country) => articleCountries.size === 0 || articleCountries.has(country.code) || ['US', 'GB', 'IN'].includes(country.code))
    .slice(0, 6)
    .map((country) => ({ label: country.label, href: `/country/${country.slug}` }));
}

function relatedTopicLinks(route, articles = []) {
  const text = articles.map((article) => `${article.title} ${article.summary}`).join(' ').toLowerCase();
  return topicIntelligence
    .filter((topic) => route.type !== 'topic' || topic.slug !== route.slug)
    .filter((topic) => text.includes(topic.slug) || text.includes(topic.label.toLowerCase()) || ['ai', 'economy', 'markets', 'science'].includes(topic.slug))
    .slice(0, 8)
    .map((topic) => ({ label: topic.label, href: `/topic/${topic.slug}` }));
}

function TrendSignalPanel({ trends, openArticle }) {
  const cards = [
    { key: 'growing', title: 'Rapidly growing stories', text: 'Multiple reports or clusters are forming.', articles: trends.growing },
    { key: 'breaking', title: 'Breaking clusters', text: 'Headlines with live, breaking, or developing signals.', articles: trends.breaking },
    { key: 'spikes', title: 'Global discussion spikes', text: 'Fresh stories published in the last few hours.', articles: trends.spikes },
  ];
  return (
    <section className="trendSignalGrid">
      {cards.map((card) => (
        <div className="trendSignalCard" key={card.key}>
          <h3>{card.title}</h3>
          <p>{card.text}</p>
          {card.articles.slice(0, 3).map((article) => (
            <button key={`${card.key}-${article.id}`} onClick={() => openArticle(article)}>
              <b>{displayTitle(article)}</b>
              <span>{article.source} · {formatFreshAge(article.pubDate)}</span>
            </button>
          ))}
          {!card.articles.length && <small>No signal yet.</small>}
        </div>
      ))}
    </section>
  );
}

function DiscoverReadinessPanel({ articles = [], route }) {
  const lead = articles.find((article) => article.image) || articles[0];
  const imageReady = articles.filter((article) => article.image).length;
  const latestTime = articles.reduce((latest, article) => Math.max(latest, new Date(article.pubDate).getTime() || 0), 0);
  return (
    <section className="discoverReadinessPanel">
      <div>
        <span className="badge">
          <ShieldCheck size={15} /> Discover & E-E-A-T
        </span>
        <h3>{route.label} editorial signals</h3>
        <p>Nuzenio keeps source links, publisher names, published timestamps, update timestamps, correction routes, AI labels, and commercial separation visible on every intelligence page.</p>
      </div>
      <div className="discoverSignalGrid">
        <div>
          <b>{imageReady}</b>
          <span>large-image candidates</span>
        </div>
        <div>
          <b>{new Set(articles.map((article) => article.source).filter(Boolean)).size}</b>
          <span>publisher sources</span>
        </div>
        <div>
          <b>{latestTime ? formatFreshAge(new Date(latestTime).toISOString()) : 'Live'}</b>
          <span>latest update</span>
        </div>
      </div>
      {lead && (
        <div className="editorInfoBox">
          <b>Editorial layer</b>
          <span>Nuzenio News Desk · Source-attributed RSS intelligence</span>
          <small>Lead source: {lead.source || 'Publisher'} · Published {formatFreshAge(lead.pubDate)} · Updated {latestTime ? formatDate(new Date(latestTime).toISOString()) : 'live'}</small>
        </div>
      )}
    </section>
  );
}

function sourceMatchesPublisher(source = '', publisherName = '') {
  const cleanSource = String(source).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const cleanPublisher = String(publisherName).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return Boolean(cleanSource && cleanPublisher && (cleanSource.includes(cleanPublisher) || cleanPublisher.includes(cleanSource)));
}

function sourceStats(articles = []) {
  const stats = new Map();
  const now = Date.now();
  articles.forEach((article) => {
    const source = article.source || 'Unknown publisher';
    const current = stats.get(source) || {
      source,
      count: 0,
      newestTime: 0,
      categories: new Set(),
      imageCount: 0,
    };
    const time = new Date(article.pubDate).getTime();
    current.count += 1;
    current.newestTime = Math.max(current.newestTime, Number.isFinite(time) ? time : 0);
    if (article.category) current.categories.add(article.category);
    if (article.image) current.imageCount += 1;
    current.freshnessMinutes = current.newestTime ? Math.max(0, Math.round((now - current.newestTime) / 60000)) : null;
    stats.set(source, current);
  });
  return [...stats.values()].map((item) => ({
    ...item,
    categoryCount: item.categories.size,
    categories: [...item.categories],
  }));
}

function PublisherProfilePanel({ publisher, articles = [] }) {
  const matched = articles.filter((article) => sourceMatchesPublisher(article.source, publisher.name));
  const latest = matched[0] || articles[0];
  return (
    <section className="publisherProfilePanel">
      <div className="publisherIdentity">
        <img src={publisher.logo} alt={`${publisher.name} logo`} loading="lazy" />
        <div>
          <span className="badge"><ShieldCheck size={15} /> Publisher profile</span>
          <h3>{publisher.name}</h3>
          <p>{publisher.profile}</p>
          <a href={publisher.homepage} target="_blank" rel="noreferrer">Publisher website <ExternalLink size={14} /></a>
        </div>
      </div>
      <div className="publisherFactGrid">
        <div><span>Country</span><b>{publisher.country === 'GLOBAL' ? 'Global' : countryLabel(publisher.country)}</b></div>
        <div><span>Tracked categories</span><b>{publisher.categories.join(', ')}</b></div>
        <div><span>Current RSS matches</span><b>{matched.length || articles.length}</b></div>
        <div><span>Latest visible story</span><b>{latest ? formatFreshAge(latest.pubDate) : 'No live match yet'}</b></div>
      </div>
      <div className="credibilityList">
        {publisher.credibility.map((item) => <span key={item}>{item}</span>)}
      </div>
    </section>
  );
}

function AuthorProfilePanel({ author }) {
  return (
    <section className="authorProfilePanel">
      <div className="authorAvatar">{author.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</div>
      <div>
        <span className="badge"><Newspaper size={15} /> Journalist directory</span>
        <h3>{author.name}</h3>
        <p>{author.bio}</p>
        <div className="authorMeta">
          <span>{author.role}</span>
          <span>{author.publisher}</span>
          {author.expertise.map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
    </section>
  );
}

function SourceIntelligencePanel({ articles = [], route }) {
  const stats = sourceStats(articles);
  const mostActive = [...stats].sort((a, b) => b.count - a.count).slice(0, 5);
  const fastest = [...stats].filter((item) => item.newestTime).sort((a, b) => b.newestTime - a.newestTime).slice(0, 5);
  const coverage = [...stats].sort((a, b) => b.categoryCount - a.categoryCount || b.count - a.count).slice(0, 5);
  return (
    <section className="sourceIntelligencePanel">
      <div className="homeTopicHead">
        <div>
          <h3>Source intelligence</h3>
          <p>Most active publishers, fastest reporting sources, and coverage breadth for {route.label}.</p>
        </div>
      </div>
      <div className="sourceIntelligenceGrid">
        <SourceMetricList title="Most active publishers" items={mostActive} format={(item) => `${item.count} stories`} />
        <SourceMetricList title="Fastest reporting sources" items={fastest} format={(item) => item.freshnessMinutes === null ? 'Live' : `${item.freshnessMinutes}m ago`} />
        <SourceMetricList title="Coverage comparison" items={coverage} format={(item) => `${item.categoryCount || 1} categories`} />
      </div>
    </section>
  );
}

function SourceMetricList({ title, items = [], format }) {
  return (
    <div className="sourceMetricCard">
      <h4>{title}</h4>
      {items.map((item) => (
        <div className="sourceMetricRow" key={`${title}-${item.source}`}>
          <span>{item.source}</span>
          <b>{format(item)}</b>
        </div>
      ))}
      {!items.length && <small>No source signal yet.</small>}
    </div>
  );
}

function OriginalJournalismPanel() {
  const contentTypes = [
    ['Analysis', 'Evidence-led context and source comparison.'],
    ['Explainers', 'Simple background for complex stories.'],
    ['Fact-checks', 'Claim, source, context, and verification status.'],
    ['Opinion', 'Clearly labeled opinion with separation from news.'],
    ['Research reports', 'Premium topic research and partner reports.'],
  ];
  return (
    <section className="originalJournalismPanel">
      <div>
        <span className="badge"><Sparkles size={15} /> Original journalism foundation</span>
        <h3>Nuzenio editorial CMS is ready for approved original work</h3>
        <p>Original articles can move from draft to review, scheduled publishing, approval, revisions, and correction history without copying publisher articles.</p>
      </div>
      <div className="originalTypeGrid">
        {contentTypes.map(([title, text]) => (
          <div key={title}>
            <b>{title}</b>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EditorialTransparencyPanel({ route, articles = [] }) {
  const latest = articles[0];
  return (
    <section className="editorialTransparencyPanel">
      <div>
        <h3>E-E-A-T transparency</h3>
        <p>Nuzenio keeps original publisher attribution separate from AI context, editorial notes, corrections, and commercial placements.</p>
      </div>
      <div className="transparencyGrid">
        <div><span>Page owner</span><b>{route.type === 'author' ? route.name : 'Nuzenio News Desk'}</b></div>
        <div><span>Source attribution</span><b>{latest?.source || route.label}</b></div>
        <div><span>Update history</span><b>{latest ? formatDate(latest.pubDate) : 'Awaiting live source'}</b></div>
        <div><span>Correction route</span><b><a href="/corrections.html">Corrections policy</a></b></div>
      </div>
    </section>
  );
}

function InternalLinkGraph({ entities, relatedCountries, relatedTopics, topics }) {
  return (
    <section className="internalLinkGraph">
      <LinkCluster title="Trending topics" items={topics.map((topic) => ({ label: `${topic.label} (${topic.count})`, href: `/entity/${slugifyTitle(topic.label)}` }))} />
      <LinkCluster title="Related countries" items={relatedCountries} />
      <LinkCluster title="Related entities" items={entities} />
      <LinkCluster title="Related intelligence topics" items={relatedTopics} />
    </section>
  );
}

function LinkCluster({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <div className="linkCluster">
      <h3>{title}</h3>
      <div>
        {items.slice(0, 12).map((item) => (
          <a key={`${title}-${item.href}-${item.label}`} href={item.href}>{item.label}</a>
        ))}
      </div>
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
      <SourceQualityLabels article={article} compact />
      <a className="headline" href={articleHref(article)} onClick={(event) => openArticleFromLink(event, article, openArticle)}>
        {displayTitle(article)}
      </a>
      <p>{displaySummary(article)}</p>
      <div className="trustRow">
        <span>
          <ShieldCheck size={14} /> Source attributed
        </span>
        {article.clusterSize > 1 && (
          <span>
            <CheckCircle2 size={14} /> {article.clusterSize} sources
          </span>
        )}
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
  const initial = source.trim().charAt(0).toUpperCase() || 'N';
  return (
    <div className={`newsFallbackVisual ${size === 'large' ? 'largeFallback' : ''} ${size === 'small' ? 'smallFallback' : ''}`}>
      <span className="fallbackInitial">{initial}</span>
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
        <span className="sourceBadge">SOURCE</span>
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          onLoad={(event) => {
            if (!event.currentTarget.naturalWidth) setBroken(true);
          }}
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
      onLoad={(event) => {
        if (!event.currentTarget.naturalWidth) setBroken(true);
      }}
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
    { label: 'India Intelligence', icon: Globe2, path: '/country/in' },
    { label: 'US Intelligence', icon: Globe2, path: '/country/us' },
    { label: 'AI Intelligence', icon: Sparkles, path: '/topic/ai' },
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

function AffiliateRail({ compact = false, context = 'top', links = [] }) {
  const approvedLinks = (links || [])
    .filter((link) => link?.title && link?.url && /^https:\/\//i.test(link.url))
    .sort((a, b) => Number((b.category || '').toLowerCase() === context) - Number((a.category || '').toLowerCase() === context))
    .slice(0, compact ? 2 : 3);

  if (!approvedLinks.length) return null;

  return (
    <div className={`railCard affiliatePanel ${compact ? 'compactAffiliatePanel' : ''}`}>
      <h3>
        <BriefcaseBusiness size={18} /> Partner picks
      </h3>
      <span className="affiliateDisclosure">Sponsored / affiliate links</span>
      <div className="affiliateLinks">
        {approvedLinks.map((link) => (
          <a
            key={link.id || link.url}
            href={link.url}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            onClick={() => trackEvent('affiliate_click', {
              affiliate_category: link.category || 'news',
              affiliate_title: link.title,
              affiliate_network: link.network || 'direct',
              placement: compact ? 'article' : 'sidebar',
            })}
          >
            {link.image && <img src={link.image} alt="" loading="lazy" />}
            <span>{(link.category || 'Partner').toUpperCase()} · {link.network || 'Direct'}</span>
            <b>{link.title}</b>
            <small>{link.disclosure || 'Nuzenio may earn a commission from this link.'}</small>
            <em>
              Open partner link <ExternalLink size={13} />
            </em>
          </a>
        ))}
      </div>
    </div>
  );
}

function isSponsoredActive(block) {
  const now = Date.now();
  const startsAt = block.start_at ? new Date(block.start_at).getTime() : 0;
  const endsAt = block.end_at ? new Date(block.end_at).getTime() : Number.POSITIVE_INFINITY;
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
}

function SponsoredBlock({ blocks = [], context = 'top', placement = 'sidebar' }) {
  const block = (blocks || []).find((item) => {
    if (!item?.title || !item?.destination_url || !/^https:\/\//i.test(item.destination_url)) return false;
    const category = String(item.category || 'all').toLowerCase();
    const itemPlacement = String(item.placement || 'sidebar').toLowerCase();
    return isSponsoredActive(item)
      && (category === 'all' || category === String(context || 'top').toLowerCase())
      && itemPlacement === placement;
  });

  if (!block) return null;

  return (
    <aside className={`railCard sponsoredBlock sponsoredBlock-${placement}`} aria-label="Sponsored content">
      <div className="sponsoredLabel">
        <Megaphone size={16} /> {block.label || 'Sponsored'}
      </div>
      {block.image_url && <img src={block.image_url} alt="" loading="lazy" />}
      <h3>{block.title}</h3>
      <p>{block.disclosure || 'Sponsored content from an approved Nuzenio partner.'}</p>
      <a
        href={block.destination_url}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        onClick={() => trackEvent('sponsored_click', {
          sponsored_id: block.id,
          sponsored_title: block.title,
          sponsor_name: block.sponsor_name,
          placement,
          category: block.category || 'all',
        })}
      >
        {block.sponsor_name || 'Sponsor'} <ExternalLink size={14} />
      </a>
    </aside>
  );
}

function aiSummaryEnabled(article, settings = defaultAiSettings) {
  if (settings?.enabled === false) return false;
  const categories = Array.isArray(settings?.categories) && settings.categories.length ? settings.categories : defaultAiSettings.categories;
  return categories.includes(article?.category || 'top');
}

function splitSentences(text = '') {
  return String(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildAiDigest(article) {
  const title = displayTitle(article);
  const summary = displaySummary(article);
  const sentences = splitSentences(summary);
  const lineOne = title;
  const lineTwo = sentences[0] || `${article.source || 'A publisher'} reported this update through RSS.`;
  const lineThree = article.whyItMatters || buildWhyItMatters(article);
  return {
    threeLine: [lineOne, lineTwo, lineThree].filter(Boolean).slice(0, 3),
    keyPoints: buildKeyFacts(article),
    why: article.whyItMatters || buildWhyItMatters(article),
    timeline: buildTimeline(article),
    background: buildBackground(article),
    simple: buildSimpleBrief(article),
  };
}

function buildWhyItMatters(article) {
  const category = article?.category === 'top' || article?.category === 'local' ? 'public-interest' : article?.category || 'news';
  return `This ${category} update may affect readers because it is connected to current events, markets, policy, public safety, culture, or daily decisions.`;
}

function buildSimpleBrief(article) {
  const source = article?.source || 'the publisher';
  return {
    short: `${source} says: ${displayTitle(article)}`,
    simple: `${displaySummary(article)} Nuzenio is not adding new facts here; this is a simpler explanation of the publisher RSS brief.`,
    beginner: `In simple terms, this story is about ${displayTitle(article).toLowerCase()}. Read the original source for the complete report and latest updates.`,
  };
}

function AiExplainPanel({ article, aiSettings, copy, isVideo }) {
  const [simpleMode, setSimpleMode] = useState(false);
  const digest = buildAiDigest(article);

  return (
    <section className="summaryPanel aiExplainPanel">
      <div className="aiPanelHead">
        <div>
          <h3>
            <Sparkles size={18} /> {isVideo ? 'AI video brief' : copy.brandBrief}
          </h3>
          <span className="aiDisclosure">AI summary from RSS/source content only</span>
        </div>
        {aiSettings?.simpleBriefEnabled !== false && (
          <button type="button" onClick={() => setSimpleMode((value) => !value)}>
            {simpleMode ? 'Original AI brief' : 'Explain simply'}
          </button>
        )}
      </div>

      {simpleMode ? (
        <div className="simpleExplainBox">
          <b>10-second brief</b>
          <p>{digest.simple.short}</p>
          <b>Simple English</b>
          <p>{digest.simple.simple}</p>
          <b>Beginner-friendly</b>
          <p>{digest.simple.beginner}</p>
        </div>
      ) : (
        <>
          <ol className="threeLineSummary">
            {digest.threeLine.map((line) => <li key={line}>{line}</li>)}
          </ol>
          <div className="aiDigestGrid">
            <div>
              <h4>Key points</h4>
              <ul>
                {digest.keyPoints.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </div>
            <div>
              <h4>Why it matters</h4>
              <p>{digest.why}</p>
            </div>
            <div>
              <h4>Timeline</h4>
              {digest.timeline.map((item) => (
                <p key={item.label}><b>{item.label}:</b> {item.text}</p>
              ))}
            </div>
            <div>
              <h4>Background</h4>
              <p>{digest.background}</p>
            </div>
          </div>
        </>
      )}
      <small className="aiSafetyNote">Safety: Nuzenio does not invent facts here. It summarizes only the RSS brief, source metadata, timestamps, and original publisher links.</small>
    </section>
  );
}

function SourceComparisonPanel({ article }) {
  const reports = Array.isArray(article.alsoReportedBy) ? article.alsoReportedBy.filter((item) => item?.source) : [];
  if (!reports.length) {
    return (
      <section className="sourceComparisonPanel">
        <h3>Source comparison</h3>
        <p>Only one source is currently available in this Nuzenio cluster. Comparison will appear when multiple publishers report the same story.</p>
      </section>
    );
  }
  return (
    <section className="sourceComparisonPanel">
      <h3>How sources report this story</h3>
      <p>Nuzenio keeps this neutral: it compares source presence and timing, not political intent or opinion.</p>
      <div>
        <article>
          <b>{article.source || 'Primary source'}</b>
          <span>Primary RSS card · {formatFreshAge(article.pubDate)}</span>
          <p>{displaySummary(article)}</p>
        </article>
        {reports.slice(0, 4).map((item) => (
          <article key={`${item.source}-${item.link}`}>
            <b>{item.source}</b>
            <span>{item.rssSourceName || 'Also reported'} · {formatFreshAge(item.publishedAt)}</span>
            <p>Also reported this topic. Open the publisher link to compare exact wording and updates.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function sourceQualityLabels(article = {}) {
  if (Array.isArray(article.sourceLabels) && article.sourceLabels.length) return article.sourceLabels;
  const labels = [];
  const sourceText = `${article.source || ''} ${article.sourceUrl || ''} ${article.link || ''}`.toLowerCase();
  const titleText = String(article.title || '').toLowerCase();
  if ((article.trustScore || 0) >= 90 || article.rssSourceName) labels.push('Verified source');
  if (/\b(gov|government|official|ministry|department|who|un|court|police)\b|\.gov\b/.test(sourceText)) labels.push('Official source');
  if (article.category === 'local') labels.push('Local source');
  if (/\b(live|breaking|developing|updates?)\b/.test(titleText)) labels.push('Developing story');
  return [...new Set(labels)].slice(0, 4);
}

function SourceQualityLabels({ article, compact = false }) {
  const labels = sourceQualityLabels(article);
  if (!labels.length) return null;
  return (
    <div className={`sourceQualityLabels ${compact ? 'compactSourceLabels' : ''}`} aria-label="Source quality labels">
      {labels.map((label) => (
        <span key={label}>
          <ShieldCheck size={compact ? 12 : 14} /> {label}
        </span>
      ))}
    </div>
  );
}

function FactCheckPanel({ article }) {
  const clusterCount = article.clusterSize || 1;
  const status = clusterCount > 1
    ? `Cross-source context available from ${clusterCount} sources`
    : 'Source attributed, not independently verified';
  return (
    <section className="factCheckPanel">
      <h3>
        <CheckCircle2 size={18} /> Fact-check status
      </h3>
      <div className="factCheckGrid">
        <div>
          <span>Claim</span>
          <p>{displayTitle(article)}</p>
        </div>
        <div>
          <span>Source</span>
          <p>{article.source || 'Publisher'} · {formatFreshAge(article.pubDate)}</p>
        </div>
        <div>
          <span>Context</span>
          <p>{displaySummary(article)}</p>
        </div>
        <div>
          <span>Verification status</span>
          <p>{status}</p>
        </div>
      </div>
    </section>
  );
}

function AlsoReportedBy({ article }) {
  const reports = Array.isArray(article.alsoReportedBy) ? article.alsoReportedBy.filter((item) => item?.source && item?.link) : [];
  if (!reports.length) return null;
  return (
    <section className="alsoReportedPanel">
      <h3>Also reported by</h3>
      <div>
        {reports.map((item) => (
          <a key={`${item.source}-${item.link}`} href={item.link} target="_blank" rel="noreferrer">
            <b>{item.source}</b>
            <span>{item.rssSourceName || 'RSS source'} · {formatFreshAge(item.publishedAt)}</span>
            <ExternalLink size={14} />
          </a>
        ))}
      </div>
    </section>
  );
}

function SourceTransparency({ article, isVideo }) {
  return (
    <section className="sourceTransparency">
      <h3>Source transparency</h3>
      <dl>
        <div>
          <dt>Original publisher</dt>
          <dd><a href={article.link} target="_blank" rel="noreferrer">{article.source || 'Publisher'} <ExternalLink size={13} /></a></dd>
        </div>
        <div>
          <dt>RSS source</dt>
          <dd>{isVideo ? sourceProviderLabel(article) : article.rssSourceName || 'Google News RSS'}</dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>{formatDate(article.pubDate)}</dd>
        </div>
        <div>
          <dt>Fetched</dt>
          <dd>{article.fetchedAt ? formatDate(article.fetchedAt) : 'Latest feed refresh'}</dd>
        </div>
      </dl>
    </section>
  );
}

function CorrectionPanel({ article }) {
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function reportCorrection(event) {
    event.preventDefault();
    if (!details.trim()) {
      setMessage('Add a short note about what looks incorrect.');
      return;
    }
    if (!supabase) {
      setMessage('Correction reporting needs Supabase. Use the Corrections page contact link for now.');
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from('correction_reports').insert({
      article_id: article.id,
      article_title: displayTitle(article),
      article_source: article.source || '',
      article_link: article.link || '',
      reporter_email: email.trim() || null,
      details: details.trim(),
      issue_type: 'incorrect',
    });
    setIsSubmitting(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setDetails('');
    setEmail('');
    setMessage('Report received. Nuzenio will review the source and add a correction notice if needed.');
    trackEvent('correction_report', articleEventParams(article));
  }

  return (
    <section className="correctionPanel">
      <h3>Corrections</h3>
      {article.correctionNotice ? (
        <p className="correctionNotice">{article.correctionNotice}</p>
      ) : (
        <p>No correction notice has been attached to this Nuzenio brief.</p>
      )}
      <form onSubmit={reportCorrection}>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Report incorrect context, wrong source, outdated information, or duplicate handling"
          rows="3"
        />
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="Email optional"
        />
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Report incorrect news'}</button>
      </form>
      {message && <small>{message}</small>}
    </section>
  );
}

function Newsletter({ copy, language, location }) {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [consent, setConsent] = useState(false);
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
    if (!consent) {
      setMessage('Confirm consent to receive Nuzenio emails.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          frequency,
          country: location.country,
          categories: ['top', 'local', 'business', 'tech', 'sports'],
          consent,
          source: 'site-sidebar',
        }),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(data.error || 'Subscription could not be saved. Please try again.');
        return;
      }
      setMessage(data.emailQueued ? 'Check your email to confirm the Nuzenio brief.' : 'Double opt-in saved. Email sending is ready when provider webhook is connected.');
      setEmail('');
      setConsent(false);
      trackEvent('newsletter_subscribe', {
        method: 'double_opt_in',
        language: language.code,
        frequency,
        country: location.country,
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
      <p>Top, local, business, tech, and sports headlines. Double opt-in, no spam.</p>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={copy.email}
        type="email"
        autoComplete="email"
        aria-label="Email address for Nuzenio daily brief"
      />
      <select value={frequency} onChange={(event) => setFrequency(event.target.value)} aria-label="Digest frequency">
        <option value="daily">Daily digest</option>
        <option value="weekly">Weekly digest</option>
      </select>
      <label className="consentCheck">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>I agree to receive Nuzenio news digest emails and can unsubscribe anytime.</span>
      </label>
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Subscribing...' : copy.subscribe}</button>
      <small className="newsletterNote">Includes unsubscribe link in every email.</small>
      {message && <small>{message}</small>}
    </form>
  );
}

function RetentionPanel({ location, user }) {
  const defaultCategories = ['top', 'local', 'business', 'tech', 'sports'];
  const [notificationPermission, setNotificationPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const [preferences, setPreferences] = useState({
    preferred_country: location.country || 'IN',
    preferred_categories: defaultCategories,
    digest_frequency: 'daily',
    email_notifications: false,
    push_notifications: false,
    marketing_consent: false,
    breaking_alerts: false,
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPreferences({
          preferred_country: data.preferred_country || location.country || 'IN',
          preferred_categories: data.preferred_categories?.length ? data.preferred_categories : defaultCategories,
          digest_frequency: data.digest_frequency || 'daily',
          email_notifications: Boolean(data.email_notifications),
          push_notifications: Boolean(data.push_notifications),
          marketing_consent: Boolean(data.marketing_consent),
          breaking_alerts: Boolean(data.metadata?.breaking_alerts),
        });
      });
  }, [user?.id]);

  function toggleCategory(category) {
    setPreferences((current) => {
      const next = current.preferred_categories.includes(category)
        ? current.preferred_categories.filter((item) => item !== category)
        : [...current.preferred_categories, category];
      return { ...current, preferred_categories: next.length ? next : [category] };
    });
  }

  async function savePreferences() {
    if (!supabase || !user) {
      setMessage('Login to save personalized Nuzenio preferences.');
      return;
    }
    const payload = {
      user_id: user.id,
      ...preferences,
      metadata: { breaking_alerts: preferences.breaking_alerts },
      preferred_country: String(preferences.preferred_country || 'IN').toUpperCase(),
    };
    const { error } = await supabase.from('user_preferences').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Preferences saved for future digest and notification features.');
    trackEvent('save_preferences', {
      country: payload.preferred_country,
      categories: payload.preferred_categories.join(','),
      digest_frequency: payload.digest_frequency,
    });
  }

  async function requestNotificationPermission() {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }
    const nextPermission = await Notification.requestPermission();
    setNotificationPermission(nextPermission);
    if (nextPermission === 'granted') {
      setPreferences((current) => ({
        ...current,
        push_notifications: true,
        breaking_alerts: true,
      }));
      trackEvent('notification_permission', { status: 'granted' });
    } else {
      trackEvent('notification_permission', { status: nextPermission });
    }
  }

  return (
    <div className="railCard retentionPanel">
      <h3>
        <ShieldCheck size={18} /> Reader preferences
      </h3>
      <p>Personalize country, topics, saved stories, reading history, and future notifications.</p>
      <input
        value={preferences.preferred_country}
        onChange={(event) => setPreferences({ ...preferences, preferred_country: event.target.value.toUpperCase() })}
        aria-label="Preferred country"
      />
      <select
        value={preferences.digest_frequency}
        onChange={(event) => setPreferences({ ...preferences, digest_frequency: event.target.value })}
        aria-label="Digest frequency"
      >
        <option value="daily">Daily digest</option>
        <option value="weekly">Weekly digest</option>
        <option value="off">No digest</option>
      </select>
      <div className="preferenceChips">
        {defaultCategories.map((category) => (
          <button
            key={category}
            type="button"
            className={preferences.preferred_categories.includes(category) ? 'active' : ''}
            onClick={() => toggleCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <label className="consentCheck">
        <input
          type="checkbox"
          checked={preferences.email_notifications}
          onChange={(event) => setPreferences({ ...preferences, email_notifications: event.target.checked, marketing_consent: event.target.checked })}
        />
        <span>Email notification ready</span>
      </label>
      <label className="consentCheck">
        <input
          type="checkbox"
          checked={preferences.push_notifications}
          onChange={(event) => setPreferences({ ...preferences, push_notifications: event.target.checked })}
        />
        <span>Future push notifications</span>
      </label>
      <label className="consentCheck">
        <input
          type="checkbox"
          checked={preferences.breaking_alerts}
          onChange={(event) => setPreferences({ ...preferences, breaking_alerts: event.target.checked })}
        />
        <span>Breaking news alerts</span>
      </label>
      <button type="button" onClick={requestNotificationPermission} disabled={notificationPermission === 'granted' || notificationPermission === 'unsupported'}>
        {notificationPermission === 'granted' ? 'Notifications allowed' : notificationPermission === 'unsupported' ? 'Notifications unsupported' : 'Enable notifications'}
      </button>
      <button onClick={savePreferences}>Save preferences</button>
      <small>{user ? 'Stored privately in your Nuzenio account.' : 'Login required to sync preferences.'}</small>
      {message && <small>{message}</small>}
    </div>
  );
}

function ArticleModal({ adSlots, affiliateLinks, aiSettings, article, articles, copy, onClose, openArticle, savedIds, sponsoredBlocks, toggleSave }) {
  const facts = buildKeyFacts(article);
  const timeline = buildTimeline(article);
  const faqs = buildFaq(article);
  const isVideo = isVideoArticle(article);
  const related = buildRelatedArticles(article, articles, 4);
  const showAi = aiSummaryEnabled(article, aiSettings);
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
        <div className="articleMasthead">
          <div>
            <span className="category">{article.category?.toUpperCase()}</span>
            <strong>{article.source || 'Publisher'}</strong>
          </div>
          <span>
            <ShieldCheck size={15} /> Publisher attributed
          </span>
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
            <ShieldCheck size={15} /> Trust score {article.trustScore || 90}
          </span>
        </div>
        <SourceQualityLabels article={article} />
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
        {showAi ? (
          <AiExplainPanel article={article} aiSettings={aiSettings} copy={copy} isVideo={isVideo} />
        ) : (
          <div className="summaryPanel">
            <h3>
              <Sparkles size={18} /> AI summary disabled
            </h3>
            <span className="aiDisclosure">Admin-controlled setting</span>
            <p>Nuzenio is showing only the publisher RSS brief and source links for this category.</p>
          </div>
        )}
        <FactCheckPanel article={article} />
        <div className="fullStoryPanel">
          <div>
            <h3>{copy.fullStoryAccess}</h3>
            <p>{copy.fullStoryText}</p>
          </div>
        </div>
        <div className="infoGrid">
          <div className="infoCard">
            <h3>{copy.whatHappened}</h3>
            <p>{article.whatHappened || displaySummary(article)}</p>
          </div>
          <div className="infoCard">
            <h3>{copy.whyItMatters}</h3>
            <p>{article.whyItMatters}</p>
          </div>
          <div className="infoCard">
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
        {showAi && aiSettings?.comparisonEnabled !== false && <SourceComparisonPanel article={article} />}
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
        <AlsoReportedBy article={article} openArticle={openArticle} />
        <div className="sourceBox">
          <h3>{copy.sourceAttribution}</h3>
          <p>
            This story is sourced from <b>{article.source}</b> via {isVideo ? sourceProviderLabel(article) : 'live RSS'}.
            Published {formatFreshAge(article.pubDate)}. Nuzenio links back to the original publisher for the full report.
          </p>
        </div>
        <SourceTransparency article={article} isVideo={isVideo} />
        <CorrectionPanel article={article} />
        <AdSlot slots={adSlots} name="article-inline" label="Article advertising inventory" />
        <SponsoredBlock blocks={sponsoredBlocks} context={article.category} placement="article" />
        <AffiliateRail links={affiliateLinks} context={article.category} compact />
        <div className="sourceBox affiliateDisclosureBox">
          <h3>Affiliate disclosure</h3>
          <p>
            Nuzenio keeps editorial RSS stories separate from commercial placements. Any paid or affiliate link must be
            labeled before publication.
          </p>
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
      <a href="/fact-checking-policy.html">Fact-Checking Policy</a>
      <a href="/ai-policy.html">AI Policy</a>
      <a href="/corrections.html">Corrections</a>
      <a href="/corrections-policy.html">Corrections Policy</a>
      <a href="/contact.html">Contact</a>
      <a href="/advertise.html">Advertise</a>
      <a href="/feed.xml">RSS</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="/affiliate-disclosure.html">Affiliate Disclosure</a>
      <a href="/humans.txt">Humans</a>
      <a href="/llms.txt">LLMs</a>
      <button onClick={onPrivacySettings}>Privacy settings</button>
      <span>{copy.tagline}</span>
    </footer>
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
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_location: url,
      page_title: title,
      send_to: 'G-7TQQHY9XDV',
    });
  }
  recordAnalyticsEvent('page_view', { page_location: url, page_title: title });
}

function trackEvent(name, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, {
      send_to: 'G-7TQQHY9XDV',
      ...params,
    });
  }
  recordAnalyticsEvent(name, params);
}

function recordAnalyticsEvent(name, params = {}) {
  if (!supabase) return;
  supabase.from('analytics_events').insert({
    event_name: name,
    article_id: params.item_id || params.article_id || null,
    category: params.category || params.content_type || null,
    metadata: params,
  }).then(() => {});
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
  if (context.intelligenceRoute) {
    return intelligenceRouteUrl(context.intelligenceRoute);
  }
  if (context.isRootHome) {
    return new URL('/', window.location.href);
  }
  return homeContextUrl(context);
}

function intelligenceRouteUrl(route) {
  const url = new URL('/', window.location.href);
  if (route.type === 'country') url.pathname = `/country/${route.slug}`;
  else if (route.type === 'topic') url.pathname = `/topic/${route.slug}`;
  else if (route.type === 'hub') url.pathname = `/hub/${route.slug}`;
  else if (route.type === 'landing') url.pathname = `/${route.slug}`;
  else if (route.type === 'entity') url.pathname = `/entity/${route.slug}`;
  else if (route.type === 'publisher') url.pathname = `/publisher/${route.slug}`;
  else if (route.type === 'author') url.pathname = `/author/${route.slug}`;
  url.search = '';
  return url;
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

function pageSeoTitle({ category, intelligenceRoute, isRootHome, location, language, searchTerm }) {
  if (searchTerm) return `Search results for "${searchTerm}" | Nuzenio`;
  if (intelligenceRoute?.type === 'country') return `${intelligenceRoute.label} News Intelligence | Nuzenio`;
  if (intelligenceRoute?.type === 'topic') return `${intelligenceRoute.label} Topic Intelligence | Nuzenio`;
  if (intelligenceRoute?.type === 'hub') return `${intelligenceRoute.label} | Nuzenio`;
  if (intelligenceRoute?.type === 'landing') return `${intelligenceRoute.label} | Nuzenio`;
  if (intelligenceRoute?.type === 'entity') return `${intelligenceRoute.label} News Entity Intelligence | Nuzenio`;
  if (intelligenceRoute?.type === 'publisher') return `${intelligenceRoute.label} Publisher Profile, Source Credibility & Latest News | Nuzenio`;
  if (intelligenceRoute?.type === 'author') return `${intelligenceRoute.label} Author Profile & Editorial Work | Nuzenio`;
  if (isRootHome) return 'Nuzenio - Global News, Local News, Live News & Video News';
  const copy = uiCopy(language.code);
  const sectionTitle = sectionContent(category, copy, location).title;
  const place = pageSeoPlace(category, location);
  return `${sectionTitle} for ${place} | Nuzenio`;
}

function pageSeoDescription({ category, intelligenceRoute, isRootHome, location, language, articles = [], searchTerm }) {
  if (searchTerm) {
    const place = pageSeoPlace(category, location);
    const count = articles.length ? `${articles.length} live results` : 'Live news results';
    return `${count} for "${searchTerm}" on Nuzenio, focused on ${place}, with English RSS headlines, source attribution, and AI-powered news context.`;
  }
  if (isRootHome) {
    return 'Nuzenio is a professional English news platform for local news, world headlines, live news channels, video news, source attribution, and AI-powered context.';
  }
  if (intelligenceRoute?.type === 'country') {
    return `Live ${intelligenceRoute.label} news intelligence on Nuzenio: top headlines, politics, business, technology, sports, health, trend signals, related topics, and source-attributed stories.`;
  }
  if (intelligenceRoute?.type === 'topic') {
    return `Track ${intelligenceRoute.label} news intelligence on Nuzenio with live RSS headlines, trend detection, related entities, countries, source clusters, and AI-powered context.`;
  }
  if (intelligenceRoute?.type === 'hub') {
    return `${intelligenceRoute.label} on Nuzenio: evergreen topic intelligence, live RSS updates, related entities, internal links, source clusters, timestamps, and E-E-A-T signals.`;
  }
  if (intelligenceRoute?.type === 'landing') {
    return `${intelligenceRoute.label} on Nuzenio: ${intelligenceRoute.intent} Includes source attribution, update timestamps, related stories, and Discover-ready mobile reading.`;
  }
  if (intelligenceRoute?.type === 'entity') {
    return `Follow ${intelligenceRoute.label} across live news sources on Nuzenio with related stories, entities, countries, topics, and source transparency.`;
  }
  if (intelligenceRoute?.type === 'publisher') {
    return `${intelligenceRoute.label} publisher profile on Nuzenio with credibility labels, source coverage, latest RSS stories, attribution transparency, and related source intelligence.`;
  }
  if (intelligenceRoute?.type === 'author') {
    return `${intelligenceRoute.label} author profile on Nuzenio with editorial role, expertise, publisher association, original journalism workflow, corrections, and E-E-A-T transparency.`;
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
    : (context.intelligenceRoute
      ? `${context.intelligenceRoute.label} ${context.intelligenceRoute.type} intelligence`
      : (context.isRootHome
      ? 'Global News Home'
      : sectionContent(context.category, uiCopy(context.language.code), context.location).title));
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
        editor: {
          '@type': 'Organization',
          name: 'Nuzenio News Desk',
          url: productionOrigin,
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
    ['Publisher Network', '/publisher/reuters'],
    ['Author Directory', '/author/nuzenio-news-desk'],
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
    '@id': `${productionUrl(contextUrlForSeo(context))}#live-headlines`,
    name: context.searchTerm
      ? `Search results for ${context.searchTerm}`
      : context.intelligenceRoute
        ? `${context.intelligenceRoute.label} intelligence headlines`
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
    const isIntelligence = Boolean(context.intelligenceRoute);
    const sectionUrl = productionUrl(isIntelligence ? contextUrlForSeo(context) : homeContextUrl(context));
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: isIntelligence
        ? `${context.intelligenceRoute.label} intelligence`
        : sectionContent(context.category, uiCopy(context.language.code), context.location).title,
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
  const url = new URL('/', window.location.origin);
  url.pathname = `/article/${encodeURIComponent(articleSlug(article))}`;
  url.searchParams.delete('article');
  url.hash = '';
  if (!url.searchParams.get('country')) url.searchParams.set('country', article.country || 'IN');
  url.searchParams.delete('language');
  url.searchParams.set('category', article.category || 'top');
  return url;
}

function articleHref(article) {
  const url = new URL(`/article/${encodeURIComponent(articleSlug(article))}`, window.location.origin);
  url.searchParams.set('country', article.country || 'IN');
  url.searchParams.set('category', article.category || 'top');
  return `${url.pathname}${url.search}`;
}

function openArticleFromLink(event, article, openArticle) {
  event.preventDefault();
  openArticle(article);
}

createRoot(document.getElementById('root')).render(<App />);
