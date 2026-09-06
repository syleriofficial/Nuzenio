import {
  APIRequestContext,
  request as playwrightRequest,
} from '@playwright/test';

export const apiBaseUrl = 'http://127.0.0.1:8001';
export const e2ePassword = 'Local-E2E-Staff-Password-42!';

export async function authenticatedApi(
  username: string,
): Promise<{ api: APIRequestContext; csrf: string }> {
  const api = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
  const response = await api.post('/v1/admin/auth/login', {
    data: { username, password: e2ePassword },
  });
  if (!response.ok()) {
    throw new Error(
      `Could not log in E2E staff ${username}: ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { csrfToken: string };
  return { api, csrf: body.csrfToken };
}

export function csrfHeaders(csrf: string): Record<string, string> {
  return { 'X-CSRF-Token': csrf };
}

export async function regenerateFixtureSummary(
  api: APIRequestContext,
  csrf: string,
  clusterId: string,
) {
  type Cluster = {
    id: string;
    version: number;
    summaries: Array<{ id: string; version: number; language: string }>;
    claims: Array<{ evidenceIds: string[] }>;
  };
  const load = async () =>
    (
      (await (await api.get('/v1/admin/clusters?page_size=100')).json())
        .items as Cluster[]
    ).find((item) => item.id === clusterId)!;
  const cluster = await load();
  const old = cluster.summaries.find((item) => item.language === 'en')!;
  const text = 'A corrected fictional report is now available.';
  const response = await api.post(`/v1/admin/summaries/${old.id}/revisions`, {
    headers: csrfHeaders(csrf),
    data: {
      expectedVersion: old.version,
      summaryText: text,
      evidenceMap: {
        sentences: [
          {
            text,
            evidence_ids: cluster.claims.flatMap((claim) => claim.evidenceIds),
          },
        ],
      },
    },
  });
  if (!response.ok()) throw new Error('Corrected fixture draft failed');
  const fresh = await response.json();
  const approved = await api.post(`/v1/admin/summaries/${fresh.id}/decision`, {
    headers: csrfHeaders(csrf),
    data: {
      expectedVersion: fresh.version,
      decision: 'APPROVED',
      notes: 'Corrected fixture evidence reviewed',
    },
  });
  if (!approved.ok()) throw new Error('Corrected fixture approval failed');
  const current = await load();
  const restored = await api.patch(
    `/v1/admin/clusters/${clusterId}/suppression`,
    {
      headers: csrfHeaders(csrf),
      data: {
        expectedVersion: current.version,
        paused: false,
        reason: 'Fresh corrected summary approved',
      },
    },
  );
  if (!restored.ok()) throw new Error('Corrected fixture restoration failed');
}
