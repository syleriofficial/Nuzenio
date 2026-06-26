import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, BarChart3, BriefcaseBusiness, Database, Edit3, Eye, Globe2, LogIn, Megaphone, RefreshCw, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';

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
  const [profiles, setProfiles] = useState([]);
  const [sources, setSources] = useState([]);
  const [cacheRows, setCacheRows] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [adSlots, setAdSlots] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [sponsoredBlocks, setSponsoredBlocks] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [journalists, setJournalists] = useState([]);
  const [originalArticles, setOriginalArticles] = useState([]);
  const [followSignals, setFollowSignals] = useState({ topics: [], entities: [], sources: [], authors: [] });
  const [recommendationLogs, setRecommendationLogs] = useState([]);
  const [aiBriefs, setAiBriefs] = useState([]);
  const [graphEntities, setGraphEntities] = useState([]);
  const [storyClusters, setStoryClusters] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [apiUsageLogs, setApiUsageLogs] = useState([]);
  const [correctionReports, setCorrectionReports] = useState([]);
  const [trends, setTrends] = useState([]);
  const [trendSnapshots, setTrendSnapshots] = useState([]);
  const [sentimentScores, setSentimentScores] = useState([]);
  const [entityMetrics, setEntityMetrics] = useState([]);
  const [publisherMetrics, setPublisherMetrics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [sharedDashboards, setSharedDashboards] = useState([]);
  const [dashboardExports, setDashboardExports] = useState([]);
  const [publisherAccounts, setPublisherAccounts] = useState([]);
  const [feedSubmissions, setFeedSubmissions] = useState([]);
  const [crawlLogs, setCrawlLogs] = useState([]);
  const [backgroundJobs, setBackgroundJobs] = useState([]);
  const [journalistAccounts, setJournalistAccounts] = useState([]);
  const [researchReports, setResearchReports] = useState([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [enterpriseAccounts, setEnterpriseAccounts] = useState([]);
  const [integrationConnections, setIntegrationConnections] = useState([]);
  const [aiResearchQueries, setAiResearchQueries] = useState([]);
  const [aiSettings, setAiSettings] = useState(defaultAiSettings);
  const [newsletters, setNewsletters] = useState([]);
  const [logs, setLogs] = useState([]);
  const [sourceForm, setSourceForm] = useState(emptySource);
  const [editingSourceId, setEditingSourceId] = useState('');
  const [adForm, setAdForm] = useState(emptyAdSlot);
  const [affiliateForm, setAffiliateForm] = useState(emptyAffiliate);
  const [sponsoredForm, setSponsoredForm] = useState(emptySponsored);
  const [originalForm, setOriginalForm] = useState(emptyOriginalArticle);
  const [cacheRefresh, setCacheRefresh] = useState({ category: 'top', country: 'US' });

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
  const mostFollowedTopics = useMemo(() => topEntries(groupCount(followSignals.topics, 'topic'), 8), [followSignals]);
  const mostFollowedSources = useMemo(() => topEntries(groupCount(followSignals.sources, 'source'), 8), [followSignals]);
  const mostFollowedEntities = useMemo(() => topEntries(groupCount(followSignals.entities, 'entity'), 8), [followSignals]);
  const recommendationCategories = useMemo(() => topEntries(groupCount(recommendationLogs, 'category'), 8), [recommendationLogs]);
  const entitiesByType = useMemo(() => topEntries(groupCount(graphEntities, 'entity_type'), 8), [graphEntities]);
  const clustersByTopic = useMemo(() => topEntries(groupCount(storyClusters, 'topic'), 8), [storyClusters]);
  const apiUsageByEndpoint = useMemo(() => topEntries(groupCount(apiUsageLogs, 'endpoint'), 8), [apiUsageLogs]);
  const trendsByStatus = useMemo(() => topEntries(groupCount(trends, 'status'), 8), [trends]);
  const sentimentByLabel = useMemo(() => topEntries(groupCount(sentimentScores, 'sentiment_label'), 8), [sentimentScores]);
  const alertsByType = useMemo(() => topEntries(groupCount(alerts, 'alert_type'), 8), [alerts]);
  const publisherAccountStatuses = useMemo(() => topEntries(groupCount(publisherAccounts, 'verification_status'), 8), [publisherAccounts]);
  const feedSubmissionStatuses = useMemo(() => topEntries(groupCount(feedSubmissions, 'status'), 8), [feedSubmissions]);
  const sourceHealthStatuses = useMemo(() => topEntries(groupCount(sources, 'health_status'), 8), [sources]);
  const crawlJobStatuses = useMemo(() => topEntries(groupCount(backgroundJobs, 'status'), 8), [backgroundJobs]);
  const journalistAccountStatuses = useMemo(() => topEntries(groupCount(journalistAccounts, 'verification_status'), 8), [journalistAccounts]);
  const marketplaceByType = useMemo(() => topEntries(groupCount(marketplaceProducts, 'product_type'), 8), [marketplaceProducts]);
  const enterpriseByPlan = useMemo(() => topEntries(groupCount(enterpriseAccounts, 'plan'), 8), [enterpriseAccounts]);
  const integrationsByType = useMemo(() => topEntries(groupCount(integrationConnections, 'integration_type'), 8), [integrationConnections]);

  useEffect(() => {
    loadAdmin();
  }, [supabase, user?.id]);

  async function countRows(table, configure = (query) => query) {
    if (!supabase) return 0;
    const query = configure(supabase.from(table).select('*', { count: 'exact', head: true }));
    const { count } = await query.catch(() => ({ count: 0 }));
    return count || 0;
  }

  async function safeQuery(query, fallback = []) {
    const result = await query.catch((error) => ({ data: fallback, error }));
    if (result.error) return { data: fallback, error: null };
    return result;
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
        profileResult,
        cacheResult,
        analyticsResult,
        adResult,
        affiliateResult,
        sponsoredResult,
        publisherResult,
        journalistResult,
        originalResult,
        followedTopicResult,
        followedEntityResult,
        followedSourceResult,
        followedAuthorResult,
        recommendationResult,
        aiBriefResult,
        graphEntityResult,
        storyClusterResult,
        apiKeyResult,
        apiUsageResult,
        correctionResult,
        aiSettingsResult,
        newsletterResult,
        logResult,
        trendResult,
        trendSnapshotResult,
        sentimentResult,
        entityMetricResult,
        publisherMetricResult,
        alertResult,
        savedReportResult,
        sharedDashboardResult,
        dashboardExportResult,
        publisherAccountResult,
        feedSubmissionResult,
        crawlLogResult,
        backgroundJobResult,
        journalistAccountResult,
        researchReportResult,
        marketplaceProductResult,
        enterpriseAccountResult,
        integrationResult,
        aiResearchResult,
        articleCount,
        userCount,
        savedCount,
        historyCount,
        newsletterCount,
        preferencesCount,
        digestLogCount,
        interestCount,
        followedTopicCount,
        followedEntityCount,
        followedSourceCount,
        followedAuthorCount,
        recommendationCount,
        aiBriefCount,
        entityCount,
        relationshipCount,
        storyClusterCount,
        storyTimelineCount,
        apiKeyCount,
        apiUsageCount,
        trendCount,
        sentimentCount,
        entityMetricCount,
        publisherMetricCount,
        alertCount,
        savedReportCount,
        sharedDashboardCount,
        dashboardExportCount,
        publisherAccountCount,
        feedSubmissionCount,
        crawlLogCount,
        crawlQueueCount,
        journalistAccountCount,
        researchReportCount,
        marketplaceProductCount,
        enterpriseAccountCount,
        integrationCount,
        aiResearchCount,
      ] = await Promise.all([
        supabase.from('rss_sources').select('*').order('priority', { ascending: false }).order('updated_at', { ascending: false }),
        supabase.from('profiles').select('id,email,full_name,role,created_at,updated_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('news_cache').select('id,article_id,title,link,source,category,country,published_at,updated_at').order('published_at', { ascending: false }).limit(250),
        supabase.from('analytics_events').select('event_name,article_id,category,metadata,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('adsense_slots').select('*').order('updated_at', { ascending: false }),
        supabase.from('affiliate_links').select('*').order('updated_at', { ascending: false }),
        supabase.from('sponsored_blocks').select('*').order('updated_at', { ascending: false }),
        supabase.from('publisher_profiles').select('*').order('updated_at', { ascending: false }),
        supabase.from('journalist_profiles').select('*').order('updated_at', { ascending: false }),
        supabase.from('original_articles').select('*').order('updated_at', { ascending: false }).limit(120),
        supabase.from('followed_topics').select('topic,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('followed_entities').select('entity,entity_type,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('followed_sources').select('source,source_slug,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('followed_authors').select('author_slug,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('recommendation_logs').select('article_id,title,source,category,score,reason,algorithm,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('ai_briefs').select('brief_type,country,categories,status,created_at,sent_at').order('created_at', { ascending: false }).limit(120),
        supabase.from('entities').select('slug,name,entity_type,country,confidence,updated_at').order('updated_at', { ascending: false }).limit(200),
        supabase.from('story_clusters').select('cluster_id,title,topic,country,cluster_size,trending_score,updated_at').order('trending_score', { ascending: false }).limit(120),
        supabase.from('api_keys').select('id,name,key_prefix,plan,quota_per_day,rate_limit_per_minute,enabled,last_used_at,created_at').order('created_at', { ascending: false }).limit(80),
        supabase.from('api_usage_logs').select('api_key_prefix,endpoint,method,status_code,units,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('correction_reports').select('*').order('created_at', { ascending: false }).limit(80),
        supabase.from('ai_settings').select('*').eq('key', 'global').maybeSingle(),
        supabase.from('newsletter_subscribers').select('email,status,language,frequency,country,created_at,confirmed_at,unsubscribed_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50),
        safeQuery(supabase.from('trends').select('trend_id,topic,category,country,momentum_score,status,volume,source_count,last_seen_at').order('momentum_score', { ascending: false }).limit(80)),
        safeQuery(supabase.from('trend_snapshots').select('trend_id,volume,momentum_score,snapshot_at').order('snapshot_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('sentiment_scores').select('article_id,entity_slug,sentiment_label,sentiment_score,confidence,created_at').order('created_at', { ascending: false }).limit(120)),
        safeQuery(supabase.from('entity_metrics').select('entity_slug,entity_name,entity_type,country,mention_count,momentum_score,sentiment_score,measured_at').order('momentum_score', { ascending: false }).limit(120)),
        safeQuery(supabase.from('publisher_metrics').select('publisher_slug,publisher_name,country,story_count,average_freshness_minutes,source_diversity_score,measured_at').order('story_count', { ascending: false }).limit(80)),
        safeQuery(supabase.from('alerts').select('id,alert_type,query,enabled,frequency,created_at,last_triggered_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('saved_reports').select('id,title,report_type,shared,created_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('shared_dashboards').select('id,name,organization_name,access_level,created_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('dashboard_exports').select('id,export_type,status,file_url,created_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('publisher_accounts').select('id,publisher_name,contact_email,country,verification_status,verification_notes,website_url,metadata,created_at,updated_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('feed_submissions').select('id,publisher_name,feed_url,category,country,language,status,test_result,submitted_by_email,created_at,updated_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('rss_crawl_logs').select('id,source_id,job_id,status,feed_url,http_status,duration_ms,item_count,inserted_count,duplicate_count,error_message,created_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('background_jobs').select('id,job_type,status,priority,payload,attempts,max_attempts,scheduled_at,started_at,finished_at,last_error,updated_at').eq('job_type', 'rss_ingestion').order('scheduled_at', { ascending: true }).limit(80)),
        safeQuery(supabase.from('journalist_accounts').select('id,full_name,email,publisher_name,verification_status,badge_label,portfolio_url,created_at,updated_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('research_reports').select('id,slug,title,topic,report_type,access_level,status,published_at,updated_at').order('updated_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('marketplace_products').select('id,slug,title,product_type,access_level,status,price_cents,currency,updated_at').order('updated_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('enterprise_accounts').select('id,organization_name,contact_email,plan,status,seats,created_at,updated_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('integration_connections').select('id,integration_type,name,status,last_delivery_at,created_at,updated_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery(supabase.from('ai_research_queries').select('id,query,mode,status,created_at,updated_at').order('created_at', { ascending: false }).limit(80)),
        countRows('news_cache'),
        countRows('profiles'),
        countRows('saved_articles'),
        countRows('reading_history'),
        countRows('newsletter_subscribers'),
        countRows('user_preferences'),
        countRows('email_digest_logs'),
        countRows('user_interests'),
        countRows('followed_topics'),
        countRows('followed_entities'),
        countRows('followed_sources'),
        countRows('followed_authors'),
        countRows('recommendation_logs'),
        countRows('ai_briefs'),
        countRows('entities'),
        countRows('entity_relationships'),
        countRows('story_clusters'),
        countRows('story_timelines'),
        countRows('api_keys'),
        countRows('api_usage_logs'),
        countRows('trends'),
        countRows('sentiment_scores'),
        countRows('entity_metrics'),
        countRows('publisher_metrics'),
        countRows('alerts'),
        countRows('saved_reports'),
        countRows('shared_dashboards'),
        countRows('dashboard_exports'),
        countRows('publisher_accounts'),
        countRows('feed_submissions'),
        countRows('rss_crawl_logs'),
        countRows('background_jobs', (query) => query.eq('job_type', 'rss_ingestion')),
        countRows('journalist_accounts'),
        countRows('research_reports'),
        countRows('marketplace_products'),
        countRows('enterprise_accounts'),
        countRows('integration_connections'),
        countRows('ai_research_queries'),
      ]);

      if (sourceResult.error) throw sourceResult.error;
      if (profileResult.error) throw profileResult.error;
      if (publisherResult.error) throw publisherResult.error;
      if (journalistResult.error) throw journalistResult.error;
      if (originalResult.error) throw originalResult.error;
      if (followedTopicResult.error) throw followedTopicResult.error;
      if (followedEntityResult.error) throw followedEntityResult.error;
      if (followedSourceResult.error) throw followedSourceResult.error;
      if (followedAuthorResult.error) throw followedAuthorResult.error;
      if (recommendationResult.error) throw recommendationResult.error;
      if (aiBriefResult.error) throw aiBriefResult.error;
      if (graphEntityResult.error) throw graphEntityResult.error;
      if (storyClusterResult.error) throw storyClusterResult.error;
      if (apiKeyResult.error) throw apiKeyResult.error;
      if (apiUsageResult.error) throw apiUsageResult.error;
      setSources(sourceResult.data || []);
      setProfiles(profileResult.data || []);
      setCacheRows(cacheResult.data || []);
      setAnalytics(analyticsResult.data || []);
      setAdSlots(adResult.data || []);
      setAffiliates(affiliateResult.data || []);
      setSponsoredBlocks(sponsoredResult.data || []);
      setPublishers(publisherResult.data || []);
      setJournalists(journalistResult.data || []);
      setOriginalArticles(originalResult.data || []);
      setFollowSignals({
        topics: followedTopicResult.data || [],
        entities: followedEntityResult.data || [],
        sources: followedSourceResult.data || [],
        authors: followedAuthorResult.data || [],
      });
      setRecommendationLogs(recommendationResult.data || []);
      setAiBriefs(aiBriefResult.data || []);
      setGraphEntities(graphEntityResult.data || []);
      setStoryClusters(storyClusterResult.data || []);
      setApiKeys(apiKeyResult.data || []);
      setApiUsageLogs(apiUsageResult.data || []);
      setCorrectionReports(correctionResult.data || []);
      setTrends(trendResult.data || []);
      setTrendSnapshots(trendSnapshotResult.data || []);
      setSentimentScores(sentimentResult.data || []);
      setEntityMetrics(entityMetricResult.data || []);
      setPublisherMetrics(publisherMetricResult.data || []);
      setAlerts(alertResult.data || []);
      setSavedReports(savedReportResult.data || []);
      setSharedDashboards(sharedDashboardResult.data || []);
      setDashboardExports(dashboardExportResult.data || []);
      setPublisherAccounts(publisherAccountResult.data || []);
      setFeedSubmissions(feedSubmissionResult.data || []);
      setCrawlLogs(crawlLogResult.data || []);
      setBackgroundJobs(backgroundJobResult.data || []);
      setJournalistAccounts(journalistAccountResult.data || []);
      setResearchReports(researchReportResult.data || []);
      setMarketplaceProducts(marketplaceProductResult.data || []);
      setEnterpriseAccounts(enterpriseAccountResult.data || []);
      setIntegrationConnections(integrationResult.data || []);
      setAiResearchQueries(aiResearchResult.data || []);
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
        interestCount,
        followedTopicCount,
        followedEntityCount,
        followedSourceCount,
        followedAuthorCount,
        recommendationCount,
        aiBriefCount,
        entityCount,
        relationshipCount,
        storyClusterCount,
        storyTimelineCount,
        apiKeyCount,
        apiUsageCount,
        trendCount,
        sentimentCount,
        entityMetricCount,
        publisherMetricCount,
        alertCount,
        savedReportCount,
        sharedDashboardCount,
        dashboardExportCount,
        publisherAccountCount,
        feedSubmissionCount,
        crawlLogCount,
        crawlQueueCount,
        journalistAccountCount,
        researchReportCount,
        marketplaceProductCount,
        enterpriseAccountCount,
        integrationCount,
        aiResearchCount,
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
      body: JSON.stringify({ url: source.url, name: source.name, id: source.id, submissionId: source.submissionId }),
    });
    const data = await response.json();
    const quality = data.qualityScore == null ? '' : ` · quality ${data.qualityScore}/100`;
    const trust = data.qualitySignals?.trustScore == null ? '' : ` · trust ${data.qualitySignals.trustScore}/100`;
    const duplicate = data.duplicate ? ` · duplicate: ${data.duplicate.name || data.duplicate.url}` : '';
    const newest = data.newestPublishedAt ? ` · newest ${localDate(data.newestPublishedAt)}` : '';
    const risk = data.qualitySignals?.approvalRisk ? ` · risk ${data.qualitySignals.approvalRisk}` : '';
    setNotice(data.ok ? `RSS test passed: ${data.itemCount} items found from ${data.feedTitle || source.name || 'source'}${quality}${trust}${newest}${risk}${duplicate}.` : `RSS test failed: ${data.error}`);
    await logAdmin('rss_source_test', data.ok ? 'ok' : 'error', { table: 'rss_sources', id: source.id || source.url, message: data.error || data.feedTitle || '' });
    return data;
  }

  async function updateFeedSubmissionStatus(submission, status, message = '', testResult = null) {
    const payload = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (testResult) payload.test_result = testResult;
    const result = await supabase
      .from('feed_submissions')
      .update(payload)
      .eq('id', submission.id);
    const error = result.error && /test_result|column/i.test(result.error.message || '') && testResult
      ? (await supabase.from('feed_submissions').update({ status, updated_at: payload.updated_at }).eq('id', submission.id)).error
      : result.error;
    if (error) {
      setNotice(error.message);
      await logAdmin('feed_submission_status', 'error', { table: 'feed_submissions', id: submission.id, message: error.message });
      return false;
    }
    await logAdmin('feed_submission_status', 'ok', { table: 'feed_submissions', id: submission.id, message: message || status });
    return true;
  }

  async function testSubmittedFeed(submission) {
    const data = await testSource({
      id: submission.id,
      name: submission.publisher_name,
      url: submission.feed_url,
      submissionId: submission.id,
    });
    if (data?.ok) {
      await updateFeedSubmissionStatus(submission, 'testing', `${data.itemCount || 0} items found`, data);
      loadAdmin();
    }
  }

  async function insertApprovedSource(payload) {
    const enrichedPayload = {
      ...payload,
      status: 'approved',
      health_status: 'unknown',
      last_error: null,
    };
    const result = await supabase.from('rss_sources').insert(enrichedPayload);
    if (!result.error) return result;
    if (!/status|health_status|last_error|column/i.test(result.error.message || '')) return result;
    return supabase.from('rss_sources').insert(payload);
  }

  async function approveFeedSubmission(submission) {
    setNotice('Checking submitted RSS source before approval...');
    const duplicateCheck = await supabase
      .from('rss_sources')
      .select('id,name,url')
      .eq('url', submission.feed_url)
      .maybeSingle();
    if (duplicateCheck.error && duplicateCheck.error.code !== 'PGRST116') {
      setNotice(duplicateCheck.error.message);
      await logAdmin('feed_submission_duplicate_check', 'error', { table: 'rss_sources', id: submission.feed_url, message: duplicateCheck.error.message });
      return;
    }
    if (duplicateCheck.data) {
      await updateFeedSubmissionStatus(submission, 'approved', `Already exists as ${duplicateCheck.data.name}`);
      setNotice(`${submission.publisher_name} already exists in RSS sources. Submission marked approved.`);
      loadAdmin();
      return;
    }

    const testResult = await testSource({
      id: submission.id,
      name: submission.publisher_name,
      url: submission.feed_url,
      submissionId: submission.id,
    });
    if (!testResult?.ok) return;
    if (testResult.duplicate) {
      await updateFeedSubmissionStatus(submission, 'rejected', `Duplicate feed: ${testResult.duplicate.name || testResult.duplicate.url}`, testResult);
      setNotice(`${submission.publisher_name || 'Submitted feed'} is a duplicate of ${testResult.duplicate.name || testResult.duplicate.url}.`);
      loadAdmin();
      return;
    }
    if (testResult.qualitySignals?.approvalRisk === 'high') {
      await updateFeedSubmissionStatus(submission, 'testing', 'High-risk feed requires manual review', testResult);
      setNotice(`${submission.publisher_name || 'Submitted feed'} needs manual review before approval: ${testResult.qualitySignals.spamRisk} spam risk, ${testResult.qualitySignals.copyrightSignal} copyright signal.`);
      loadAdmin();
      return;
    }

    const payload = {
      name: submission.publisher_name || testResult.feedTitle || 'Approved publisher',
      url: submission.feed_url,
      country: String(submission.country || 'GLOBAL').toUpperCase(),
      language: submission.language || 'en',
      category: submission.category || 'top',
      priority: 10,
      enabled: true,
    };
    const insertResult = await insertApprovedSource(payload);
    if (insertResult.error) {
      setNotice(insertResult.error.message);
      await logAdmin('feed_submission_approve', 'error', { table: 'rss_sources', id: submission.feed_url, message: insertResult.error.message });
      return;
    }
    await updateFeedSubmissionStatus(submission, 'approved', 'Approved and added to rss_sources');
    setNotice(`${payload.name} approved and added to RSS Source Manager.`);
    loadAdmin();
  }

  async function rejectFeedSubmission(submission) {
    if (!window.confirm(`Reject ${submission.publisher_name || submission.feed_url}?`)) return;
    const ok = await updateFeedSubmissionStatus(submission, 'rejected', 'Rejected by admin');
    if (ok) {
      setNotice(`${submission.publisher_name || 'Source'} rejected.`);
      loadAdmin();
    }
  }

  async function runCrawler(action = 'run', sourceId = '') {
    setNotice(action === 'enqueue' ? 'Adding due RSS sources to crawl queue...' : 'Running RSS crawler...');
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/rss-crawler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
      },
      body: JSON.stringify({ action: sourceId ? 'source' : action, sourceId, limit: 8 }),
    });
    const data = await response.json();
    const ok = data.ok !== false;
    const message = sourceId
      ? `${data.result?.sourceName || 'Source'} crawled: ${data.result?.insertedCount || 0} new, ${data.result?.duplicateCount || 0} duplicate.`
      : action === 'enqueue'
        ? `Crawler queue: ${data.enqueuedCount || 0} sources enqueued, ${data.skippedCount || 0} skipped.`
        : `Crawler run: ${data.queue?.claimedCount || 0} jobs processed.`;
    setNotice(ok ? message : `Crawler failed: ${data.error}`);
    await logAdmin(`rss_crawler_${sourceId ? 'source' : action}`, ok ? 'ok' : 'error', { table: 'rss_sources', id: sourceId || action, message: data.error || message });
    loadAdmin();
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
      setNotice('No duplicate cached articles found in the latest cache view.');
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

  async function updateUserRole(targetProfile, role) {
    if (targetProfile.id === user.id && role !== 'admin') {
      setNotice('You cannot remove your own admin role from the dashboard.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', targetProfile.id);
    if (error) {
      setNotice(error.message);
      await logAdmin('profile_role_update', 'error', { table: 'profiles', id: targetProfile.id, message: error.message });
      return;
    }
    setNotice(`${targetProfile.email || targetProfile.id} role updated to ${role}.`);
    await logAdmin('profile_role_update', 'ok', { table: 'profiles', id: targetProfile.id, message: role });
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
        <AdminGate title="Admin Google login" message="Use the same Nuzenio Google account. After login, admin users return directly to this dashboard.">
          <button className="primaryAction" onClick={onLogin}><LogIn size={16} /> Continue with Google</button>
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

  const showAdvancedRoadmapPanels = false;

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
        <StatCard icon={Activity} label="Recent errors" value={logs.filter((log) => log.status === 'error').length} />
      </section>

      <section className="adminGrid twoColumn">
        <AdminPanel title="RSS Crawling Engine">
          <div className="adminToolbar">
            <button onClick={() => runCrawler('enqueue')}><RefreshCw size={15} /> Enqueue due sources</button>
            <button className="primaryAction" onClick={() => runCrawler('run')}><Activity size={15} /> Run crawler now</button>
          </div>
          <MetricRow label="Crawl jobs" value={overview.crawlQueueCount || 0} />
          <MetricRow label="Crawl logs" value={overview.crawlLogCount || 0} />
          <h4>Source health</h4>
          {sourceHealthStatuses.length ? sourceHealthStatuses.map(([key, count]) => <MetricRow key={key} label={key || 'unknown'} value={count} />) : <MetricRow label="No health data yet" value="Run crawler" />}
          <h4>Queue status</h4>
          {crawlJobStatuses.length ? crawlJobStatuses.map(([key, count]) => <MetricRow key={key} label={key} value={count} />) : <MetricRow label="No queue jobs yet" value="Ready" />}
          <p className="adminHint">Crawler stores title, short RSS summary, source, timestamp, original link, AI-safe tags, and deduplicated article IDs. Full publisher articles are not copied.</p>
        </AdminPanel>

        <AdminPanel title="Recent Crawl Logs">
          <AdminTable headers={['Source', 'Status', 'Items', 'New', 'Duplicates', 'Time']}>
            {crawlLogs.slice(0, 12).map((log) => (
              <tr key={log.id}>
                <td><b>{sources.find((source) => source.id === log.source_id)?.name || 'RSS source'}</b><small>{log.error_message || log.feed_url}</small></td>
                <td>{log.status}</td>
                <td>{log.item_count || 0}</td>
                <td>{log.inserted_count || 0}</td>
                <td>{log.duplicate_count || 0}</td>
                <td>{localDate(log.created_at)}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>
      </section>

      <section className="adminGrid twoColumn">
        <AdminPanel title="Source Review Queue">
          <MetricRow label="Feed submissions" value={overview.feedSubmissionCount || feedSubmissions.length || 0} />
          <MetricRow label="Ready for review" value={feedSubmissions.filter((item) => !['approved', 'rejected'].includes(item.status)).length} />
          <h4>Submission status</h4>
          {feedSubmissionStatuses.length
            ? feedSubmissionStatuses.map(([key, count]) => <MetricRow key={key} label={key || 'pending'} value={count} />)
            : <MetricRow label="No feed submissions yet" value="Open submit source" />}
          <p className="adminHint">Approve only working RSS feeds. Approval adds the publisher feed to the live RSS Source Manager, where the crawler can index it automatically.</p>
        </AdminPanel>

        <AdminPanel title="Publisher Source Review">
          <AdminTable headers={['Publisher', 'Country', 'Category', 'Status', 'Submitted', 'Actions']}>
            {feedSubmissions.slice(0, 20).map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.publisher_name || 'Publisher'}</b>
                  <small>{item.feed_url}</small>
                  <small>{item.submitted_by_email || 'No email supplied'}</small>
                  {item.test_result?.qualityScore != null && <small>Quality {item.test_result.qualityScore}/100 · {item.test_result.recommendation || 'review'}</small>}
                  {item.test_result?.qualitySignals && <small>Trust {item.test_result.qualitySignals.trustScore}/100 · spam {item.test_result.qualitySignals.spamRisk} · {item.test_result.qualitySignals.copyrightSignal}</small>}
                  {item.test_result?.qualitySignals?.suggestedCategory && <small>Suggested category: {item.test_result.qualitySignals.suggestedCategory} · updates {item.test_result.qualitySignals.updateFrequency}</small>}
                  {item.test_result?.duplicate && <small>Duplicate: {item.test_result.duplicate.name || item.test_result.duplicate.url}</small>}
                </td>
                <td>{item.country || 'GLOBAL'}</td>
                <td>{item.category || 'top'}</td>
                <td>{item.status || 'pending'}</td>
                <td>{localDate(item.created_at)}</td>
                <td className="adminActions">
                  <button onClick={() => testSubmittedFeed(item)}>Test</button>
                  <button className="primaryAction" onClick={() => approveFeedSubmission(item)}>Approve</button>
                  <button className="dangerAction" onClick={() => rejectFeedSubmission(item)}>Reject</button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>
      </section>

      <section className="adminGrid twoColumn">
        <AdminPanel title="Publisher Verification">
          <MetricRow label="Publisher accounts" value={overview.publisherAccountCount || publisherAccounts.length || 0} />
          <h4>Verification status</h4>
          {publisherAccountStatuses.length
            ? publisherAccountStatuses.map(([key, count]) => <MetricRow key={key} label={key || 'submitted'} value={count} />)
            : <MetricRow label="No publisher accounts yet" value="Open verification" />}
          <p className="adminHint">Publishers verify domain ownership with a DNS TXT record. Verified status means the DNS token was found; editorial trust labels still require source review.</p>
        </AdminPanel>

        <AdminPanel title="Publisher Account Review">
          <AdminTable headers={['Publisher', 'Country', 'Status', 'Updated']}>
            {publisherAccounts.slice(0, 20).map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.publisher_name || 'Publisher'}</b>
                  <small>{item.website_url || 'No website supplied'}</small>
                  <small>{item.contact_email}</small>
                  {item.metadata?.verification_record && <small>TXT: {item.metadata.verification_record}</small>}
                  {item.verification_notes && <small>{item.verification_notes}</small>}
                </td>
                <td>{item.country || 'GLOBAL'}</td>
                <td>{item.verification_status || 'submitted'}</td>
                <td>{localDate(item.updated_at || item.created_at)}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>
      </section>

      {showAdvancedRoadmapPanels && <section className="adminGrid twoColumn">
        <AdminPanel title="V20 Publisher & Journalist Portal">
          <MetricRow label="Publisher accounts" value={overview.publisherAccountCount || 0} />
          <MetricRow label="Feed submissions" value={overview.feedSubmissionCount || 0} />
          <MetricRow label="Journalist accounts" value={overview.journalistAccountCount || 0} />
          <h4>Publisher verification</h4>
          {publisherAccountStatuses.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Feed submission status</h4>
          {feedSubmissionStatuses.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <AdminTable headers={['Submission', 'Country', 'Category', 'Status']}>
            {feedSubmissions.slice(0, 10).map((item) => (
              <tr key={item.id}>
                <td><b>{item.publisher_name}</b><small>{item.feed_url}</small></td>
                <td>{item.country || 'GLOBAL'}</td>
                <td>{item.category || 'top'}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>

        <AdminPanel title="V20 Research, Marketplace & Enterprise">
          <MetricRow label="Research reports" value={overview.researchReportCount || 0} />
          <MetricRow label="Marketplace products" value={overview.marketplaceProductCount || 0} />
          <MetricRow label="Enterprise accounts" value={overview.enterpriseAccountCount || 0} />
          <MetricRow label="Integration requests" value={overview.integrationCount || 0} />
          <MetricRow label="AI research queries" value={overview.aiResearchCount || 0} />
          <h4>Marketplace by type</h4>
          {marketplaceByType.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Enterprise plans</h4>
          {enterpriseByPlan.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Integrations</h4>
          {integrationsByType.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
        </AdminPanel>
      </section>}

      {showAdvancedRoadmapPanels && <section className="adminGrid twoColumn">
        <AdminPanel title="News Intelligence Command Center">
          <MetricRow label="Active trends" value={overview.trendCount || 0} />
          <MetricRow label="Trend snapshots" value={trendSnapshots.length} />
          <MetricRow label="Entity metric rows" value={overview.entityMetricCount || 0} />
          <MetricRow label="Publisher metric rows" value={overview.publisherMetricCount || 0} />
          <h4>Trends by status</h4>
          {trendsByStatus.length ? trendsByStatus.map(([key, count]) => <MetricRow key={key} label={key} value={count} />) : <MetricRow label="No trend rows yet" value="Run ingestion" />}
          <h4>Top trend records</h4>
          <AdminTable headers={['Topic', 'Country', 'Momentum', 'Status']}>
            {trends.slice(0, 10).map((trend) => (
              <tr key={trend.trend_id}>
                <td><b>{trend.topic}</b><small>{trend.category} · {trend.volume || 0} volume · {trend.source_count || 0} sources</small></td>
                <td>{trend.country || 'GLOBAL'}</td>
                <td>{Number(trend.momentum_score || 0).toFixed(2)}</td>
                <td>{trend.status || 'emerging'}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>

        <AdminPanel title="Sentiment & Entity Intelligence">
          <MetricRow label="Sentiment rows" value={overview.sentimentCount || 0} />
          <MetricRow label="Tracked entity metrics" value={overview.entityMetricCount || 0} />
          <h4>Sentiment mix</h4>
          {sentimentByLabel.length ? sentimentByLabel.map(([key, count]) => <MetricRow key={key} label={key} value={count} />) : <MetricRow label="No sentiment rows yet" value="Heuristic ready" />}
          <h4>Entity momentum</h4>
          <AdminTable headers={['Entity', 'Type', 'Mentions', 'Momentum']}>
            {entityMetrics.slice(0, 10).map((entity) => (
              <tr key={`${entity.entity_slug}-${entity.measured_at}`}>
                <td><b>{entity.entity_name}</b><small>{entity.country || 'GLOBAL'} · sentiment {Number(entity.sentiment_score || 0).toFixed(2)}</small></td>
                <td>{entity.entity_type}</td>
                <td>{entity.mention_count || 0}</td>
                <td>{Number(entity.momentum_score || 0).toFixed(2)}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>
      </section>}

      {showAdvancedRoadmapPanels && <section className="adminGrid twoColumn">
        <AdminPanel title="Publisher Intelligence Metrics">
          <MetricRow label="Publisher metric rows" value={overview.publisherMetricCount || 0} />
          <MetricRow label="Measured publishers" value={new Set(publisherMetrics.map((item) => item.publisher_slug)).size} />
          <AdminTable headers={['Publisher', 'Country', 'Stories', 'Diversity']}>
            {publisherMetrics.slice(0, 12).map((publisher) => (
              <tr key={`${publisher.publisher_slug}-${publisher.measured_at}`}>
                <td><b>{publisher.publisher_name}</b><small>{publisher.average_freshness_minutes ?? '-'}m avg freshness</small></td>
                <td>{publisher.country || 'GLOBAL'}</td>
                <td>{publisher.story_count || 0}</td>
                <td>{Number(publisher.source_diversity_score || 0).toFixed(2)}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminPanel>

        <AdminPanel title="Custom Alerts & Enterprise Reports">
          <MetricRow label="Alerts" value={overview.alertCount || 0} />
          <MetricRow label="Saved reports" value={overview.savedReportCount || 0} />
          <MetricRow label="Shared dashboards" value={overview.sharedDashboardCount || 0} />
          <MetricRow label="Exports" value={overview.dashboardExportCount || 0} />
          <h4>Alerts by type</h4>
          {alertsByType.length ? alertsByType.map(([key, count]) => <MetricRow key={key} label={key} value={count} />) : <MetricRow label="No alerts yet" value="Ready" />}
          <h4>Recent exports</h4>
          {dashboardExports.slice(0, 6).map((item) => <MetricRow key={item.id} label={`${item.export_type} · ${localDate(item.created_at)}`} value={item.status} />)}
          <h4>Shared dashboards</h4>
          {sharedDashboards.slice(0, 6).map((item) => <MetricRow key={item.id} label={item.name} value={item.access_level} />)}
          {savedReports.slice(0, 4).map((item) => <MetricRow key={item.id} label={item.title} value={item.report_type} />)}
        </AdminPanel>
      </section>}

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
              <td><b>{source.name}</b><small>{source.url}</small><small>{source.health_status || 'unknown'} · last crawl {localDate(source.last_crawled_at)}</small></td>
              <td>{source.category}</td>
              <td>{source.country}</td>
              <td>{source.priority}</td>
              <td>{source.enabled ? (source.status || 'enabled') : 'Disabled'}</td>
              <td className="adminActions">
                <button onClick={() => editSource(source)}>Edit</button>
                <button onClick={() => updateSource(source, { enabled: !source.enabled })}>{source.enabled ? 'Disable' : 'Enable'}</button>
                <button onClick={() => testSource(source)}>Test</button>
                <button onClick={() => runCrawler('source', source.id)}>Crawl</button>
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

      {showAdvancedRoadmapPanels && <section className="adminGrid twoColumn">
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
      </section>}

      {showAdvancedRoadmapPanels && <AdminPanel title="Editorial CMS">
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
      </AdminPanel>}

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
          <MetricRow label="Sitemap status" value="4,000+ public URLs + live news sitemap" />
          <MetricRow label="CTR tracking" value={seoCtr} />
          <MetricRow label="News sitemap" value="/news-sitemap.xml" />
          <h4>Top pages</h4>
          {topPages.map(([key, count]) => <MetricRow key={key} label={key.replace('https://nuzenio.com', '')} value={count} />)}
          <h4>Search queries</h4>
          {searchQueries.slice(0, 6).map(([key, count]) => <MetricRow key={`seo-${key}`} label={key} value={count} />)}
        </AdminPanel>
      </section>

      {showAdvancedRoadmapPanels && <section className="adminGrid twoColumn">
        <AdminPanel title="AI Personalization Analytics">
          <MetricRow label="User interests" value={overview.interestCount || 0} />
          <MetricRow label="Followed topics" value={overview.followedTopicCount || 0} />
          <MetricRow label="Followed entities" value={overview.followedEntityCount || 0} />
          <MetricRow label="Followed sources" value={overview.followedSourceCount || 0} />
          <MetricRow label="Followed authors" value={overview.followedAuthorCount || 0} />
          <MetricRow label="Recommendation logs" value={overview.recommendationCount || 0} />
          <h4>Most followed topics</h4>
          {mostFollowedTopics.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Most followed sources</h4>
          {mostFollowedSources.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Most followed entities</h4>
          {mostFollowedEntities.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
        </AdminPanel>

        <AdminPanel title="AI Briefs & Retention">
          <MetricRow label="AI briefs" value={overview.aiBriefCount || 0} />
          <MetricRow label="Ready briefs" value={aiBriefs.filter((brief) => brief.status === 'ready').length} />
          <MetricRow label="Sent briefs" value={aiBriefs.filter((brief) => brief.status === 'sent').length} />
          <MetricRow label="Engagement events" value={analytics.filter((event) => ['select_content', 'save_article', 'follow_item', 'search'].includes(event.event_name)).length} />
          <h4>Recommendation categories</h4>
          {recommendationCategories.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Recent briefs</h4>
          {aiBriefs.slice(0, 8).map((brief) => <MetricRow key={`${brief.brief_type}-${brief.created_at}`} label={`${brief.brief_type} · ${brief.country}`} value={brief.status} />)}
        </AdminPanel>
      </section>}

      {showAdvancedRoadmapPanels && <section className="adminGrid twoColumn">
        <AdminPanel title="Knowledge Graph">
          <MetricRow label="Entities" value={overview.entityCount || 0} />
          <MetricRow label="Relationships" value={overview.relationshipCount || 0} />
          <MetricRow label="Story clusters" value={overview.storyClusterCount || 0} />
          <MetricRow label="Timeline events" value={overview.storyTimelineCount || 0} />
          <h4>Entities by type</h4>
          {entitiesByType.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>Clusters by topic</h4>
          {clustersByTopic.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
        </AdminPanel>

        <AdminPanel title="API Management">
          <MetricRow label="API keys" value={overview.apiKeyCount || 0} />
          <MetricRow label="Usage logs" value={overview.apiUsageCount || 0} />
          <MetricRow label="Enabled keys" value={apiKeys.filter((key) => key.enabled).length} />
          <MetricRow label="Public API" value="/api/v1/latest" />
          <h4>Usage by endpoint</h4>
          {apiUsageByEndpoint.map(([key, count]) => <MetricRow key={key} label={key} value={count} />)}
          <h4>API keys</h4>
          {apiKeys.slice(0, 8).map((key) => <MetricRow key={key.id} label={`${key.name} · ${key.plan}`} value={key.enabled ? 'enabled' : 'disabled'} />)}
        </AdminPanel>
      </section>}

      <section className="adminGrid twoColumn">
        <AdminPanel title="User Management">
          <MetricRow label="Total users" value={overview.userCount || 0} />
          <MetricRow label="Saved articles" value={overview.savedCount || 0} />
          <MetricRow label="Reading history rows" value={overview.historyCount || 0} />
          <MetricRow label="Newsletter subscribers" value={overview.newsletterCount || 0} />
          <MetricRow label="User preferences" value={overview.preferencesCount || 0} />
          <MetricRow label="Digest logs" value={overview.digestLogCount || 0} />
          <h4>User roles</h4>
          <AdminTable headers={['User', 'Role', 'Created', 'Actions']}>
            {profiles.slice(0, 20).map((item) => (
              <tr key={item.id}>
                <td><b>{item.full_name || item.email || item.id}</b><small>{item.email || item.id}</small></td>
                <td>{item.role}</td>
                <td>{localDate(item.created_at)}</td>
                <td className="adminActions">
                  {['reader', 'editor', 'admin'].map((role) => (
                    <button
                      key={role}
                      className={item.role === role ? 'primaryAction' : ''}
                      disabled={item.role === role}
                      onClick={() => updateUserRole(item, role)}
                    >
                      {role}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </AdminTable>
          <h4>Latest subscribers</h4>
          {newsletters.slice(0, 10).map((item) => <MetricRow key={item.email} label={`${item.email} · ${item.frequency || 'daily'} · ${item.country || 'GLOBAL'}`} value={item.status} />)}
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
