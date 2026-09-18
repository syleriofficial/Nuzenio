import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FreeSourcePreview } from '@/components/free-source-preview';
import { sourceCardPreviewEnabled } from '@/lib/free-source-cards/gate';
import { normalizeFixturePack } from '@/lib/free-source-cards/model';
import fixtures from '@/lib/free-source-cards/fixtures.json';

export const metadata: Metadata = {
  title: 'Fictional source-card preview',
  robots: { index: false, follow: false },
};

export default async function SourceCardPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Check before reading/rendering fixtures. No public reader or API fallback.
  if (!sourceCardPreviewEnabled(process.env)) notFound();
  const params = await searchParams;
  const filters = {
    lang: params.lang === 'hi' ? ('hi' as const) : ('en' as const),
    original:
      params.original === 'en' || params.original === 'hi'
        ? params.original
        : 'all',
    source:
      params.source === 'pib' || params.source === 'global-voices'
        ? params.source
        : 'all',
  };
  return (
    <FreeSourcePreview
      cards={normalizeFixturePack(fixtures)}
      filters={filters}
    />
  );
}
