'use client';

import { useState } from 'react';
import { Clock3, MoonStar, SunMedium } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReaderBrief } from '@/lib/api-types';
import { usePreferences } from '@/lib/preferences';

export function BriefsScreen({
  briefs,
}: {
  briefs: { morning: ReaderBrief; evening: ReaderBrief };
}) {
  const { language, t } = usePreferences();
  const [edition, setEdition] = useState<'morning' | 'evening'>('morning');
  const brief = briefs[edition];
  const stories = brief.stories;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {t('Clear in under 5 minutes', '5 मिनट से कम में स्पष्ट')}
          </p>
          <h1>{t('Daily Briefs', 'दैनिक ब्रीफ')}</h1>
          <p className="lede">
            {t(
              'The essential updates, linked to the full source comparison.',
              'जरूरी अपडेट, पूरी स्रोत तुलना के लिंक के साथ।',
            )}
          </p>
        </div>
      </section>
      <fieldset className="segmented">
        <legend className="sr-status">
          {t('Choose brief edition', 'ब्रीफ संस्करण चुनें')}
        </legend>
        <Button
          variant={edition === 'morning' ? 'default' : 'ghost'}
          onClick={() => setEdition('morning')}
        >
          <SunMedium /> {t('Morning · 6:30', 'सुबह · 6:30')}
        </Button>
        <Button
          variant={edition === 'evening' ? 'default' : 'ghost'}
          onClick={() => setEdition('evening')}
        >
          <MoonStar /> {t('Evening · 18:30', 'शाम · 18:30')}
        </Button>
      </fieldset>
      <article className="brief-sheet">
        <header>
          <div>
            <p className="eyebrow">
              {edition === 'morning'
                ? t('Morning brief', 'सुबह का ब्रीफ')
                : t('Evening brief', 'शाम का ब्रीफ')}
            </p>
            <h2>{brief.title}</h2>
          </div>
          <span className="read-time">
            <Clock3 /> {stories.length + 1} {t('min read', 'मिनट')}
          </span>
        </header>
        {stories.length ? (
          <ol className="brief-list">
            {stories.map((story) => (
              <li key={story.slug}>
                <span className="brief-number" aria-hidden="true">
                  {String(stories.indexOf(story) + 1).padStart(2, '0')}
                </span>
                <div>
                  <span className="brief-category">{story.category}</span>
                  <a href={`/story/${story.slug}?lang=${language}`}>
                    <h3>
                      {language === 'hi' ? story.headlineHi : story.headline}
                    </h3>
                  </a>
                  <p>{language === 'hi' ? story.briefHi : story.brief}</p>
                  <a
                    className="text-link"
                    href={`/story/${story.slug}?lang=${language}`}
                  >
                    {t('Compare sources', 'स्रोतों की तुलना')} →
                  </a>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">
            <Clock3 />
            <h2>{t('This brief is empty', 'यह ब्रीफ खाली है')}</h2>
            <p>
              {t(
                'Published story clusters will appear in the next edition.',
                'प्रकाशित स्टोरी क्लस्टर अगले संस्करण में दिखाई देंगे।',
              )}
            </p>
          </div>
        )}
      </article>
    </>
  );
}
