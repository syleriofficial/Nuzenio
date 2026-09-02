import type { StoryCluster } from '@/lib/story-types';

export type ReaderLanguage = 'en' | 'hi';

export interface ApiPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSourceArticle {
  name: string;
  slug: string;
  short: string;
  organization: string;
  organizationId: string;
  domain: string;
  language: ReaderLanguage;
  headline: string;
  url: string;
  publishedAt: string;
  syndicatedCopy: boolean;
  machineTranslated: boolean;
}

export interface ApiEvidence {
  id: string;
  locator: string;
  supportScore: number;
  sourceName: string | null;
  sourceUrl: string | null;
  primaryDocumentTitle: string | null;
  primaryDocumentUrl: string | null;
}

export interface ApiClaim {
  id: string;
  state: 'CONFIRMED' | 'DEVELOPING' | 'DISPUTED';
  text: string;
  evidence: ApiEvidence[];
}

export interface ApiClusterCard {
  slug: string;
  category: string;
  location: string | null;
  headline: string;
  brief: string;
  status: StoryCluster['status'];
  updatedAt: string;
  independentSourceCount: number;
  riskLevel: StoryCluster['riskLevel'];
  reviewState: StoryCluster['reviewState'];
  sources: ApiSourceArticle[];
  claims: ApiClaim[];
  whyShown: string;
  language: ReaderLanguage;
  machineTranslated: boolean;
  demonstrationData: boolean;
}

export interface ApiClusterDetail extends ApiClusterCard {
  timeline: Array<{ at: string; title: string; detail: string }>;
  primaryDocuments: Array<{
    id: string;
    title: string;
    issuer: string;
    url: string;
    publishedAt: string | null;
  }>;
  corrections: Array<{
    id: string;
    description: string;
    status: string;
    publishedAt: string | null;
  }>;
}

export interface ApiClusterPage {
  items: ApiClusterCard[];
  pagination: ApiPagination;
}

export interface ApiSourceProfile {
  slug: string;
  name: string;
  organization: string;
  description: string;
  languages: ReaderLanguage[];
  domains: string[];
  ownership: string;
  rights: string;
  feedHealth: string;
  correctionPolicy: string;
  recentClusters: ApiClusterCard[];
  language: ReaderLanguage;
  demonstrationData: boolean;
}

export interface ApiBrief {
  edition: string;
  period: 'morning' | 'evening';
  language: ReaderLanguage;
  title: string;
  publishedAt: string;
  items: ApiClusterCard[];
  demonstrationData: boolean;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    status: number;
    details?: Array<Record<string, unknown>>;
  };
}

export interface ReaderSourceProfile {
  slug: string;
  name: string;
  organization: string;
  description: string;
  languages: string[];
  domains: string[];
  ownership: string;
  rights: string;
  feedHealth: string;
  correctionPolicy: string;
  recentClusters: StoryCluster[];
}

export interface ReaderBrief {
  title: string;
  period: 'morning' | 'evening';
  publishedAt: string;
  stories: StoryCluster[];
}
