import { validReport } from '@/lib/reader-report';

const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
};
const reply = (
  status: number,
  error = 'Report submission could not be completed.',
) => Response.json({ error }, { status, headers });

// Public write-only proxy. No cookies, authorization, forwarded IPs, arbitrary
// upstream paths, redirects, demo fallback, or public report/status reads.
export async function POST(request: Request) {
  // NextURL normalizes loopback hosts and reverse proxies may rewrite the URL.
  // Compare against an operator-configured canonical browser origin, never an
  // attacker-controlled Host/X-Forwarded-Host header or an inferred alias.
  const origin = process.env.NUZENIO_REPORT_WEB_ORIGIN;
  try {
    if (
      !origin ||
      new URL(origin).origin !== origin ||
      !/^https?:/.test(origin)
    )
      return reply(503);
  } catch {
    return reply(503);
  }
  if (
    request.headers.get('origin') !== origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return reply(403);
  if (
    request.headers.get('content-type')?.split(';')[0].toLowerCase() !==
      'application/json' ||
    ![null, 'identity'].includes(request.headers.get('content-encoding'))
  )
    return reply(415);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => {});
  }, 5000);
  let payload: unknown;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (expired) return reply(408);
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        return reply(413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    payload = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    );
  } catch {
    return reply(400);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  if (!validReport(payload))
    return reply(422, 'Check the report fields and length limits.');
  const base = (
    process.env.NUZENIO_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:8000'
  ).replace(/\/$/, '');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  const deadline = setTimeout(cancel, 8000);
  try {
    const response = await fetch(`${base}/v1/reader-reports`, {
      method: 'POST',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (response.status !== 202) {
      const status = [404, 409, 413, 422, 429].includes(response.status)
        ? response.status
        : 503;
      return reply(status);
    }
    const body = await response.json();
    if (controller.signal.aborted || body?.accepted !== true) return reply(503);
    return Response.json({ accepted: true }, { status: 202, headers });
  } catch {
    return reply(503);
  } finally {
    clearTimeout(deadline);
    request.signal.removeEventListener('abort', cancel);
  }
}
