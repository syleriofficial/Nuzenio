import { describe, expect, it } from 'vitest';
import {
  createReaderStore,
  INITIAL_READER_STATE,
  MAX_PREFERENCES,
  READER_KEYS,
  followsStory,
  personalizeStories,
  visibleStories,
  whyStory,
} from '@/lib/reader-state';
import type { StoryCluster } from '@/lib/story-types';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
const story = (slug: string, category: string, sources: string[]) =>
  ({
    slug,
    category,
    sources: sources.map((slug) => ({ slug, name: slug })),
    independentSourceCount: sources.length,
  }) as StoryCluster;

describe('browser-local reader preferences', () => {
  it('supports database-length slugs and round-trips a full bounded list', () => {
    const ids = Array.from({ length: MAX_PREFERENCES }, (_, index) =>
      ('story-' + index).padEnd(300, 'x'),
    );
    const data = storage({ [READER_KEYS.saved]: JSON.stringify(ids) });
    const store = createReaderStore(() => data);
    store.refresh();
    expect(store.getSnapshot().saved).toEqual(ids);
    expect(store.toggle('saved', 'x'.repeat(301))).toBe(false);
    expect(store.toggle('saved', 'not--canonical')).toBe(false);
  });
  it('has deterministic SSR state and no implicit followed topics', () => {
    const store = createReaderStore(() => storage());
    expect(store.getSnapshot()).toBe(INITIAL_READER_STATE);
    store.refresh();
    expect(store.getSnapshot()).toMatchObject({
      topics: [],
      saved: [],
      ready: true,
    });
  });
  it('preserves explicit empty legacy topics across a reload', () => {
    const data = storage({ [READER_KEYS.topics]: '[]' });
    const first = createReaderStore(() => data);
    first.toggle('topics', 'Business');
    first.toggle('topics', 'Business');
    const reloaded = createReaderStore(() => data);
    reloaded.refresh();
    expect(reloaded.getSnapshot().topics).toEqual([]);
  });
  it.each(['{broken', 'null', '{}', '12', '"Technology"', 'x'.repeat(33000)])(
    'tolerates malformed local JSON: %s',
    (raw) => {
      const store = createReaderStore(() =>
        storage({ [READER_KEYS.saved]: raw }),
      );
      store.refresh();
      expect(store.getSnapshot().saved).toEqual([]);
    },
  );
  it('validates and deduplicates legacy IDs and topics without touching unrelated storage', () => {
    const data = storage({
      unrelated: 'keep',
      [READER_KEYS.saved]: '["a","a",null,42,"../admin","https://bad.test"]',
      [READER_KEYS.topics]: '["Technology","x","Technology"]',
    });
    const store = createReaderStore(() => data);
    store.refresh();
    expect(store.getSnapshot().saved).toEqual(['a']);
    expect(store.getSnapshot().topics).toEqual(['Technology']);
    store.toggle('saved', 'b');
    expect(data.values.get('unrelated')).toBe('keep');
  });
  it('notifies all consumers of a successful change and retains only IDs', () => {
    const data = storage();
    const store = createReaderStore(() => data);
    store.refresh();
    let first = 0,
      second = 0;
    const unsubscribe = store.subscribe(() => first++);
    store.subscribe(() => second++);
    expect(store.toggle('saved', 'national-story')).toBe(true);
    expect([first, second]).toEqual([1, 1]);
    unsubscribe();
    store.toggle('saved', 'national-story');
    expect([first, second]).toEqual([1, 2]);
    expect([...data.values.keys()]).toEqual([READER_KEYS.saved]);
  });
  it('refreshes from another tab before mutation, without clobbering other fields', () => {
    const data = storage();
    const first = createReaderStore(() => data),
      second = createReaderStore(() => data);
    first.toggle('saved', 'one');
    second.toggle('topics', 'Sports');
    second.toggle('saved', 'two');
    first.refresh();
    expect(first.getSnapshot()).toMatchObject({
      saved: ['one', 'two'],
      topics: ['Sports'],
    });
    data.values.clear();
    first.refresh();
    expect(first.getSnapshot().saved).toEqual([]);
  });
  it('does not claim persistence when storage reads or writes fail', () => {
    const blocked = createReaderStore(() => {
      throw new Error('SecurityError');
    });
    expect(blocked.toggle('saved', 'a')).toBe(false);
    expect(blocked.getSnapshot()).toMatchObject({
      saved: [],
      ready: true,
      storageAvailable: false,
    });
    const data = storage();
    const quota = createReaderStore(() => ({
      ...data,
      setItem() {
        throw new Error('QuotaExceeded');
      },
    }));
    expect(quota.toggle('saved', 'a')).toBe(false);
    expect(quota.getSnapshot().saved).toEqual([]);
    expect(data.getItem(READER_KEYS.saved)).toBeNull();
  });
  it('bounds collection size without silently dropping existing bookmarks', () => {
    const ids = Array.from({ length: MAX_PREFERENCES }, (_, i) => 'story-' + i);
    const data = storage({ [READER_KEYS.saved]: JSON.stringify(ids) });
    const store = createReaderStore(() => data);
    expect(store.toggle('saved', 'overflow')).toBe(false);
    expect(store.getSnapshot().saved).toEqual(ids);
    expect(store.toggle('saved', ids[0])).toBe(true);
    expect(store.toggle('saved', 'overflow')).toBe(true);
  });
  it.each(['saved', 'sources', 'hidden'] as const)(
    'preserves legacy overflow in %s while limiting only future additions',
    (key) => {
      const ids = Array.from({ length: 251 }, (_, i) => 'legacy-' + i);
      const raw = JSON.stringify(ids);
      const data = storage({ [READER_KEYS[key]]: raw, unrelated: 'keep' });
      const store = createReaderStore(() => data);
      store.refresh();
      expect(store.getSnapshot()[key]).toEqual(ids);
      expect(data.getItem(READER_KEYS[key])).toBe(raw);
      expect(store.toggle(key, 'new-item')).toBe(false);
      expect(data.getItem(READER_KEYS[key])).toBe(raw);
      for (const id of [ids[0], ids[125], ids[250]]) {
        expect(store.toggle(key, id)).toBe(true);
        ids.splice(ids.indexOf(id), 1);
        expect(JSON.parse(data.getItem(READER_KEYS[key])!)).toEqual(ids);
      }
      const next = createReaderStore(() => data);
      next.refresh();
      expect(next.getSnapshot()[key]).toEqual(ids);
      expect(data.getItem('unrelated')).toBe('keep');
    },
  );
  it('removes exactly one of 201 old bookmarks and recovers addition capacity', () => {
    const ids = Array.from({ length: 201 }, (_, i) => 'story-' + i);
    const data = storage({ [READER_KEYS.saved]: JSON.stringify(ids) });
    const store = createReaderStore(() => data);
    expect(store.toggle('saved', 'story-0')).toBe(true);
    expect(JSON.parse(data.getItem(READER_KEYS.saved)!)).toEqual(ids.slice(1));
    expect(store.toggle('saved', 'new-story')).toBe(false);
    expect(store.toggle('saved', 'story-200')).toBe(true);
    expect(store.toggle('saved', 'new-story')).toBe(true);
    expect(JSON.parse(data.getItem(READER_KEYS.saved)!)).toEqual([
      ...ids.slice(1, 200),
      'new-story',
    ]);
  });
  it('preserves long legacy IDs and rereads overflow changes from other tabs', () => {
    const ids = Array.from({ length: 300 }, (_, i) =>
      ('story-' + i).padEnd(300, 'x'),
    );
    const data = storage({ [READER_KEYS.saved]: JSON.stringify(ids) });
    const first = createReaderStore(() => data);
    const second = createReaderStore(() => data);
    first.refresh();
    expect(second.toggle('saved', ids[299])).toBe(true);
    expect(first.toggle('saved', ids[0])).toBe(true);
    expect(first.getSnapshot().saved).toEqual(ids.slice(1, 299));
    expect(JSON.parse(data.getItem(READER_KEYS.saved)!)).toEqual(
      ids.slice(1, 299),
    );
  });
  it('refuses edits rather than overwriting legacy storage above the parsing budget', () => {
    const raw = JSON.stringify(
      Array.from({ length: 500 }, (_, i) => ('story-' + i).padEnd(300, 'x')),
    );
    expect(raw.length).toBeGreaterThan(131072);
    const data = storage({ [READER_KEYS.saved]: raw });
    const store = createReaderStore(() => data);
    store.refresh();
    expect(store.getSnapshot().storageAvailable).toBe(false);
    expect(store.toggle('saved', 'new-story')).toBe(false);
    expect(data.getItem(READER_KEYS.saved)).toBe(raw);
    // The user can still recover after replacing the oversized data externally.
    data.setItem(READER_KEYS.saved, '["retained"]');
    expect(store.toggle('saved', 'new-story')).toBe(true);
    expect(store.getSnapshot().saved).toEqual(['retained', 'new-story']);
  });
  it('persists source follows, hides and personalisation independently', () => {
    const data = storage(),
      store = createReaderStore(() => data);
    store.toggle('sources', 'janadesh');
    store.toggle('hidden', 'janadesh');
    store.setPersonalized(false);
    const next = createReaderStore(() => data);
    next.refresh();
    expect(next.getSnapshot()).toMatchObject({
      sources: ['janadesh'],
      hidden: ['janadesh'],
      personalized: false,
    });
  });
});

describe('transparent reader selection', () => {
  const stories = [
    story('a', 'National', ['one', 'two']),
    story('b', 'Sports', ['two']),
    story('c', 'Technology', ['three']),
  ];
  const state = {
    ...INITIAL_READER_STATE,
    ready: true,
    topics: ['Technology'],
    sources: ['two'],
  };
  it('follows topics OR sources without duplicating clusters', () => {
    expect(stories.filter((item) => followsStory(item, state))).toHaveLength(3);
  });
  it('hides complete containing clusters without rewriting editorial source counts', () => {
    const original = JSON.stringify(stories);
    expect(
      visibleStories(stories, { ...state, hidden: ['one'] }).map(
        (item) => item.slug,
      ),
    ).toEqual(['b', 'c']);
    expect(JSON.stringify(stories)).toBe(original);
    expect(stories[0].independentSourceCount).toBe(2);
  });
  it('ranks followed choices first, retaining stable edition order otherwise', () => {
    expect(
      personalizeStories(stories, { ...state, sources: [] }).map(
        (item) => item.slug,
      ),
    ).toEqual(['c', 'a', 'b']);
    expect(whyStory(stories[2], state)[0]).toBe('You follow Technology.');
    expect(whyStory(stories[0], state)[0]).toBe('You follow two.');
    expect(whyStory(stories[0], { ...state, sources: [] })[0]).toContain(
      'not a followed',
    );
  });
  it('personalisation off disables boosting but does not bypass hide preferences', () => {
    expect(
      personalizeStories(stories, {
        ...state,
        personalized: false,
        hidden: ['one'],
      }).map((item) => item.slug),
    ).toEqual(['b', 'c']);
    expect(
      whyStory(stories[2], { ...state, personalized: false })[0],
    ).toContain('off');
  });
});
