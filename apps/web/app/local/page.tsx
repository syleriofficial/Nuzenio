import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { FeedScreen } from '@/components/feed-screen';
import { getLocalFeed } from '@/lib/api-client';
import { routeLanguage, type RouteSearchParams } from '@/lib/reader-query';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: 'Delhi NCR Local',
  description: 'Clustered local reporting for the Delhi NCR pilot.',
};
export default async function LocalPage({
  searchParams,
}: {
  searchParams: RouteSearchParams;
}) {
  await connection();
  const language = await routeLanguage(searchParams);
  const stories = await getLocalFeed(language);
  return (
    <AppShell>
      <FeedScreen
        title="Delhi NCR"
        titleHi="दिल्ली NCR"
        eyebrow="Your local edition"
        eyebrowHi="आपका स्थानीय संस्करण"
        description="Useful local reporting across civic life, mobility, weather and public safety."
        descriptionHi="नागरिक जीवन, परिवहन, मौसम और जन सुरक्षा की उपयोगी स्थानीय रिपोर्टिंग।"
        stories={stories}
        local
      />
    </AppShell>
  );
}
