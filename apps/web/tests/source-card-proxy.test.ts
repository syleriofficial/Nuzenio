// Next 16.3.4 still exports this test helper under its legacy name.
import { unstable_doesMiddlewareMatch as doesProxyMatch } from 'next/experimental/testing/server';
import { afterEach, expect, it, vi } from 'vitest';
import { config, proxy } from '@/proxy';

afterEach(() => vi.unstubAllEnvs());

it.each([
  '/',
  '/admin',
  '/saved',
  '/search',
  '/story/demo',
  '/source/demo',
  '/api/reader/story',
  '/_next/static/test.js',
])('does not intercept existing path %s', (url) => {
  expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
});

it.each([
  '/preview/source-cards',
  '/preview/source-cards/',
  '/preview/source-cards?lang=hi',
  '/preview/source-cards/extra',
])('matches the whole lab boundary %s', (url) => {
  expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
});

it('returns a no-store 404 before rendering in production despite opt-ins', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NUZENIO_ENVIRONMENT', 'development');
  vi.stubEnv('NUZENIO_FREE_SOURCE_PREVIEW', 'true');
  vi.stubEnv('NUZENIO_DEMO_MODE', 'true');
  vi.stubEnv('NUZENIO_FEED_KILL_SWITCH', 'true');
  const response = proxy();
  expect(response.status).toBe(404);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(await response.text()).toBe('Not found');
});

it('continues only for explicit development opts and still blocks a disabled kill switch', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('NUZENIO_ENVIRONMENT', 'development');
  vi.stubEnv('NUZENIO_FREE_SOURCE_PREVIEW', 'true');
  vi.stubEnv('NUZENIO_DEMO_MODE', 'true');
  vi.stubEnv('NUZENIO_FEED_KILL_SWITCH', 'true');
  expect(proxy().headers.get('x-middleware-next')).toBe('1');
  vi.stubEnv('NUZENIO_FEED_KILL_SWITCH', 'false');
  expect(proxy().status).toBe(404);
});
