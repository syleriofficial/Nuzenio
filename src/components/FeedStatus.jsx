import { RefreshCw } from 'lucide-react';
import { formatLastUpdated } from '../utils/format.js';

export function SectionStatus({ isLoading, lastUpdated, onRefresh, status }) {
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

export function LoadingCards({ count = 6, type = 'article' }) {
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

export function VideoShowcaseSkeleton() {
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
