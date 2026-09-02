import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { BriefsScreen } from '@/components/briefs-screen';
import { getBriefs } from '@/lib/api-client';
import { routeLanguage, type RouteSearchParams } from '@/lib/reader-query';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: 'Daily Briefs',
  description: 'Morning and evening briefs from verified story clusters.',
};
export default async function BriefsPage({
  searchParams,
}: {
  searchParams: RouteSearchParams;
}) {
  await connection();
  const language = await routeLanguage(searchParams);
  const briefs = await getBriefs(language);
  return (
    <AppShell>
      <BriefsScreen briefs={briefs} />
    </AppShell>
  );
}
