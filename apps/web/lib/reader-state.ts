import type { StoryCluster } from './story-types';

export const TOPICS = [
  'Business',
  'Technology',
  'Sports',
  'Delhi NCR',
  'National',
] as const;
export const READER_KEYS = {
  saved: 'nuzenio-saved',
  topics: 'nuzenio-followed-topics',
  sources: 'nuzenio-followed-sources',
  hidden: 'nuzenio-hidden-sources',
  personalized: 'nuzenio-personalization',
} as const;
export const MAX_PREFERENCES = 200;
export const validSlug = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= 300 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export interface ReaderState {
  saved: string[];
  topics: string[];
  sources: string[];
  hidden: string[];
  personalized: boolean;
  ready: boolean;
  storageAvailable: boolean;
}
type ListKey = 'saved' | 'topics' | 'sources' | 'hidden';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export const INITIAL_READER_STATE: ReaderState = {
  saved: [],
  topics: [],
  sources: [],
  hidden: [],
  personalized: true,
  ready: false,
  storageAvailable: true,
};

function readList(storage: StoragePort, key: ListKey): string[] {
  const raw = storage.getItem(READER_KEYS[key]);
  if (!raw || raw.length > 131072) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return [
    ...new Set(
      parsed.filter((value): value is string =>
        key === 'topics'
          ? TOPICS.some((topic) => topic === value)
          : validSlug(value),
      ),
    ),
  ].slice(0, MAX_PREFERENCES);
}

// Only IDs/preferences are retained. Never persist article text or API payloads.
export function createReaderStore(getStorage: () => StoragePort) {
  let state = INITIAL_READER_STATE;
  const listeners = new Set<() => void>();
  const publish = (next: ReaderState) => {
    if (JSON.stringify(state) === JSON.stringify(next)) return;
    state = next;
    listeners.forEach((listener) => listener());
  };
  const refresh = () => {
    try {
      const storage = getStorage();
      publish({
        saved: readList(storage, 'saved'),
        topics: readList(storage, 'topics'),
        sources: readList(storage, 'sources'),
        hidden: readList(storage, 'hidden'),
        personalized: storage.getItem(READER_KEYS.personalized) !== 'false',
        ready: true,
        storageAvailable: true,
      });
    } catch {
      publish({ ...state, ready: true, storageAvailable: false });
    }
  };
  const write = (key: keyof typeof READER_KEYS, value: string[] | boolean) => {
    try {
      getStorage().setItem(READER_KEYS[key], JSON.stringify(value));
      publish({ ...state, [key]: value, ready: true, storageAvailable: true });
      return true;
    } catch {
      publish({ ...state, ready: true, storageAvailable: false });
      return false;
    }
  };
  return {
    getSnapshot: () => state,
    refresh,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggle(this: void, key: ListKey, value: string) {
      if (
        key === 'topics'
          ? !TOPICS.some((topic) => topic === value)
          : !validSlug(value)
      )
        return false;
      refresh();
      if (!state.storageAvailable) return false;
      const current = state[key];
      if (!current.includes(value) && current.length >= MAX_PREFERENCES)
        return false;
      return write(
        key,
        current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      );
    },
    setPersonalized(this: void, value: boolean) {
      refresh();
      return state.storageAvailable && write('personalized', value);
    },
  };
}

// Hiding a source removes the entire containing cluster from feed lists. This
// preserves the API's editorial evidence and independent-source counts intact.
// Direct story/source links stay accessible; this is a preference, not an ACL.
export function visibleStories(stories: StoryCluster[], state: ReaderState) {
  return stories.filter(
    (story) =>
      !story.sources.some((source) => state.hidden.includes(source.slug)),
  );
}
export function followsStory(story: StoryCluster, state: ReaderState) {
  return (
    state.topics.includes(story.category) ||
    story.sources.some((source) => state.sources.includes(source.slug))
  );
}
export function personalizeStories(
  stories: StoryCluster[],
  state: ReaderState,
) {
  const visible = visibleStories(stories, state);
  if (!state.personalized) return visible;
  // Stable, transparent ranking over this recent edition, not engagement scores.
  return visible
    .map((story, index) => ({
      story,
      index,
      score: Number(followsStory(story, state)),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ story }) => story);
}
export function whyStory(
  story: StoryCluster,
  state: ReaderState,
): [string, string] {
  if (!state.personalized)
    return [
      'Recent edition; personalisation is off.',
      'हाल का संस्करण; निजीकरण बंद है।',
    ];
  if (state.topics.includes(story.category))
    return [
      `You follow ${story.category}.`,
      `आप ${topicLabel(story.category)} फॉलो करते हैं।`,
    ];
  const source = story.sources.find((item) =>
    state.sources.includes(item.slug),
  );
  if (source)
    return [`You follow ${source.name}.`, `आप ${source.name} फॉलो करते हैं।`];
  return [
    'From the recent India edition; not a followed topic or source.',
    'हाल के भारत संस्करण से; यह फॉलो किया विषय या स्रोत नहीं है।',
  ];
}
export function topicLabel(topic: string) {
  const labels: Record<string, string> = {
    Business: 'बिजनेस',
    Technology: 'तकनीक',
    Sports: 'खेल',
    'Delhi NCR': 'दिल्ली NCR',
    National: 'राष्ट्रीय',
  };
  return labels[topic] ?? topic;
}
