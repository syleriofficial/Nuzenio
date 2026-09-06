'use client';

import { StoryCard } from '@/components/story-card';
import Link from 'next/link';
import type { StoryCluster } from '@/lib/story-types';
import { usePreferences } from '@/lib/preferences';

export function TopNewsPage({ stories }: { stories: StoryCluster[] }) {
  const { language, t } = usePreferences();
  const sourceCount = new Set(
    stories.flatMap((story) =>
      story.sources.map((source) => source.organization),
    ),
  ).size;
  return (
    <main className="top-news-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {t('Wednesday, 2 September', 'बुधवार, 2 सितंबर')}
          </p>
          <h1>{t('Top News', 'मुख्य समाचार')}</h1>
          <p className="lede">
            {t(
              'The day’s essential stories, grouped across independent sources.',
              'दिन की जरूरी खबरें, स्वतंत्र स्रोतों के आधार पर एक साथ।',
            )}
          </p>
        </div>
        <div
          className="edition-chip"
          aria-label={t('Current edition: India', 'वर्तमान संस्करण: भारत')}
        >
          <span aria-hidden="true">🇮🇳</span> {t('India edition', 'भारत संस्करण')}
        </div>
      </section>
      <div className="demo-notice" role="note">
        <strong>{t('Demonstration edition.', 'प्रदर्शन संस्करण।')}</strong>{' '}
        {t(
          'All stories and publisher names shown here are fictional sample data.',
          'यहां दिखाई गई सभी खबरें और प्रकाशक नाम काल्पनिक नमूना डेटा हैं।',
        )}
      </div>
      <div className="feed-grid">
        <div
          className="story-feed"
          aria-label={t('Top story clusters', 'मुख्य स्टोरी क्लस्टर')}
        >
          {stories.length ? (
            stories
              .slice(0, 5)
              .map((story, index) => (
                <StoryCard
                  key={story.slug}
                  story={story}
                  featured={index === 0}
                />
              ))
          ) : (
            <section className="empty-state">
              <h2>
                {t('No clusters in this edition', 'इस संस्करण में कोई क्लस्टर नहीं')}
              </h2>
              <p>
                {t(
                  'Approved, evidence-backed stories will appear here after publication.',
                  'स्वीकृत और साक्ष्य-समर्थित स्टोरी प्रकाशन के बाद यहां दिखेंगी।',
                )}
              </p>
            </section>
          )}
        </div>
        <aside
          className="rail"
          aria-label={t('Today at a glance', 'आज एक नजर में')}
        >
          <div className="rail-card briefing-card">
            <p className="eyebrow">
              {t('Morning brief · 6:30 AM', 'सुबह का ब्रीफ · 6:30')}
            </p>
            <h2>{t('7 stories for your commute', 'सफर के लिए 7 खबरें')}</h2>
            <p>
              {t(
                'National policy, Delhi air, markets and the cricket series—in about 4 minutes.',
                'राष्ट्रीय नीति, दिल्ली की हवा, बाजार और क्रिकेट—लगभग 4 मिनट में।',
              )}
            </p>
            <Link className="text-link" href={`/briefs?lang=${language}`}>
              {t('Read the morning brief', 'सुबह का ब्रीफ पढ़ें')}{' '}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="rail-card">
            <p className="eyebrow">{t('Across the edition', 'पूरे संस्करण में')}</p>
            <dl className="edition-stats">
              <div>
                <dt>{t('Story clusters', 'स्टोरी क्लस्टर')}</dt>
                <dd>{stories.length}</dd>
              </div>
              <div>
                <dt>{t('Publisher groups', 'प्रकाशक समूह')}</dt>
                <dd>{sourceCount}</dd>
              </div>
              <div>
                <dt>{t('Official documents', 'आधिकारिक दस्तावेज')}</dt>
                <dd>
                  {stories.filter((story) => story.primaryDocument).length}
                </dd>
              </div>
            </dl>
            <p className="rail-note">
              {t(
                'Source counts combine domains owned by the same publisher and exclude syndicated copies.',
                'स्रोत गणना में एक ही प्रकाशक के डोमेन जोड़े जाते हैं और सिंडिकेटेड प्रतियां हटाई जाती हैं।',
              )}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
