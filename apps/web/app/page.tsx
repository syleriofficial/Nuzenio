import { AppShell } from '@/components/app-shell';
import { TopNewsPage } from '@/components/top-news-page';
import { getTopFeed } from '@/lib/api-client';
import { routeLanguage, type RouteSearchParams } from '@/lib/reader-query';
import { connection } from 'next/server';

export default async function Home({
  searchParams,
}: {
  searchParams: RouteSearchParams;
}) {
  await connection();
  const language = await routeLanguage(searchParams);
  const stories = await getTopFeed(language);
  return (
    <AppShell>
      <TopNewsPage stories={stories} />
    </AppShell>
  );
}
