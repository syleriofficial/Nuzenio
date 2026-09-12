import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { SavedScreen } from '@/components/saved-screen';

export const metadata: Metadata = {
  title: 'Saved stories',
  description:
    'Bookmarks on this browser, rechecked against current public reporting.',
};
export default function SavedPage() {
  return (
    <AppShell>
      <SavedScreen />
    </AppShell>
  );
}
