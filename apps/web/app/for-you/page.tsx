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
        description="Followed topics and sources first, then other recent stories. Hidden sources stay out."
        descriptionHi="पहले फॉलो किए विषय और स्रोत, फिर अन्य हाल की स्टोरी। छिपे स्रोत बाहर रहेंगे।"
        stories={stories}
        showWhy
      />
    </AppShell>
  );
}
