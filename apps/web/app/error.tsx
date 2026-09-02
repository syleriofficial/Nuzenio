'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorState({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="route-state" role="alert">
      <AlertTriangle />
      <h1>We could not load this edition</h1>
      <p>
        Your settings and saved stories are safe. Try loading the page again.
      </p>
      <Button onClick={retry}>Try again</Button>
    </main>
  );
}
