import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SourceDetail, type SourceProfile } from '@/components/source-detail';
import { getSource, sourceProfiles } from '@/lib/demo-data';

export function generateStaticParams() {
  return sourceProfiles.map((source) => ({ slug: source.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const source = getSource((await params).slug);
  return source
    ? {
        title: source.name,
        description: source.description,
        openGraph: {
          title: `${source.name} source profile`,
          description: source.description,
          images: [],
        },
        twitter: {
          card: 'summary',
          title: `${source.name} source profile`,
          description: source.description,
          images: [],
        },
      }
    : { title: 'Source not found' };
}
export default async function SourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const source = getSource((await params).slug);
  if (!source) notFound();
  return (
    <AppShell>
      <SourceDetail source={source as SourceProfile} />
    </AppShell>
  );
}
