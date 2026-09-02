import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { FollowingScreen } from '@/components/following-screen';
import { getTopFeed } from '@/lib/api-client';
import { routeLanguage, type RouteSearchParams } from '@/lib/reader-query';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: 'Following',
  description: 'Stories from followed Nuzenio topics and sources.',
};
export default async function FollowingPage({
  searchParams,
}: {
  searchParams: RouteSearchParams;
}) {
  await connection();
  const language = await routeLanguage(searchParams);
  const stories = await getTopFeed(language);
  return (
    <AppShell>
      <FollowingScreen stories={stories} />
    </AppShell>
  );
}
