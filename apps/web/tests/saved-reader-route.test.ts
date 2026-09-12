import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/reader/story/route';
import { getCluster, ReaderApiError } from '@/lib/api-client';

vi.mock('@/lib/api-client', async (original) => ({
  ...(await original<typeof import('@/lib/api-client')>()),
  getCluster: vi.fn(),
}));
const request = (query: string) =>
  new Request('http://localhost/api/reader/story?' + query, {
    headers: { Cookie: 'staff-session=must-not-forward' },
  });
beforeEach(() => vi.clearAllMocks());

describe('saved bookmark public revalidation', () => {
  it.each([
    'slug=../admin&language=en',
    'slug=hello&language=xx',
    'slug=hello&slug=other&language=en',
    'language=en',
    'slug=http%3A%2F%2Fexample.com&language=en',
  ])('rejects unsafe/ambiguous inputs before API work', async (query) => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(getCluster).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('fetches the current public story only, with no forwarded staff state', async () => {
    vi.mocked(getCluster).mockResolvedValue({
      slug: 'approved-story',
      headline: 'Current correction',
    } as Awaited<ReturnType<typeof getCluster>>);
    const response = await GET(request('slug=approved-story&language=hi'));
    expect(getCluster).toHaveBeenCalledExactlyOnceWith('approved-story', 'hi');
    expect(await response.json()).toEqual({
      story: { slug: 'approved-story', headline: 'Current correction' },
    });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('does not resurrect suppressed content or serve a saved text snapshot', async () => {
    vi.mocked(getCluster).mockRejectedValue(
      new ReaderApiError('private details', 404, 'not_found'),
    );
    const response = await GET(request('slug=withdrawn-story&language=en'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Story unavailable.' });
  });
  it('distinguishes upstream failure from withdrawal without leaking diagnostics', async () => {
    vi.mocked(getCluster).mockRejectedValue(new Error('private diagnostic'));
    const response = await GET(request('slug=approved-story&language=en'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private diagnostic');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
});
