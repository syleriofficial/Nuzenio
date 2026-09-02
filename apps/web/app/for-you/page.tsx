import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { FeedScreen } from '@/components/feed-screen';
import { storyClusters } from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'For You',
  description: 'A transparent personalised Nuzenio feed.',
};
export default function ForYouPage() {
  return (
    <AppShell>
      <FeedScreen
        title="For You"
        titleHi="आपके लिए"
        eyebrow="Explainable personalisation"
        eyebrowHi="समझने योग्य निजीकरण"
        description="Based on followed topics, selected local edition and sources you have not hidden."
        descriptionHi="फॉलो किए विषयों, चुने स्थानीय संस्करण और आपके न छिपाए स्रोतों पर आधारित।"
        stories={[
          storyClusters[2],
          storyClusters[4],
          storyClusters[1],
          storyClusters[3],
        ]}
        showWhy
      />
    </AppShell>
  );
}
