import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { FeedScreen } from '@/components/feed-screen';
import { storyClusters } from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'Delhi NCR Local',
  description: 'Clustered local reporting for the Delhi NCR pilot.',
};
export default function LocalPage() {
  return (
    <AppShell>
      <FeedScreen
        title="Delhi NCR"
        titleHi="दिल्ली NCR"
        eyebrow="Your local edition"
        eyebrowHi="आपका स्थानीय संस्करण"
        description="Useful local reporting across civic life, mobility, weather and public safety."
        descriptionHi="नागरिक जीवन, परिवहन, मौसम और जन सुरक्षा की उपयोगी स्थानीय रिपोर्टिंग।"
        stories={storyClusters.filter((story) => story.location)}
        local
      />
    </AppShell>
  );
}
