import { expect, test } from '@playwright/test';

test('production omits the fictional showcase even with every demo flag enabled', async ({
  request,
}) => {
  const variants: Record<string, string>[] = [{}, { RSC: '1' }];
  for (const headers of variants) {
    const response = await request.get('/preview/source-cards?lang=hi', {
      headers,
    });
    expect(response.status()).toBe(404);
    const body = await response.text();
    expect(body).not.toContain('fixture-pib-en-library');
    expect(body).not.toContain('pib-fixture.example');
    expect(body).not.toContain('global-voices-fixture.example');
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});
