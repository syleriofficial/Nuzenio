import { NextResponse } from 'next/server';
import { sourceCardPreviewEnabled } from '@/lib/free-source-cards/gate';

// Only this new lab path is matched. Reject before Next can stream its loading
// boundary as a soft 200. The server page repeats the same fail-closed check.
export function proxy() {
  if (!sourceCardPreviewEnabled(process.env)) {
    return new NextResponse('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
  return NextResponse.next();
}

export const config = { matcher: '/preview/source-cards/:path*' };
