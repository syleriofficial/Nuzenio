import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSavedStory } from '@/lib/fetch-saved-story';

const payload = { story: { slug: 'story-one', sources: [] } };
const ok = () => Response.json(payload);

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('compatible Saved request cancellation', () => {
  it.each(['any', 'timeout', 'both'])(
    'loads without AbortSignal.%s while preserving the public request boundary',
    async (missing) => {
      const original = AbortSignal;
      vi.stubGlobal('AbortSignal', {
        any: missing === 'timeout' ? original.any.bind(original) : undefined,
        timeout:
          missing === 'any' ? original.timeout.bind(original) : undefined,
      });
      const fetch = vi.fn().mockResolvedValue(ok());
      vi.stubGlobal('fetch', fetch);
      const parent = new AbortController();
      expect(await fetchSavedStory('story-one', 'hi', parent.signal)).toEqual({
        slug: 'story-one',
        status: 'ready',
        story: payload.story,
      });
      expect(fetch).toHaveBeenCalledExactlyOnceWith(
        '/api/reader/story?slug=story-one&language=hi',
        expect.objectContaining({ cache: 'no-store', credentials: 'omit' }),
      );
    },
  );
  it('never fetches an already cancelled request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const parent = new AbortController();
    parent.abort();
    expect(await fetchSavedStory('story-one', 'en', parent.signal)).toEqual({
      slug: 'story-one',
      status: 'error',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([200, 404, 503])(
    'cleans listeners and deadline after HTTP %s',
    async (status) => {
      vi.useFakeTimers();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(Response.json(payload, { status })),
      );
      const parent = new AbortController();
      const add = vi.spyOn(parent.signal, 'addEventListener');
      const remove = vi.spyOn(parent.signal, 'removeEventListener');
      const result = await fetchSavedStory('story-one', 'en', parent.signal);
      expect(result.status).toBe(
        status === 200 ? 'ready' : status === 404 ? 'unavailable' : 'error',
      );
      expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it('aborts a stalled fetch at 8 seconds and removes its parent listener', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            requestSignal = options.signal!;
            requestSignal.addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              { once: true },
            );
          }),
      ),
    );
    const parent = new AbortController();
    const remove = vi.spyOn(parent.signal, 'removeEventListener');
    const result = fetchSavedStory('story-one', 'en', parent.signal);
    await vi.advanceTimersByTimeAsync(7999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual({ slug: 'story-one', status: 'error' });
    expect(requestSignal?.aborted).toBe(true);
    expect(parent.signal.aborted).toBe(false);
    expect(remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['parent', 'timeout'])(
    'rejects a late decoded body after %s cancellation',
    async (cause) => {
      vi.useFakeTimers();
      let resolveBody!: (value: unknown) => void;
      const json = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveBody = resolve;
          }),
      );
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json }),
      );
      const parent = new AbortController();
      const result = fetchSavedStory('story-one', 'en', parent.signal);
      await Promise.resolve();
      expect(json).toHaveBeenCalledOnce();
      if (cause === 'parent') parent.abort();
      else await vi.advanceTimersByTimeAsync(8000);
      resolveBody(payload);
      expect(await result).toEqual({ slug: 'story-one', status: 'error' });
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it('keeps parallel requests isolated and cancels all remaining work on navigation', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options: RequestInit) => {
        signals.push(options.signal!);
        if (signals.length === 1) return Promise.resolve(ok());
        return new Promise((_resolve, reject) =>
          options.signal!.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          ),
        );
      }),
    );
    const parent = new AbortController();
    const first = fetchSavedStory('story-one', 'en', parent.signal);
    const second = fetchSavedStory('story-two', 'en', parent.signal);
    expect((await first).status).toBe('ready');
    expect(vi.getTimerCount()).toBe(1);
    parent.abort();
    expect((await second).status).toBe('error');
    expect(signals[0].aborted).toBe(false);
    expect(signals[1].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([
    null,
    {},
    { story: { slug: 'wrong', sources: [] } },
    { story: { slug: 'story-one' } },
  ])('does not publish invalid saved payload %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
    expect(
      (await fetchSavedStory('story-one', 'en', new AbortController().signal))
        .status,
    ).toBe('error');
  });
});
