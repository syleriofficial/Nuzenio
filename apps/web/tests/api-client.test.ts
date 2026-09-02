import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getTopFeed,
  ReaderApiError,
  ReaderContractError,
} from '@/lib/api-client';
import type { ApiClusterCard, ApiClusterPage } from '@/lib/api-types';

const cluster: ApiClusterCard = {
  slug: 'sample-cluster',
  category: 'National',
  location: null,
  headline: 'A neutral fictional headline',
  brief:
    'A fictional evidence-backed briefing sentence is used only to validate the typed reader contract.',
  status: 'VERIFIED',
  updatedAt: '2026-09-02T08:00:00+05:30',
  independentSourceCount: 1,
  riskLevel: 'STANDARD',
  reviewState: 'PUBLISHED',
  sources: [
    {
      name: 'Example Publisher',
      slug: 'example-publisher',
      short: 'EP',
      organization: 'Example Publisher Group',
      organizationId: '11111111-1111-1111-1111-111111111111',
      domain: 'publisher.example',
      language: 'en',
      headline: 'Example publisher headline',
      url: 'https://publisher.example/story',
      publishedAt: '2026-09-02T07:30:00+05:30',
      syndicatedCopy: false,
      machineTranslated: false,
    },
  ],
  claims: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      state: 'CONFIRMED',
      text: 'A fictional fact was confirmed.',
      evidence: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          locator: 'Feed excerpt',
          supportScore: 1,
          sourceName: 'Example Publisher',
          sourceUrl: 'https://publisher.example/story',
          primaryDocumentTitle: null,
          primaryDocumentUrl: null,
        },
      ],
    },
  ],
  whyShown: 'National edition',
  language: 'en',
  machineTranslated: false,
  demonstrationData: true,
};

const page = (items: ApiClusterCard[]): ApiClusterPage => ({
  items,
  pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 },
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('typed reader API client', () => {
  it('maps the FastAPI cluster contract to the existing reader model', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(page([cluster])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const result = await getTopFeed('en');
    expect(result).toHaveLength(1);
    expect(result[0].headline).toBe(cluster.headline);
    expect(result[0].confirmed).toEqual(['A fictional fact was confirmed.']);
    expect(result[0].sources[0].url).toBe('https://publisher.example/story');
  });

  it('preserves a legitimate empty API response', async () => {
    vi.stubEnv('NUZENIO_ENABLE_DEMO_FALLBACK', 'true');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(page([])), { status: 200 }),
        ),
    );

    await expect(getTopFeed('en')).resolves.toEqual([]);
  });

  it('never silently falls back in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NUZENIO_ENABLE_DEMO_FALLBACK', 'true');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(getTopFeed('en')).rejects.toBeInstanceOf(ReaderApiError);
  });

  it('uses demo fixtures only when development fallback is explicit', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NUZENIO_ENABLE_DEMO_FALLBACK', 'true');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await getTopFeed('hi');
    expect(result).toHaveLength(7);
    expect(result.every((story) => story.headline === story.headlineHi)).toBe(
      true,
    );
  });

  it('rejects incompatible API payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ items: [{}], pagination: { total: 1 } }),
          {
            status: 200,
          },
        ),
      ),
    );

    await expect(getTopFeed('en')).rejects.toBeInstanceOf(ReaderContractError);
  });
});
