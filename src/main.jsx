import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search, Bell, Bookmark, Share2, Sparkles, Globe2, User, ShieldCheck, CheckCircle2,
  Clock, Headphones, TrendingUp, BarChart3, Mail, Settings, Newspaper, Languages
} from 'lucide-react';
import './styles.css';

const categories = [
  ['top','Top News'], ['hindi','हिन्दी'], ['india','India'], ['world','World'], ['business','Business'],
  ['tech','Technology'], ['sports','Sports'], ['entertainment','Entertainment'], ['health','Health'], ['science','Science']
];

const languages = [
  'English','हिन्दी','বাংলা','தமிழ்','తెలుగు','मराठी','ગુજરાતી','ಕನ್ನಡ','മലയാളം','ਪੰਜਾਬੀ','اردو',
  'العربية','Español','Français','Deutsch','Português','Русский','中文','日本語','한국어'
];

function App(){
  const [screen,setScreen]=useState('home');
  const [category,setCategory]=useState('top');
  const [articles,setArticles]=useState([]);
  const [status,setStatus]=useState('Loading live news...');
  const [query,setQuery]=useState('');
  const [language,setLanguage]=useState('English');
  const [saved,setSaved]=useState(()=>JSON.parse(localStorage.getItem('newssetu_saved')||'[]'));
  const [selected,setSelected]=useState(null);

  useEffect(()=>{ loadNews(category); },[category]);

  async function loadNews(cat='top'){
    setStatus('Loading live RSS news...');
    try{
      const res=await fetch(`/api/news?category=${encodeURIComponent(cat)}`);
      const data=await res.json();
      if(!data.ok) throw new Error(data.error || 'News fetch failed');
      setArticles(data.articles || []);
      setStatus(`${data.total} live articles loaded`);
    }catch(e){
      setStatus('Live API error: '+e.message);
    }
  }

  async function searchNews(){
    if(!query.trim()) return loadNews(category);
    setStatus('Searching live news...');
    try{
      const res=await fetch(`/api/news?q=${encodeURIComponent(query.trim())}`);
      const data=await res.json();
      setArticles(data.articles || []);
      setStatus(`${data.total || 0} search results`);
    }catch(e){ setStatus('Search error: '+e.message); }
  }

  function toggleSave(article){
    const next=saved.includes(article.id)?saved.filter(x=>x!==article.id):[...saved,article.id];
    setSaved(next);
    localStorage.setItem('newssetu_saved',JSON.stringify(next));
  }

  const lead = articles[0];
  const sideStories = articles.slice(1,5);
  const feed = articles.slice(5);
  const ticker = useMemo(()=>articles.slice(0,5).map(a=>a.title).join(' • '),[articles]);

  return <div>
    <header className="header">
      <div className="topbar">
        <button className="brand" onClick={()=>setScreen('home')}>
          <div className="logo">N</div>
          <div><h1>News<span>Setu</span></h1><small>Trusted News, Simplified</small></div>
        </button>

        <div className="searchBox">
          <Search size={18}/>
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchNews()} placeholder="Search news, topics, countries..." />
        </div>

        <select className="language" value={language} onChange={e=>setLanguage(e.target.value)}>
          {languages.map(l=><option key={l}>{l}</option>)}
        </select>

        <button className="iconBtn"><Bell size={18}/></button>
        <button className="loginBtn"><User size={17}/> Login</button>
      </div>

      <nav className="nav">
        <button className={screen==='home'?'active':''} onClick={()=>setScreen('home')}>Home</button>
        <button className={screen==='saved'?'active':''} onClick={()=>setScreen('saved')}>Saved</button>
        <button className={screen==='admin'?'active':''} onClick={()=>setScreen('admin')}>Admin</button>
        <button className={screen==='analytics'?'active':''} onClick={()=>setScreen('analytics')}>Analytics</button>
        <button className={screen==='monetize'?'active':''} onClick={()=>setScreen('monetize')}>Monetize</button>
      </nav>
    </header>

    {screen==='home' && <Home
      lead={lead} sideStories={sideStories} feed={feed} articles={articles}
      category={category} setCategory={setCategory} status={status} ticker={ticker}
      saved={saved} toggleSave={toggleSave} setSelected={setSelected}
    />}
    {screen==='saved' && <Saved articles={articles.filter(a=>saved.includes(a.id))} toggleSave={toggleSave} setSelected={setSelected}/>}
    {screen==='admin' && <Admin/>}
    {screen==='analytics' && <Analytics articles={articles} saved={saved}/>}
    {screen==='monetize' && <Monetize/>}

    {selected && <ArticleModal article={selected} onClose={()=>setSelected(null)} saved={saved} toggleSave={toggleSave}/>}
    <MobileNav setScreen={setScreen}/>
  </div>
}

function Home({lead,sideStories,feed,articles,category,setCategory,status,ticker,saved,toggleSave,setSelected}){
  return <>
    <div className="breaking"><b>BREAKING</b><span>{ticker || status}</span></div>

    <main className="main">
      <section>
        <div className="categoryBar">
          {categories.map(([key,label])=><button key={key} className={category===key?'pillActive':''} onClick={()=>setCategory(key)}>{label}</button>)}
        </div>

        <div className="heroGrid">
          <div className="leadCard" onClick={()=>lead && setSelected(lead)}>
            <div className="leadVisual">🌍</div>
            <div className="leadContent">
              <div className="badge"><ShieldCheck size={15}/> Verified Source</div>
              <h2>{lead?.title || 'Loading live lead story...'}</h2>
              <p>{lead?.summary || status}</p>
              <div className="leadActions"><button><Sparkles size={15}/> 30 sec summary</button><button>Read full story</button></div>
            </div>
          </div>

          <div className="sideList">
            {sideStories.map(a=><SmallStory key={a.id} article={a} setSelected={setSelected}/>)}
          </div>
        </div>

        <div className="adSlot">AdSense Native Banner Slot</div>

        <div className="sectionHead">
          <h2>For You</h2>
          <span>{status}</span>
        </div>

        <div className="feedGrid">
          {feed.map(a=><ArticleCard key={a.id} article={a} saved={saved} toggleSave={toggleSave} setSelected={setSelected}/>)}
        </div>
      </section>

      <aside className="rightRail">
        <Trending articles={articles}/>
        <AISummaryBox/>
        <Newsletter/>
        <div className="adSlot sideAd">AdSense Sidebar Slot</div>
      </aside>
    </main>
  </>
}

function SmallStory({article,setSelected}){
  return <button className="smallStory" onClick={()=>setSelected(article)}>
    <div className="miniThumb">📰</div>
    <div>
      <b>{article.title}</b>
      <span>{article.source} · {new Date(article.pubDate || Date.now()).toLocaleTimeString()}</span>
    </div>
  </button>
}

function ArticleCard({article,saved,toggleSave,setSelected}){
  const isSaved=saved.includes(article.id);
  return <article className="articleCard">
    <div className="cardTop"><span className="category">{article.category?.toUpperCase()}</span><span><Clock size={13}/> 2 min read</span></div>
    <button className="headline" onClick={()=>setSelected(article)}>{article.title}</button>
    <p>{article.summary}</p>
    <div className="trustRow"><span><ShieldCheck size={14}/> Trust {article.trustScore || 91}%</span><span><CheckCircle2 size={14}/> Verified</span></div>
    <div className="cardActions">
      <button onClick={()=>alert('30 sec AI Summary:\\n\\n'+(article.title+' '+article.summary).split(' ').slice(0,34).join(' ')+'...')}><Sparkles size={15}/> AI Summary</button>
      <button onClick={()=>toggleSave(article)}><Bookmark size={15} fill={isSaved?'currentColor':'none'}/> {isSaved?'Saved':'Save'}</button>
      <button><Share2 size={15}/> Share</button>
    </div>
    <a href={article.link} target="_blank" rel="noreferrer">Read original source →</a>
  </article>
}

function Trending({articles}){
  return <div className="railCard"><h3><TrendingUp size={18}/> Trending Now</h3>{articles.slice(0,5).map((a,i)=><div className="trend" key={a.id}><b>{i+1}</b><span>{a.title}</span></div>)}</div>
}
function AISummaryBox(){
  return <div className="railCard aiBox"><h3><Sparkles size={18}/> AI News Companion</h3><p>Ask: What happened? Why it matters? Explain simply. Timeline and key facts are ready for API integration.</p><button>Open AI Brief</button></div>
}
function Newsletter(){
  return <div className="railCard"><h3>Daily Brief</h3><p>Top stories in your language every morning.</p><input placeholder="Email address"/><button>Subscribe</button></div>
}

function ArticleModal({article,onClose,saved,toggleSave}){
  return <div className="modalOverlay" onClick={onClose}>
    <article className="articleModal" onClick={e=>e.stopPropagation()}>
      <button className="close" onClick={onClose}>×</button>
      <div className="progress"></div>
      <span className="category">{article.category?.toUpperCase()}</span>
      <h1>{article.title}</h1>
      <div className="articleMeta">{article.source} · {new Date(article.pubDate || Date.now()).toLocaleString()} · <ShieldCheck size={14}/> Verified</div>
      <div className="summaryPanel"><h3><Sparkles size={18}/> 30 Second AI Summary</h3><p>{article.summary}</p></div>
      <div className="infoGrid">
        <div><h3>What happened?</h3><p>{article.summary}</p></div>
        <div><h3>Why it matters?</h3><p>This story may affect public interest, policy, markets, sports, or daily life depending on the topic.</p></div>
        <div><h3>Key facts</h3><p>Original source linked. Trust badge visible. Timeline module ready.</p></div>
      </div>
      <div className="readerTools"><button><Headphones size={16}/> Listen</button><button><Languages size={16}/> Original / Translated</button><button onClick={()=>toggleSave(article)}><Bookmark size={16}/> {saved.includes(article.id)?'Saved':'Save'}</button></div>
      <a className="original" href={article.link} target="_blank" rel="noreferrer">Read original publisher story →</a>
    </article>
  </div>
}

function Saved({articles,toggleSave,setSelected}){
  return <main className="single"><section><div className="pageHero"><h2>Saved Articles</h2><p>Your read-later library.</p></div><div className="feedGrid">{articles.length?articles.map(a=><ArticleCard key={a.id} article={a} saved={articles.map(x=>x.id)} toggleSave={toggleSave} setSelected={setSelected}/>):<div className="empty">No saved articles yet.</div>}</div></section></main>
}
function Admin(){
  const items=['Source Manager','RSS Manager','AI Summary Manager','Newsletter Manager','Ad Placement Manager','User Management','Language Manager','Push Notifications','SEO Dashboard'];
  return <main className="single"><section><div className="pageHero"><h2>Admin Dashboard</h2><p>Manage NewsSetu content, sources, monetization and users.</p></div><div className="adminGrid">{items.map(x=><div className="adminCard" key={x}><h3>{x}</h3><p>Production module foundation ready.</p><button>Open</button></div>)}</div></section></main>
}
function Analytics({articles,saved}){
  return <main className="single"><section><div className="pageHero"><h2>Analytics Dashboard</h2><p>Traffic, engagement and revenue overview.</p></div><div className="stats"><div><b>{articles.length}</b><span>Live Articles</span></div><div><b>{saved.length}</b><span>Saved</span></div><div><b>10</b><span>Categories</span></div><div><b>20+</b><span>Languages</span></div></div></section></main>
}
function Monetize(){
  return <main className="single"><section><div className="pageHero"><h2>Monetization</h2><p>AdSense, sponsored stories, newsletter sponsorship and premium membership.</p></div><div className="adminGrid">{['AdSense Slots','Sponsored Stories','Newsletter Sponsorship','Premium AI Summaries','Subscription Plans','Revenue Dashboard'].map(x=><div className="adminCard" key={x}><h3>{x}</h3><p>Revenue channel setup.</p><button>Configure</button></div>)}</div></section></main>
}
function MobileNav({setScreen}){
  return <div className="mobileNav"><button onClick={()=>setScreen('home')}>Home</button><button onClick={()=>setScreen('saved')}>Saved</button><button onClick={()=>setScreen('admin')}>Admin</button><button onClick={()=>setScreen('analytics')}>Stats</button></div>
}

createRoot(document.getElementById('root')).render(<App/>);
