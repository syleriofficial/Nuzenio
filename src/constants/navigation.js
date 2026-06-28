export const categories = [
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

export const primarySectionRoutes = {
  local: '/local',
  ai: '/ai',
  live: '/live',
  video: '/video',
};

export const categoryRoutes = {
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

export const intelligenceCountries = [
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

export const topicIntelligence = [
  { slug: 'ai', label: 'AI', category: 'ai', query: 'artificial intelligence AI chips models startups policy' },
  { slug: 'economy', label: 'Economy', category: 'business', query: 'economy inflation jobs GDP central bank' },
  { slug: 'markets', label: 'Markets', category: 'business', query: 'markets stocks bonds commodities currency' },
  { slug: 'climate', label: 'Climate', category: 'science', query: 'climate change weather emissions energy transition' },
  { slug: 'energy', label: 'Energy', category: 'business', query: 'energy oil gas solar power electricity' },
  { slug: 'space', label: 'Space', category: 'science', query: 'space NASA rocket satellite moon mars' },
  { slug: 'science', label: 'Science', category: 'science', query: 'science research discovery study space climate' },
  { slug: 'startups', label: 'Startups', category: 'business', query: 'startups venture capital funding technology founders' },
];

export const seoLandingPages = [
  { slug: 'latest-news', label: 'Latest News', category: 'top', query: '', intent: 'Fresh live headlines and top stories from verified publishers.' },
  { slug: 'breaking-news', label: 'Breaking News', category: 'top', query: 'breaking news live developing updates', intent: 'Fast-moving breaking news clusters and live developing stories.' },
  { slug: 'local-news', label: 'Local News', category: 'local', query: '', intent: 'Location-aware local headlines, nearby updates, civic news, weather, traffic, and regional stories.' },
  { slug: 'world-news', label: 'World News', category: 'world', query: '', intent: 'International headlines, diplomacy, conflicts, policy, and global affairs.' },
  { slug: 'technology-news', label: 'Technology News', category: 'tech', query: '', intent: 'Technology, AI, gadgets, startups, platforms, chips, and product news.' },
  { slug: 'business-news', label: 'Business News', category: 'business', query: '', intent: 'Business, economy, markets, companies, jobs, money, and policy news.' },
  { slug: 'finance-news', label: 'Finance News', category: 'business', query: 'finance markets stocks economy banking investing inflation', intent: 'Finance, banking, investing, inflation, markets, companies, and money news.' },
  { slug: 'market-news', label: 'Market News', category: 'business', query: 'markets stocks bonds commodities currencies investors earnings', intent: 'Stock market, bond market, commodities, currencies, earnings, and investor headlines.' },
  { slug: 'sports-news', label: 'Sports News', category: 'sports', query: '', intent: 'Sports headlines, match updates, leagues, teams, and athlete news.' },
  { slug: 'entertainment-news', label: 'Entertainment News', category: 'entertainment', query: '', intent: 'Entertainment, movies, streaming, music, celebrity, culture, and television headlines.' },
  { slug: 'ai-news', label: 'AI News', category: 'ai', query: '', intent: 'Artificial intelligence companies, models, chips, research, tools, and policy.' },
  { slug: 'startup-news', label: 'Startup News', category: 'business', query: 'startups startup funding venture capital founders technology IPO', intent: 'Startup funding, founders, venture capital, product launches, IPOs, and company news.' },
  { slug: 'science-news', label: 'Science News', category: 'science', query: '', intent: 'Science, space, discoveries, research, climate, and innovation updates.' },
  { slug: 'space-news', label: 'Space News', category: 'science', query: 'space NASA rocket satellite moon mars astronomy launch mission', intent: 'Space missions, rockets, satellites, astronomy, NASA, moon, Mars, and exploration updates.' },
  { slug: 'climate-news', label: 'Climate News', category: 'science', query: 'climate change weather emissions energy transition heat floods policy', intent: 'Climate change, weather extremes, emissions, energy transition, science, and policy updates.' },
  { slug: 'health-news', label: 'Health News', category: 'health', query: '', intent: 'Health, medicine, public health, wellness, research, and hospital updates.' },
  { slug: 'live-news', label: 'Live News', category: 'live', query: '', intent: 'Playable live news channels and live video coverage with visible source attribution.' },
  { slug: 'video-news', label: 'Video News', category: 'video', query: '', intent: 'Recorded news videos, reports, explainers, interviews, and source-attributed video updates.' },
  { slug: 'politics-news', label: 'Politics News', category: 'top', query: 'politics election government policy parliament congress diplomacy', intent: 'Politics, elections, government policy, diplomacy, legislatures, and public-interest headlines.' },
];
