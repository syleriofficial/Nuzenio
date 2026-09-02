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
