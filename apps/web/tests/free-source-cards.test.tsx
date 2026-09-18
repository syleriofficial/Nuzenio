import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FreeSourcePreview } from '@/components/free-source-preview';
import { sourceCardPreviewEnabled } from '@/lib/free-source-cards/gate';
import {
  normalizeFixture,
  normalizeFixturePack,
} from '@/lib/free-source-cards/model';
import {
  sourceCandidates,
  sourceCardScope,
} from '@/lib/free-source-cards/registry';
import fixtures from '@/lib/free-source-cards/fixtures.json';

const environment = {
  NODE_ENV: 'development',
  NUZENIO_ENVIRONMENT: 'development',
  NUZENIO_FREE_SOURCE_PREVIEW: 'true',
  NUZENIO_DEMO_MODE: 'true',
  NUZENIO_FEED_KILL_SWITCH: 'true',
};
afterEach(() => vi.unstubAllGlobals());

describe('offline source-card boundary', () => {
  it('requires every exact opt-in and never enables a production build', () => {
    expect(sourceCardPreviewEnabled(environment)).toBe(true);
    expect(
      sourceCardPreviewEnabled({ ...environment, NUZENIO_ENVIRONMENT: 'test' }),
    ).toBe(true);
    for (const key of Object.keys(environment)) {
      for (const value of [
        undefined,
        '',
        'false',
        'TRUE',
        ' true ',
        'production',
        'staging',
      ]) {
        expect(
          sourceCardPreviewEnabled({ ...environment, [key]: value }),
          `${key}=${value}`,
        ).toBe(false);
      }
    }
    expect(sourceCardPreviewEnabled({})).toBe(false);
  });

  it('contains two disabled candidates, unknown live rights and no network activity', () => {
    const network = vi.fn(() => {
      throw new Error('No network allowed');
    });
    vi.stubGlobal('fetch', network);
    expect(sourceCandidates.map((s) => s.id)).toEqual(['pib', 'global-voices']);
    for (const source of sourceCandidates) {
      expect(source.enabled).toBe(false);
      expect(source.approval).toBe('not-reviewed');
      expect(new URL(source.policyUrl).protocol).toBe('https:');
    }
    expect(sourceCardScope.liveImport).toBe(false);
    expect(sourceCardScope.publicPublish).toBe(false);
    expect(
      Object.values(sourceCardScope.livePermissions).every(
        (v) => v === 'unknown',
      ),
    ).toBe(true);
    expect(normalizeFixturePack(fixtures)).toHaveLength(4);
    expect(network).not.toHaveBeenCalled();
  });

  it('preserves originals and attribution, never adding generated or disallowed fields', () => {
    const input = {
      ...fixtures[2],
      image: 'https://bad.example/photo.jpg',
      content: 'DO NOT DISPLAY FULL TEXT',
      summary: 'AI TEXT',
      translation: 'AI TEXT',
    };
    const card = normalizeFixture(input);
    expect(card.headline).toBe(input.title);
    expect(card.excerpt).toBe(input.description);
    expect(card.author).toBe(input['dc:creator']);
    expect(card.attribution).toBe(input.attribution);
    expect(card.originalUrl).toBe(input.link);
    expect(card.language).toBe(input.language);
    expect(card).not.toHaveProperty('image');
    expect(card).not.toHaveProperty('content');
    expect(card).not.toHaveProperty('summary');
    expect(card).not.toHaveProperty('translation');
  });

  it.each([
    { fictional: false },
    { fictional: undefined },
    { candidateId: 'unknown' },
    { language: 'fr' },
    { language: '' },
    { title: '' },
    { description: '' },
    { title: '<script>alert(1)</script>' },
    { description: 'x'.repeat(601) },
    { title: 'control\ncharacter' },
    { pubDate: 'yesterday' },
    { pubDate: '2026-02-30T03:30:00.000Z' },
    { guid: 'real-source-id' },
    { author: undefined },
    { licenceUrl: 'https://globalvoices.org/licence' },
    { fixturePermission: undefined },
    { fixturePermission: {} },
    {
      fixturePermission: {
        headline: 'unknown',
        excerpt: 'fixture-only',
        attribution: 'fixture-only',
        revoked: false,
      },
    },
    {
      fixturePermission: {
        headline: 'fixture-only',
        excerpt: 'unknown',
        attribution: 'fixture-only',
        revoked: false,
      },
    },
    {
      fixturePermission: {
        headline: 'fixture-only',
        excerpt: 'fixture-only',
        attribution: 'fixture-only',
        revoked: true,
      },
    },
    {
      fixturePermission: {
        headline: 'approved',
        excerpt: 'approved',
        attribution: 'approved',
        revoked: false,
      },
    },
  ])('rejects unsafe or unapproved fictional inputs: %o', (changes) => {
    expect(() => normalizeFixture({ ...fixtures[0], ...changes })).toThrow();
  });

  it.each([
    'https://pib.gov.in/release',
    'https://global-voices-fixture.example/release',
    'http://pib-fixture.example/release',
    'javascript:alert(1)',
    'https://user:pass@pib-fixture.example/release',
    'https://pib-fixture.example:444/release',
    'https://pib-fixture.example/release?redirect=bad',
    'https://pib-fixture.example/release#bad',
    'https://PIB-fixture.example/release',
    'https://pib-fixture.example/../release',
    'https://pib-fixture.example.evil.test/release',
  ])('rejects live or noncanonical links: %s', (link) => {
    expect(() => normalizeFixture({ ...fixtures[0], link })).toThrow();
  });

  it('rejects duplicate identities and oversized batches atomically', () => {
    expect(() => normalizeFixturePack([fixtures[0], fixtures[0]])).toThrow();
    expect(() =>
      normalizeFixturePack([
        fixtures[0],
        { ...fixtures[0], guid: 'fixture-other' },
      ]),
    ).toThrow();
    expect(() => normalizeFixturePack(Array(21).fill(fixtures[0]))).toThrow();
    expect(() => normalizeFixturePack(null)).toThrow();
  });
});

describe('fictional card display', () => {
  const cards = normalizeFixturePack(fixtures);
  it('shows provenance and demo labels without images, fake save actions or cluster claims', () => {
    const html = renderToStaticMarkup(
      <FreeSourcePreview
        cards={cards}
        filters={{ lang: 'en', original: 'all', source: 'all' }}
      />,
    );
    expect(html).toContain('Fictional preview — not live news');
    expect(html.match(/data-fixture-card=/g)).toHaveLength(4);
    expect(html).toContain('Disabled · not reviewed');
    expect(html).toContain('Attribution example');
    expect(html).toContain('Original link example (not live)');
    expect(html).toContain(cards[0].originalUrl);
    expect(html).not.toMatch(
      /<img|dangerouslySetInnerHTML|independentSourceCount|Save story/,
    );
  });
  it('switches UI without translating or relabelling original English text', () => {
    const html = renderToStaticMarkup(
      <FreeSourcePreview
        cards={cards}
        filters={{ lang: 'hi', original: 'en', source: 'all' }}
      />,
    );
    expect(html).toContain('सीधे स्रोत से।');
    expect(html.match(/data-fixture-card=/g)).toHaveLength(2);
    expect(html).toContain(cards[0].headline);
    expect(html).not.toContain(cards[1].headline);
    expect(html).toContain('lang="en"');
  });
  it('filters by source and original language without mutating fixtures or preferences', () => {
    const before = JSON.stringify(fixtures);
    const html = renderToStaticMarkup(
      <FreeSourcePreview
        cards={cards}
        filters={{ lang: 'en', original: 'hi', source: 'global-voices' }}
      />,
    );
    expect(html.match(/data-fixture-card=/g)).toHaveLength(1);
    expect(html).toContain(cards[3].headline);
    expect(JSON.stringify(fixtures)).toBe(before);
  });
});
