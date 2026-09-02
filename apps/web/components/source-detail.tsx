'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Ban,
  BellPlus,
  Check,
  ExternalLink,
  Globe2,
  Languages,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { StoryCard } from '@/components/story-card';
import type { ReaderSourceProfile } from '@/lib/api-types';
import { usePreferences } from '@/lib/preferences';

export function SourceDetail({ source }: { source: ReaderSourceProfile }) {
  const { language, t } = usePreferences();
  const [followed, setFollowed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const stories = source.recentClusters;
  return (
    <>
      <Link className="back-link" href={`/?lang=${language}`}>
        <span aria-hidden="true">←</span>{' '}
        {t('Back to Top', 'मुख्य समाचार पर वापस')}
      </Link>
      <header className="source-hero">
        <div className="source-logo">
          {source.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div>
          <p className="eyebrow">{t('Source profile', 'स्रोत प्रोफाइल')}</p>
          <h1>{source.name}</h1>
          <p>{source.description}</p>
          <div className="source-tags">
            <Badge variant="outline">
              <Languages /> {source.languages.join(' · ')}
            </Badge>
            <Badge variant="outline">
              <Globe2 /> {source.domains.length}{' '}
              {t('verified domains', 'सत्यापित डोमेन')}
            </Badge>
            <Badge variant="outline">
              <ShieldCheck /> {t('Approved source', 'स्वीकृत स्रोत')}
            </Badge>
          </div>
        </div>
      </header>
      <div className="detail-actions">
        <Button
          variant={followed ? 'secondary' : 'default'}
          onClick={() => setFollowed(!followed)}
        >
          {followed ? <Check /> : <BellPlus />}{' '}
          {followed
            ? t('Following', 'फॉलोइंग')
            : t('Follow source', 'स्रोत फॉलो करें')}
        </Button>
        <Button
          variant={hidden ? 'destructive' : 'outline'}
          onClick={() => setHidden(!hidden)}
        >
          <Ban />{' '}
          {hidden
            ? t('Source hidden', 'स्रोत छिपा')
            : t('Hide source', 'स्रोत छिपाएं')}
        </Button>
        <a
          className={buttonVariants({ variant: 'ghost' })}
          href={`https://${source.domains[0]}`}
          target="_blank"
          rel="noreferrer"
        >
          {t('Visit publisher', 'प्रकाशक पर जाएं')} <ExternalLink />
        </a>
      </div>
      <section className="source-facts">
        <div>
          <span>{t('Publisher organisation', 'प्रकाशक संगठन')}</span>
          <strong>{source.ownership}</strong>
        </div>
        <div>
          <span>{t('Rights policy', 'अधिकार नीति')}</span>
          <strong>{source.rights}</strong>
        </div>
        <div>
          <span>{t('Feed health', 'फीड स्वास्थ्य')}</span>
          <strong>{source.feedHealth}</strong>
        </div>
        <div>
          <span>{t('Correction policy', 'सुधार नीति')}</span>
          <strong>{source.correctionPolicy}</strong>
        </div>
      </section>
      <section className="source-domains">
        <h2>{t('Domains counted as one source', 'एक स्रोत के रूप में गिने डोमेन')}</h2>
        <p>
          {t(
            'Articles from all domains below count once toward cluster source diversity because they share an owner.',
            'नीचे दिए सभी डोमेन के लेख एक ही स्वामी के कारण क्लस्टर स्रोत विविधता में एक बार गिने जाते हैं।',
          )}
        </p>
        <ul>
          {source.domains.map((domain) => (
            <li key={domain}>
              <Globe2 /> {domain}
            </li>
          ))}
        </ul>
      </section>
      <section className="source-stories">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('Recent coverage', 'हाल की कवरेज')}</p>
            <h2>
              {t(
                'Story clusters containing this source',
                'इस स्रोत वाले स्टोरी क्लस्टर',
              )}
            </h2>
          </div>
        </div>
        {stories.length ? (
          <div className="story-feed narrow-feed">
            {stories.map((story) => (
              <StoryCard key={story.slug} story={story} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Globe2 />
            <h2>{t('No recent clusters', 'हाल के क्लस्टर नहीं')}</h2>
            <p>
              {t(
                'Approved feed items will appear after clustering.',
                'क्लस्टरिंग के बाद स्वीकृत फीड आइटम यहां आएंगे।',
              )}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
