import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { StoryDetail } from '@/components/story-detail';
import { getStory, storyClusters } from '@/lib/demo-data';

export function generateStaticParams() {
  return storyClusters.map((story) => ({ slug: story.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const story = getStory((await params).slug);
  if (!story) return { title: 'Story not found' };
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
export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const story = getStory((await params).slug);
  if (!story) notFound();
  return (
    <AppShell>
      <StoryDetail story={story} />
    </AppShell>
  );
}
