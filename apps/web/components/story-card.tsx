'use client';

import { useState } from 'react';
import {
  BellPlus,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  EyeOff,
  Share2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { StoryCluster } from '@/lib/story-types';
import { usePreferences } from '@/lib/preferences';
import { useReaderPreferences } from '@/lib/reader-preferences';
import { whyStory } from '@/lib/reader-state';

export function StoryCard({
  story,
  featured = false,
  showWhy = false,
}: {
  story: StoryCluster;
  featured?: boolean;
  showWhy?: boolean;
}) {
  const { language, t } = usePreferences();
  const reader = useReaderPreferences();
  const saved = reader.saved.includes(story.slug);
  const followed = reader.topics.includes(story.category);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');

  const failed = () =>
    setMessage(
      t(
        'Could not save this preference. Check browser storage or remove older items.',
        'प्राथमिकता सेव नहीं हुई। ब्राउज़र स्टोरेज जांचें या पुराने आइटम हटाएं।',
      ),
    );

  const toggleSaved = () => {
    if (!reader.toggle('saved', story.slug)) return failed();
    setMessage(
      saved
        ? t('Removed from saved stories', 'सेव से हटाया गया')
        : t('Story saved', 'स्टोरी सेव की गई'),
    );
  };
  const toggleFollowed = () => {
    if (!reader.toggle('topics', story.category)) return failed();
    setMessage(
      followed
        ? t('Topic unfollowed', 'विषय अनफॉलो किया')
        : t('Topic followed', 'विषय फॉलो किया'),
    );
  };
  const share = async () => {
    const url = `${window.location.origin}/story/${story.slug}`;
    if (navigator.share) await navigator.share({ title: story.headline, url });
    else await navigator.clipboard?.writeText(url);
    setMessage(t('Share link ready', 'शेयर लिंक तैयार है'));
  };
  const hideSource = () => {
    const source = story.sources[0];
    if (!source || !reader.toggle('hidden', source.slug)) return failed();
    setMessage(
      t(
        `${source.name} hidden from your feed`,
        `${source.name} को आपकी फीड से छिपाया गया`,
      ),
    );
  };

  return (
    <article className={`story-card${featured ? ' featured' : ''}`}>
      <div className="story-meta">
        <Badge variant="outline" className="category-badge">
          {story.category}
        </Badge>
        {story.status !== 'VERIFIED' && (
          <span className={`status ${story.status.toLowerCase()}`}>
            {story.status === 'DISPUTED'
              ? t('Sources differ', 'स्रोत अलग')
              : t('Developing', 'विकासशील')}
          </span>
        )}
        <span>
          <Clock3 aria-hidden="true" /> {story.updated}
        </span>
        {story.reviewState === 'EDITOR_REVIEWED' && (
          <span className="reviewed-label">
            {t('Editor reviewed', 'संपादकीय समीक्षा')}
          </span>
        )}
      </div>
      <a
        className="story-title-link"
        href={`/story/${story.slug}?lang=${language}`}
      >
        <h2>{language === 'hi' ? story.headlineHi : story.headline}</h2>
      </a>
      <p className="story-brief">
        {language === 'hi' ? story.briefHi : story.brief}
      </p>
      {expanded && (
        <div className="expanded-facts">
          <p>
            <strong>{t('Confirmed:', 'पुष्ट:')}</strong>{' '}
            {(language === 'hi' ? story.confirmedHi : story.confirmed)[0]}
          </p>
          {story.developing[0] && (
            <p>
              <strong>{t('Still developing:', 'अभी विकासशील:')}</strong>{' '}
              {(language === 'hi' ? story.developingHi : story.developing)[0]}
            </p>
          )}
        </div>
      )}
      {showWhy && (
        <details className="why-seeing">
          <summary>
            {t('Why am I seeing this?', 'मैं यह क्यों देख रहा/रही हूं?')}
          </summary>
          <p>{t(...whyStory(story, reader))}</p>
        </details>
      )}
      <div className="source-row">
        <div className="source-stack" aria-hidden="true">
          {story.sources.slice(0, 3).map((source) => (
            <span key={source.slug}>{source.short}</span>
          ))}
        </div>
        <a href={`/story/${story.slug}?lang=${language}#sources`}>
          <strong>
            {story.independentSourceCount}{' '}
            {t('independent sources', 'स्वतंत्र स्रोत')}
          </strong>
          <span>
            {story.sources
              .slice(0, 3)
              .map((s) => s.name)
              .join(' · ')}
          </span>
        </a>
      </div>
      <div className="story-actions">
        <Button
          variant={saved ? 'secondary' : 'ghost'}
          onClick={toggleSaved}
          aria-pressed={saved}
          disabled={!reader.ready}
        >
          <Bookmark /> {saved ? t('Saved', 'सेव') : t('Save', 'सेव करें')}
        </Button>
        <Button
          variant={followed ? 'secondary' : 'ghost'}
          onClick={toggleFollowed}
          aria-pressed={followed}
          disabled={!reader.ready}
        >
          {followed ? <Check /> : <BellPlus />}{' '}
          {followed ? t('Following', 'फॉलोइंग') : t('Follow', 'फॉलो करें')}
        </Button>
        <Button variant="ghost" onClick={share}>
          <Share2 /> {t('Share', 'शेयर')}
        </Button>
        <Button
          variant="ghost"
          onClick={hideSource}
          className="wide-action"
          disabled={!reader.ready || !story.sources.length}
          title={t(
            `Hide ${story.sources[0]?.name ?? 'source'} and stories containing it`,
            `${story.sources[0]?.name ?? 'स्रोत'} और उससे जुड़ी स्टोरी छिपाएं`,
          )}
        >
          <EyeOff /> {t('Hide source', 'स्रोत छिपाएं')}
        </Button>
        <Button
          variant="ghost"
          className="more-button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? t('Less', 'कम') : t('More', 'और')}{' '}
          <ChevronDown className={expanded ? 'rotate-180' : ''} />
        </Button>
      </div>
      <output className="sr-status" aria-live="polite">
        {message}
      </output>
    </article>
  );
}
