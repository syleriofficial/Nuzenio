import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { SearchScreen } from '@/components/search-screen';
import { searchClusters } from '@/lib/api-client';
import {
  routeLanguage,
  routeQuery,
  type RouteSearchParams,
} from '@/lib/reader-query';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search Nuzenio story clusters, sources and topics.',
};
export default async function SearchPage({
  searchParams,
}: {
  searchParams: RouteSearchParams;
}) {
  await connection();
  const [language, query] = await Promise.all([
    routeLanguage(searchParams),
    routeQuery(searchParams, 'q'),
  ]);
  const stories = query ? await searchClusters(query, language) : [];
  return (
    <AppShell>
      <SearchScreen initialQuery={query} stories={stories} />
    </AppShell>
  );
}
