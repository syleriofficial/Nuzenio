import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { AppShell } from '@/components/app-shell';
import { SourceDetail } from '@/components/source-detail';
import { getSourceProfile, ReaderApiError } from '@/lib/api-client';
import { routeLanguage, type RouteSearchParams } from '@/lib/reader-query';

type SourcePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: RouteSearchParams;
};

async function loadSource({ params, searchParams }: SourcePageProps) {
  await connection();
  const [{ slug }, language] = await Promise.all([
    params,
    routeLanguage(searchParams),
  ]);
  try {
    return await getSourceProfile(slug, language);
  } catch (error) {
    if (error instanceof ReaderApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata(
  props: SourcePageProps,
): Promise<Metadata> {
  const source = await loadSource(props);
  return {
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
  };
}

export default async function SourcePage(props: SourcePageProps) {
  const source = await loadSource(props);
  return (
    <AppShell>
      <SourceDetail source={source} />
    </AppShell>
  );
}
