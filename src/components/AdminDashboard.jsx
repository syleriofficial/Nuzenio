import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, BarChart3, Database, Edit3, Eye, Globe2, Megaphone, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';

const emptySource = {
  name: '',
  url: '',
  country: 'GLOBAL',
  language: 'en',
  category: 'top',
  priority: 0,
  enabled: true,
};

const emptyAdSlot = {
  slot_key: '',
  placement: '',
  format: 'responsive',
  enabled: true,
  notes: '',
};

const emptyAffiliate = {
  title: '',
  category: 'news',
  destination_url: '',
  network: 'Amazon Associates',
  image_url: '',
  disclosure: 'Nuzenio may earn a commission from this link.',
  enabled: false,
};

const emptySponsored = {
  title: '',
  sponsor_name: '',
  category: 'all',
  placement: 'sidebar',
  destination_url: '',
  image_url: '',
  disclosure: 'Sponsored content from an approved Nuzenio partner.',
  label: 'Sponsored',
  enabled: false,
  start_at: '',
  end_at: '',
};

const emptyOriginalArticle = {
  title: '',
  slug: '',
  dek: '',
  content_type: 'analysis',
  status: 'draft',
  author_slug: 'nuzenio-news-desk',
  publisher_slug: 'nuzenio',
  category: 'top',
  tags: '',
  opinion_label: false,
  scheduled_at: '',
};

const aiCategoryOptions = ['top', 'world', 'business', 'tech', 'ai', 'sports', 'health', 'science', 'entertainment', 'local'];
const originalContentTypes = ['analysis', 'explainer', 'fact_check', 'opinion', 'research'];
const editorialStatuses = ['draft', 'review', 'scheduled', 'published', 'archived'];

const defaultAiSettings = {
  key: 'global',
  enabled: true,
  categories: aiCategoryOptions,
  simple_brief_enabled: true,
  comparison_enabled: true,
};

function groupCount(rows = [], key) {
  return rows.reduce((acc, row) => {
    const value = row?.[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(object, limit = 8) {
  return Object.entries(object || {}).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function localDate(value) {
  if (!value) return 'Latest';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminDashboard({ supabase, user, onBack, onLogin, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [overview, setOverview] = useState({});
  const [sources, setSources] = useState([]);
  const [cacheRows, setCacheRows] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [adSlots, setAdSlots] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [sponsoredBlocks, setSponsoredBlocks] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [journalists, setJournalists] = useState([]);
  const [originalArticles, setOriginalArticles] = useState([]);
  const [correctionReports, setCorrectionReports] = useState([]);
  const [aiSettings, setAiSettings] = useState(defaultAiSettings);
  const [newsletters, setNewsletters] = useState([]);
  const [logs, setLogs] = useState([]);
  const [sourceForm, setSourceForm] = useState(emptySource);
  const [editingSourceId, setEditingSourceId] = useState('');
  const [adForm, setAdForm] = useState(emptyAdSlot);
  const [affiliateForm, setAffiliateForm] = useState(emptyAffiliate);
  const [sponsoredForm, setSponsoredForm] = useState(emptySponsored);
  const [originalForm, setOriginalForm] = useState(emptyOriginalArticle);
  const [cacheRefresh, setCacheRefresh] = useState({ category: 'top', country: 'IN' });

  const isAdmin = profile?.role === 'admin';
  const articlesByCategory = useMemo(() => topEntries(groupCount(cacheRows, 'category')), [cacheRows]);
  const articlesByCountry = useMemo(() => topEntries(groupCount(cacheRows, 'country')), [cacheRows]);
  const topCategories = useMemo(() => topEntries(groupCount(analytics, 'category')), [analytics]);
  const searchQueries = useMemo(() => topEntries(analytics
    .filter((event) => event.event_name === 'search')
    .reduce((acc, event) => {
      const query = event.metadata?.search_term || 'unknown';
      acc[query] = (acc[query] || 0) + 1;
      return acc;
    }, {})), [analytics]);
  const mostViewedStories = useMemo(() => topEntries(analytics
    .filter((event) => event.article_id)
    .reduce((acc, event) => {
      acc[event.article_id] = (acc[event.article_id] || 0) + 1;
      return acc;
    }, {})), [analytics]);
  const topPages = useMemo(() => topEntries(analytics
    .filter((event) => event.event_name === 'page_view')
    .reduce((acc, event) => {
      const page = event.metadata?.page_location || 'unknown page';
      acc[page] = (acc[page] || 0) + 1;
      return acc;
    }, {}), 10), [analytics]);
  const seoCtr = useMemo(() => {
    const impressions = analytics.reduce((sum, event) => sum + Number(event.metadata?.impressions || 0), 0);
    const clicks = analytics.reduce((sum, event) => sum + Number(event.metadata?.clicks || 0), 0);
    return impressions ? `${((clicks / impressions) * 100).toFixed(2)}%` : 'Connect GSC';
  }, [analytics]);
  const sourceCoverage = useMemo(() => topEntries(groupCount(cacheRows, 'source'), 12), [cacheRows]);
  const originalByStatus = useMemo(() => topEntries(groupCount(originalArticles, 'status'), 8), [originalArticles]);
  const originalByType = useMemo(() => topEntries(groupCount(originalArticles, 'content_type'), 8), [originalArticles]);

  useEffect(() => {
    loadAdmin();
  }, [supabase, user?.id]);

  async function countRows(table, configure = (query) => query) {
    if (!supabase) return 0;
    const query = configure(supabase.from(table).select('*', { count: 'exact', head: true }));
    const { count } = await query;
    return count || 0;
  }

  async function loadAdmin() {
    setLoading(true);
    setNotice('');
    try {
      if (!supabase) {
        setNotice('Add Supabase environment variables to enable the admin dashboard.');
        return;
      }
      if (!user) return;
      const { data: adminProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id,email,full_name,role')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      setProfile(adminProfile);
      if (adminProfile?.role !== 'admin') return;

      const [
        sourceResult,
        cacheResult,
        analyticsResult,
        adResult,
        affiliateResult,
        sponsoredResult,
        publisherResult,
        journalistResult,
        originalResult,
        correctionResult,
        aiSettingsResult,
        newsletterResult,
        logResult,
        articleCount,
        userCount,
        savedCount,
        historyCount,
        newsletterCount,
        preferencesCount,
        digestLogCount,
      ] = await Promise.all([
        supabase.from('rss_sources').select('*').order('priority', { ascending: false }).order('updated_at', { ascending: false }),
        supabase.from('news_cache').select('id,article_id,title,link,source,category,country,published_at,updated_at').order('published_at', { ascending: false }).limit(250),
        supabase.from('analytics_events').select('event_name,article_id,category,metadata,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('adsense_slots').select('*').order('updated_at', { ascending: false }),
        supabase.from('affiliate_links').select('*').order('updated_at', { ascending: false }),
        supabase.from('sponsored_blocks').select('*').order('updated_at', { ascending: false }),
        supabase.from('publisher_profiles').select('*').order('updated_at', { ascending: false }),
        supabase.from('journalist_profiles').select('*').order('updated_at', { ascending: false }),
        supabase.from('original_articles').select('*').order('updated_at', { ascending: false }).limit(120),
        supabase.from('correction_reports').select('*').order('created_at', { ascending: false }).limit(80),
        supabase.from('ai_settings').select('*').eq('key', 'global').maybeSingle(),
        supabase.from('newsletter_subscribers').select('email,status,language,frequency,country,created_at,confirmed_at,unsubscribed_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50),
        countRows('news_cache'),
        countRows('profiles'),
        countRows('saved_articles'),
        countRows('reading_history'),
        countRows('newsletter_subscribers'),
        countRows('user_preferences'),
        countRows('email_digest_logs'),
      ]);

      if (sourceResult.error) throw sourceResult.error;
      if (publisherResult.error) throw publisherResult.error;
      if (journalistResult.error) throw journalistResult.error;
      if (originalResult.error) throw originalResult.error;
      setSources(sourceResult.data || []);
      setCacheRows(cacheResult.data || []);
      setAnalytics(analyticsResult.data || []);
      setAdSlots(adResult.data || []);
      setAffiliates(affiliateResult.data || []);
      setSponsoredBlocks(sponsoredResult.data || []);
      setPublishers(publisherResult.data || []);
      setJournalists(journalistResult.data || []);
      setOriginalArticles(originalResult.data || []);
      setCorrectionReports(correctionResult.data || []);
      if (aiSettingsResult.data) setAiSettings({ ...defaultAiSettings, ...aiSettingsResult.data });
      setNewsletters(newsletterResult.data || []);
      setLogs(logResult.data || []);
      setOverview({
        articleCount,
        userCount,
        savedCount,
        historyCount,
        newsletterCount,
        preferencesCount,
        digestLogCount,
        correctionCount: correctionResult.data?.length || 0,
        publisherCount: publisherResult.data?.length || 0,
        journalistCount: journalistResult.data?.length || 0,
        originalCount: originalResult.data?.length || 0,
        publishedOriginalCount: (originalResult.data || []).filter((item) => item.status === 'published').length,
        sourceCount: sourceResult.data?.length || 0,
        enabledSources: (sourceResult.data || []).filter((item) => item.enabled).length,
      });
    } catch (error) {
      setNotice(error.message || 'Admin dashboard could not load.');
    } finally {
      setLoading(false);
    }
  }

  async function logAdmin(action, status = 'ok', metadata = {}) {
    if (!supabase || !isAdmin) return;
    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action,
      target_table: metadata.table || null,
      target_id: metadata.id || null,
      status,
      message: metadata.message || null,
      metadata,
    });
  }

  async function saveSource(event) {
    event.preventDefault();
    const payload = {
      ...sourceForm,
      priority: Number(sourceForm.priority) || 0,
      country: String(sourceForm.country || 'GLOBAL').toUpperCase(),
    };
    const result = editingSourceId
      ? await supabase.from('rss_sources').update(payload).eq('id', editingSourceId)
      : await supabase.from('rss_sources').insert(payload);
    if (result.error) {
      setNotice(result.error.message);
      await logAdmin('rss_source_save', 'error', { table: 'rss_sources', id: editingSourceId, message: result.error.message });
      return;
    }
    await logAdmin(editingSourceId ? 'rss_source_update' : 'rss_source_create', 'ok', { table: 'rss_sources', id: editingSourceId || payload.url });
    setSourceForm(emptySource);
    setEditingSourceId('');
    loadAdmin();
  }

  async function testSource(source = sourceForm) {
    setNotice('Testing RSS feed...');
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/admin-rss-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
      },
      body: JSON.stringify({ url: source.url, name: source.name }),
    });
    const data = await response.json();
    setNotice(data.ok ? `RSS test passed: ${data.itemCount} items found from ${data.feedTitle || source.name || 'source'}.` : `RSS test failed: ${data.error}`);
    await logAdmin('rss_source_test', data.ok ? 'ok' : 'error', { table: 'rss_sources', id: source.id || source.url, message: data.error || data.feedTitle || '' });
  }

  async function editSource(source) {
    setEditingSourceId(source.id);
    setSourceForm({
      name: source.name || '',
      url: source.url || '',
      country: source.country || 'GLOBAL',
      language: source.language || 'en',
      category: source.category || 'top',
      priority: source.priority || 0,
      enabled: source.enabled !== false,
    });
  }

  async function updateSource(source, patch) {
    const { error } = await supabase.from('rss_sources').update(patch).eq('id', source.id);
    if (error) setNotice(error.message);
    else await logAdmin('rss_source_update', 'ok', { table: 'rss_sources', id: source.id });
    loadAdmin();
  }

  async function deleteRow(table, id, label = 'row') {
    if (!window.confirm(`Delete ${label}?`)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      setNotice(error.message);
      await logAdmin(`${table}_delete`, 'error', { table, id, message: error.message });
      return;
    }
    await logAdmin(`${table}_delete`, 'ok', { table, id });
    loadAdmin();
  }

  async function refreshCache() {
    setNotice('Refreshing live cache...');
    const response = await fetch(`/api/news?category=${encodeURIComponent(cacheRefresh.category)}&country=${encodeURIComponent(cacheRefresh.country)}&language=en&fresh=${Date.now()}`);
    const data = await response.json();
    setNotice(data.ok ? `Cache refreshed: ${data.total || 0} articles loaded.` : `Refresh failed: ${data.error}`);
    await logAdmin('cache_refresh', data.ok ? 'ok' : 'error', { table: 'news_cache', id: `${cacheRefresh.category}-${cacheRefresh.country}`, message: data.error || `${data.total || 0} articles` });
    loadAdmin();
  }

  async function removeDuplicateCache() {
    const seen = new Set();
    const duplicateIds = [];
    cacheRows.forEach((row) => {
      const key = (row.link || row.title || '').toLowerCase().trim();
      if (!key) return;
      if (seen.has(key)) duplicateIds.push(row.id);
      else seen.add(key);
    });
    if (!duplicateIds.length) {
      setNotice('No duplicate cached articles found in the latest sample.');
      return;
    }
    const { error } = await supabase.from('news_cache').delete().in('id', duplicateIds);
    if (error) setNotice(error.message);
    else {
      setNotice(`Removed ${duplicateIds.length} duplicate cached articles.`);
      await logAdmin('cache_dedupe', 'ok', { table: 'news_cache', message: `${duplicateIds.length} duplicates removed` });
    }
    loadAdmin();
  }

  async function saveAdSlot(event) {
    event.preventDefault();
    const { error } = await supabase.from('adsense_slots').upsert(adForm, { onConflict: 'slot_key' });
    if (error) setNotice(error.message);
    else {
      setAdForm(emptyAdSlot);
      await logAdmin('ad_slot_upsert', 'ok', { table: 'adsense_slots', id: adForm.slot_key });
      loadAdmin();
    }
  }

  async function saveAffiliate(event) {
    event.preventDefault();
    const { error } = await supabase.from('affiliate_links').insert(affiliateForm);
    if (error) setNotice(error.message);
    else {
      setAffiliateForm(emptyAffiliate);
      await logAdmin('affiliate_create', 'ok', { table: 'affiliate_links', id: affiliateForm.destination_url });
      loadAdmin();
    }
  }

  async function saveSponsored(event) {
    event.preventDefault();
    const payload = {
      ...sponsoredForm,
      start_at: sponsoredForm.start_at || null,
      end_at: sponsoredForm.end_at || null,
    };
    const { error } = await supabase.from('sponsored_blocks').insert(payload);
    if (error) setNotice(error.message);
    else {
      setSponsoredForm(emptySponsored);
      await logAdmin('sponsored_create', 'ok', { table: 'sponsored_blocks', id: payload.destination_url });
      loadAdmin();
    }
  }

  function slugify(value = '') {
    return String(value)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'nuzenio-original';
  }

  async function saveOriginalArticle(event) {
    event.preventDefault();
    const payload = {
      ...originalForm,
      slug: originalForm.slug || slugify(originalForm.title),
      tags: String(originalForm.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      scheduled_at: originalForm.scheduled_at || null,
      opinion_label: originalForm.content_type === 'opinion' || originalForm.opinion_label,
    };
    const { error } = await supabase.from('original_articles').insert(payload);
    if (error) {
      setNotice(error.message);
      await logAdmin('original_article_create', 'error', { table: 'original_articles', id: payload.slug, message: error.message });
      return;
    }
    setOriginalForm(emptyOriginalArticle);
    setNotice('Original article draft created.');
    await logAdmin('original_article_create', 'ok', { table: 'original_articles', id: payload.slug });
    loadAdmin();
  }

  async function updateOriginalArticleStatus(article, status) {
    const patch = {
      status,
      published_at: status === 'published' ? new Date().toISOString() : article.published_at,
    };
    const { error } = await supabase.from('original_articles').update(patch).eq('id', article.id);
    if (error) {
      setNotice(error.message);
      await logAdmin('original_article_status', 'error', { table: 'original_articles', id: article.id, message: error.message });
      return;
    }
    await supabase.from('editorial_workflow_logs').insert({
      article_id: article.id,
      actor_id: user.id,
      action: `status:${status}`,
      status,
      message: `Status changed from ${article.status} to ${status}`,
    });
    await logAdmin('original_article_status', 'ok', { table: 'original_articles', id: article.id, message: status });
    loadAdmin();
  }

  async function toggleRow(table, item) {
    const { error } = await supabase.from(table).update({ enabled: !item.enabled }).eq('id', item.id);
    if (error) {
      setNotice(error.message);
      await logAdmin(`${table}_toggle`, 'error', { table, id: item.id, message: error.message });
      return;
    }
    await logAdmin(`${table}_toggle`, 'ok', { table, id: item.id });
    loadAdmin();
  }

  async function toggleCorrectionStatus(report) {
    const nextStatus = report.status === 'reviewed' ? 'new' : 'reviewed';
    const { error } = await supabase.from('correction_reports').update({
      status: nextStatus,
      reviewed_by: user.id,
    }).eq('id', report.id);
    if (error) {
      setNotice(error.message);
      await logAdmin('correction_report_update', 'error', { table: 'correction_reports', id: report.id, message: error.message });
      return;
    }
    await logAdmin('correction_report_update', 'ok', { table: 'correction_reports', id: report.id, message: nextStatus });
    loadAdmin();
  }

  function toggleAiCategory(category) {
    setAiSettings((current) => {
      const categories = current.categories || [];
      const next = categories.includes(category)
        ? categories.filter((item) => item !== category)
        : [...categories, category];
      return { ...current, categories: next.length ? next : [category] };
    });
  }

  async function saveAiSettings() {
    const payload = {
      key: 'global',
      enabled: aiSettings.enabled !== false,
      categories: aiSettings.categories?.length ? aiSettings.categories : aiCategoryOptions,
      simple_brief_enabled: aiSettings.simple_brief_enabled !== false,
      comparison_enabled: aiSettings.comparison_enabled !== false,
      updated_by: user.id,
    };
    const { error } = await supabase.from('ai_settings').upsert(payload, { onConflict: 'key' });
    if (error) {
      setNotice(error.message);
      await logAdmin('ai_settings_update', 'error', { table: 'ai_settings', id: 'global', message: error.message });
      return;
    }
    setNotice('AI summary settings saved.');
    await logAdmin('ai_settings_update', 'ok', { table: 'ai_settings', id: 'global' });
    loadAdmin();
  }

  if (!supabase) {
    return <AdminShell onBack={onBack}><AdminGate title="Supabase required" message="Add Supabase env variables before using the admin dashboard." /></AdminShell>;
  }

  if (!user) {
    return (
      <AdminShell onBack={onBack}>
        <AdminGate title="Admin login required" message="Sign in with Google, then make your profile role admin in Supabase.">
          <button className="primaryAction" onClick={onLogin}>Google Login</button>
        </AdminGate>
      </AdminShell>
    );
  }

  if (loading) {
    return <AdminShell onBack={onBack}><AdminGate title="Loading admin dashboard" message="Checking profile role and loading Supabase tables..." /></AdminShell>;
  }

  if (!isAdmin) {
    return (
      <AdminShell onBack={onBack}>
        <AdminGate title="Admin role required" message={`Signed in as ${profile?.email || user.email || 'user'}, but this profile is not admin.`}>
          <button onClick={onLogout}>Logout</button>
        </AdminGate>
      </AdminShell>
    );
  }

  return (
    <AdminShell onBack={onBack}>
      <section className="adminHero">
        <div>
          <span><ShieldCheck size={16} /> Admin role verified</span>
          <h1>Nuzenio Control Center</h1>
          <p>Manage RSS sources, cached articles, analytics, monetization, users, and audit logs without code edits.</p>
        </div>
        <button onClick={loadAdmin}><RefreshCw size={16} /> Reload</button>
      </section>
      {notice && <div className="adminNotice">{notice}</div>}

      <section className="adminGrid statsGrid">
        <StatCard icon={Database} label="Cached articles" value={overview.articleCount || 0} />
        <StatCard icon={Globe2} label="RSS sources" value={`${overview.enabledSources || 0}/${overview.sourceCount || 0}`} />
        <StatCard icon={Users} label="Users" value={overview.userCount || 0} />
        <StatCard icon={Eye} label="Page events" value={analytics.length} />
        <StatCard icon={Megaphone} label="Newsletter" value={overview.newsletterCount || 0} />
        <StatCard icon={ShieldCheck} label="Corrections" value={overview.correctionCount || 0} />
        <StatCard icon={BarChart3} label="Digest logs" value={overview.digestLogCount || 0} />
        <StatCard icon={Globe2} label="Publishers" value={overview.publisherCount || 0} />
        <StatCard icon={Edit3} label="Original CMS" value={`${overview.publishedOriginalCount || 0}/${overview.originalCount || 0}`} />
        <StatCard icon={Activity} label="Recent errors" value={logs.filter((log) => log.status === 'error').length} />
      </section>

      <section className="adminGrid twoColumn">
        <AdminPanel title="Articles by category">{articlesByCategory.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}</AdminPanel>
        <AdminPanel title="Articles by country">{articlesByCountry.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}</AdminPanel>
      </section>

      <AdminPanel title="RSS Source Manager">
        <form className="adminForm" onSubmit={saveSource}>
          <input value={sourceForm.name} onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })} placeholder="Source name" required />
          <input value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} placeholder="RSS URL" type="url" required />
          <input value={sourceForm.country} onChange={(event) => setSourceForm({ ...sourceForm, country: event.target.value })} placeholder="Country" />
          <input value={sourceForm.language} onChange={(event) => setSourceForm({ ...sourceForm, language: event.target.value })} placeholder="Language" />
          <input value={sourceForm.category} onChange={(event) => setSourceForm({ ...sourceForm, category: event.target.value })} placeholder="Category" />
          <input value={sourceForm.priority} onChange={(event) => setSourceForm({ ...sourceForm, priority: event.target.value })} placeholder="Priority" type="number" />
          <label><input type="checkbox" checked={sourceForm.enabled} onChange={(event) => setSourceForm({ ...sourceForm, enabled: event.target.checked })} /> Enabled</label>
          <button type="submit" className="primaryAction">{editingSourceId ? 'Update source' : 'Add source'}</button>
          <button type="button" onClick={() => testSource(sourceForm)}>Test RSS feed</button>
        </form>
        <AdminTable headers={['Source', 'Category', 'Country', 'Priority', 'Status', 'Actions']}>
          {sources.map((source) => (
            <tr key={source.id}>
              <td><b>{source.name}</b><small>{source.url}</small></td>
              <td>{source.category}</td>
              <td>{source.country}</td>
              <td>{source.priority}</td>
              <td>{source.enabled ? 'Enabled' : 'Disabled'}</td>
              <td className="adminActions">
                <button onClick={() => editSource(source)}>Edit</button>
                <button onClick={() => updateSource(source, { enabled: !source.enabled })}>{source.enabled ? 'Disable' : 'Enable'}</button>
                <button onClick={() => testSource(source)}>Test</button>
                <button className="dangerAction" onClick={() => deleteRow('rss_sources', source.id, source.name)}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPanel>

      <AdminPanel title="News Cache Manager">
        <div className="adminToolbar">
          <select value={cacheRefresh.category} onChange={(event) => setCacheRefresh({ ...cacheRefresh, category: event.target.value })}>
            {['top', 'world', 'business', 'tech', 'ai', 'sports', 'health', 'science', 'entertainment'].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={cacheRefresh.country} onChange={(event) => setCacheRefresh({ ...cacheRefresh, country: event.target.value.toUpperCase() })} />
          <button onClick={refreshCache}><RefreshCw size={15} /> Refresh cache</button>
          <button onClick={removeDuplicateCache}>Remove duplicates</button>
        </div>
        <AdminTable headers={['Title', 'Source', 'Category', 'Country', 'Published', 'Actions']}>
          {cacheRows.slice(0, 80).map((article) => (
            <tr key={article.id}>
              <td><b>{article.title}</b><small>{article.link}</small></td>
              <td>{article.source}</td>
              <td>{article.category}</td>
              <td>{article.country}</td>
              <td>{localDate(article.published_at)}</td>
              <td><button className="dangerAction" onClick={() => deleteRow('news_cache', article.id, article.title)}>Delete</button></td>
            </tr>
          ))}
        </AdminTable>
      </AdminPanel>

      <section className="adminGrid twoColumn">
        <AdminPanel title="Publisher Network">
          <MetricRow label="Publisher profiles" value={overview.publisherCount || 0} />
          <MetricRow label="Journalist profiles" value={overview.journalistCount || 0} />
          <h4>Most active cached sources</h4>
          {sourceCoverage.slice(0, 8).map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Publisher directory</h4>
          <AdminTable headers={['Publisher', 'Country', 'Categories', 'Status']}>
            {publishers.slice(0, 30).map((publisher) => (
              <tr key={publisher.id || publisher.slug}>
                <td><b>{publisher.name}</b><small>/publisher/{publisher.slug}</small></td>
                <td>{publisher.country || 'GLOBAL'}</td>
                <td>{(publisher.categories || []).join(', ')}</td>
                <td>{publisher.status || 'active'}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>

        <AdminPanel title="Journalist Directory">
          <MetricRow label="Author profiles" value={overview.journalistCount || 0} />
          <MetricRow label="Editorial desks" value={journalists.filter((item) => (item.role || '').toLowerCase().includes('desk')).length} />
          <AdminTable headers={['Author', 'Publisher', 'Expertise', 'Updated']}>
            {journalists.slice(0, 30).map((author) => (
              <tr key={author.id || author.slug}>
                <td><b>{author.full_name}</b><small>/author/{author.slug}</small></td>
                <td>{author.publisher_slug || 'nuzenio'}</td>
                <td>{(author.expertise || []).join(', ')}</td>
                <td>{localDate(author.updated_at)}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>
      </section>

      <AdminPanel title="Editorial CMS">
        <section className="adminGrid twoColumn">
          <div>
            <h4>Create original article</h4>
            <form className="adminForm stacked" onSubmit={saveOriginalArticle}>
              <input value={originalForm.title} onChange={(event) => setOriginalForm({ ...originalForm, title: event.target.value, slug: originalForm.slug || slugify(event.target.value) })} placeholder="Original article title" required />
              <input value={originalForm.slug} onChange={(event) => setOriginalForm({ ...originalForm, slug: event.target.value })} placeholder="SEO slug" required />
              <input value={originalForm.dek} onChange={(event) => setOriginalForm({ ...originalForm, dek: event.target.value })} placeholder="Short description / dek" />
              <select value={originalForm.content_type} onChange={(event) => setOriginalForm({ ...originalForm, content_type: event.target.value, opinion_label: event.target.value === 'opinion' })}>
                {originalContentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={originalForm.status} onChange={(event) => setOriginalForm({ ...originalForm, status: event.target.value })}>
                {editorialStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input value={originalForm.author_slug} onChange={(event) => setOriginalForm({ ...originalForm, author_slug: event.target.value })} placeholder="Author slug" />
              <input value={originalForm.publisher_slug} onChange={(event) => setOriginalForm({ ...originalForm, publisher_slug: event.target.value })} placeholder="Publisher slug" />
              <input value={originalForm.category} onChange={(event) => setOriginalForm({ ...originalForm, category: event.target.value })} placeholder="Category" />
              <input value={originalForm.tags} onChange={(event) => setOriginalForm({ ...originalForm, tags: event.target.value })} placeholder="Tags, comma separated" />
              <input value={originalForm.scheduled_at} onChange={(event) => setOriginalForm({ ...originalForm, scheduled_at: event.target.value })} type="datetime-local" aria-label="Scheduled publish time" />
              <label><input type="checkbox" checked={originalForm.opinion_label} onChange={(event) => setOriginalForm({ ...originalForm, opinion_label: event.target.checked })} /> Clearly label as opinion</label>
              <button className="primaryAction">Create draft</button>
            </form>
          </div>
          <div>
            <h4>Workflow overview</h4>
            {originalByStatus.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
            <h4>Content types</h4>
            {originalByType.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
            <p className="adminHint">Use original articles only for Nuzenio-owned work. Aggregated RSS stories stay copyright-safe with title, summary, source, timestamp, and original link.</p>
          </div>
        </section>
        <AdminTable headers={['Article', 'Type', 'Status', 'Author', 'Scheduled', 'Actions']}>
          {originalArticles.slice(0, 80).map((article) => (
            <tr key={article.id}>
              <td><b>{article.title}</b><small>/article/{article.slug} · {article.dek || 'No dek yet'}</small></td>
              <td>{article.content_type}{article.opinion_label ? ' · opinion label' : ''}</td>
              <td>{article.status}</td>
              <td>{article.author_slug || '-'}</td>
              <td>{localDate(article.scheduled_at || article.published_at || article.updated_at)}</td>
              <td className="adminActions">
                <button onClick={() => updateOriginalArticleStatus(article, 'review')}>Review</button>
                <button onClick={() => updateOriginalArticleStatus(article, 'scheduled')}>Schedule</button>
                <button onClick={() => updateOriginalArticleStatus(article, 'published')}>Publish</button>
                <button className="dangerAction" onClick={() => deleteRow('original_articles', article.id, article.title)}>Delete</button>
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPanel>

      <AdminPanel title="Correction Reports">
        <AdminTable headers={['Story', 'Source', 'Issue', 'Status', 'Time', 'Actions']}>
          {correctionReports.map((report) => (
            <tr key={report.id}>
              <td><b>{report.article_title || 'Untitled story'}</b><small>{report.article_link}</small></td>
              <td>{report.article_source || '-'}</td>
              <td>{report.details || report.issue_type}</td>
              <td>{report.status}</td>
              <td>{localDate(report.created_at)}</td>
              <td className="adminActions">
                <button onClick={() => toggleCorrectionStatus(report)}>{report.status === 'reviewed' ? 'Reopen' : 'Mark reviewed'}</button>
                <button className="dangerAction" onClick={() => deleteRow('correction_reports', report.id, report.article_title || 'correction report')}>Delete</button>
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPanel>

      <AdminPanel title="AI Summary Controls">
        <div className="adminToolbar">
          <label><input type="checkbox" checked={aiSettings.enabled !== false} onChange={(event) => setAiSettings({ ...aiSettings, enabled: event.target.checked })} /> Enable AI summaries</label>
          <label><input type="checkbox" checked={aiSettings.simple_brief_enabled !== false} onChange={(event) => setAiSettings({ ...aiSettings, simple_brief_enabled: event.target.checked })} /> Explain simply</label>
          <label><input type="checkbox" checked={aiSettings.comparison_enabled !== false} onChange={(event) => setAiSettings({ ...aiSettings, comparison_enabled: event.target.checked })} /> Source comparison</label>
          <button className="primaryAction" onClick={saveAiSettings}>Save AI settings</button>
        </div>
        <div className="preferenceChips">
          {aiCategoryOptions.map((category) => (
            <button
              key={category}
              type="button"
              className={(aiSettings.categories || []).includes(category) ? 'active' : ''}
              onClick={() => toggleAiCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <p className="adminHint">AI summaries use only RSS title, summary, source metadata, timestamps, and publisher links. No invented facts.</p>
      </AdminPanel>

      <section className="adminGrid twoColumn">
        <AdminPanel title="Analytics Dashboard">
          <MetricRow label="Page views" value={analytics.filter((event) => event.event_name === 'page_view').length} />
          <MetricRow label="Searches" value={analytics.filter((event) => event.event_name === 'search').length} />
          <MetricRow label="Saved articles" value={overview.savedCount || 0} />
          <h4>Top categories</h4>
          {topCategories.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Search queries</h4>
          {searchQueries.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Most viewed stories</h4>
          {mostViewedStories.map(([key, count]) => <MetricRow key={key} label={key.slice(0, 28)} value={count} />)}
        </AdminPanel>

        <AdminPanel title="SEO Monitoring">
          <MetricRow label="Indexed pages" value="Check Search Console" />
          <MetricRow label="Sitemap status" value="306 static URLs + live news sitemap" />
          <MetricRow label="CTR tracking" value={seoCtr} />
          <MetricRow label="News sitemap" value="/news-sitemap.xml" />
          <h4>Top pages</h4>
          {topPages.map(([key, count]) => <MetricRow key={key} label={key.replace('https://nuzenio.com', '')} value={count} />)}
          <h4>Search queries</h4>
          {searchQueries.slice(0, 6).map(([key, count]) => <MetricRow key={`seo-${key}`} label={key} value={count} />)}
        </AdminPanel>
      </section>

      <section className="adminGrid twoColumn">
        <AdminPanel title="User Management">
          <MetricRow label="Total users" value={overview.userCount || 0} />
          <MetricRow label="Saved articles" value={overview.savedCount || 0} />
          <MetricRow label="Reading history rows" value={overview.historyCount || 0} />
          <MetricRow label="Newsletter subscribers" value={overview.newsletterCount || 0} />
          <MetricRow label="User preferences" value={overview.preferencesCount || 0} />
          <MetricRow label="Digest logs" value={overview.digestLogCount || 0} />
          <h4>Latest subscribers</h4>
          {newsletters.slice(0, 10).map((item) => <MetricRow key={item.email} label={`${item.email} · ${item.frequency || 'daily'} · ${item.country || 'IN'}`} value={item.status} />)}
        </AdminPanel>
      </section>

      <section className="adminGrid twoColumn">
        <AdminPanel title="AdSense Slots">
          <form className="adminForm stacked" onSubmit={saveAdSlot}>
            <input value={adForm.slot_key} onChange={(event) => setAdForm({ ...adForm, slot_key: event.target.value })} placeholder="Slot key" required />
            <input value={adForm.placement} onChange={(event) => setAdForm({ ...adForm, placement: event.target.value })} placeholder="Placement" required />
            <input value={adForm.format} onChange={(event) => setAdForm({ ...adForm, format: event.target.value })} placeholder="Format" required />
            <input value={adForm.notes} onChange={(event) => setAdForm({ ...adForm, notes: event.target.value })} placeholder="Notes" />
            <label><input type="checkbox" checked={adForm.enabled} onChange={(event) => setAdForm({ ...adForm, enabled: event.target.checked })} /> Enabled</label>
            <button className="primaryAction">Save ad slot</button>
          </form>
          <AdminTable headers={['Slot', 'Placement', 'Format', 'Status', 'Actions']}>
            {adSlots.map((slot) => (
              <tr key={slot.id}>
                <td><b>{slot.slot_key}</b><small>{slot.notes || 'Reserved inventory'}</small></td>
                <td>{slot.placement || 'site'}</td>
                <td>{slot.format}</td>
                <td>{slot.enabled ? 'Enabled' : 'Disabled'}</td>
                <td className="adminActions">
                  <button onClick={() => toggleRow('adsense_slots', slot)}>{slot.enabled ? 'Disable' : 'Enable'}</button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>

        <AdminPanel title="Affiliate Blocks">
          <form className="adminForm stacked" onSubmit={saveAffiliate}>
            <input value={affiliateForm.title} onChange={(event) => setAffiliateForm({ ...affiliateForm, title: event.target.value })} placeholder="Affiliate title" required />
            <input value={affiliateForm.destination_url} onChange={(event) => setAffiliateForm({ ...affiliateForm, destination_url: event.target.value })} placeholder="Destination URL" type="url" required />
            <input value={affiliateForm.category} onChange={(event) => setAffiliateForm({ ...affiliateForm, category: event.target.value })} placeholder="Category" />
            <input value={affiliateForm.network} onChange={(event) => setAffiliateForm({ ...affiliateForm, network: event.target.value })} placeholder="Network, e.g. Amazon Associates" />
            <input value={affiliateForm.image_url} onChange={(event) => setAffiliateForm({ ...affiliateForm, image_url: event.target.value })} placeholder="Image URL" type="url" />
            <input value={affiliateForm.disclosure} onChange={(event) => setAffiliateForm({ ...affiliateForm, disclosure: event.target.value })} placeholder="Disclosure" />
            <label><input type="checkbox" checked={affiliateForm.enabled} onChange={(event) => setAffiliateForm({ ...affiliateForm, enabled: event.target.checked })} /> Enabled</label>
            <button className="primaryAction">Add affiliate block</button>
          </form>
          <AdminTable headers={['Affiliate', 'Category', 'Network', 'Status', 'Actions']}>
            {affiliates.map((item) => (
              <tr key={item.id}>
                <td><b>{item.title}</b><small>{item.destination_url}</small></td>
                <td>{item.category}</td>
                <td>{item.network || 'direct'}</td>
                <td>{item.enabled ? 'Enabled' : 'Disabled'}</td>
                <td className="adminActions">
                  <button onClick={() => toggleRow('affiliate_links', item)}>{item.enabled ? 'Disable' : 'Enable'}</button>
                  <button className="dangerAction" onClick={() => deleteRow('affiliate_links', item.id, item.title)}>Delete</button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>
      </section>

      <AdminPanel title="Sponsored Content Blocks">
        <form className="adminForm" onSubmit={saveSponsored}>
          <input value={sponsoredForm.title} onChange={(event) => setSponsoredForm({ ...sponsoredForm, title: event.target.value })} placeholder="Sponsored title" required />
          <input value={sponsoredForm.sponsor_name} onChange={(event) => setSponsoredForm({ ...sponsoredForm, sponsor_name: event.target.value })} placeholder="Sponsor name" required />
          <input value={sponsoredForm.destination_url} onChange={(event) => setSponsoredForm({ ...sponsoredForm, destination_url: event.target.value })} placeholder="Destination URL" type="url" required />
          <input value={sponsoredForm.category} onChange={(event) => setSponsoredForm({ ...sponsoredForm, category: event.target.value })} placeholder="Category or all" />
          <select value={sponsoredForm.placement} onChange={(event) => setSponsoredForm({ ...sponsoredForm, placement: event.target.value })}>
            <option value="sidebar">Sidebar</option>
            <option value="feed">In-feed</option>
            <option value="article">Article</option>
          </select>
          <input value={sponsoredForm.image_url} onChange={(event) => setSponsoredForm({ ...sponsoredForm, image_url: event.target.value })} placeholder="Image URL" type="url" />
          <input value={sponsoredForm.label} onChange={(event) => setSponsoredForm({ ...sponsoredForm, label: event.target.value })} placeholder="Label" />
          <input value={sponsoredForm.disclosure} onChange={(event) => setSponsoredForm({ ...sponsoredForm, disclosure: event.target.value })} placeholder="Disclosure" />
          <input value={sponsoredForm.start_at} onChange={(event) => setSponsoredForm({ ...sponsoredForm, start_at: event.target.value })} type="datetime-local" aria-label="Campaign start date" />
          <input value={sponsoredForm.end_at} onChange={(event) => setSponsoredForm({ ...sponsoredForm, end_at: event.target.value })} type="datetime-local" aria-label="Campaign end date" />
          <label><input type="checkbox" checked={sponsoredForm.enabled} onChange={(event) => setSponsoredForm({ ...sponsoredForm, enabled: event.target.checked })} /> Enabled</label>
          <button className="primaryAction">Add sponsored block</button>
        </form>
        <AdminTable headers={['Campaign', 'Category', 'Placement', 'Window', 'Status', 'Actions']}>
          {sponsoredBlocks.map((item) => (
            <tr key={item.id}>
              <td><b>{item.title}</b><small>{item.sponsor_name} · {item.destination_url}</small></td>
              <td>{item.category}</td>
              <td>{item.placement}</td>
              <td>{localDate(item.start_at)} to {localDate(item.end_at)}</td>
              <td>{item.enabled ? 'Enabled' : 'Disabled'}</td>
              <td className="adminActions">
                <button onClick={() => toggleRow('sponsored_blocks', item)}>{item.enabled ? 'Disable' : 'Enable'}</button>
                <button className="dangerAction" onClick={() => deleteRow('sponsored_blocks', item.id, item.title)}>Delete</button>
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPanel>

      <AdminPanel title="Security Audit Logs">
        <AdminTable headers={['Action', 'Status', 'Target', 'Message', 'Time']}>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.action}</td>
              <td>{log.status}</td>
              <td>{log.target_table || '-'} {log.target_id || ''}</td>
              <td>{log.message || '-'}</td>
              <td>{localDate(log.created_at)}</td>
            </tr>
          ))}
        </AdminTable>
      </AdminPanel>
    </AdminShell>
  );
}

function AdminShell({ children, onBack }) {
  return (
    <main id="main-content" className="adminMain" tabIndex="-1">
      <button className="adminBack" onClick={onBack}><ArrowLeft size={16} /> Back to Nuzenio</button>
      {children}
    </main>
  );
}

function AdminGate({ title, message, children }) {
  return (
    <section className="adminGate">
      <ShieldCheck size={32} />
      <h1>{title}</h1>
      <p>{message}</p>
      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="statCard">
      <Icon size={20} />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function AdminPanel({ title, children }) {
  return (
    <section className="adminPanel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="metricRow">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function AdminTable({ headers, children }) {
  return (
    <div className="adminTableWrap">
      <table className="adminTable">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
