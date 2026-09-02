import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { BriefsScreen } from '@/components/briefs-screen';

export const metadata: Metadata = {
  title: 'Daily Briefs',
  description: 'Morning and evening briefs from verified story clusters.',
};
export default function BriefsPage() {
  return (
    <AppShell>
      <BriefsScreen />
    </AppShell>
  );
}
