import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { AdminScreen } from '@/components/admin-screen';

export const metadata: Metadata = {
  title: 'Admin',
  description: 'Nuzenio demonstration editorial operations.',
};
export default function AdminPage() {
  return (
    <AppShell>
      <AdminScreen />
    </AppShell>
  );
}
