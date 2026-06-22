import { formatDate } from './format.js';

export function displayTitle(article) {
  if (!article) return '';
  return article.title;
}

export function displaySummary(article) {
  if (!article) return '';
  return article.summary;
}

export function displayFullBrief(article) {
  if (!article) return '';
  return article.fullBrief || article.summary;
}

export function isVideoArticle(article) {
  return ['live', 'video'].includes(article?.category) && Boolean(article?.videoId || article?.embedUrl || article?.streamUrl);
}

export function mediaEmbedUrl(article, options = {}) {
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

export function videoThumbnail(article) {
  if (article?.image) return article.image;
  return article?.videoId ? `https://i.ytimg.com/vi/${article.videoId}/hqdefault.jpg` : '';
}

export function sourceProviderLabel(article) {
  const labels = {
    youtube: 'YouTube',
    twitch: 'Twitch',
    official_embed: 'official publisher embed',
    hls: 'official HLS stream',
  };
  return labels[article?.provider] || 'approved video source';
}

export function buildKeyFacts(article) {
  return [
    `Source: ${article.source || 'RSS publisher'}`,
    `Published: ${formatDate(article.pubDate)}`,
    `Category: ${article.category || 'top'}`,
  ];
}

export function buildRelatedArticles(article, articles, limit = 4) {
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

export function buildTimeline(article) {
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

export function buildBackground(article) {
  const category = article.category === 'local' ? 'local public-interest' : article.category || 'news';
  return `This is a ${category} story from ${article.source || 'a verified RSS source'}. Nuzenio adds context, key facts, and a safe path to the original report so readers can understand the story quickly without losing source attribution.`;
}

export function buildFaq(article) {
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
      q: 'How does Nuzenio handle translated news?',
      a: 'Nuzenio localizes UI and summaries while preserving source attribution and original publisher links. Full publisher articles remain on the original source.',
    },
  ];
}
