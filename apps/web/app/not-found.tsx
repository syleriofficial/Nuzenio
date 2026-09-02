import { AppShell } from '@/components/app-shell';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <AppShell>
      <main className="route-state">
        <div className="route-state-brand">N</div>
        <h1>That story is not in this edition</h1>
        <p>
          It may have been merged into another cluster or removed after
          editorial review.
        </p>
        <Link className={buttonVariants()} href="/">
          Return to Top News
        </Link>
      </main>
    </AppShell>
  );
}
