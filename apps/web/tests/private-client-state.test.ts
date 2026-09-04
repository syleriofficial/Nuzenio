import { afterEach, expect, it, vi } from 'vitest';
import { adminRequest, resetPrivateRequests } from '@/lib/admin-api-client';

afterEach(() => {
  resetPrivateRequests();
  vi.unstubAllGlobals();
});

it('discard private responses that arrive after logout/account change', async () => {
  let resolve!: (value: Response) => void;
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise<Response>((done) => {
        resolve = done;
      });
    }),
  );
  const request = adminRequest('/v1/admin/clusters');
  const rejected = expect(request).rejects.toMatchObject({
    name: 'AbortError',
  });
  resetPrivateRequests();
  expect(signal?.aborted).toBe(true);
  resolve(new Response(JSON.stringify({ secret: 'old account data' })));
  await rejected;
});

it('new account requests remain usable and always bypass the HTTP cache', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ account: 'new' })));
  vi.stubGlobal('fetch', fetcher);
  resetPrivateRequests();
  expect(await adminRequest('/v1/admin/auth/session')).toEqual({
    account: 'new',
  });
  expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
});
