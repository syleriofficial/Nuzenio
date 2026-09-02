import type {
  ApiBrief,
  ApiClusterCard,
  ApiClusterDetail,
  ApiClusterPage,
  ApiErrorEnvelope,
  ApiSourceProfile,
  ReaderBrief,
  ReaderLanguage,
  ReaderSourceProfile,
} from '@/lib/api-types';
import {
  fallbackBriefs,
  fallbackLocal,
  fallbackSearch,
  fallbackSource,
  fallbackStory,
  fallbackTop,
} from '@/lib/demo-fallback';
import type { StoryCluster } from '@/lib/story-types';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export class ReaderApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ReaderApiError';
  }
}

export class ReaderContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReaderContractError';
  }
}

function apiBaseUrl(): string {
  return (
    process.env.NUZENIO_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  ).replace(/\/$/, '');
}

export function demoFallbackEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.NUZENIO_ENABLE_DEMO_FALLBACK === 'true'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertCluster(value: unknown): asserts value is ApiClusterCard {
  if (
    !isRecord(value) ||
    typeof value.slug !== 'string' ||
    typeof value.headline !== 'string' ||
    typeof value.brief !== 'string' ||
    !Array.isArray(value.sources) ||
    !Array.isArray(value.claims) ||
    typeof value.independentSourceCount !== 'number'
  ) {
    throw new ReaderContractError(
      'Reader API returned an invalid story cluster.',
    );
  }
}

function assertClusterPage(value: unknown): asserts value is ApiClusterPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !isRecord(value.pagination) ||
    typeof value.pagination.total !== 'number'
  ) {
    throw new ReaderContractError(
      'Reader API returned an invalid paginated feed.',
    );
  }
  value.items.forEach(assertCluster);
}

async function readError(response: Response): Promise<ReaderApiError> {
  let payload: ApiErrorEnvelope | undefined;
  try {
    payload = (await response.json()) as ApiErrorEnvelope;
  } catch {
    payload = undefined;
  }
  return new ReaderApiError(
    payload?.error?.message ??
      'Nuzenio reader data is temporarily unavailable.',
    response.status,
    payload?.error?.code ?? 'reader_api_error',
  );
}

async function request<T>(
  path: string,
  fallback: (() => T) | undefined,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    if (fallback && demoFallbackEnabled()) return fallback();
    throw new ReaderApiError(
      'Could not reach the Nuzenio Reader API. Please try again.',
      503,
      'reader_api_unreachable',
    );
  }
  if (!response.ok) {
    const error = await readError(response);
    if (response.status >= 500 && fallback && demoFallbackEnabled())
      return fallback();
    throw error;
  }
  return (await response.json()) as T;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function mapApiCluster(item: ApiClusterCard): StoryCluster {
  assertCluster(item);
  const claims = (state: ApiClusterCard['claims'][number]['state']) =>
    item.claims
      .filter((claim) => claim.state === state)
      .map((claim) => claim.text);
  const confirmed = claims('CONFIRMED');
  const developing = claims('DEVELOPING');
  const disputed = claims('DISPUTED');
  const detail = item as Partial<ApiClusterDetail>;
  const primaryDocument = detail.primaryDocuments?.[0];
  return {
    slug: item.slug,
    category: item.category,
    location: item.location ?? undefined,
    headline: item.headline,
    headlineHi: item.headline,
    brief: item.brief,
    briefHi: item.brief,
    status: item.status,
    statusLabel:
      item.status === 'DISPUTED'
        ? 'Sources differ'
        : item.status === 'DEVELOPING'
          ? 'Developing'
          : 'Confirmed',
    updated: formatTime(item.updatedAt),
    independentSourceCount: item.independentSourceCount,
    riskLevel: item.riskLevel,
    reviewState: item.reviewState,
    sources: item.sources.map((source) => ({
      name: source.name,
      slug: source.slug,
      short: source.short,
      organization: source.organization,
      domain: source.domain,
      language: source.language === 'hi' ? 'Hindi' : 'English',
      headline: source.headline,
      headlineHi: source.headline,
      url: source.url,
      publishedAt: formatTime(source.publishedAt),
      isSyndicated: source.syndicatedCopy,
      machineTranslated: source.machineTranslated,
    })),
    confirmed,
    confirmedHi: confirmed,
    developing,
    developingHi: developing,
    disputed,
    disputedHi: disputed,
    timeline: detail.timeline ?? [],
    primaryDocument: primaryDocument
      ? {
          title: primaryDocument.title,
          issuer: primaryDocument.issuer,
          url: primaryDocument.url,
          publishedAt: primaryDocument.publishedAt
            ? formatTime(primaryDocument.publishedAt)
            : 'Publication time unavailable',
        }
      : undefined,
    corrections:
      detail.corrections?.map((correction) => ({
        at: correction.publishedAt
          ? formatTime(correction.publishedAt)
          : correction.id,
        note: correction.description,
      })) ?? [],
    whyShown: item.whyShown,
  };
}

function queryString(
  values: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}

export async function getTopFeed(
  language: ReaderLanguage,
  options: { category?: string; status?: StoryCluster['status'] } = {},
): Promise<StoryCluster[]> {
  const query = queryString({
    language,
    page: 1,
    page_size: 20,
    category: options.category,
    status: options.status,
  });
  const payload = await request<ApiClusterPage | StoryCluster[]>(
    `/v1/feed/top?${query}`,
    () => fallbackTop(language),
  );
  if (Array.isArray(payload)) return payload;
  assertClusterPage(payload);
  return payload.items.map(mapApiCluster);
}

export async function getLocalFeed(
  language: ReaderLanguage,
): Promise<StoryCluster[]> {
  const payload = await request<ApiClusterPage | StoryCluster[]>(
    `/v1/feed/local?${queryString({ language, page_size: 20, area: 'Delhi NCR' })}`,
    () => fallbackLocal(language),
  );
  if (Array.isArray(payload)) return payload;
  assertClusterPage(payload);
  return payload.items.map(mapApiCluster);
}

export async function getCluster(
  slug: string,
  language: ReaderLanguage,
): Promise<StoryCluster> {
  const fallback = () => {
    const story = fallbackStory(slug, language);
    if (!story)
      throw new ReaderApiError(
        'Story cluster not found.',
        404,
        'cluster_not_found',
      );
    return story;
  };
  const payload = await request<ApiClusterDetail | StoryCluster>(
    `/v1/clusters/${encodeURIComponent(slug)}?${queryString({ language })}`,
    fallback,
  );
  if ('headlineHi' in payload) return payload as unknown as StoryCluster;
  assertCluster(payload);
  return mapApiCluster(payload);
}

export async function getSourceProfile(
  slug: string,
  language: ReaderLanguage,
): Promise<ReaderSourceProfile> {
  const fallback = () => {
    const source = fallbackSource(slug, language);
    if (!source)
      throw new ReaderApiError('Source not found.', 404, 'source_not_found');
    return source;
  };
  const payload = await request<ApiSourceProfile | ReaderSourceProfile>(
    `/v1/sources/${encodeURIComponent(slug)}?${queryString({ language })}`,
    fallback,
  );
  if ('recentClusters' in payload && !('demonstrationData' in payload))
    return payload as unknown as ReaderSourceProfile;
  if (!isRecord(payload) || !Array.isArray(payload.recentClusters))
    throw new ReaderContractError(
      'Reader API returned an invalid source profile.',
    );
  return {
    slug: payload.slug,
    name: payload.name,
    organization: payload.organization,
    description: payload.description,
    languages: payload.languages.map((item) =>
      item === 'hi' ? 'Hindi' : 'English',
    ),
    domains: payload.domains,
    ownership: payload.ownership,
    rights: payload.rights,
    feedHealth: payload.feedHealth,
    correctionPolicy: payload.correctionPolicy,
    recentClusters: payload.recentClusters.map(mapApiCluster),
  };
}

export async function searchClusters(
  query: string,
  language: ReaderLanguage,
): Promise<StoryCluster[]> {
  const payload = await request<ApiClusterPage | StoryCluster[]>(
    `/v1/search?${queryString({ q: query, language, page_size: 20 })}`,
    () => fallbackSearch(query, language),
  );
  if (Array.isArray(payload)) return payload;
  assertClusterPage(payload);
  return payload.items.map(mapApiCluster);
}

async function getBrief(
  period: 'morning' | 'evening',
  language: ReaderLanguage,
): Promise<ReaderBrief> {
  const fallback = () => fallbackBriefs(language)[period];
  const payload = await request<ApiBrief | ReaderBrief>(
    `/v1/briefs/${period}?${queryString({ language })}`,
    fallback,
  );
  if ('stories' in payload) return payload as unknown as ReaderBrief;
  if (!isRecord(payload) || !Array.isArray(payload.items))
    throw new ReaderContractError(
      'Reader API returned an invalid daily brief.',
    );
  return {
    title: payload.title,
    period: payload.period,
    publishedAt: payload.publishedAt,
    stories: payload.items.map(mapApiCluster),
  };
}

export async function getBriefs(language: ReaderLanguage): Promise<{
  morning: ReaderBrief;
  evening: ReaderBrief;
}> {
  const [morning, evening] = await Promise.all([
    getBrief('morning', language),
    getBrief('evening', language),
  ]);
  return { morning, evening };
}
