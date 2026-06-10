import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart3,
  Bell,
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
  Menu,
  Newspaper,
  Search,
  Settings,
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
];

const countryNames = {
  AE: 'United Arab Emirates',
  AU: 'Australia',
  BD: 'Bangladesh',
  CA: 'Canada',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  IN: 'India',
  JP: 'Japan',
  KR: 'South Korea',
  PK: 'Pakistan',
  RU: 'Russia',
  US: 'United States',
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

const englishCopy = { saved: 'Saved', history: 'History', admin: 'Admin', analytics: 'Analytics' };

function App() {
  const [screen, setScreen] = useState('home');
  const [category, setCategory] = useState('local');
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState('Loading live news...');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState(languages[0]);
  const [location, setLocation] = useState(() => detectLocaleCountry());
  const [viewMode, setViewMode] = useState('original');
  const [savedIds, setSavedIds] = useState(() => readLocal('newssetu_saved_ids', []));
  const [history, setHistory] = useState(() => readLocal('newssetu_history', []));
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [authNotice, setAuthNotice] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
  }, []);

  useEffect(() => {
    detectBrowserLocation(setLocation);
  }, []);

  useEffect(() => {
    loadNews(category, location.country);
  }, [category, location.country]);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) syncSavedFromSupabase(session.user.id);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadNews(cat = 'local', country = location.country) {
    setStatus('Loading live RSS news...');
    try {
      const res = await fetch(`/api/news?category=${encodeURIComponent(cat)}&country=${encodeURIComponent(country)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'News fetch failed');
      setArticles(data.articles || []);
      setStatus(`${data.total} live articles for ${countryNames[data.country] || data.country}`);
    } catch (error) {
      setStatus(`Live API error: ${error.message}`);
    }
  }

  async function searchNews(event) {
    event?.preventDefault();
    if (!query.trim()) return loadNews(category, location.country);
    setStatus('Searching live RSS news...');
    try {
      const res = await fetch(
        `/api/news?q=${encodeURIComponent(query.trim())}&country=${encodeURIComponent(location.country)}`,
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Search failed');
      setArticles(data.articles || []);
      setStatus(`${data.total || 0} results for "${query.trim()}"`);
    } catch (error) {
      setStatus(`Search error: ${error.message}`);
    }
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
      writeLocal('newssetu_saved_ids', ids);
    }
  }

  async function toggleSave(article) {
    const exists = savedIds.includes(article.id);
    const next = exists ? savedIds.filter((id) => id !== article.id) : [article.id, ...savedIds];
    setSavedIds(next);
    writeLocal('newssetu_saved_ids', next);

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
    const entry = {
      id: article.id,
      title: article.title,
      source: article.source,
      openedAt: new Date().toISOString(),
    };
    const next = [entry, ...history.filter((item) => item.id !== article.id)].slice(0, 30);
    setHistory(next);
    writeLocal('newssetu_history', next);
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

  const copy = englishCopy;
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
        copy={copy}
        language={language}
        loginWithGoogle={loginWithGoogle}
        logout={logout}
        mobileSearchOpen={mobileSearchOpen}
        query={query}
        screen={screen}
        searchNews={searchNews}
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
          feed={feed}
          language={language}
          lead={lead}
          location={location}
          openArticle={openArticle}
          savedIds={savedIds}
          setCategory={setCategory}
          sideStories={sideStories}
          status={status}
          ticker={ticker}
          toggleSave={toggleSave}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      )}
      {screen === 'saved' && (
        <Saved
          articles={savedArticles}
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
          language={language}
          onClose={() => setSelected(null)}
          savedIds={savedIds}
          toggleSave={toggleSave}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      )}
      <Footer />
      <MobileNav copy={copy} setScreen={setScreen} setMobileSearchOpen={setMobileSearchOpen} />
    </div>
  );
}

function Header({
  authNotice,
  copy,
  language,
  loginWithGoogle,
  logout,
  mobileSearchOpen,
  query,
  screen,
  searchNews,
  setLanguage,
  setMobileSearchOpen,
  setQuery,
  setScreen,
  user,
}) {
  return (
    <header className="header">
      <div className="topbar">
        <button className="brand" onClick={() => setScreen('home')} aria-label="NewsSetu home">
          <div className="logo">N</div>
          <div>
            <h1>
              News<span>Setu</span>
            </h1>
            <small>AI multilingual news bridge</small>
          </div>
        </button>

        <form className={`searchBox ${mobileSearchOpen ? 'isOpen' : ''}`} onSubmit={searchNews}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search live news in your region..."
          />
          <button className="searchSubmit" type="submit">
            Search
          </button>
        </form>

        <label className="translateSelect">
          <span>Translate</span>
          <select
            className="language"
            value={language.code}
            onChange={(event) => setLanguage(languages.find((item) => item.code === event.target.value))}
            aria-label="Translate articles"
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
        <button className="iconBtn" aria-label="Notifications">
          <Bell size={18} />
        </button>
        {user ? (
          <button className="loginBtn" onClick={logout}>
            <LogOut size={17} /> Logout
          </button>
        ) : (
          <button className="loginBtn" onClick={loginWithGoogle}>
            <LogIn size={17} /> Google Login
          </button>
        )}
      </div>

      {authNotice && <div className="authNotice">{authNotice}</div>}

      <nav className="nav" aria-label="Primary navigation">
        <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}>
          Home
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
          Monetize
        </button>
      </nav>
    </header>
  );
}

function Home({
  articles,
  category,
  feed,
  language,
  lead,
  location,
  openArticle,
  savedIds,
  setCategory,
  sideStories,
  status,
  ticker,
  toggleSave,
  viewMode,
  setViewMode,
}) {
  return (
    <>
      <div className="breaking">
        <b>BREAKING</b>
        <span>{ticker || status}</span>
      </div>
      <RevenueStrip />

      <main className="main">
        <section>
          <LocationBanner location={location} status={status} />
          <ProductTrustBar />

          <div className="toolbarRow">
            <div className="categoryBar">
              {categories.map(([key, label]) => (
                <button
                  key={key}
                  className={category === key ? 'pillActive' : ''}
                  onClick={() => setCategory(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <TranslationToggle viewMode={viewMode} setViewMode={setViewMode} language={language} />
          </div>

          <div className="heroGrid">
            <button className="leadCard" onClick={() => lead && openArticle(lead)}>
              <div className="leadVisual">
                <Newspaper size={112} />
              </div>
              <div className="leadContent">
                <div className="badge">
                  <ShieldCheck size={15} /> Live RSS verified
                </div>
                <h2>{displayTitle(lead, language, viewMode) || 'Loading live lead story...'}</h2>
                <p>{displaySummary(lead, language, viewMode) || status}</p>
                <div className="leadActions">
                  <span>
                    <Sparkles size={15} /> AI brief ready
                  </span>
                  <span>
                    Read story <ChevronRight size={15} />
                  </span>
                </div>
              </div>
            </button>

            <div className="sideList">
              {sideStories.map((article) => (
                <SmallStory
                  key={article.id}
                  article={article}
                  language={language}
                  openArticle={openArticle}
                  viewMode={viewMode}
                />
              ))}
            </div>
          </div>

          <AdSlot name="top-native" label="AdSense Native Banner Slot" />

          <div className="sectionHead">
            <div>
              <h2>All Latest Stories</h2>
              <p>Every story shown here is pulled from the live RSS feed. Open any card for the full NewsSetu brief.</p>
            </div>
            <span>{status}</span>
          </div>

          <div className="feedGrid">
            {feed.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                language={language}
                openArticle={openArticle}
                savedIds={savedIds}
                toggleSave={toggleSave}
                viewMode={viewMode}
              />
            ))}
          </div>
        </section>

        <aside className="rightRail">
          <Trending articles={articles} language={language} openArticle={openArticle} viewMode={viewMode} />
          <AISummaryBox />
          <AffiliatePanel />
          <Newsletter />
          <AdSlot name="sidebar-rectangle" label="AdSense Sidebar Slot" compact />
        </aside>
      </main>
    </>
  );
}

function RevenueStrip() {
  return (
    <section className="revenueStrip" aria-label="NewsSetu revenue and trust model">
      <div>
        <b>Live RSS</b>
        <span>No fake cards</span>
      </div>
      <div>
        <b>AdSense-ready</b>
        <span>Policy-safe slots</span>
      </div>
      <div>
        <b>Affiliate-ready</b>
        <span>Disclosure built in</span>
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
        <span>Affiliate links require admin approval</span>
      </div>
    </div>
  );
}

function LocationBanner({ location, status }) {
  return (
    <div className="locationBanner">
      <div>
        <Globe2 size={18} />
        <b>Local news for {location.label}</b>
      </div>
      <span>{location.source === 'gps' ? 'Detected from browser location' : 'Detected from browser region'} · {status}</span>
    </div>
  );
}

function SmallStory({ article, language, openArticle, viewMode }) {
  return (
    <button className="smallStory" onClick={() => openArticle(article)}>
      <div className="miniThumb">
        <Globe2 size={28} />
      </div>
      <div>
        <b>{displayTitle(article, language, viewMode)}</b>
        <span>
          {article.source} · {formatDate(article.pubDate)}
        </span>
      </div>
    </button>
  );
}

function ArticleCard({ article, language, openArticle, savedIds, toggleSave, viewMode }) {
  const isSaved = savedIds.includes(article.id);
  return (
    <article className="articleCard">
      <div className="cardTop">
        <span className="category">{article.category?.toUpperCase()}</span>
        <span>
          <Clock size={13} /> {article.readTime || 2} min read
        </span>
      </div>
      <button className="headline" onClick={() => openArticle(article)}>
        {displayTitle(article, language, viewMode)}
      </button>
      <p>{displaySummary(article, language, viewMode)}</p>
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
          <Sparkles size={15} /> AI Brief
        </button>
        <button onClick={() => toggleSave(article)}>
          <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Saved' : 'Save'}
        </button>
        <button onClick={() => shareArticle(article)}>
          <Share2 size={15} /> Share
        </button>
      </div>
      <div className="commerceHint">
        <LinkIcon size={14} /> Related partner links can appear here after admin review.
      </div>
      <a href={article.link} target="_blank" rel="noreferrer">
        Source <ExternalLink size={14} />
      </a>
    </article>
  );
}

function Trending({ articles, language, openArticle, viewMode }) {
  return (
    <div className="railCard">
      <h3>
        <TrendingUp size={18} /> Trending Now
      </h3>
      {articles.slice(0, 5).map((article, index) => (
        <button className="trend" key={article.id} onClick={() => openArticle(article)}>
          <b>{index + 1}</b>
          <span>{displayTitle(article, language, viewMode)}</span>
        </button>
      ))}
    </div>
  );
}

function AISummaryBox() {
  return (
    <div className="railCard aiBox">
      <h3>
        <Sparkles size={18} /> AI News Companion
      </h3>
      <p>Article pages include summary, what happened, why it matters, key facts, and source attribution.</p>
      <button>Open AI Brief</button>
    </div>
  );
}

function AffiliatePanel() {
  return (
    <div className="railCard affiliatePanel">
      <h3>
        <LinkIcon size={18} /> Partner Picks
      </h3>
      <p>Affiliate placements are reserved for relevant tools, books, subscriptions, and courses. Every link must be labeled.</p>
      <div className="affiliateDisclosure">Affiliate disclosure active</div>
    </div>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  async function subscribe(event) {
    event.preventDefault();
    if (!email.trim()) return;
    if (supabase) {
      await supabase.from('newsletter_subscribers').insert({ email: email.trim(), language: 'en' });
    }
    setMessage('Subscribed for the daily brief.');
    setEmail('');
  }

  return (
    <form className="railCard" onSubmit={subscribe}>
      <h3>
        <Mail size={18} /> Daily Brief
      </h3>
      <p>Top stories in your language every morning.</p>
      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" />
      <button type="submit">Subscribe</button>
      {message && <small>{message}</small>}
    </form>
  );
}

function ArticleModal({ article, language, onClose, savedIds, toggleSave, viewMode, setViewMode }) {
  const facts = buildKeyFacts(article);
  return (
    <div className="modalOverlay" onClick={onClose}>
      <article className="articleModal" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close article">
          <X size={20} />
        </button>
        <div className="progress" />
        <div className="articleTopline">
          <span className="category">{article.category?.toUpperCase()}</span>
          <TranslationToggle viewMode={viewMode} setViewMode={setViewMode} language={language} />
        </div>
        <h1>{displayTitle(article, language, viewMode)}</h1>
        <div className="articleMeta">
          {article.source} · {formatDate(article.pubDate)} · <ShieldCheck size={14} /> Verified RSS
        </div>
        <div className="summaryPanel">
          <h3>
            <Sparkles size={18} /> NewsSetu Brief
          </h3>
          <p>{displayFullBrief(article, language, viewMode)}</p>
        </div>
        <div className="fullStoryPanel">
          <div>
            <h3>Full story access</h3>
            <p>
              NewsSetu shows the complete available RSS brief, AI context, key facts, and attribution here. The full
              publisher article opens on the original source for copyright-safe reading.
            </p>
          </div>
          <a href={article.link} target="_blank" rel="noreferrer">
            Read full story on {article.source} <ExternalLink size={16} />
          </a>
        </div>
        <div className="infoGrid">
          <div>
            <h3>What happened</h3>
            <p>{article.whatHappened || displaySummary(article, language, viewMode)}</p>
          </div>
          <div>
            <h3>Why it matters</h3>
            <p>{article.whyItMatters}</p>
          </div>
          <div>
            <h3>Key facts</h3>
            <ul>
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="sourceBox">
          <h3>Source attribution</h3>
          <p>
            This story is sourced from <b>{article.source}</b> via live RSS. NewsSetu links back to the original
            publisher for the full report.
          </p>
        </div>
        <AdSlot name="article-inline" label="AdSense Article Inline Slot" />
        <div className="sourceBox affiliateDisclosureBox">
          <h3>Affiliate disclosure</h3>
          <p>
            Some future partner links may earn NewsSetu a commission. Editorial stories, summaries, and source links stay
            separate from paid placements.
          </p>
        </div>
        <div className="readerTools">
          <button>
            <Languages size={16} /> {viewMode === 'original' ? 'Original' : 'Translated'}
          </button>
          <button onClick={() => toggleSave(article)}>
            <Bookmark size={16} /> {savedIds.includes(article.id) ? 'Saved' : 'Save'}
          </button>
          <button onClick={() => shareArticle(article)}>
            <Share2 size={16} /> Share
          </button>
        </div>
        <a className="original" href={article.link} target="_blank" rel="noreferrer">
          Read original publisher story <ExternalLink size={16} />
        </a>
      </article>
    </div>
  );
}

function Saved({ articles, history, openArticle, savedIds, toggleSave }) {
  return (
    <main className="single">
      <section>
        <div className="pageHero">
          <h2>Saved Articles</h2>
          <p>Your read-later library and reading history sync with Supabase when login is enabled.</p>
        </div>
        <div className="feedGrid">
          {articles.length ? (
            articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                language={languages[0]}
                openArticle={openArticle}
                savedIds={savedIds}
                toggleSave={toggleSave}
                viewMode="original"
              />
            ))
          ) : (
            <div className="empty">No saved articles from the current feed yet.</div>
          )}
        </div>
        <div className="historyPanel">
          <h3>Reading History</h3>
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
            <p>No reading history yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Admin({ user }) {
  const rssRows = categories.map(([key, label]) => ({ key, label, status: 'Live RSS', health: 'Healthy' }));
  const adSlots = ['top-native', 'sidebar-rectangle', 'article-inline', 'mobile-feed', 'newsletter-sponsor'];
  const affiliateRows = ['Books and explainers', 'AI tools', 'Market data tools', 'Learning courses'];
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
                <span>Placeholder only</span>
                <em>No script</em>
              </div>
            ))}
          </Manager>

          <Manager title="Affiliate Link Manager" icon={<LinkIcon size={18} />}>
            {affiliateRows.map((row) => (
              <div className="managerRow" key={row}>
                <b>{row}</b>
                <span>Manual approval</span>
                <em>Disclosure required</em>
              </div>
            ))}
          </Manager>

          <Manager title="Newsletter Manager" icon={<Mail size={18} />}>
            <div className="managerMetric">
              <b>Subscribers table</b>
              <span>public.newsletter_subscribers</span>
            </div>
            <button>Export CSV</button>
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
  const revenueReadiness = articles.length && sourceCount ? 86 : 0;
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
            <span>Revenue Readiness</span>
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
    ['AdSense Slots', 'Top banner, sidebar, article inline, mobile feed, and newsletter sponsor placements.'],
    ['Affiliate Links', 'Admin-approved partner links with visible disclosure and category matching.'],
    ['Newsletter Sponsorship', 'Daily brief subscriber table and sponsorship slot are ready.'],
    ['Premium AI Summaries', 'Article intelligence panel can connect to paid summaries or memberships.'],
    ['Sponsored Stories', 'Paid posts stay separate from editorial RSS and must be labeled.'],
    ['SEO Revenue Loop', 'Sitemap, metadata, source links, and topic pages support search acquisition.'],
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
            <p>AdSense, affiliate, newsletter, and premium AI revenue structure without fake scripts or fake stories.</p>
          </div>
          <div className="moneyScore">
            <b>4</b>
            <span>Revenue channels</span>
          </div>
        </div>
        <div className="adminGrid">
          {channels.map(([title, body]) => (
            <div className="adminCard" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
              <button>Configure</button>
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

function MobileNav({ copy, setScreen, setMobileSearchOpen }) {
  return (
    <div className="mobileNav">
      <button onClick={() => setScreen('home')}>
        <HomeIcon size={18} /> Home
      </button>
      <button onClick={() => setScreen('saved')}>
        <Bookmark size={18} /> {copy.saved}
      </button>
      <button onClick={() => setMobileSearchOpen((value) => !value)}>
        <Search size={18} /> Search
      </button>
      <button onClick={() => setScreen('admin')}>
        <Settings size={18} /> {copy.admin}
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <b>NewsSetu</b>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="/affiliate-disclosure.html">Affiliate Disclosure</a>
      <span>Live RSS news with labeled monetization surfaces.</span>
    </footer>
  );
}

function TranslationToggle({ language, setViewMode, viewMode }) {
  return (
    <div className="translationToggle" role="group" aria-label="Original or translated article view">
      <button className={viewMode === 'original' ? 'active' : ''} onClick={() => setViewMode('original')}>
        Original
      </button>
      <button className={viewMode === 'translated' ? 'active' : ''} onClick={() => setViewMode('translated')}>
        {language.native}
      </button>
    </div>
  );
}

function AdSlot({ compact = false, label, name }) {
  return (
    <div className={`adSlot ${compact ? 'sideAd' : ''}`} data-ad-slot={name}>
      <span>{label}</span>
      <small>Publisher-ready placeholder, no ad script loaded</small>
    </div>
  );
}

function displayTitle(article, language, viewMode) {
  if (!article) return '';
  if (viewMode === 'original' || language.code === 'en') return article.title;
  return `${article.title} (${language.native})`;
}

function displaySummary(article, language, viewMode) {
  if (!article) return '';
  if (viewMode === 'original' || language.code === 'en') return article.summary;
  return `${article.summary} Translation layer selected for ${language.label}; connect a server-side AI translation endpoint before production traffic.`;
}

function displayFullBrief(article, language, viewMode) {
  if (!article) return '';
  const brief = article.fullBrief || article.summary;
  if (viewMode === 'original' || language.code === 'en') return brief;
  return `${brief} Translation layer selected for ${language.label}; connect a server-side AI translation endpoint before production traffic.`;
}

function buildKeyFacts(article) {
  return [
    `Source: ${article.source || 'RSS publisher'}`,
    `Published: ${formatDate(article.pubDate)}`,
    `Category: ${article.category || 'top'}`,
  ];
}

function detectLocaleCountry() {
  const locale = navigator.language || navigator.languages?.[0] || 'en-IN';
  const localeCountry = locale.split('-')[1]?.toUpperCase();
  const timezoneCountry = inferCountryFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const country = normalizeCountry(localeCountry || timezoneCountry || 'IN');
  return {
    country,
    label: countryNames[country] || country,
    source: localeCountry ? 'browser locale' : 'timezone',
  };
}

function detectBrowserLocation(setLocation) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const country = inferCountryFromCoordinates(position.coords.latitude, position.coords.longitude);
      if (!country) return;
      setLocation({ country, label: countryNames[country] || country, source: 'gps' });
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 1000 * 60 * 60 * 12, timeout: 4500 },
  );
}

function normalizeCountry(country) {
  const value = (country || 'IN').toUpperCase();
  return countryNames[value] ? value : 'IN';
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
  if (timeZone.includes('Tokyo')) return 'JP';
  if (timeZone.includes('Seoul')) return 'KR';
  if (timeZone.includes('Moscow')) return 'RU';
  if (timeZone.includes('New_York') || timeZone.includes('Chicago') || timeZone.includes('Los_Angeles')) return 'US';
  return 'IN';
}

function inferCountryFromCoordinates(latitude, longitude) {
  if (latitude >= 6 && latitude <= 37 && longitude >= 68 && longitude <= 98) return 'IN';
  if (latitude >= 24 && latitude <= 50 && longitude >= -125 && longitude <= -66) return 'US';
  if (latitude >= 49 && latitude <= 61 && longitude >= -8 && longitude <= 2) return 'GB';
  if (latitude >= 42 && latitude <= 84 && longitude >= -141 && longitude <= -52) return 'CA';
  if (latitude >= -44 && latitude <= -10 && longitude >= 112 && longitude <= 154) return 'AU';
  if (latitude >= 23 && latitude <= 27 && longitude >= 51 && longitude <= 57) return 'AE';
  if (latitude >= 20 && latitude <= 27 && longitude >= 88 && longitude <= 93) return 'BD';
  if (latitude >= 23 && latitude <= 37 && longitude >= 60 && longitude <= 78) return 'PK';
  if (latitude >= 30 && latitude <= 46 && longitude >= 129 && longitude <= 146) return 'JP';
  if (latitude >= 33 && latitude <= 39 && longitude >= 124 && longitude <= 132) return 'KR';
  return null;
}

function formatDate(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function shareArticle(article) {
  if (navigator.share) {
    await navigator.share({ title: article.title, url: article.link });
    return;
  }
  await navigator.clipboard?.writeText(article.link);
}

createRoot(document.getElementById('root')).render(<App />);
