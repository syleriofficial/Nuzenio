import { useEffect, useState } from 'react';

export function NewsFallbackVisual({ article, size = 'default' }) {
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

export function ImageWithFallback({
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
