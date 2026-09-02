import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { SearchScreen } from '@/components/search-screen';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search Nuzenio story clusters, sources and topics.',
};
export default function SearchPage() {
  return (
    <AppShell>
      <SearchScreen />
    </AppShell>
  );
}
