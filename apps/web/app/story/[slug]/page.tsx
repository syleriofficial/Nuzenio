import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { AppShell } from '@/components/app-shell';
import { StoryDetail } from '@/components/story-detail';
import { getCluster, ReaderApiError } from '@/lib/api-client';
import { routeLanguage, type RouteSearchParams } from '@/lib/reader-query';

type StoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: RouteSearchParams;
};

async function loadStory({ params, searchParams }: StoryPageProps) {
  await connection();
  const [{ slug }, language] = await Promise.all([
    params,
    routeLanguage(searchParams),
  ]);
  try {
    return await getCluster(slug, language);
  } catch (error) {
    if (error instanceof ReaderApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata(
  props: StoryPageProps,
): Promise<Metadata> {
  const story = await loadStory(props);
  return {
    title: story.headline,
    description: story.brief,
    openGraph: { title: story.headline, description: story.brief, images: [] },
    twitter: {
      card: 'summary',
      title: story.headline,
      description: story.brief,
      images: [],
    },
  };
}

export default async function StoryPage(props: StoryPageProps) {
  const story = await loadStory(props);
  return (
    <AppShell>
      <StoryDetail story={story} />
    </AppShell>
  );
}
