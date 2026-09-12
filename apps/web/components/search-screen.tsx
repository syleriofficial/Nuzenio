'use client';

import { type SyntheticEvent, useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StoryCard } from '@/components/story-card';
import type { StoryCluster } from '@/lib/story-types';
import { usePreferences } from '@/lib/preferences';
import { useReaderPreferences } from '@/lib/reader-preferences';
import { visibleStories } from '@/lib/reader-state';

export function SearchScreen({
  initialQuery,
  stories: inputStories,
}: {
  initialQuery: string;
  stories: StoryCluster[];
}) {
  const { t } = usePreferences();
  const reader = useReaderPreferences();
  const stories = visibleStories(inputStories, reader);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState(initialQuery);
  const [loading, startTransition] = useTransition();
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const query = input.trim();
    if (query) params.set('q', query);
    else params.delete('q');
    startTransition(() => router.push(`/search?${params.toString()}`));
  };
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {t('Clusters, sources and topics', 'क्लस्टर, स्रोत और विषय')}
          </p>
          <h1>{t('Search', 'खोजें')}</h1>
        </div>
      </section>
      <form className="search-form" onSubmit={submit}>
        <Search aria-hidden="true" />
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t(
            'Try “Delhi”, “technology” or “business”',
            '“दिल्ली”, “तकनीक” या “बिजनेस” खोजें',
          )}
          aria-label={t('Search stories', 'स्टोरी खोजें')}
        />
        <Button type="submit">{t('Search', 'खोजें')}</Button>
      </form>
      {loading ? (
        <div
          className="loading-list"
          aria-live="polite"
          aria-label={t('Searching', 'खोज जारी')}
        >
          <span />
          <span />
          <span />
        </div>
      ) : !initialQuery ? (
        <div className="empty-state">
          <Search />
          <h2>
            {t('Find one story across many sources', 'कई स्रोतों में एक स्टोरी खोजें')}
          </h2>
          <p>
            {t(
              'Results are grouped by event, not repeated by publisher.',
              'परिणाम घटना के आधार पर समूहित हैं, प्रकाशक के आधार पर दोहराए नहीं जाते।',
            )}
          </p>
        </div>
      ) : stories.length ? (
        <main className="story-feed narrow-feed" aria-live="polite">
          {stories.map((story) => (
            <StoryCard key={story.slug} story={story} />
          ))}
        </main>
      ) : (
        <div className="empty-state">
          <Search />
          <h2>{t('No matching story clusters', 'कोई मिलती स्टोरी नहीं')}</h2>
          <p>
            {t(
              'Try a broader topic, city or publisher name, or check hidden sources in Settings.',
              'कोई व्यापक विषय, शहर या प्रकाशक नाम आजमाएं, या सेटिंग्स में छिपे स्रोत जांचें।',
            )}
          </p>
        </div>
      )}
    </>
  );
}
