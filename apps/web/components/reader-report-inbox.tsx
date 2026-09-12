'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  adminRequest,
  AdminApiError,
  type AdminPage,
} from '@/lib/admin-api-client';

interface Report {
  id: string;
  storySlug: string;
  language: string;
  category: string;
  details: string;
  status: string;
  version: number;
  resolutionNote: string;
  createdAt: string;
}

export function ReaderReportInbox({
  csrfToken,
  canManage,
  onUnauthorized,
}: {
  csrfToken: string;
  canManage: boolean;
  onUnauthorized: () => void;
}) {
  const [filter, setFilter] = useState('NEW');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminPage<Report> | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  const load = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true);
    setData(null);
    setError('');
    try {
      const result = await adminRequest<AdminPage<Report>>(
        `/v1/admin/reader-reports?page=${page}&page_size=10${filter ? '&status=' + filter : ''}`,
      );
      if (mounted.current && ticket === generation.current) {
        if (!result.items.length && page > 1) setPage(page - 1);
        else setData(result);
      }
    } catch (caught) {
      if (!mounted.current || ticket !== generation.current) return;
      if (caught instanceof AdminApiError && caught.status === 401)
        onUnauthorized();
      else if (
        !(caught instanceof DOMException && caught.name === 'AbortError')
      )
        setError('Could not load private reports. Please retry.');
    } finally {
      if (mounted.current && ticket === generation.current) setLoading(false);
    }
  }, [filter, page, onUnauthorized]);
  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);

  async function transition(
    event: SyntheticEvent<HTMLFormElement>,
    report: Report,
  ) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      await adminRequest(`/v1/admin/reader-reports/${report.id}`, {
        method: 'PATCH',
        csrfToken,
        body: {
          expectedVersion: report.version,
          status: fields.get('status'),
          note: fields.get('note'),
        },
      });
      if (mounted.current) await load();
    } catch (caught) {
      if (!mounted.current) return;
      if (caught instanceof AdminApiError && caught.status === 401)
        onUnauthorized();
      else
        setError(
          caught instanceof AdminApiError && caught.status === 409
            ? 'This report changed or the transition is no longer allowed. Refresh before retrying.'
            : 'The report was not confirmed updated. Refresh and check before retrying.',
        );
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  return (
    <section className="reader-report-inbox" aria-label="Reader reports">
      <h2>Reader reports</h2>
      <p>
        Private submissions, not verified facts. Status changes never edit or
        publish a story. Use the separate correction/review workflow when
        needed.
      </p>
      <div className="detail-actions">
        <label htmlFor="report-status-filter">Status</label>
        <select
          id="report-status-filter"
          value={filter}
          disabled={pending}
          onChange={(event) => {
            setPage(1);
            setFilter(event.target.value);
          }}
        >
          <option value="">All statuses</option>
          {['NEW', 'REVIEWING', 'RESOLVED', 'DISMISSED'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={loading || pending}
          onClick={() => void load()}
        >
          Refresh reports
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && <output>Loading private reports…</output>}
      {data?.items.length === 0 && <p>No reports match this status.</p>}
      {data?.items.map((report) => (
        <article className="reader-report-card" key={report.id}>
          <h3>{report.storySlug}</h3>
          <p>
            {report.category} · {report.language} · {report.status} · Version{' '}
            {report.version}
          </p>
          <p className="report-user-text">{report.details}</p>
          {report.resolutionNote && (
            <p className="report-user-text">
              Staff note: {report.resolutionNote}
            </p>
          )}
          <small>{new Date(report.createdAt).toLocaleString()}</small>
          {canManage && ['NEW', 'REVIEWING'].includes(report.status) && (
            <form onSubmit={(event) => void transition(event, report)}>
              <label htmlFor={'report-state-' + report.id}>Next status</label>
              <select
                id={'report-state-' + report.id}
                name="status"
                disabled={pending}
                defaultValue={
                  report.status === 'NEW' ? 'REVIEWING' : 'RESOLVED'
                }
              >
                {(report.status === 'NEW'
                  ? ['REVIEWING']
                  : ['RESOLVED', 'DISMISSED']
                ).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <label htmlFor={'report-note-' + report.id}>Review note</label>
              <Textarea
                id={'report-note-' + report.id}
                name="note"
                required
                minLength={10}
                maxLength={1000}
                disabled={pending}
              />
              <Button type="submit" disabled={pending}>
                Update report
              </Button>
            </form>
          )}
        </article>
      ))}
      {data && (
        <div className="detail-actions">
          <Button
            variant="outline"
            disabled={page <= 1 || pending}
            onClick={() => setPage(page - 1)}
          >
            Previous reports
          </Button>
          <span>
            Page {page} · {data.pagination.total} reports
          </span>
          <Button
            variant="outline"
            disabled={page >= data.pagination.totalPages || pending}
            onClick={() => setPage(page + 1)}
          >
            Next reports
          </Button>
        </div>
      )}
    </section>
  );
}
