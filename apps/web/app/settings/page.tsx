import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { SettingsScreen } from '@/components/settings-screen';

export const metadata: Metadata = {
  title: 'Settings',
  description:
    'Nuzenio language, theme, location and personalisation settings.',
};
export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsScreen />
    </AppShell>
  );
}
