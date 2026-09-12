import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/reader/reports/route';
import {
  newSubmissionId,
  submitReaderReport,
  validReport,
} from '@/lib/reader-report';

const payload = {
  submissionId: 'ca3b2a4a-5cf8-4e8b-92c4-f7fa73599a85',
  storySlug: 'public-story',
  language: 'hi' as const,
  category: 'INACCURATE' as const,
  details: 'कृपया इस विवरण की जांच करें।',
};
const fetcher = vi.fn();
const req = (body: unknown = payload, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/reader/reports', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockReset();
  vi.stubEnv('NUZENIO_API_BASE_URL', 'http://private-api:8000');
  vi.stubEnv('NUZENIO_REPORT_WEB_ORIGIN', 'http://localhost');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('public report proxy', () => {
  it.each([
    '',
    'not-a-url',
    'http://localhost/',
    'https://user:password@example.com',
  ])(
    'fails closed for missing or malformed configured origin %s',
    async (origin) => {
      vi.stubEnv('NUZENIO_REPORT_WEB_ORIGIN', origin);
      expect((await POST(req())).status).toBe(503);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('uses explicit browser origin despite NextURL loopback normalization', async () => {
    vi.stubEnv('NUZENIO_REPORT_WEB_ORIGIN', 'http://127.0.0.1');
    fetcher.mockResolvedValue(
      Response.json({ accepted: true }, { status: 202 }),
    );
    expect(
      (await POST(req(payload, { Origin: 'http://127.0.0.1' }))).status,
    ).toBe(202);
    expect(
      (await POST(req(payload, { Origin: 'http://localhost' }))).status,
    ).toBe(403);
  });
  it('uses cryptographically random UUIDv4 bits without randomUUID', () => {
    const random = vi.fn((bytes: Uint8Array) => {
      bytes.fill(255);
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues: random });
    expect(newSubmissionId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(random).toHaveBeenCalledOnce();
  });
  it('fails rather than using weak randomness when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => newSubmissionId()).toThrow();
  });
  it.each([
    null,
    {},
    { ...payload, details: 'short' },
    { ...payload, details: 'x'.repeat(2001) },
    { ...payload, storySlug: '../admin' },
    { ...payload, language: 'xx' },
    { ...payload, status: 'RESOLVED' },
    { ...payload, details: 'control\u0000canary' },
    { ...payload, submissionId: 'invalid' },
  ])('rejects invalid fields before API work', async (body) => {
    expect(validReport(body)).toBe(false);
    const response = await POST(req(body));
    expect(response.status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it.each([
    ['Origin', 'https://evil.example'],
    ['Origin', 'null'],
    ['sec-fetch-site', 'cross-site'],
  ])('rejects cross-origin submission %s=%s', async (name, value) => {
    expect((await POST(req(payload, { [name]: value }))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('requires an Origin and bounded unencoded JSON', async () => {
    const missing = req();
    missing.headers.delete('Origin');
    expect((await POST(missing)).status).toBe(403);
    expect(
      (await POST(req(payload, { 'Content-Type': 'text/plain' }))).status,
    ).toBe(415);
    expect(
      (await POST(req(payload, { 'Content-Encoding': 'gzip' }))).status,
    ).toBe(415);
    expect(
      (await POST(req({ ...payload, details: 'x'.repeat(17000) }))).status,
    ).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('forwards only validated fields to fixed public endpoint without private headers', async () => {
    fetcher.mockResolvedValue(
      Response.json(
        { accepted: true, internal: 'must-not-escape' },
        { status: 202 },
      ),
    );
    const result = await POST(
      req(payload, {
        Cookie: 'staff-secret',
        Authorization: 'Bearer secret',
        'X-Forwarded-For': '1.2.3.4',
      }),
    );
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual({ accepted: true });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('http://private-api:8000/v1/reader-reports');
    expect(options.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(options.credentials).toBe('omit');
    expect(options.cache).toBe('no-store');
    expect(options.redirect).toBe('error');
    expect(JSON.parse(options.body)).toEqual(payload);
    expect(result.headers.get('Cache-Control')).toContain('no-store');
  });
  it.each([404, 409, 413, 422, 429, 401, 500, 503])(
    'preserves safe status %s without leaking diagnostics',
    async (status) => {
      fetcher.mockResolvedValue(new Response('secret diagnostic', { status }));
      const result = await POST(req());
      expect(result.status).toBe([401, 500].includes(status) ? 503 : status);
      expect(await result.text()).not.toContain('secret diagnostic');
    },
  );
  it('does not treat upstream failure or a malformed acknowledgment as success', async () => {
    fetcher.mockRejectedValueOnce(new Error('private database URL'));
    expect((await POST(req())).status).toBe(503);
    fetcher.mockResolvedValueOnce(
      Response.json({ accepted: false }, { status: 202 }),
    );
    expect((await POST(req())).status).toBe(503);
  });
});

describe('reader report client', () => {
  it('uses credential-free no-store POST and requires confirmed acceptance', async () => {
    fetcher.mockResolvedValue(
      Response.json({ accepted: true }, { status: 202 }),
    );
    await submitReaderReport(payload, new AbortController().signal);
    const [path, options] = fetcher.mock.calls[0];
    expect(path).toBe('/api/reader/reports');
    expect(options.credentials).toBe('omit');
    expect(options.cache).toBe('no-store');
    expect(JSON.parse(options.body)).toEqual(payload);
  });
  it.each([200, 404, 429, 503])(
    'does not manufacture success for HTTP %s',
    async (status) => {
      fetcher.mockResolvedValue(Response.json({ accepted: true }, { status }));
      await expect(
        submitReaderReport(payload, new AbortController().signal),
      ).rejects.toMatchObject({ status });
    },
  );
  it('rejects late success after cancellation', async () => {
    const controller = new AbortController();
    fetcher.mockImplementation(async () => {
      controller.abort();
      return Response.json({ accepted: true }, { status: 202 });
    });
    await expect(
      submitReaderReport(payload, controller.signal),
    ).rejects.toMatchObject({ status: 503 });
  });
});
