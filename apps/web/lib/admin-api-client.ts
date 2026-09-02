export type StaffRole =
  | 'ADMINISTRATOR'
  | 'EDITOR'
  | 'REVIEWER'
  | 'PUBLISHER_MANAGER'
  | 'ANALYST';

export interface StaffSession {
  id: string;
  username: string;
  displayName: string;
  role: StaffRole;
  permissions: string[];
  expiresAt: string;
  csrfToken?: string;
}

export interface AdminPage<T = Record<string, unknown>> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminEntity {
  id: string;
  entityType: string;
  version: number;
  data: Record<string, unknown>;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export function adminApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:8000'
  ).replace(/\/$/, '');
}

async function parseError(response: Response): Promise<AdminApiError> {
  let payload: ErrorEnvelope = {};
  try {
    payload = (await response.json()) as ErrorEnvelope;
  } catch {
    // A generic message intentionally avoids reflecting untrusted server text.
  }
  return new AdminApiError(
    payload.error?.message ?? 'The editorial request could not be completed.',
    response.status,
    payload.error?.code ?? 'admin_api_error',
  );
}

export async function adminRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    body?: unknown;
    csrfToken?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.csrfToken) headers['X-CSRF-Token'] = options.csrfToken;
  const response = await fetch(`${adminApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function hasPermission(
  session: StaffSession,
  permission: string,
): boolean {
  return session.permissions.includes(permission);
}
