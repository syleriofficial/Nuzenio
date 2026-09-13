'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  adminRequest,
  AdminApiError,
  type AdminPage,
} from '@/lib/admin-api-client';
import {
  assignmentPayload,
  type AssignmentPayload,
  type IncomingArticle,
  type DraftTarget,
} from '@/lib/draft-assignment';

export function IncomingArticleInbox({
  csrfToken,
  canAssign,
  onUnauthorized,
  onOpenDraft,
}: {
  csrfToken: string;
  canAssign: boolean;
  onUnauthorized: () => void;
  onOpenDraft: (id: string) => void;
}) {
  const [filter, setFilter] = useState('UNASSIGNED');
  const [page, setPage] = useState(1);
  const [draftPage, setDraftPage] = useState(1);
  const [data, setData] = useState<AdminPage<IncomingArticle> | null>(null);
  const [drafts, setDrafts] = useState<AdminPage<DraftTarget> | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const attempts = useRef(new Map<string, AssignmentPayload>());
  const mounted = useRef(false);
  const busy = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const memory = attempts.current;
    return () => {
      mounted.current = false;
      generation.current += 1;
      memory.clear();
    };
  }, []);
  const load = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true);
    setError('');
    setData(null);
    setDrafts(null);
    try {
      const [articles, targets] = await Promise.all([
        adminRequest<AdminPage<IncomingArticle>>(
          `/v1/admin/incoming-articles?state=${filter}&page=${page}&page_size=10`,
        ),
        adminRequest<AdminPage<DraftTarget>>(
          `/v1/admin/draft-workspaces?page=${draftPage}&page_size=10`,
        ),
      ]);
      if (!mounted.current || ticket !== generation.current) return;
      setDrafts(targets);
      if (!articles.items.length && page > 1) setPage(page - 1);
      else setData(articles);
    } catch (caught) {
      if (!mounted.current || ticket !== generation.current) return;
      if (caught instanceof AdminApiError && caught.status === 401)
        onUnauthorized();
      else if (
        caught instanceof AdminApiError &&
        caught.code === 'draft_inbox_disabled'
      )
        setError(
          'Fixture inbox is disabled. Enable it only in an isolated development/test environment with demo mode and live feeds disabled.',
        );
      else setError('Could not load the private inbox. Refresh to retry.');
    } finally {
      if (mounted.current && ticket === generation.current) setLoading(false);
    }
  }, [filter, page, draftPage, onUnauthorized]);
  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);

  async function submit(
    event: SyntheticEvent<HTMLFormElement>,
    article: IncomingArticle,
  ) {
    event.preventDefault();
    if (busy.current) return;
    const selected = new FormData(event.currentTarget).get('target');
    const target =
      selected === 'new' ? null : drafts?.items.find((d) => d.id === selected);
    if (target === undefined) {
      setError('Refresh and select an available target.');
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    setConfirmed(null);
    try {
      const payload = assignmentPayload(
        article,
        target,
        attempts.current.get(article.id),
      );
      attempts.current.set(article.id, payload);
      const result = await adminRequest<{ clusterId: string }>(
        `/v1/admin/incoming-articles/${article.id}/assign`,
        { method: 'POST', csrfToken, body: payload },
      );
      if (!mounted.current) return;
      attempts.current.delete(article.id);
      setConfirmed(result.clusterId);
      await load();
    } catch (caught) {
      if (!mounted.current) return;
      if (caught instanceof AdminApiError && caught.status === 401)
        onUnauthorized();
      else if (
        caught instanceof AdminApiError &&
        [403, 409, 422].includes(caught.status)
      )
        setError(
          'Assignment is no longer eligible or a version changed. Refresh and check before retrying.',
        );
      else
        setError(
          'Assignment could not be confirmed. Retry the same selection to reuse the operation, or refresh to check assigned articles.',
        );
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return (
    <section aria-label="Incoming articles" className="reader-report-inbox">
      <h2>Incoming articles</h2>
      <p>
        Offline fictional sources only. Source text is unverified. Assignment
        creates a private HELD/PENDING draft, never a published story, summary
        or translation.
      </p>
      <div className="detail-actions">
        <label htmlFor="incoming-state">Assignment status</label>
        <select
          id="incoming-state"
          value={filter}
          disabled={pending}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="UNASSIGNED">Unassigned</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="ALL">All articles</option>
        </select>
        <Button
          variant="outline"
          disabled={pending || loading}
          onClick={() => void load()}
        >
          Refresh inbox
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {confirmed && (
        <div>
          <output aria-label="Draft assignment result">
            Assigned to a private draft. Independent factual review is still
            required.
          </output>
          <Button variant="outline" onClick={() => onOpenDraft(confirmed)}>
            Open editorial workspace
          </Button>
        </div>
      )}
      {loading && <output>Loading private incoming articles…</output>}
      {data?.items.length === 0 && (
        <p>
          No articles match. Use the explicit offline fixture import; no live
          feeds are polled here.
        </p>
      )}
      {data?.items.map((article) => (
        <article
          className="reader-report-card incoming-article-card"
          key={article.id}
        >
          <h3>{article.title ?? 'Source text withheld'}</h3>
          <p>
            {article.publisher} · Original language: {article.language} ·{' '}
            {article.state} · Version {article.version}
          </p>
          {article.excerpt && (
            <p className="report-user-text">{article.excerpt}</p>
          )}
          {article.originalUrl && (
            <p>
              Fixture source reference: <code>{article.originalUrl}</code> (not
              fetched)
            </p>
          )}
          {!!article.blockedReasons.length && (
            <p>Blocked: {article.blockedReasons.join(', ')}</p>
          )}
          {article.clusterId && (
            <Button
              variant="outline"
              onClick={() => onOpenDraft(article.clusterId!)}
            >
              Open editorial workspace
            </Button>
          )}
          {canAssign &&
            article.state === 'UNASSIGNED' &&
            !article.blockedReasons.length && (
              <form onSubmit={(e) => void submit(e, article)}>
                <label htmlFor={`target-${article.id}`}>
                  Draft destination
                </label>
                <select
                  id={`target-${article.id}`}
                  name="target"
                  disabled={pending || loading}
                  defaultValue="new"
                >
                  <option value="new">Create a new private draft</option>
                  {drafts?.items.map((draft) => (
                    <option
                      key={draft.id}
                      value={draft.id}
                      disabled={!!draft.blockedReasons.length}
                    >
                      {draft.title} · v{draft.version}
                      {draft.blockedReasons.length
                        ? ' · editorial editing started'
                        : ''}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={pending || loading}>
                  Assign to draft
                </Button>
              </form>
            )}
        </article>
      ))}
      {data && (
        <div className="detail-actions">
          <Button
            variant="outline"
            disabled={pending || page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous articles
          </Button>
          <span>
            Page {page} · {data.pagination.total} articles
          </span>
          <Button
            variant="outline"
            disabled={pending || page >= data.pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next articles
          </Button>
        </div>
      )}
      {canAssign && drafts && drafts.pagination.totalPages > 1 && (
        <div className="detail-actions">
          <Button
            variant="outline"
            disabled={pending || draftPage <= 1}
            onClick={() => setDraftPage(draftPage - 1)}
          >
            Previous draft targets
          </Button>
          <span>
            Draft target page {draftPage} · {drafts.pagination.total} drafts
          </span>
          <Button
            variant="outline"
            disabled={pending || draftPage >= drafts.pagination.totalPages}
            onClick={() => setDraftPage(draftPage + 1)}
          >
            Next draft targets
          </Button>
        </div>
      )}
    </section>
  );
}
