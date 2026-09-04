import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

function worker(response = new Response('static')) {
  const handlers: Record<
    string,
    (event: {
      request: Request;
      respondWith: (value: Promise<Response>) => void;
    }) => void
  > = {};
  const put = vi.fn();
  const open = vi.fn().mockResolvedValue({ put });
  const fetcher = vi.fn().mockResolvedValue(response);
  runInNewContext(
    readFileSync(
      new URL('../public/service-worker.js', import.meta.url),
      'utf8',
    ),
    {
      self: {
        location: { origin: 'https://nuzenio.test' },
        addEventListener: (
          name: string,
          handler: (typeof handlers)[string],
        ) => {
          handlers[name] = handler;
        },
      },
      URL,
      Response,
      fetch: fetcher,
      caches: { open },
    },
  );
  return {
    fetcher,
    put,
    open,
    run: (request: Request) => {
      let result: Promise<Response> | undefined;
      handlers.fetch({
        request,
        respondWith: (value) => {
          result = value;
        },
      });
      return result;
    },
  };
}

it.each([
  '/v1/admin/clusters',
  '/v1/admin/auth/session',
  '/v1/feed/top',
  '/admin',
  '/?_rsc=private',
  '/_next/static/app.js?token=private',
])('never intercepts private, API, or query requests: %s', (path) => {
  const sw = worker();
  expect(sw.run(new Request('https://nuzenio.test' + path))).toBeUndefined();
  expect(sw.fetcher).not.toHaveBeenCalled();
  expect(sw.put).not.toHaveBeenCalled();
});

const privateResponseHeaders: Record<string, string>[] = [
  { 'cache-control': 'private, max-age=100' },
  { 'cache-control': 'no-store' },
  { 'content-type': 'text/x-component' },
];
it.each(privateResponseHeaders)(
  'never stores disallowed responses even on static URLs: %o',
  async (headers) => {
    const sw = worker(new Response('private response', { headers }));
    await sw.run(new Request('https://nuzenio.test/icon-192.png'));
    expect(sw.put).not.toHaveBeenCalled();
  },
);

const privateRequestHeaders: Record<string, string>[] = [
  { RSC: '1' },
  { Authorization: 'Bearer fixture' },
  { 'Next-Router-State-Tree': 'fixture' },
];
it.each(privateRequestHeaders)(
  'bypasses RSC/authenticated requests: %o',
  (headers) => {
    const sw = worker();
    expect(
      sw.run(
        new Request('https://nuzenio.test/_next/static/app.js', { headers }),
      ),
    ).toBeUndefined();
  },
);

it('allows static assets and strips credentials from their fetch', async () => {
  const sw = worker();
  await sw.run(new Request('https://nuzenio.test/icon-192.png'));
  expect(sw.put).toHaveBeenCalledOnce();
  expect(sw.fetcher.mock.calls[0][1].credentials).toBe('omit');
});

it.each([
  { cache: 'no-store' as RequestCache },
  { headers: { 'Cache-Control': 'no-store' } },
  { headers: { 'Cache-Control': 'max-age=0, No-StOrE, no-cache' } },
  { headers: { 'Cache-Control': 'extension="a,b", NO-STORE' } },
  { headers: { 'Cache-Control': 'extension="a\\\",b", no-store' } },
])('no-store bypasses all worker cache access: %o', (options) => {
  const sw = worker();
  expect(
    sw.run(new Request('https://nuzenio.test/icon-192.png', options)),
  ).toBeUndefined();
  expect(sw.open).not.toHaveBeenCalled();
  expect(sw.put).not.toHaveBeenCalled();
});

it('does not mistake quoted extension content for a no-store directive', async () => {
  const sw = worker();
  await sw.run(
    new Request('https://nuzenio.test/icon-192.png', {
      headers: { 'Cache-Control': 'extension="a,no-store,b", max-age=0' },
    }),
  );
  expect(sw.put).toHaveBeenCalledOnce();
});
