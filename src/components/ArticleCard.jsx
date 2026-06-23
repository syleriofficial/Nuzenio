import {
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock,
  PlayCircle,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { displaySummary, displayTitle, videoThumbnail } from '../utils/article.js';
import { formatDate, formatFreshAge } from '../utils/format.js';
import { ImageWithFallback, NewsFallbackVisual } from './Media.jsx';
import { SourceQualityLabels } from './SourceQualityLabels.jsx';

export function ArticleCard({
  article,
  articleHref,
  copy,
  openArticle,
  openArticleFromLink,
  savedIds,
  shareArticle,
  toggleSave,
}) {
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
          fallback={<NewsFallbackVisual article={article} />}
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
