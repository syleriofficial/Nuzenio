import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ErrorState from '@/app/error';
import Loading from '@/app/loading';
import { FeedScreen } from '@/components/feed-screen';
import { PreferencesProvider } from '@/lib/preferences';

describe('reader route states', () => {
  it('renders an accessible loading state', () => {
    const html = renderToStaticMarkup(<Loading />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Preparing story clusters');
  });

  it('renders a recoverable error state with retry action', () => {
    const html = renderToStaticMarkup(
      <ErrorState error={new Error('offline')} retry={vi.fn()} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('We could not load this edition');
    expect(html).toContain('Try again');
  });

  it('renders the bilingual empty feed state', () => {
    const html = renderToStaticMarkup(
      <PreferencesProvider>
        <FeedScreen
          title="Local"
          titleHi="स्थानीय"
          description="Local coverage"
          descriptionHi="स्थानीय कवरेज"
          eyebrow="Delhi NCR"
          eyebrowHi="दिल्ली एनसीआर"
          stories={[]}
          local
        />
      </PreferencesProvider>,
    );
    expect(html).toContain('No published clusters yet');
    expect(html).toContain('Approved, evidence-backed reporting');
  });
});
