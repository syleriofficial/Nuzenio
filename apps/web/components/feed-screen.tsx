'use client';

import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { StoryCard } from '@/components/story-card';
import type { StoryCluster } from '@/lib/demo-data';
import { usePreferences } from '@/lib/preferences';

export function FeedScreen({
  title,
  titleHi,
  description,
  descriptionHi,
  eyebrow,
  eyebrowHi,
  stories,
  showWhy = false,
  local = false,
}: {
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  eyebrow: string;
  eyebrowHi: string;
  stories: StoryCluster[];
  showWhy?: boolean;
  local?: boolean;
}) {
  const { t } = usePreferences();
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t(eyebrow, eyebrowHi)}</p>
          <h1>{t(title, titleHi)}</h1>
          <p className="lede">{t(description, descriptionHi)}</p>
        </div>
        {local && (
          <div className="edition-chip">
            <MapPin /> Delhi NCR
          </div>
        )}
      </section>
      {local && (
        <div className="local-context">
          <div>
            <span className="context-kicker">
              {t('Local pilot', 'स्थानीय पायलट')}
            </span>
            <strong>
              {t(
                'Delhi · Gurugram · Noida · Ghaziabad · Faridabad',
                'दिल्ली · गुरुग्राम · नोएडा · गाजियाबाद · फरीदाबाद',
              )}
            </strong>
          </div>
          <Link href="/settings">{t('Change area', 'क्षेत्र बदलें')}</Link>
        </div>
      )}
      <main
        className="story-feed narrow-feed"
        aria-label={t(`${title} story clusters`, `${titleHi} स्टोरी क्लस्टर`)}
      >
        {stories.map((story, index) => (
          <StoryCard
            key={story.slug}
            story={story}
            featured={index === 0}
            showWhy={showWhy}
          />
        ))}
      </main>
    </>
  );
}
