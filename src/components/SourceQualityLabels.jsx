import { ShieldCheck } from 'lucide-react';

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

export function SourceQualityLabels({ article, compact = false }) {
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
