import { getCluster, ReaderApiError } from '@/lib/api-client';
import { validSlug } from '@/lib/reader-state';

// A fixed, public-reader endpoint only. Never forwards staff cookies or headers.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get('slug');
  const language = params.get('language');
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  if (
    !validSlug(slug) ||
    (language !== 'en' && language !== 'hi') ||
    params.getAll('slug').length !== 1 ||
    params.getAll('language').length !== 1
  ) {
    return Response.json(
      { error: 'Invalid reader request.' },
      { status: 400, headers },
    );
  }
  try {
    const story = await getCluster(slug, language);
    return Response.json({ story }, { headers });
  } catch (error) {
    const unavailable = error instanceof ReaderApiError && error.status === 404;
    return Response.json(
      {
        error: unavailable
          ? 'Story unavailable.'
          : 'Reader temporarily unavailable.',
      },
      { status: unavailable ? 404 : 503, headers },
    );
  }
}
