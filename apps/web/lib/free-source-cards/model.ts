import { sourceCandidates, type CandidateId } from './registry';

export type OriginalLanguage = 'en' | 'hi';
export type FixtureCard = Readonly<{
  kind: 'fictional-source-card';
  id: string;
  candidateId: CandidateId;
  sourceType: 'official-release' | 'community-reporting';
  headline: string;
  excerpt: string;
  publisher: string;
  author: string;
  language: OriginalLanguage;
  publishedAt: string;
  originalUrl: string;
  attribution: string;
  licenceUrl: string;
}>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid fictional source item.');
  return value as Record<string, unknown>;
}

function plain(value: unknown, max: number): string {
  // This offline contract accepts plain text only, not HTML or real feed XML.
  // Do not truncate assertions/attribution silently or render embedded markup.
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[<>\p{Cc}]/u.test(value)
  )
    throw new Error('Expected bounded plain text.');
  return value;
}

function fixtureUrl(value: unknown, host: string): string {
  const raw = plain(value, 400);
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' ||
    url.host !== host ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.href !== raw
  )
    throw new Error('Only canonical fictional HTTPS links are allowed.');
  return raw;
}

/** Normalize already-decoded fictional RSS-like records. No XML parser,
 * transport, database, approval mutation or live ingestion is involved. */
export function normalizeFixture(value: unknown): FixtureCard {
  const item = record(value);
  const candidate = sourceCandidates.find(
    (source) => source.id === item.candidateId,
  );
  if (!candidate || item.fictional !== true)
    throw new Error('Unknown candidate or non-fictional input.');
  const permission = record(item.fixturePermission);
  if (
    permission.headline !== 'fixture-only' ||
    permission.excerpt !== 'fixture-only' ||
    permission.attribution !== 'fixture-only' ||
    permission.revoked !== false
  )
    throw new Error('Fictional display permission missing or revoked.');
  if (item.language !== 'en' && item.language !== 'hi')
    throw new Error('Original language is required.');
  const id = plain(item.guid, 80);
  if (!/^fixture-[a-z0-9-]+$/.test(id)) throw new Error('Invalid fixture ID.');
  const publishedAt = plain(item.pubDate, 30);
  // Canonical UTC prevents locale-dependent dates and invalid normalized days.
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(publishedAt) ||
    !Number.isFinite(Date.parse(publishedAt)) ||
    new Date(publishedAt).toISOString() !== publishedAt
  )
    throw new Error('A valid original publication time is required.');
  return {
    kind: 'fictional-source-card',
    id,
    candidateId: candidate.id,
    sourceType: candidate.sourceType,
    headline: plain(item.title, 240),
    excerpt: plain(item.description, 600),
    publisher: `${candidate.name} · fictional format example`,
    author: plain(item['dc:creator'] ?? item.author, 120),
    language: item.language,
    publishedAt,
    originalUrl: fixtureUrl(item.link, candidate.fixtureHost),
    attribution: plain(item.attribution, 500),
    licenceUrl: fixtureUrl(item.licenceUrl, candidate.fixtureHost),
  };
}

export function normalizeFixturePack(values: unknown): FixtureCard[] {
  if (!Array.isArray(values) || values.length > 20)
    throw new Error('Expected a bounded fictional fixture pack.');
  const cards = values.map(normalizeFixture);
  if (
    new Set(cards.map((item) => item.id)).size !== cards.length ||
    new Set(cards.map((item) => item.originalUrl)).size !== cards.length
  )
    throw new Error('Duplicate fixture identity.');
  return cards;
}
