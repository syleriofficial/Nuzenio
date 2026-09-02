'use client';

import { SyntheticEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  GitMerge,
  HeartPulse,
  LogOut,
  PencilLine,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AdminApiError,
  AdminPage,
  StaffSession,
  adminApiBaseUrl,
  adminRequest,
  hasPermission,
} from '@/lib/admin-api-client';

type TabId =
  | 'sources'
  | 'health'
  | 'clusters'
  | 'corrections'
  | 'risk'
  | 'edition'
  | 'audit'
  | 'staff';

interface PublisherRow {
  id: string;
  name: string;
  ownership: string;
  contactEmail: string;
  state: string;
  version: number;
  domains: Array<{
    id: string;
    domain: string;
    verified: boolean;
    state: string;
    version: number;
  }>;
  rights: Array<{
    id: string;
    name: string;
    state: string;
    expiresAt?: string;
    fullTextDisplay: boolean;
    version: number;
  }>;
  feeds: Array<{
    id: string;
    name: string;
    url: string;
    state: string;
    health: string;
    lastSuccessAt?: string;
    nextPollAt?: string;
    version: number;
  }>;
}

interface ClusterRow {
  id: string;
  slug: string;
  headline: string;
  headlineHi: string;
  status: string;
  riskLevel: string;
  reviewState: string;
  version: number;
  articleIds: string[];
  claims: Array<{
    id: string;
    text: string;
    textHi: string;
    state: string;
    version: number;
    evidenceIds: string[];
  }>;
  summaries: Array<{
    id: string;
    language: string;
    text: string;
    decision: string;
    version: number;
    evidenceCount: number;
  }>;
  primaryDocuments: Array<{ id: string; title: string }>;
}

interface ReviewRow {
  id: string;
  clusterId: string;
  headline: string;
  riskCategory: string;
  reason: string;
  draftedById?: string;
  reviewerId?: string;
  decision: string;
  version: number;
}

interface CorrectionRow {
  id: string;
  description: string;
  status: string;
  clusterId?: string;
  version: number;
  raisedAt: string;
}

interface FeedRunRow {
  id: string;
  feedId: string;
  state: string;
  attempt: number;
  httpStatus?: number;
  fetchedBytes: number;
  parsedItems: number;
  newArticles: number;
  durationMs?: number;
  errorCode?: string;
  createdAt: string;
}

interface AuditRow {
  id: string;
  action: string;
  actorRole?: string;
  entityType: string;
  requestId: string;
  outcome: string;
  reason?: string;
  createdAt: string;
}

interface StaffRow {
  id: string;
  username: string;
  displayName: string;
  role: string;
  active: boolean;
  version: number;
  lastLoginAt?: string;
}

interface EditionRow {
  id: string;
  version: number;
  data: { edition: string; paused: boolean; reason?: string };
}

const tabs: Array<{
  id: TabId;
  label: string;
  permission: string;
}> = [
  { id: 'sources', label: 'Source registry', permission: 'publisher:manage' },
  { id: 'health', label: 'Feed health', permission: 'feed:operate' },
  { id: 'clusters', label: 'Clusters', permission: 'review:read' },
  { id: 'corrections', label: 'Corrections', permission: 'correction:manage' },
  { id: 'risk', label: 'High-risk review', permission: 'review:read' },
  { id: 'edition', label: 'Edition control', permission: 'edition:pause' },
  { id: 'audit', label: 'Audit', permission: 'audit:read' },
  { id: 'staff', label: 'Staff', permission: 'staff:manage' },
];

function humanState(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase();
}

function humanRole(value: string): string {
  const label = humanState(value);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function LoginPanel({ onLogin }: { onLogin: (value: StaffSession) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError('');
    try {
      const session = await adminRequest<StaffSession>('/v1/admin/auth/login', {
        method: 'POST',
        body: {
          username: form.get('username'),
          password: form.get('password'),
        },
      });
      onLogin(session);
    } catch (caught) {
      setError(
        caught instanceof AdminApiError
          ? caught.message
          : 'The editorial service is unavailable.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login" aria-labelledby="staff-login-title">
      <div className="admin-login-copy">
        <Badge variant="outline">Staff only</Badge>
        <h1 id="staff-login-title">Editorial operations</h1>
        <p>
          Sign in with an account created by the protected staff bootstrap
          command. Reader accounts are not supported here.
        </p>
      </div>
      <form onSubmit={submit} className="admin-login-form">
        <label htmlFor="staff-username">Username</label>
        <Input
          id="staff-username"
          name="username"
          autoComplete="username"
          required
          maxLength={120}
        />
        <label htmlFor="staff-password">Password</label>
        <Input
          id="staff-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in securely'}
        </Button>
      </form>
    </main>
  );
}

export function AdminScreen() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [active, setActive] = useState<TabId>('clusters');
  const [loadingSession, setLoadingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [publishers, setPublishers] = useState<PublisherRow[]>([]);
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [feedRuns, setFeedRuns] = useState<FeedRunRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [edition, setEdition] = useState<EditionRow | null>(null);
  const [selectedClusters, setSelectedClusters] = useState<string[]>([]);

  const loadTab = useCallback(async (tab: TabId) => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'sources') {
        setPublishers(
          (
            await adminRequest<AdminPage<PublisherRow>>(
              '/v1/admin/publishers?page_size=50',
            )
          ).items,
        );
      } else if (tab === 'health') {
        const [sourcePage, runPage] = await Promise.all([
          adminRequest<AdminPage<PublisherRow>>(
            '/v1/admin/publishers?page_size=50',
          ),
          adminRequest<AdminPage<FeedRunRow>>(
            '/v1/admin/feed-runs?page_size=20',
          ),
        ]);
        setPublishers(sourcePage.items);
        setFeedRuns(runPage.items);
      } else if (tab === 'clusters') {
        setClusters(
          (
            await adminRequest<AdminPage<ClusterRow>>(
              '/v1/admin/clusters?page_size=50',
            )
          ).items,
        );
      } else if (tab === 'corrections') {
        const [correctionPage, clusterPage] = await Promise.all([
          adminRequest<AdminPage<CorrectionRow>>(
            '/v1/admin/corrections?page_size=50',
          ),
          adminRequest<AdminPage<ClusterRow>>(
            '/v1/admin/clusters?page_size=50',
          ),
        ]);
        setCorrections(correctionPage.items);
        setClusters(clusterPage.items);
      } else if (tab === 'risk') {
        setReviews(
          (
            await adminRequest<AdminPage<ReviewRow>>(
              '/v1/admin/review-queue?page_size=50',
            )
          ).items,
        );
      } else if (tab === 'audit') {
        setAudit(
          (
            await adminRequest<AdminPage<AuditRow>>(
              '/v1/admin/audit?page_size=50',
            )
          ).items,
        );
      } else if (tab === 'edition') {
        setEdition(await adminRequest<EditionRow>('/v1/admin/editions/india'));
      } else if (tab === 'staff') {
        setStaff(
          (
            await adminRequest<AdminPage<StaffRow>>(
              '/v1/admin/staff?page_size=50',
            )
          ).items,
        );
      }
    } catch (caught) {
      if (caught instanceof AdminApiError && caught.status === 401) {
        setSession(null);
      } else {
        setError(
          caught instanceof AdminApiError
            ? caught.message
            : 'The editorial service could not be reached.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    adminRequest<StaffSession>('/v1/admin/auth/session')
      .then((value) => {
        setSession(value);
        setCsrfToken(value.csrfToken ?? '');
        const first = tabs.find((tab) => hasPermission(value, tab.permission));
        if (first) setActive(first.id);
      })
      .catch(() => setSession(null))
      .finally(() => setLoadingSession(false));
  }, []);

  useEffect(() => {
    if (
      session &&
      hasPermission(session, tabs.find((tab) => tab.id === active)!.permission)
    ) {
      void loadTab(active);
    }
  }, [active, loadTab, session]);

  async function mutate(action: () => Promise<unknown>, confirmation: string) {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(confirmation);
      if (session) await loadTab(active);
    } catch (caught) {
      setError(
        caught instanceof AdminApiError
          ? caught.message
          : 'The operation could not be completed.',
      );
    }
  }

  async function logout() {
    await mutate(
      () =>
        adminRequest('/v1/admin/auth/logout', {
          method: 'POST',
          csrfToken,
        }),
      'Signed out.',
    );
    setSession(null);
    setCsrfToken('');
  }

  if (loadingSession) {
    return (
      <main className="admin-loading" aria-live="polite">
        <RefreshCw aria-hidden="true" /> Checking staff session…
      </main>
    );
  }
  if (!session) {
    return (
      <LoginPanel
        onLogin={(value) => {
          setSession(value);
          setCsrfToken(value.csrfToken ?? '');
          const first = tabs.find((tab) =>
            hasPermission(value, tab.permission),
          );
          if (first) setActive(first.id);
        }}
      />
    );
  }

  const availableTabs = tabs.filter((tab) =>
    hasPermission(session, tab.permission),
  );

  return (
    <main className="admin-root">
      <section className="admin-heading">
        <div>
          <p className="eyebrow">Nuzenio operations</p>
          <h1>Editorial control room</h1>
          <p>
            Persistent, permissioned workflows. Changes use version checks and
            are written to the append-only audit trail.
          </p>
        </div>
        <div className="admin-identity">
          <Badge variant="outline">{humanRole(session.role)}</Badge>
          <span>{session.displayName}</span>
          <Button variant="ghost" onClick={() => void logout()}>
            <LogOut /> Log out
          </Button>
        </div>
      </section>
      <nav className="admin-tabs" aria-label="Admin sections">
        {availableTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={active === tab.id ? 'default' : 'ghost'}
            onClick={() => setActive(tab.id)}
            aria-current={active === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </Button>
        ))}
      </nav>

      {error && (
        <div className="admin-error-state" role="alert">
          <AlertTriangle />
          <span>{error}</span>
          <Button variant="outline" onClick={() => void loadTab(active)}>
            Retry
          </Button>
        </div>
      )}
      {loading && (
        <div className="admin-inline-loading" aria-live="polite">
          <RefreshCw /> Refreshing operational data…
        </div>
      )}

      {active === 'sources' && (
        <SourceRegistry
          rows={publishers}
          session={session}
          csrfToken={csrfToken}
          mutate={mutate}
        />
      )}
      {active === 'health' && (
        <FeedHealth
          publishers={publishers}
          runs={feedRuns}
          csrfToken={csrfToken}
          mutate={mutate}
        />
      )}
      {active === 'clusters' && (
        <ClusterWorkspace
          rows={clusters}
          selected={selectedClusters}
          setSelected={setSelectedClusters}
          canEdit={hasPermission(session, 'cluster:edit')}
          canEditClaims={hasPermission(session, 'claim:edit')}
          canReviewSummaries={hasPermission(session, 'summary:review')}
          csrfToken={csrfToken}
          mutate={mutate}
        />
      )}
      {active === 'corrections' && (
        <CorrectionWorkspace
          rows={corrections}
          clusters={clusters}
          csrfToken={csrfToken}
          mutate={mutate}
        />
      )}
      {active === 'risk' && (
        <RiskQueue
          rows={reviews}
          canApprove={hasPermission(session, 'high-risk:approve')}
          csrfToken={csrfToken}
          mutate={mutate}
        />
      )}
      {active === 'audit' && <AuditWorkspace rows={audit} />}
      {active === 'edition' && edition && (
        <EditionWorkspace
          edition={edition}
          csrfToken={csrfToken}
          mutate={mutate}
        />
      )}
      {active === 'staff' && (
        <StaffWorkspace
          rows={staff}
          currentUsername={session.username}
          csrfToken={csrfToken}
          mutate={mutate}
        />
      )}

      {!loading &&
        !error &&
        ((active === 'risk' && reviews.length === 0) ||
          (active === 'corrections' && corrections.length === 0)) && (
          <div className="empty-mini">
            <CheckCircle2 /> No records currently require attention.
          </div>
        )}
      <output className="admin-toast" aria-live="polite">
        {message}
      </output>
    </main>
  );
}

interface MutationProps {
  csrfToken: string;
  mutate: (
    action: () => Promise<unknown>,
    confirmation: string,
  ) => Promise<void>;
}

function SourceRegistry({
  rows,
  session,
  csrfToken,
  mutate,
}: MutationProps & { rows: PublisherRow[]; session: StaffSession }) {
  async function create(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        adminRequest('/v1/admin/publishers', {
          method: 'POST',
          csrfToken,
          body: {
            name: form.get('name'),
            slug: form.get('slug'),
            ownership: form.get('ownership'),
            contactName: form.get('contactName'),
            contactEmail: form.get('contactEmail'),
            correctionRoute: form.get('correctionRoute'),
          },
        }),
      'Publisher draft created.',
    );
    event.currentTarget.reset();
  }

  return (
    <section className="admin-panel">
      <header>
        <div>
          <h2>Source registry</h2>
          <p>Organization, domain, rights and feed approval remain separate.</p>
        </div>
        <ClipboardCheck />
      </header>
      {hasPermission(session, 'publisher:manage') && (
        <details className="admin-disclosure">
          <summary>Add publisher draft</summary>
          <form className="admin-form-grid" onSubmit={create}>
            <Input
              name="name"
              aria-label="Publisher name"
              placeholder="Publisher name"
              required
            />
            <Input
              name="slug"
              aria-label="Publisher slug"
              placeholder="publisher-slug"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
            <Input
              name="ownership"
              aria-label="Ownership"
              placeholder="Ownership"
              required
            />
            <Input
              name="contactName"
              aria-label="Contact name"
              placeholder="Contact name"
              required
            />
            <Input
              name="contactEmail"
              type="email"
              aria-label="Contact email"
              placeholder="Contact email"
              required
            />
            <Input
              name="correctionRoute"
              type="url"
              aria-label="Correction route"
              placeholder="https://…/corrections"
              required
            />
            <Button type="submit">Create draft</Button>
          </form>
        </details>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Domains</th>
              <th>Rights</th>
              <th>Feeds</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((publisher) => (
              <tr key={publisher.id}>
                <td>
                  <strong>{publisher.name}</strong>
                  <small>
                    {publisher.ownership}
                    <br />
                    {publisher.contactEmail}
                  </small>
                </td>
                <td>
                  {publisher.domains.filter((item) => item.verified).length}{' '}
                  verified
                  <small>
                    {publisher.domains.map((item) => item.domain).join(', ') ||
                      'None submitted'}
                  </small>
                </td>
                <td>
                  {publisher.rights.map((item) => item.name).join(', ') ||
                    'Not recorded'}
                  <small>Full-text display: disabled</small>
                </td>
                <td>
                  {publisher.feeds.length}
                  <small>
                    {publisher.feeds
                      .map((item) => humanState(item.state))
                      .join(', ')}
                  </small>
                </td>
                <td>
                  <Badge variant="outline">{humanState(publisher.state)}</Badge>
                  {publisher.state === 'APPROVED' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void mutate(
                          () =>
                            adminRequest(
                              `/v1/admin/publishers/${publisher.id}/transition`,
                              {
                                method: 'POST',
                                csrfToken,
                                body: {
                                  expectedVersion: publisher.version,
                                  state: 'PAUSED',
                                  notes: 'Paused from editorial workspace',
                                },
                              },
                            ),
                          'Publisher paused; affected feeds were stopped.',
                        )
                      }
                    >
                      Pause
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-onboarding-list">
        {rows.map((publisher) => (
          <PublisherOnboarding
            key={publisher.id}
            publisher={publisher}
            csrfToken={csrfToken}
            mutate={mutate}
          />
        ))}
      </div>
    </section>
  );
}

const stateActions: Record<string, Array<{ state: string; label: string }>> = {
  DRAFT: [{ state: 'SUBMITTED', label: 'Submit' }],
  SUBMITTED: [
    { state: 'UNDER_REVIEW', label: 'Start review' },
    { state: 'DRAFT', label: 'Return to draft' },
  ],
  UNDER_REVIEW: [
    { state: 'APPROVED', label: 'Approve' },
    { state: 'REJECTED', label: 'Reject' },
  ],
  APPROVED: [
    { state: 'PAUSED', label: 'Pause' },
    { state: 'BLOCKED', label: 'Block' },
  ],
  PAUSED: [
    { state: 'APPROVED', label: 'Restore' },
    { state: 'BLOCKED', label: 'Block' },
  ],
  BLOCKED: [{ state: 'UNDER_REVIEW', label: 'Re-review' }],
  REJECTED: [{ state: 'DRAFT', label: 'Revise draft' }],
};

function OnboardingActions({
  path,
  state,
  version,
  label,
  csrfToken,
  mutate,
}: MutationProps & {
  path: string;
  state: string;
  version: number;
  label: string;
}) {
  return (
    <div className="panel-actions" aria-label={`${label} lifecycle actions`}>
      {(stateActions[state] ?? []).map((action) => (
        <Button
          key={action.state}
          size="sm"
          variant={action.state === 'APPROVED' ? 'default' : 'outline'}
          onClick={() =>
            void mutate(
              () =>
                adminRequest(path, {
                  method: 'POST',
                  csrfToken,
                  body: {
                    expectedVersion: version,
                    state: action.state,
                    notes: `${action.label} from publisher review workspace`,
                  },
                }),
              `${label} moved to ${humanState(action.state)}.`,
            )
          }
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function PublisherOnboarding({
  publisher,
  csrfToken,
  mutate,
}: MutationProps & { publisher: PublisherRow }) {
  async function addDomain(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        adminRequest(`/v1/admin/publishers/${publisher.id}/domains`, {
          method: 'POST',
          csrfToken,
          body: {
            expectedVersion: publisher.version,
            domain: form.get('domain'),
            ownershipEvidence: form.get('ownershipEvidence'),
          },
        }),
      'Verified-domain draft added.',
    );
  }

  async function addRights(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        adminRequest(`/v1/admin/publishers/${publisher.id}/rights`, {
          method: 'POST',
          csrfToken,
          body: {
            expectedVersion: publisher.version,
            policyName: form.get('policyName'),
            evidenceUrl: form.get('evidenceUrl'),
            effectiveAt: new Date().toISOString(),
            headline: form.get('headline') === 'on',
            snippet: form.get('snippet') === 'on',
            thumbnail: form.get('thumbnail') === 'on',
            generatedSummary: form.get('generatedSummary') === 'on',
            translation: form.get('translation') === 'on',
            audio: form.get('audio') === 'on',
            fullTextStorage: form.get('fullTextStorage') === 'on',
            fullTextDisplay: false,
          },
        }),
      'Rights-policy draft added with full-text display disabled.',
    );
  }

  async function addFeed(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        adminRequest(`/v1/admin/publishers/${publisher.id}/feeds`, {
          method: 'POST',
          csrfToken,
          body: {
            expectedVersion: publisher.version,
            domainId: form.get('domainId'),
            rightsPolicyId: form.get('rightsPolicyId'),
            name: form.get('feedName'),
            url: form.get('feedUrl'),
            language: form.get('language'),
          },
        }),
      'Feed draft added. Run dry validation before approval.',
    );
  }

  return (
    <details className="admin-disclosure">
      <summary>
        Review {publisher.name} · {humanState(publisher.state)}
      </summary>
      <OnboardingActions
        path={`/v1/admin/publishers/${publisher.id}/transition`}
        state={publisher.state}
        version={publisher.version}
        label={publisher.name}
        csrfToken={csrfToken}
        mutate={mutate}
      />
      <div className="onboarding-columns">
        <section>
          <h3>Verified domains</h3>
          {publisher.domains.map((domain) => (
            <div className="onboarding-record" key={domain.id}>
              <strong>{domain.domain}</strong>
              <small>{humanState(domain.state)}</small>
              <OnboardingActions
                path={`/v1/admin/domains/${domain.id}/transition`}
                state={domain.state}
                version={domain.version}
                label={domain.domain}
                csrfToken={csrfToken}
                mutate={mutate}
              />
            </div>
          ))}
          <form className="admin-form-grid" onSubmit={addDomain}>
            <Input
              name="domain"
              aria-label={`${publisher.name} domain`}
              placeholder="publisher.example"
              required
            />
            <Input
              name="ownershipEvidence"
              aria-label={`${publisher.name} ownership evidence`}
              placeholder="Ownership evidence reference"
              required
            />
            <Button size="sm" type="submit" variant="outline">
              Add domain draft
            </Button>
          </form>
        </section>
        <section>
          <h3>Rights evidence</h3>
          {publisher.rights.map((rights) => (
            <div className="onboarding-record" key={rights.id}>
              <strong>{rights.name}</strong>
              <small>
                {humanState(rights.state)} · full text display{' '}
                {rights.fullTextDisplay ? 'enabled' : 'disabled'}
              </small>
              <OnboardingActions
                path={`/v1/admin/rights/${rights.id}/transition`}
                state={rights.state}
                version={rights.version}
                label={rights.name}
                csrfToken={csrfToken}
                mutate={mutate}
              />
            </div>
          ))}
          <form className="admin-form-grid" onSubmit={addRights}>
            <Input
              name="policyName"
              aria-label={`${publisher.name} rights policy name`}
              placeholder="Rights policy name"
              required
            />
            <Input
              name="evidenceUrl"
              type="url"
              aria-label={`${publisher.name} rights evidence URL`}
              placeholder="https://…/rights-evidence"
              required
            />
            <fieldset className="rights-checks">
              <legend>Permitted uses</legend>
              <label>
                <input name="headline" type="checkbox" defaultChecked />{' '}
                Headline
              </label>
              <label>
                <input name="snippet" type="checkbox" defaultChecked /> Snippet
              </label>
              <label>
                <input name="generatedSummary" type="checkbox" defaultChecked />
                Generated summary
              </label>
              <label>
                <input name="thumbnail" type="checkbox" /> Thumbnail
              </label>
              <label>
                <input name="translation" type="checkbox" /> Translation
              </label>
              <label>
                <input name="audio" type="checkbox" /> Audio
              </label>
              <label>
                <input name="fullTextStorage" type="checkbox" /> Full-text
                storage
              </label>
              <span>Full-text display is unavailable.</span>
            </fieldset>
            <Button size="sm" type="submit" variant="outline">
              Add rights draft
            </Button>
          </form>
        </section>
        <section>
          <h3>Controlled feeds</h3>
          {publisher.feeds.map((feed) => (
            <div className="onboarding-record" key={feed.id}>
              <strong>{feed.name}</strong>
              <small>{humanState(feed.state)}</small>
              <OnboardingActions
                path={`/v1/admin/feeds/${feed.id}/transition`}
                state={feed.state}
                version={feed.version}
                label={feed.name}
                csrfToken={csrfToken}
                mutate={mutate}
              />
            </div>
          ))}
          <form className="admin-form-grid" onSubmit={addFeed}>
            <Input
              name="feedName"
              aria-label={`${publisher.name} feed name`}
              placeholder="Feed name"
              required
            />
            <Input
              name="feedUrl"
              type="url"
              aria-label={`${publisher.name} feed URL`}
              placeholder="https://…/feed.xml"
              required
            />
            <label>
              Verified domain
              <select name="domainId" required>
                {publisher.domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.domain} · {humanState(domain.state)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rights policy
              <select name="rightsPolicyId" required>
                {publisher.rights.map((rights) => (
                  <option key={rights.id} value={rights.id}>
                    {rights.name} · {humanState(rights.state)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Language
              <select name="language" defaultValue="en">
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </label>
            <Button
              size="sm"
              type="submit"
              variant="outline"
              disabled={!publisher.domains.length || !publisher.rights.length}
            >
              Add feed draft
            </Button>
          </form>
        </section>
      </div>
    </details>
  );
}

function FeedHealth({
  publishers,
  runs,
  csrfToken,
  mutate,
}: MutationProps & { publishers: PublisherRow[]; runs: FeedRunRow[] }) {
  const feeds = publishers.flatMap((publisher) => publisher.feeds);
  return (
    <section className="admin-panel">
      <header>
        <div>
          <h2>Feed health and worker control</h2>
          <p>
            Runs are queued in Redis; validation never fetches during dry run.
          </p>
        </div>
        <HeartPulse />
      </header>
      <div className="health-grid">
        {feeds.map((feed) => (
          <article key={feed.id}>
            {feed.health === 'HEALTHY' ? (
              <CheckCircle2 className="ok" />
            ) : (
              <AlertTriangle className="warn" />
            )}
            <strong>{feed.name}</strong>
            <span>
              {humanState(feed.state)} · {humanState(feed.health)}
            </span>
            <small>{feed.url}</small>
            <small>
              Last success:{' '}
              {feed.lastSuccessAt
                ? new Date(feed.lastSuccessAt).toLocaleString('en-IN')
                : 'Never'}
              {' · '}Next due:{' '}
              {feed.nextPollAt
                ? new Date(feed.nextPollAt).toLocaleString('en-IN')
                : 'Not scheduled'}
            </small>
            <div className="panel-actions">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void mutate(
                    () =>
                      adminRequest(`/v1/admin/feeds/${feed.id}/dry-run`, {
                        method: 'POST',
                        csrfToken,
                      }),
                    'Dry-run validation completed without fetching.',
                  )
                }
              >
                Dry run
              </Button>
              {feed.state === 'APPROVED' && (
                <Button
                  size="sm"
                  onClick={() =>
                    void mutate(
                      () =>
                        adminRequest(`/v1/admin/feeds/${feed.id}/run`, {
                          method: 'POST',
                          csrfToken,
                        }),
                      'Feed run queued.',
                    )
                  }
                >
                  Run
                </Button>
              )}
              {feed.state === 'APPROVED' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void mutate(
                      () =>
                        adminRequest(`/v1/admin/feeds/${feed.id}/pause`, {
                          method: 'PATCH',
                          csrfToken,
                          body: {
                            expectedVersion: feed.version,
                            paused: true,
                            reason: 'Manual editorial pause',
                          },
                        }),
                      'Feed paused.',
                    )
                  }
                >
                  Pause
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      <h3>Recent runs</h3>
      {runs.length ? (
        <ul className="admin-record-list">
          {runs.map((run) => (
            <li key={run.id}>
              <Badge variant="outline">{humanState(run.state)}</Badge>
              <span>
                {run.parsedItems} parsed · {run.newArticles} new · attempt{' '}
                {run.attempt}
              </span>
              <small>
                {run.httpStatus ? `HTTP ${run.httpStatus} · ` : ''}
                {run.fetchedBytes} bytes
                {run.durationMs !== undefined && run.durationMs !== null
                  ? ` · ${run.durationMs} ms`
                  : ''}
              </small>
              <small>{new Date(run.createdAt).toLocaleString('en-IN')}</small>
              {run.state === 'DEAD_LETTERED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void mutate(
                      () =>
                        adminRequest(`/v1/admin/feed-runs/${run.id}/retry`, {
                          method: 'POST',
                          csrfToken,
                        }),
                      'Dead-lettered feed run queued for a controlled retry.',
                    )
                  }
                >
                  Retry
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-mini">
          <FileClock /> No worker runs recorded.
        </div>
      )}
    </section>
  );
}

function ClusterWorkspace({
  rows,
  selected,
  setSelected,
  canEdit,
  canEditClaims,
  canReviewSummaries,
  csrfToken,
  mutate,
}: MutationProps & {
  rows: ClusterRow[];
  selected: string[];
  setSelected: (value: string[]) => void;
  canEdit: boolean;
  canEditClaims: boolean;
  canReviewSummaries: boolean;
}) {
  const chosen = rows.filter((row) => selected.includes(row.id));
  function toggle(id: string) {
    setSelected(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  }
  async function edit(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
    cluster: ClusterRow,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        adminRequest(`/v1/admin/clusters/${cluster.id}/headline`, {
          method: 'PATCH',
          csrfToken,
          body: {
            expectedVersion: cluster.version,
            headline: form.get('headline'),
            headlineHi: form.get('headlineHi'),
          },
        }),
      'Neutral headline saved with a revision record.',
    );
  }
  async function editClaim(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
    claim: ClusterRow['claims'][number],
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        adminRequest(`/v1/admin/claims/${claim.id}`, {
          method: 'PATCH',
          csrfToken,
          body: {
            expectedVersion: claim.version,
            text: form.get('text'),
            textHi: form.get('textHi'),
            state: form.get('state'),
            evidenceIds: claim.evidenceIds,
          },
        }),
      'Claim saved with its existing evidence references.',
    );
  }

  async function attachDocument(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
    cluster: ClusterRow,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        adminRequest(`/v1/admin/clusters/${cluster.id}/primary-documents`, {
          method: 'POST',
          csrfToken,
          body: {
            expectedVersion: cluster.version,
            title: form.get('title'),
            titleHi: form.get('titleHi') || undefined,
            issuer: form.get('issuer'),
            url: form.get('url'),
          },
        }),
      'Primary document attached.',
    );
  }
  function merge() {
    const [target, ...sources] = chosen;
    if (!target || sources.length === 0) return;
    void mutate(
      () =>
        adminRequest('/v1/admin/clusters/merge', {
          method: 'POST',
          csrfToken,
          body: {
            targetId: target.id,
            sourceIds: sources.map((item) => item.id),
            versions: Object.fromEntries(
              chosen.map((item) => [item.id, item.version]),
            ),
          },
        }),
      'Clusters merged and source clusters suppressed.',
    );
  }
  function split(cluster: ClusterRow) {
    if (cluster.articleIds.length < 2) return;
    const midpoint = Math.ceil(cluster.articleIds.length / 2);
    void mutate(
      () =>
        adminRequest(`/v1/admin/clusters/${cluster.id}/split`, {
          method: 'POST',
          csrfToken,
          body: {
            expectedVersion: cluster.version,
            groups: [
              {
                slug: `${cluster.slug}-part-one`,
                headline: `${cluster.headline} — part one`,
                headlineHi: `${cluster.headline} — भाग एक`,
                articleIds: cluster.articleIds.slice(0, midpoint),
              },
              {
                slug: `${cluster.slug}-part-two`,
                headline: `${cluster.headline} — part two`,
                headlineHi: `${cluster.headline} — भाग दो`,
                articleIds: cluster.articleIds.slice(midpoint),
              },
            ],
          },
        }),
      'Cluster split into held drafts for editorial review.',
    );
  }
  return (
    <section className="admin-panel">
      <header>
        <div>
          <h2>Cluster operations</h2>
          <p>
            Select clusters to merge, or edit and split a single event with
            compare-and-swap protection.
          </p>
        </div>
        <GitMerge />
      </header>
      {canEdit && (
        <div className="panel-actions">
          <Button onClick={merge} disabled={chosen.length < 2}>
            Merge selected
          </Button>
          <span>{chosen.length} selected</span>
        </div>
      )}
      <div className="admin-stack">
        {rows.map((cluster) => (
          <article className="cluster-admin-card" key={cluster.id}>
            <div className="cluster-admin-meta">
              <input
                type="checkbox"
                checked={selected.includes(cluster.id)}
                onChange={() => toggle(cluster.id)}
                aria-label={`Select ${cluster.headline}`}
              />
              <Badge variant="outline">{humanState(cluster.status)}</Badge>
              <Badge variant="outline">v{cluster.version}</Badge>
            </div>
            <h3>{cluster.headline}</h3>
            <small>
              {cluster.riskLevel} · {cluster.reviewState} ·{' '}
              {cluster.articleIds.length} articles
            </small>
            {canEdit && (
              <details className="admin-disclosure">
                <summary>Edit neutral headline</summary>
                <form
                  className="admin-form-grid"
                  onSubmit={(event) => void edit(event, cluster)}
                >
                  <Input
                    name="headline"
                    defaultValue={cluster.headline}
                    aria-label="English neutral headline"
                    required
                  />
                  <Input
                    name="headlineHi"
                    defaultValue={cluster.headlineHi}
                    aria-label="Hindi neutral headline"
                    required
                  />
                  <Button type="submit">Save headline</Button>
                </form>
              </details>
            )}
            {canEditClaims && cluster.claims.length > 0 && (
              <details className="admin-disclosure">
                <summary>Review claims and evidence</summary>
                <div className="admin-stack">
                  {cluster.claims.map((claim) => (
                    <form
                      className="admin-form-grid claim-editor"
                      key={claim.id}
                      onSubmit={(event) => void editClaim(event, claim)}
                    >
                      <label>
                        Claim state
                        <select name="state" defaultValue={claim.state}>
                          <option value="CONFIRMED">Confirmed</option>
                          <option value="DEVELOPING">Developing</option>
                          <option value="DISPUTED">Disputed</option>
                        </select>
                      </label>
                      <Input
                        name="text"
                        defaultValue={claim.text}
                        aria-label="English claim"
                        required
                      />
                      <Input
                        name="textHi"
                        defaultValue={claim.textHi}
                        aria-label="Hindi claim"
                        required
                      />
                      <small>
                        {claim.evidenceIds.length} evidence links retained
                      </small>
                      <Button type="submit" size="sm">
                        Save claim
                      </Button>
                    </form>
                  ))}
                </div>
              </details>
            )}
            {canReviewSummaries && cluster.summaries.length > 0 && (
              <details className="admin-disclosure">
                <summary>Approve or reject summaries</summary>
                <div className="admin-record-list">
                  {cluster.summaries.map((summary) => (
                    <article key={summary.id} className="summary-review-row">
                      <div>
                        <Badge variant="outline">
                          {summary.language.toUpperCase()} ·{' '}
                          {humanState(summary.decision)}
                        </Badge>
                        <p>{summary.text}</p>
                        <small>{summary.evidenceCount} evidence mappings</small>
                      </div>
                      <div className="panel-actions">
                        <Button
                          size="sm"
                          disabled={summary.evidenceCount === 0}
                          onClick={() =>
                            void mutate(
                              () =>
                                adminRequest(
                                  `/v1/admin/summaries/${summary.id}/decision`,
                                  {
                                    method: 'POST',
                                    csrfToken,
                                    body: {
                                      expectedVersion: summary.version,
                                      decision: 'APPROVED',
                                      notes:
                                        'Evidence reviewed in editorial workspace',
                                    },
                                  },
                                ),
                              'Summary approved.',
                            )
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void mutate(
                              () =>
                                adminRequest(
                                  `/v1/admin/summaries/${summary.id}/decision`,
                                  {
                                    method: 'POST',
                                    csrfToken,
                                    body: {
                                      expectedVersion: summary.version,
                                      decision: 'REJECTED',
                                      notes:
                                        'Rejected from editorial workspace',
                                    },
                                  },
                                ),
                              'Summary rejected and removed from reader selection.',
                            )
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </details>
            )}
            {canEdit && (
              <details className="admin-disclosure">
                <summary>Attach primary document</summary>
                <form
                  className="admin-form-grid"
                  onSubmit={(event) => void attachDocument(event, cluster)}
                >
                  <Input name="title" aria-label="Document title" required />
                  <Input name="titleHi" aria-label="Hindi document title" />
                  <Input name="issuer" aria-label="Document issuer" required />
                  <Input
                    name="url"
                    type="url"
                    aria-label="Official document URL"
                    required
                  />
                  <small>
                    {cluster.primaryDocuments.length} documents currently
                    attached
                  </small>
                  <Button type="submit" size="sm">
                    Attach document
                  </Button>
                </form>
              </details>
            )}
            {canEdit && (
              <div className="panel-actions">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void mutate(
                      () =>
                        adminRequest(
                          `/v1/admin/clusters/${cluster.id}/suppression`,
                          {
                            method: 'PATCH',
                            csrfToken,
                            body: {
                              expectedVersion: cluster.version,
                              suppressed: cluster.status === 'PUBLISHED',
                              reason:
                                cluster.status === 'PUBLISHED'
                                  ? 'Manual editorial hold'
                                  : 'Editorial restoration after checks',
                            },
                          },
                        ),
                      cluster.status === 'PUBLISHED'
                        ? 'Cluster suppressed.'
                        : 'Cluster restored.',
                    )
                  }
                >
                  {cluster.status === 'PUBLISHED' ? 'Suppress' : 'Restore'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={cluster.articleIds.length < 2}
                  onClick={() => split(cluster)}
                >
                  Split into drafts
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function CorrectionWorkspace({
  rows,
  clusters,
  csrfToken,
  mutate,
}: MutationProps & { rows: CorrectionRow[]; clusters: ClusterRow[] }) {
  async function create(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        adminRequest('/v1/admin/corrections', {
          method: 'POST',
          csrfToken,
          body: {
            clusterId: form.get('clusterId'),
            description: form.get('description'),
            sourceUrl: form.get('sourceUrl'),
            evidence: form.get('evidence'),
          },
        }),
      'Correction opened for review and propagation.',
    );
    event.currentTarget.reset();
  }
  async function apply(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
    correction: CorrectionRow,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cluster = clusters.find((item) => item.id === correction.clusterId);
    if (!cluster) return;
    const headline = formText(form, 'headline');
    const headlineHi = formText(form, 'headlineHi');
    await mutate(
      () =>
        adminRequest(`/v1/admin/corrections/${correction.id}/apply`, {
          method: 'POST',
          csrfToken,
          body: {
            expectedVersion: correction.version,
            clusterExpectedVersion: cluster.version,
            resolution: form.get('resolution'),
            headline: headline || undefined,
            headlineHi: headlineHi || undefined,
            removeFromBriefs: form.get('removeFromBriefs') === 'on',
          },
        }),
      'Correction published with revision and impact history.',
    );
  }
  return (
    <section className="admin-panel">
      <header>
        <div>
          <h2>Corrections</h2>
          <p>
            Published changes retain prior versions and visible correction
            history.
          </p>
        </div>
        <PencilLine />
      </header>
      <details className="admin-disclosure">
        <summary>Open a correction</summary>
        <form className="admin-form-grid" onSubmit={create}>
          <label>
            Story cluster
            <select name="clusterId" required>
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.headline}
                </option>
              ))}
            </select>
          </label>
          <Input
            name="description"
            aria-label="Correction description"
            placeholder="What requires correction?"
            required
          />
          <Input
            name="sourceUrl"
            type="url"
            aria-label="Correction source URL"
            placeholder="https://…"
            required
          />
          <Input
            name="evidence"
            aria-label="Correction evidence"
            placeholder="Evidence or document reference"
            required
          />
          <Button type="submit">Open correction</Button>
        </form>
      </details>
      <ul className="admin-record-list">
        {rows.map((item) => (
          <li key={item.id}>
            <Badge variant="outline">{humanState(item.status)}</Badge>
            <strong>{item.description}</strong>
            <small>
              {new Date(item.raisedAt).toLocaleString('en-IN')} · v
              {item.version}
            </small>
            {item.status !== 'PUBLISHED' && item.clusterId && (
              <details className="admin-disclosure">
                <summary>Resolve and publish</summary>
                <form
                  className="admin-form-grid"
                  onSubmit={(event) => void apply(event, item)}
                >
                  <Input
                    name="resolution"
                    aria-label="Correction resolution"
                    placeholder="What was changed and why?"
                    required
                  />
                  <Input
                    name="headline"
                    aria-label="Corrected English headline"
                    placeholder="Optional corrected English headline"
                  />
                  <Input
                    name="headlineHi"
                    aria-label="Corrected Hindi headline"
                    placeholder="Optional corrected Hindi headline"
                  />
                  <label>
                    <input name="removeFromBriefs" type="checkbox" /> Remove
                    this cluster from current briefs
                  </label>
                  <Button type="submit" size="sm">
                    Publish correction
                  </Button>
                </form>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RiskQueue({
  rows,
  canApprove,
  csrfToken,
  mutate,
}: MutationProps & { rows: ReviewRow[]; canApprove: boolean }) {
  return (
    <section className="admin-panel">
      <header>
        <div>
          <h2>High-risk review queue</h2>
          <p>
            Final approval must come from someone other than the drafter. Alert
            readiness is a separate approval.
          </p>
        </div>
        <ShieldAlert />
      </header>
      <div className="admin-stack">
        {rows.map((review) => (
          <article className="risk-item" key={review.id}>
            <span className="risk-level">
              {review.riskCategory || 'HIGH RISK'}
            </span>
            <div>
              <h3>{review.headline}</h3>
              <p>{review.reason}</p>
              <small>
                Drafter {review.draftedById?.slice(0, 8) ?? 'legacy'} · v
                {review.version} · {humanState(review.decision)}
              </small>
            </div>
            {canApprove && review.decision === 'PENDING' && (
              <div className="panel-actions">
                <Button
                  onClick={() =>
                    void mutate(
                      () =>
                        adminRequest(
                          `/v1/admin/reviews/${review.id}/decision`,
                          {
                            method: 'POST',
                            csrfToken,
                            body: {
                              expectedVersion: review.version,
                              decision: 'APPROVED',
                              notes:
                                'Evidence and neutral wording independently reviewed.',
                            },
                          },
                        ),
                      'High-risk story independently approved.',
                    )
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void mutate(
                      () =>
                        adminRequest(
                          `/v1/admin/reviews/${review.id}/decision`,
                          {
                            method: 'POST',
                            csrfToken,
                            body: {
                              expectedVersion: review.version,
                              decision: 'REJECTED',
                              notes:
                                'Returned for additional evidence and wording review.',
                            },
                          },
                        ),
                      'Story returned to the drafting editor.',
                    )
                  }
                >
                  Reject
                </Button>
              </div>
            )}
            {canApprove && review.decision === 'APPROVED' && (
              <div className="panel-actions">
                <Button
                  onClick={() =>
                    void mutate(
                      () =>
                        adminRequest(
                          `/v1/admin/reviews/${review.id}/push-approval`,
                          {
                            method: 'POST',
                            csrfToken,
                            body: { expectedVersion: review.version },
                          },
                        ),
                      'Alert readiness approved. No public alert was sent.',
                    )
                  }
                >
                  Mark alert ready
                </Button>
                <small>
                  Final reviewer {review.reviewerId?.slice(0, 8) ?? 'recorded'}
                </small>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function EditionWorkspace({
  edition,
  csrfToken,
  mutate,
}: MutationProps & { edition: EditionRow }) {
  const paused = edition.data.paused;
  return (
    <section className="admin-panel">
      <header>
        <div>
          <h2>India edition control</h2>
          <p>
            This kill switch returns a recoverable error for public feeds while
            the editorial issue is investigated.
          </p>
        </div>
        <ShieldAlert />
      </header>
      <div className="edition-control-card">
        <Badge variant="outline">{paused ? 'Paused' : 'Publishing'}</Badge>
        <p>
          {edition.data.reason ||
            'No edition-wide editorial incident is currently recorded.'}
        </p>
        <Button
          variant={paused ? 'default' : 'outline'}
          onClick={() =>
            void mutate(
              () =>
                adminRequest('/v1/admin/editions/india', {
                  method: 'PATCH',
                  csrfToken,
                  body: {
                    expectedVersion: edition.version,
                    paused: !paused,
                    reason: paused
                      ? 'Edition restored after editorial checks'
                      : 'Manual edition pause from editorial control room',
                  },
                }),
              paused ? 'India edition restored.' : 'India edition paused.',
            )
          }
        >
          {paused ? 'Restore India edition' : 'Pause India edition'}
        </Button>
      </div>
    </section>
  );
}

function AuditWorkspace({ rows }: { rows: AuditRow[] }) {
  const [visibleRows, setVisibleRows] = useState(rows);
  const [exportQuery, setExportQuery] = useState('');
  const [filterError, setFilterError] = useState('');

  useEffect(() => setVisibleRows(rows), [rows]);

  async function filter(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const search = new URLSearchParams({ page_size: '50' });
    for (const key of ['action', 'entity_type', 'request_id', 'outcome']) {
      const value = formText(form, key);
      if (value) search.set(key, value);
    }
    setFilterError('');
    try {
      const result = await adminRequest<AdminPage<AuditRow>>(
        `/v1/admin/audit?${search.toString()}`,
      );
      setVisibleRows(result.items);
      search.delete('page_size');
      setExportQuery(search.toString());
    } catch (caught) {
      setFilterError(
        caught instanceof AdminApiError
          ? caught.message
          : 'Audit search could not be completed.',
      );
    }
  }

  const suffix = exportQuery ? `&${exportQuery}` : '';
  return (
    <section className="admin-panel">
      <header>
        <div>
          <h2>Append-only audit</h2>
          <p>
            Actor, request, outcome and redacted change summaries are
            exportable.
          </p>
        </div>
        <FileClock />
      </header>
      <form className="admin-filter-row" onSubmit={filter}>
        <Input name="action" aria-label="Audit action" placeholder="Action" />
        <Input
          name="entity_type"
          aria-label="Audit entity type"
          placeholder="Entity type"
        />
        <Input
          name="request_id"
          aria-label="Audit request ID"
          placeholder="Request ID"
        />
        <label>
          <span className="sr-only">Audit outcome</span>
          <select name="outcome" defaultValue="">
            <option value="">All outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
            <option value="REJECTION">Rejection</option>
          </select>
        </label>
        <Button type="submit" size="sm">
          Search audit
        </Button>
      </form>
      {filterError && (
        <p className="admin-error" role="alert">
          {filterError}
        </p>
      )}
      <div className="panel-actions">
        <a
          className="button-link"
          href={`${adminApiBaseUrl()}/v1/admin/audit/export?format=csv${suffix}`}
        >
          Export CSV
        </a>
        <a
          className="button-link"
          href={`${adminApiBaseUrl()}/v1/admin/audit/export?format=json${suffix}`}
        >
          Export JSON
        </a>
      </div>
      <ul className="admin-record-list">
        {visibleRows.map((item) => (
          <li key={item.id}>
            <Badge variant="outline">{humanState(item.outcome)}</Badge>
            <strong>{humanState(item.action)}</strong>
            <span>
              {item.entityType} ·{' '}
              {item.actorRole ? humanState(item.actorRole) : 'system'}
            </span>
            <small>
              {new Date(item.createdAt).toLocaleString('en-IN')} · request{' '}
              {item.requestId.slice(0, 12)}
            </small>
          </li>
        ))}
      </ul>
      {!visibleRows.length && (
        <div className="empty-mini">
          <FileClock /> No audit records match these filters.
        </div>
      )}
    </section>
  );
}

function StaffWorkspace({
  rows,
  currentUsername,
  csrfToken,
  mutate,
}: MutationProps & { rows: StaffRow[]; currentUsername: string }) {
  async function changeRole(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
    item: StaffRow,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        adminRequest(`/v1/admin/staff/${item.id}`, {
          method: 'PATCH',
          csrfToken,
          body: {
            expectedVersion: item.version,
            role: form.get('role'),
          },
        }),
      `${item.displayName}'s role was updated and existing sessions were revoked.`,
    );
  }

  return (
    <section className="admin-panel">
      <header>
        <div>
          <h2>Staff and roles</h2>
          <p>
            Accounts are created only through the protected CLI bootstrap
            command.
          </p>
        </div>
        <Users />
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Staff member</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.displayName}</strong>
                  <small>{item.username}</small>
                </td>
                <td>{humanRole(item.role)}</td>
                <td>
                  <Badge variant="outline">
                    {item.active ? 'Active' : 'Revoked'}
                  </Badge>
                </td>
                <td>
                  {item.lastLoginAt
                    ? new Date(item.lastLoginAt).toLocaleString('en-IN')
                    : 'Never'}
                </td>
                <td>
                  {item.username === currentUsername ? (
                    <small>Current account</small>
                  ) : (
                    <div className="staff-controls">
                      <form onSubmit={(event) => void changeRole(event, item)}>
                        <label>
                          <span className="sr-only">
                            Role for {item.displayName}
                          </span>
                          <select name="role" defaultValue={item.role}>
                            <option value="ADMINISTRATOR">Administrator</option>
                            <option value="EDITOR">Editor</option>
                            <option value="REVIEWER">Reviewer</option>
                            <option value="PUBLISHER_MANAGER">
                              Publisher Manager
                            </option>
                            <option value="ANALYST">Analyst</option>
                          </select>
                        </label>
                        <Button size="sm" type="submit" variant="outline">
                          Change role
                        </Button>
                      </form>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void mutate(
                            () =>
                              adminRequest(`/v1/admin/staff/${item.id}`, {
                                method: 'PATCH',
                                csrfToken,
                                body: {
                                  expectedVersion: item.version,
                                  active: !item.active,
                                },
                              }),
                            `${item.displayName} was ${item.active ? 'disabled' : 'restored'}.`,
                          )
                        }
                      >
                        {item.active ? 'Disable' : 'Restore'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void mutate(
                            () =>
                              adminRequest(
                                `/v1/admin/staff/${item.id}/revoke-sessions`,
                                { method: 'POST', csrfToken },
                              ),
                            `${item.displayName}'s sessions were revoked.`,
                          )
                        }
                      >
                        Revoke sessions
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
