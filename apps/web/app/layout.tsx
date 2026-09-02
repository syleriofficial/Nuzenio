import type { Metadata } from 'next';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Nuzenio — One story. Multiple sources.',
    template: '%s · Nuzenio',
  },
  description:
    'India-first news clustering, comparison and briefing. One story, multiple sources, clear in 60 seconds.',
  applicationName: 'Nuzenio',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Nuzenio' },
  openGraph: {
    type: 'website',
    siteName: 'Nuzenio',
    title: 'Nuzenio — One story. Multiple sources.',
    description: 'India-first news clustering, comparison and briefing.',
  },
  twitter: {
    card: 'summary',
    title: 'Nuzenio — One story. Multiple sources.',
    description: 'India-first news clustering, comparison and briefing.',
  },
};

export const viewport = {
  themeColor: '#a42820',
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
