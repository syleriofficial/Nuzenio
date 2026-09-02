'use client';

import { type SyntheticEvent, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StoryCard } from '@/components/story-card';
import { storyClusters } from '@/lib/demo-data';
import { usePreferences } from '@/lib/preferences';

export function SearchScreen() {
  const { t } = usePreferences();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      setQuery(input.trim());
      setLoading(false);
    }, 250);
  };
  const matches = storyClusters.filter((story) =>
    `${story.headline} ${story.headlineHi} ${story.category} ${story.brief}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const hasError = query.toLowerCase() === 'error';
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
      ) : hasError ? (
        <div className="error-state" role="alert">
          <AlertTriangle />
          <h2>
            {t(
              'Search is temporarily unavailable',
              'खोज अस्थायी रूप से उपलब्ध नहीं',
            )}
          </h2>
          <p>
            {t(
              'Your query is safe. Please try again.',
              'आपकी क्वेरी सुरक्षित है। कृपया फिर कोशिश करें।',
            )}
          </p>
          <Button variant="outline" onClick={() => setQuery('')}>
            {t('Try again', 'फिर कोशिश करें')}
          </Button>
        </div>
      ) : !query ? (
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
      ) : matches.length ? (
        <main className="story-feed narrow-feed" aria-live="polite">
          {matches.map((story) => (
            <StoryCard key={story.slug} story={story} />
          ))}
        </main>
      ) : (
        <div className="empty-state">
          <Search />
          <h2>{t('No matching story clusters', 'कोई मिलती स्टोरी नहीं')}</h2>
          <p>
            {t(
              'Try a broader topic, city or publisher name.',
              'कोई व्यापक विषय, शहर या प्रकाशक नाम आजमाएं।',
            )}
          </p>
        </div>
      )}
    </>
  );
}
