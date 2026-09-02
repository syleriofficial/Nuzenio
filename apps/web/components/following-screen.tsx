'use client';

import { useEffect, useState } from 'react';
import { BellPlus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoryCard } from '@/components/story-card';
import type { StoryCluster } from '@/lib/story-types';
import { usePreferences } from '@/lib/preferences';

const availableTopics = [
  'Business',
  'Technology',
  'Sports',
  'Delhi NCR',
  'National',
];

export function FollowingScreen({ stories }: { stories: StoryCluster[] }) {
  const { t } = usePreferences();
  const [topics, setTopics] = useState<string[]>(['Business', 'Technology']);
  useEffect(() => {
    const saved = JSON.parse(
      localStorage.getItem('nuzenio-followed-topics') ?? '[]',
    );
    if (saved.length) setTopics(saved);
  }, []);
  const toggle = (topic: string) => {
    const next = topics.includes(topic)
      ? topics.filter((item) => item !== topic)
      : [...topics, topic];
    setTopics(next);
    localStorage.setItem('nuzenio-followed-topics', JSON.stringify(next));
  };
  const followedStories = stories.filter((story) =>
    topics.includes(story.category),
  );
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {t('Your topics and sources', 'आपके विषय और स्रोत')}
          </p>
          <h1>{t('Following', 'फॉलोइंग')}</h1>
          <p className="lede">
            {t(
              'A quieter feed from the subjects you chose.',
              'आपके चुने विषयों की शांत फीड।',
            )}
          </p>
        </div>
      </section>
      <section className="topic-picker" aria-labelledby="topic-picker-title">
        <h2 id="topic-picker-title">{t('Topics', 'विषय')}</h2>
        <div>
          {availableTopics.map((topic) => (
            <Button
              key={topic}
              variant={topics.includes(topic) ? 'secondary' : 'outline'}
              onClick={() => toggle(topic)}
              aria-pressed={topics.includes(topic)}
            >
              {topics.includes(topic) ? <X /> : <Plus />}
              {topic}
            </Button>
          ))}
        </div>
      </section>
      {followedStories.length ? (
        <main className="story-feed narrow-feed">
          {followedStories.map((story) => (
            <StoryCard key={story.slug} story={story} />
          ))}
        </main>
      ) : (
        <div className="empty-state">
          <BellPlus />
          <h2>{t('Nothing followed yet', 'अभी कुछ भी फॉलो नहीं')}</h2>
          <p>
            {t(
              'Choose a topic above to build this feed.',
              'यह फीड बनाने के लिए ऊपर कोई विषय चुनें।',
            )}
          </p>
        </div>
      )}
    </>
  );
}
