'use client';

import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { StoryCard } from '@/components/story-card';
import type { StoryCluster } from '@/lib/story-types';
import { usePreferences } from '@/lib/preferences';
import { useReaderPreferences } from '@/lib/reader-preferences';
import { personalizeStories, visibleStories } from '@/lib/reader-state';

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
  const { t, language } = usePreferences();
  const reader = useReaderPreferences();
  const visible = showWhy
    ? personalizeStories(stories, reader)
    : visibleStories(stories, reader);
  return (
    <main>
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
      <section
        className="story-feed narrow-feed"
        aria-label={t(`${title} story clusters`, `${titleHi} स्टोरी क्लस्टर`)}
      >
        {visible.length ? (
          visible.map((story, index) => (
            <StoryCard
              key={story.slug}
              story={story}
              featured={index === 0}
              showWhy={showWhy}
            />
          ))
        ) : (
          <section className="empty-state">
            <MapPin />
            <h2>
              {stories.length
                ? t(
                    'No visible clusters in this edition',
                    'इस संस्करण में कोई दृश्यमान क्लस्टर नहीं',
                  )
                : t('No published clusters yet', 'अभी कोई प्रकाशित क्लस्टर नहीं')}
            </h2>
            <p>
              {stories.length
                ? t(
                    'No published stories match this view. Check hidden sources in Settings.',
                    'इस सूची में कोई प्रकाशित स्टोरी नहीं है। सेटिंग्स में छिपे स्रोत जांचें।',
                  )
                : t(
                    'Approved, evidence-backed reporting will appear here when available.',
                    'स्वीकृत और साक्ष्य-समर्थित रिपोर्टिंग उपलब्ध होने पर यहां दिखेगी।',
                  )}
            </p>
            <Link href={`/settings?lang=${language}`}>
              {t('Manage preferences', 'प्राथमिकताएं बदलें')}
            </Link>
          </section>
        )}
      </section>
    </main>
  );
}
