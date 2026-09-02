import type {
  ReaderBrief,
  ReaderLanguage,
  ReaderSourceProfile,
} from '@/lib/api-types';
import { getSource, getStory, storyClusters } from '@/lib/demo-data';
import type { StoryCluster } from '@/lib/story-types';

export function localizeFallbackStory(
  story: StoryCluster,
  language: ReaderLanguage,
): StoryCluster {
  const headline = language === 'hi' ? story.headlineHi : story.headline;
  const brief = language === 'hi' ? story.briefHi : story.brief;
  const confirmed = language === 'hi' ? story.confirmedHi : story.confirmed;
  const developing = language === 'hi' ? story.developingHi : story.developing;
  const disputed = language === 'hi' ? story.disputedHi : story.disputed;
  return {
    ...story,
    headline,
    headlineHi: headline,
    brief,
    briefHi: brief,
    confirmed,
    confirmedHi: confirmed,
    developing,
    developingHi: developing,
    disputed,
    disputedHi: disputed,
    sources: story.sources.map((source) => ({
      ...source,
      headline:
        language === 'hi' && source.headlineHi
          ? source.headlineHi
          : source.headline,
    })),
  };
}

export function fallbackTop(language: ReaderLanguage): StoryCluster[] {
  return storyClusters.map((story) => localizeFallbackStory(story, language));
}

export function fallbackLocal(language: ReaderLanguage): StoryCluster[] {
  return fallbackTop(language).filter((story) => story.location);
}

export function fallbackStory(
  slug: string,
  language: ReaderLanguage,
): StoryCluster | undefined {
  const story = getStory(slug);
  return story ? localizeFallbackStory(story, language) : undefined;
}

export function fallbackSearch(
  query: string,
  language: ReaderLanguage,
): StoryCluster[] {
  const needle = query.toLowerCase();
  return fallbackTop(language).filter((story) =>
    `${story.headline} ${story.category} ${story.location ?? ''} ${story.brief}`
      .toLowerCase()
      .includes(needle),
  );
}

export function fallbackSource(
  slug: string,
  language: ReaderLanguage,
): ReaderSourceProfile | undefined {
  const source = getSource(slug);
  if (!source) return undefined;
  return {
    ...source,
    recentClusters: fallbackTop(language).filter((story) =>
      story.sources.some((item) => item.slug === source.slug),
    ),
  };
}

export function fallbackBriefs(language: ReaderLanguage): {
  morning: ReaderBrief;
  evening: ReaderBrief;
} {
  const stories = fallbackTop(language);
  return {
    morning: {
      title:
        language === 'hi'
          ? 'दिन शुरू होने से पहले जरूरी बातें'
          : 'What matters before your day starts',
      period: 'morning',
      publishedAt: '2026-09-02T06:30:00+05:30',
      stories: stories.slice(0, 4),
    },
    evening: {
      title:
        language === 'hi'
          ? 'आपके दूर रहने पर क्या बदला'
          : 'What changed while you were away',
      period: 'evening',
      publishedAt: '2026-09-02T18:30:00+05:30',
      stories: stories.slice(4),
    },
  };
}
