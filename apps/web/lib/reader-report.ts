import { validSlug } from '@/lib/reader-state';

export const reportCategories = [
  'INACCURATE',
  'OUTDATED',
  'UNCLEAR',
  'OTHER',
] as const;
export interface ReaderReportSubmission {
  submissionId: string;
  storySlug: string;
  language: 'en' | 'hi';
  category: (typeof reportCategories)[number];
  details: string;
}

export function validReport(value: unknown): value is ReaderReportSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Object.keys(item).length === 5 &&
    typeof item.submissionId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      item.submissionId,
    ) &&
    validSlug(item.storySlug) &&
    (item.language === 'en' || item.language === 'hi') &&
    reportCategories.some((category) => category === item.category) &&
    typeof item.details === 'string' &&
    item.details.trim().length >= 10 &&
    item.details.length <= 2000 &&
    !Array.from(item.details).some((character) => {
      const code = character.codePointAt(0)!;
      return (
        (code < 32 && code !== 9 && code !== 10) ||
        (code >= 127 && code <= 159) ||
        (code >= 0xd800 && code <= 0xdfff)
      );
    })
  );
}

export class ReportSubmissionError extends Error {
  constructor(public readonly status: number) {
    super('Report submission failed');
  }
}

export function newSubmissionId(): string {
  // getRandomValues is available on supported local HTTP previews too. Never
  // substitute Math.random for an unpredictable idempotency identifier.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function submitReaderReport(
  payload: ReaderReportSubmission,
  signal: AbortSignal,
) {
  const response = await fetch('/api/reader/reports', {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (signal.aborted) throw new ReportSubmissionError(503);
  if (response.status !== 202) throw new ReportSubmissionError(response.status);
  const result = await response.json();
  if (signal.aborted || result?.accepted !== true)
    throw new ReportSubmissionError(503);
}
