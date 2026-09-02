import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { FollowingScreen } from '@/components/following-screen';

export const metadata: Metadata = {
  title: 'Following',
  description: 'Stories from followed Nuzenio topics and sources.',
};
export default function FollowingPage() {
  return (
    <AppShell>
      <FollowingScreen />
    </AppShell>
  );
}
