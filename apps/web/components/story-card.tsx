'use client';

import { useEffect, useState } from 'react';
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
  const [saved, setSaved] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setSaved(
      JSON.parse(localStorage.getItem('nuzenio-saved') ?? '[]').includes(
        story.slug,
      ),
    );
    setFollowed(
      JSON.parse(
        localStorage.getItem('nuzenio-followed-topics') ?? '[]',
      ).includes(story.category),
    );
  }, [story.category, story.slug]);

  const toggleInStorage = (key: string, value: string, active: boolean) => {
    const values: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    localStorage.setItem(
      key,
      JSON.stringify(
        active
          ? values.filter((item) => item !== value)
          : [...new Set([...values, value])],
      ),
    );
  };

  const toggleSaved = () => {
    toggleInStorage('nuzenio-saved', story.slug, saved);
    setSaved(!saved);
    setMessage(
      saved
        ? t('Removed from saved stories', 'सेव से हटाया गया')
        : t('Story saved', 'स्टोरी सेव की गई'),
    );
  };
  const toggleFollowed = () => {
    toggleInStorage('nuzenio-followed-topics', story.category, followed);
    setFollowed(!followed);
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
    toggleInStorage('nuzenio-hidden-sources', source.slug, false);
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
          <p>{story.whyShown}</p>
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
        >
          <Bookmark /> {saved ? t('Saved', 'सेव') : t('Save', 'सेव करें')}
        </Button>
        <Button
          variant={followed ? 'secondary' : 'ghost'}
          onClick={toggleFollowed}
          aria-pressed={followed}
        >
          {followed ? <Check /> : <BellPlus />}{' '}
          {followed ? t('Following', 'फॉलोइंग') : t('Follow', 'फॉलो करें')}
        </Button>
        <Button variant="ghost" onClick={share}>
          <Share2 /> {t('Share', 'शेयर')}
        </Button>
        <Button variant="ghost" onClick={hideSource} className="wide-action">
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
