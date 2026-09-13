import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { e2ePassword } from '../e2e/helpers';

const api = `http://127.0.0.1:${process.env.NUZENIO_E2E_API_PORT ?? '8001'}`;
async function login(page: Page, username = 'e2e-editor') {
  await page.goto('/admin');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(e2ePassword);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await page
    .getByRole('button', { name: 'Incoming articles', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Incoming articles', exact: true }),
  ).toBeVisible();
}

test('create private draft, preserve original Hindi, attach and persist through reload', async ({
  page,
}, info) => {
  const number = info.project.name === 'draft-desktop' ? 1 : 2;
  await login(page);
  const title = `काल्पनिक नई बस योजना ${number}`;
  let card = page.locator('.incoming-article-card').filter({ hasText: title });
  await expect(card).toBeVisible();
  const done = page.waitForResponse(
    (response) =>
      response.url().endsWith('/assign') &&
      response.request().method() === 'POST',
  );
  await card.getByRole('button', { name: 'Assign to draft' }).click();
  const result = await done;
  expect(result.status()).toBe(200);
  const { clusterId } = await result.json();
  await expect(
    page.getByRole('status', { name: 'Draft assignment result' }),
  ).toContainText('Assigned to a private draft');
  expect(
    (await page.request.get(`${api}/v1/clusters/draft-${clusterId}`)).status(),
  ).toBe(404);
  const english = page
    .locator('.incoming-article-card')
    .filter({ hasText: `Fictional incoming bus proposal ${number}` });
  await english.getByLabel('Draft destination').selectOption(clusterId);
  await english.getByRole('button', { name: 'Assign to draft' }).click();
  await expect(english).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('button', { name: 'Incoming articles', exact: true })
    .click();
  await page.getByLabel('Assignment status').selectOption('ASSIGNED');
  card = page.locator('.incoming-article-card').filter({ hasText: title });
  await expect(card).toContainText('ASSIGNED');
  await card.getByRole('button', { name: 'Open editorial workspace' }).click();
  await expect(
    page.getByRole('button', { name: 'Clusters', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('main')).toContainText(title);
});

test('lost acknowledgement retries one operation and logout clears private inbox', async ({
  page,
}, info) => {
  const number = info.project.name === 'draft-desktop' ? 3 : 4;
  await login(page);
  const title = `Fictional incoming bus proposal ${number}`;
  const card = page
    .locator('.incoming-article-card')
    .filter({ hasText: title });
  const operations: string[] = [];
  await page.route('**/v1/admin/incoming-articles/*/assign', async (route) => {
    operations.push(route.request().postDataJSON().operationId);
    const upstream = await route.fetch();
    expect(upstream.status()).toBe(200);
    if (operations.length === 1)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{}',
      });
    else await route.fulfill({ response: upstream });
  });
  await card.getByRole('button', { name: 'Assign to draft' }).click();
  await expect(
    page.getByRole('region', { name: 'Incoming articles' }).getByRole('alert'),
  ).toContainText('could not be confirmed');
  await card.getByRole('button', { name: 'Assign to draft' }).click();
  await expect(
    page.getByRole('status', { name: 'Draft assignment result' }),
  ).toContainText('Assigned to a private draft');
  expect(operations).toHaveLength(2);
  expect(operations[0]).toBe(operations[1]);
  await page.getByLabel('Assignment status').selectOption('ASSIGNED');
  await expect(
    page.locator('.incoming-article-card').filter({ hasText: title }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.locator('.incoming-article-card')).toHaveCount(0);
  expect(
    (await page.request.get(`${api}/v1/admin/incoming-articles`)).status(),
  ).toBe(401);
  await page.context().setOffline(true);
  await page.reload().catch(() => undefined);
  await expect(page.locator('.incoming-article-card')).toHaveCount(0);
  await page.context().setOffline(false);
});

test('reviewer read-only inbox is accessible; analyst cannot read it', async ({
  page,
}) => {
  await login(page, 'e2e-reviewer');
  await expect(
    page.getByRole('button', { name: 'Assign to draft', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.incoming-article-card').first()).toBeVisible();
  const scan = await new AxeBuilder({ page }).include('main').analyze();
  expect(scan.violations).toEqual([]);
  const response = await page.request.get(`${api}/v1/admin/incoming-articles`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByLabel('Username').fill('e2e-analyst');
  await page.getByLabel('Password').fill(e2ePassword);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(
    page.getByRole('button', { name: 'Log out', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Incoming articles', exact: true }),
  ).toHaveCount(0);
  expect(
    (await page.request.get(`${api}/v1/admin/incoming-articles`)).status(),
  ).toBe(403);
});
