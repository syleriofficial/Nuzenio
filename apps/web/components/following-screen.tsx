'use client';

import { BellPlus, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StoryCard } from '@/components/story-card';
import type { StoryCluster } from '@/lib/story-types';
import { usePreferences } from '@/lib/preferences';
import { useReaderPreferences } from '@/lib/reader-preferences';
import {
  followsStory,
  TOPICS,
  topicLabel,
  visibleStories,
} from '@/lib/reader-state';

export function FollowingScreen({ stories }: { stories: StoryCluster[] }) {
  const { t, language } = usePreferences();
  const reader = useReaderPreferences();
  const followedStories = visibleStories(stories, reader).filter((story) =>
    followsStory(story, reader),
  );
  const sourceNames = new Map(
    stories.flatMap((story) =>
      story.sources.map((source) => [source.slug, source.name] as const),
    ),
  );
  return (
    <main>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {t('Your topics and sources', 'आपके विषय और स्रोत')}
          </p>
          <h1>{t('Following', 'फॉलोइंग')}</h1>
          <Link href={`/saved?lang=${language}`}>
            {t('Open saved stories', 'सेव की गई स्टोरी खोलें')}
          </Link>
          <p className="lede">
            {t(
              'Recent stories from your choices. Saved only in this browser.',
              'आपकी पसंद की हाल की स्टोरी। केवल इस ब्राउज़र में सेव होती हैं।',
            )}
          </p>
        </div>
      </section>
      <section className="topic-picker" aria-labelledby="topic-picker-title">
        <h2 id="topic-picker-title">{t('Topics', 'विषय')}</h2>
        <div>
          {TOPICS.map((topic) => (
            <Button
              key={topic}
              variant={reader.topics.includes(topic) ? 'secondary' : 'outline'}
              onClick={() => reader.toggle('topics', topic)}
              disabled={!reader.ready}
              aria-pressed={reader.topics.includes(topic)}
            >
              {reader.topics.includes(topic) ? <X /> : <Plus />}
              {t(topic, topicLabel(topic))}
            </Button>
          ))}
        </div>
      </section>
      <section className="topic-picker" aria-labelledby="source-picker-title">
        <h2 id="source-picker-title">
          {t('Followed sources', 'फॉलो किए स्रोत')}
        </h2>
        <p>
          {t(
            'Follow a publisher from its source profile. Hidden sources stay excluded even when followed.',
            'स्रोत प्रोफाइल से प्रकाशक फॉलो करें। फॉलो होने पर भी छिपे स्रोत बाहर रहेंगे।',
          )}
        </p>
        <div>
          {reader.sources.map((slug) => (
            <div key={slug} className="reader-source-choice">
              <Link href={`/source/${slug}?lang=${language}`}>
                {sourceNames.get(slug) ?? slug.replaceAll('-', ' ')}
              </Link>
              <Button
                variant="outline"
                onClick={() => reader.toggle('sources', slug)}
                aria-label={t(
                  `Unfollow ${sourceNames.get(slug) ?? slug}`,
                  `${sourceNames.get(slug) ?? slug} अनफॉलो करें`,
                )}
              >
                <X />
                {t('Unfollow', 'अनफॉलो')}
              </Button>
            </div>
          ))}
        </div>
        {!reader.sources.length && (
          <p>{t('No sources followed yet.', 'अभी कोई स्रोत फॉलो नहीं है।')}</p>
        )}
      </section>
      {followedStories.length ? (
        <div className="story-feed narrow-feed">
          {followedStories.map((story) => (
            <StoryCard key={story.slug} story={story} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BellPlus />
          <h2>
            {reader.topics.length || reader.sources.length
              ? t(
                  'No matching stories in this edition',
                  'इस संस्करण में कोई मिलती स्टोरी नहीं',
                )
              : t('Nothing followed yet', 'अभी कुछ भी फॉलो नहीं')}
          </h2>
          <p>
            {t(
              'Choose topics above or follow a source. Check Settings if you have hidden sources.',
              'ऊपर विषय चुनें या स्रोत फॉलो करें। स्रोत छिपाए हैं तो सेटिंग्स जांचें।',
            )}
          </p>
          <Link href={`/settings?lang=${language}`}>
            {t('Manage preferences', 'प्राथमिकताएं बदलें')}
          </Link>
        </div>
      )}
    </main>
  );
}
