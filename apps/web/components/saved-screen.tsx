'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoryCard } from '@/components/story-card';
import { usePreferences } from '@/lib/preferences';
import { useReaderPreferences } from '@/lib/reader-preferences';
import type { StoryCluster } from '@/lib/story-types';
import { visibleStories } from '@/lib/reader-state';

type SavedResult = { slug: string } & (
  | { status: 'ready'; story: StoryCluster }
  | { status: 'unavailable' | 'error' }
);
const PAGE_SIZE = 10;

export function SavedScreen() {
  const { t, language } = usePreferences();
  const reader = useReaderPreferences();
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    results: SavedResult[];
  } | null>(null);
  const [message, setMessage] = useState('');
  const pages = Math.max(1, Math.ceil(reader.saved.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const slugs = reader.saved
    .slice()
    .reverse()
    .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
    .join(',');
  const key = `${language}:${slugs}:${refresh}`;

  useEffect(() => {
    const recheck = () => {
      setLoaded(null);
      setRefresh((value) => value + 1);
    };
    const visible = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    window.addEventListener('focus', recheck);
    window.addEventListener('online', recheck);
    window.addEventListener('offline', recheck);
    window.addEventListener('pageshow', recheck);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('focus', recheck);
      window.removeEventListener('online', recheck);
      window.removeEventListener('offline', recheck);
      window.removeEventListener('pageshow', recheck);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!reader.ready || !slugs) return () => controller.abort();
    const load = async (slug: string): Promise<SavedResult> => {
      try {
        const response = await fetch(
          `/api/reader/story?slug=${encodeURIComponent(slug)}&language=${language}`,
          {
            cache: 'no-store',
            credentials: 'omit',
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(8000),
            ]),
          },
        );
        if (response.status === 404) return { slug, status: 'unavailable' };
        if (!response.ok) return { slug, status: 'error' };
        const payload = await response.json();
        if (
          !payload.story ||
          payload.story.slug !== slug ||
          !Array.isArray(payload.story.sources)
        )
          return { slug, status: 'error' };
        return { slug, status: 'ready', story: payload.story };
      } catch {
        return { slug, status: 'error' };
      }
    };
    void Promise.all(slugs.split(',').map(load)).then((results) => {
      if (!controller.signal.aborted) setLoaded({ key, results });
    });
    return () => controller.abort();
  }, [reader.ready, slugs, language, key]);

  const remove = (slug: string) => {
    setMessage(
      reader.toggle('saved', slug)
        ? t('Removed from saved stories.', 'सेव से हटाया गया।')
        : t(
            'Could not remove bookmark. Check browser storage.',
            'बुकमार्क नहीं हटा। ब्राउज़र स्टोरेज जांचें।',
          ),
    );
  };
  return (
    <main>
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('Your reading list', 'आपकी रीडिंग सूची')}</p>
          <h1>{t('Saved stories', 'सेव की गई स्टोरी')}</h1>
          <p className="lede">
            {t(
              'Bookmarks stay in this browser, not across devices. Stories are checked online each time; article text is not stored offline.',
              'बुकमार्क इसी ब्राउज़र में रहते हैं, अन्य डिवाइस पर नहीं। स्टोरी हर बार ऑनलाइन जांची जाती हैं; लेख ऑफलाइन सेव नहीं होते।',
            )}
          </p>
        </div>
      </section>
      <output aria-live="polite">{message}</output>
      {!reader.ready ? (
        <output aria-live="polite">
          {t('Loading bookmarks…', 'बुकमार्क लोड हो रहे हैं…')}
        </output>
      ) : !reader.saved.length ? (
        <section className="empty-state">
          <Bookmark />
          <h2>{t('No saved stories yet', 'अभी कोई स्टोरी सेव नहीं')}</h2>
          <p>
            {t(
              'Use Save on a story card or story page.',
              'स्टोरी कार्ड या स्टोरी पेज पर सेव करें।',
            )}
          </p>
          <Link href={`/?lang=${language}`}>
            {t('Explore Top News', 'मुख्य समाचार देखें')}
          </Link>
        </section>
      ) : (
        <>
          <div className="reader-list-toolbar">
            <p>
              {reader.saved.length} {t('bookmarks', 'बुकमार्क')} ·{' '}
              {t('Page', 'पेज')} {currentPage + 1}/{pages}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setLoaded(null);
                setRefresh((value) => value + 1);
              }}
            >
              {t('Refresh stories', 'स्टोरी रीफ्रेश करें')}
            </Button>
          </div>
          {loaded?.key !== key ? (
            <output aria-live="polite">
              {t(
                'Checking current public stories…',
                'वर्तमान सार्वजनिक स्टोरी जांची जा रही हैं…',
              )}
            </output>
          ) : (
            <div className="story-feed narrow-feed">
              {loaded.results.map((result) => {
                if (
                  result.status === 'ready' &&
                  visibleStories([result.story], reader).length
                )
                  return <StoryCard key={result.slug} story={result.story} />;
                return (
                  <section className="story-card" key={result.slug}>
                    <h2>
                      {result.status === 'ready'
                        ? t(
                            'Hidden by your source preferences',
                            'आपकी स्रोत प्राथमिकताओं से छिपी',
                          )
                        : result.status === 'unavailable'
                          ? t(
                              'Story no longer publicly available',
                              'स्टोरी अब सार्वजनिक रूप से उपलब्ध नहीं',
                            )
                          : t(
                              'Could not check this story',
                              'यह स्टोरी जांची नहीं जा सकी',
                            )}
                    </h2>
                    <p className="saved-bookmark-id">{result.slug}</p>
                    <p>
                      {result.status === 'error'
                        ? t(
                            'Check your connection and refresh. No old copy is shown.',
                            'कनेक्शन जांचकर रीफ्रेश करें। पुरानी प्रति नहीं दिखाई जाती।',
                          )
                        : t(
                            'Your bookmark remains until you remove it.',
                            'हटाने तक आपका बुकमार्क बना रहेगा।',
                          )}
                    </p>
                    {result.status === 'ready' && (
                      <Link href={`/settings?lang=${language}`}>
                        {t('Manage hidden sources', 'छिपे स्रोत बदलें')}
                      </Link>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => remove(result.slug)}
                    >
                      {t('Remove bookmark', 'बुकमार्क हटाएं')}
                    </Button>
                  </section>
                );
              })}
            </div>
          )}
          <nav
            className="reader-list-toolbar"
            aria-label={t('Saved stories pages', 'सेव स्टोरी पेज')}
          >
            <Button
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              {t('Previous', 'पिछला')}
            </Button>
            <Button
              variant="outline"
              disabled={currentPage >= pages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              {t('Next', 'अगला')}
            </Button>
          </nav>
        </>
      )}
    </main>
  );
}
