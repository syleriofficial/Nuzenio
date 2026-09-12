import type { StoryCluster } from './story-types';

export type SavedResult = { slug: string } & (
  | { status: 'ready'; story: StoryCluster }
  | { status: 'unavailable' | 'error' }
);

export async function fetchSavedStory(
  slug: string,
  language: 'en' | 'hi',
  parent: AbortSignal,
): Promise<SavedResult> {
  const error: SavedResult = { slug, status: 'error' };
  if (parent.aborted) return error;
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, { once: true });
  // AbortSignal.any/timeout are not available in every supported reader browser.
  // Keep the deadline active through body decoding, not just response headers.
  const timer = setTimeout(abort, 8000);
  try {
    const response = await fetch(
      `/api/reader/story?slug=${encodeURIComponent(slug)}&language=${language}`,
      {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      },
    );
    if (controller.signal.aborted) return error;
    if (response.status === 404) return { slug, status: 'unavailable' };
    if (!response.ok) return error;
    const payload = await response.json();
    if (
      controller.signal.aborted ||
      !payload?.story ||
      payload.story.slug !== slug ||
      !Array.isArray(payload.story.sources)
    )
      return error;
    return { slug, status: 'ready', story: payload.story };
  } catch {
    return error;
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', abort);
  }
}
