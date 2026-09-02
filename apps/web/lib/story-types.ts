export type StoryStatus = 'VERIFIED' | 'DEVELOPING' | 'DISPUTED';
export type RiskLevel = 'STANDARD' | 'HIGH';

export interface StorySource {
  name: string;
  slug: string;
  short: string;
  organization: string;
  domain: string;
  language: 'English' | 'Hindi';
  headline: string;
  headlineHi?: string;
  url: string;
  publishedAt: string;
  isSyndicated?: boolean;
  machineTranslated?: boolean;
}

export interface TimelineEntry {
  at: string;
  title: string;
  detail: string;
}

export interface StoryCluster {
  slug: string;
  category: string;
  location?: string;
  headline: string;
  headlineHi: string;
  brief: string;
  briefHi: string;
  status: StoryStatus;
  statusLabel: string;
  updated: string;
  independentSourceCount: number;
  riskLevel: RiskLevel;
  reviewState: 'PUBLISHED' | 'EDITOR_REVIEWED';
  sources: StorySource[];
  confirmed: string[];
  confirmedHi: string[];
  developing: string[];
  developingHi: string[];
  disputed: string[];
  disputedHi: string[];
  timeline: TimelineEntry[];
  primaryDocument?: {
    title: string;
    issuer: string;
    url: string;
    publishedAt: string;
  };
  corrections: { at: string; note: string }[];
  whyShown: string;
}
