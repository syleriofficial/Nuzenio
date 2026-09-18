// Research metadata only. This registry is NOT read by the feed scheduler,
// publisher onboarding, draft inbox, or public reader. No live approval exists.
export const sourceCandidates = [
  {
    id: 'pib',
    name: 'PIB',
    sourceType: 'official-release',
    enabled: false,
    approval: 'not-reviewed',
    checkedOn: '2026-09-18',
    policyUrl:
      'https://www.pib.gov.in/content/3622_2_CopyrightPolicy.aspx?lang=6&reg=17',
    directoryUrl: 'https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1',
    fixtureHost: 'pib-fixture.example',
    proposedFields: [
      'headline',
      'source-excerpt',
      'publisher',
      'date',
      'original-link',
    ],
    attributionTemplate:
      'Source: {publisher}. Original: {url}. Policy: {policyUrl}.',
    reviewNote:
      'Accurate reproduction with source credit; third-party material excluded. Hindi feed endpoint not verified.',
  },
  {
    id: 'global-voices',
    name: 'Global Voices',
    sourceType: 'community-reporting',
    enabled: false,
    approval: 'not-reviewed',
    checkedOn: '2026-09-18',
    policyUrl:
      'https://globalvoices.org/about/global-voices-attribution-policy/',
    directoryUrl: 'https://globalvoices.org/feeds/',
    fixtureHost: 'global-voices-fixture.example',
    proposedFields: [
      'headline',
      'source-excerpt',
      'author',
      'publisher',
      'date',
      'original-link',
    ],
    attributionTemplate:
      '{author} / {publisher}. Original: {url}. Licence: {licenceUrl}. Changes: {changes}.',
    reviewNote:
      'Check original authorship, item licence and upstream credit; third-party media excluded. Fresh daily Hindi coverage not established.',
  },
] as const;

export type CandidateId = (typeof sourceCandidates)[number]['id'];

// An intended display mode is not a permission. No real content may enter this
// prototype, regardless of research evidence or an individual item's metadata.
export const sourceCardScope = {
  mode: 'offline-fictional-only',
  liveImport: false,
  publicPublish: false,
  livePermissions: {
    headline: 'unknown',
    excerpt: 'unknown',
    summary: 'unknown',
    translation: 'unknown',
    images: 'unknown',
    fullText: 'unknown',
  },
  retention: 'No runtime persistence; checked-in fictional fixtures only.',
  review:
    'Source and item rights, attribution, pause/revocation and a separate publishing gate must be reviewed before any real import.',
} as const;
