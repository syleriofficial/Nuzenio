import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { FeedScreen } from '@/components/feed-screen';
import { getTopFeed } from '@/lib/api-client';
import { routeLanguage, type RouteSearchParams } from '@/lib/reader-query';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: 'For You',
  description: 'A transparent personalised Nuzenio feed.',
};
export default async function ForYouPage({
  searchParams,
}: {
  searchParams: RouteSearchParams;
}) {
  await connection();
  const language = await routeLanguage(searchParams);
  const stories = await getTopFeed(language);
  return (
    <AppShell>
      <FeedScreen
        title="For You"
        titleHi="आपके लिए"
        eyebrow="Explainable personalisation"
        eyebrowHi="समझने योग्य निजीकरण"
        description="Based on followed topics, selected local edition and sources you have not hidden."
        descriptionHi="फॉलो किए विषयों, चुने स्थानीय संस्करण और आपके न छिपाए स्रोतों पर आधारित।"
        stories={stories.filter((story) =>
          ['Business', 'Technology', 'Delhi NCR', 'Sports'].includes(
            story.category,
          ),
        )}
        showWhy
      />
    </AppShell>
  );
}
