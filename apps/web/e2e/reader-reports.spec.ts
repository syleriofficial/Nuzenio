import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { e2ePassword } from './helpers';

const slug = 'open-language-model-india-labs';

async function openReport(
  page: import('@playwright/test').Page,
  language = 'en',
) {
  await page.goto(`/story/${slug}?lang=${language}`);
  await page
    .getByRole('button', {
      name: language === 'hi' ? 'मुद्दा रिपोर्ट करें' : 'Report issue',
      exact: true,
    })
    .click();
}

test('report reaches protected inbox and triage survives reload without editing story', async ({
  page,
}) => {
  await openReport(page);
  const title = await page.locator('h1').innerText();
  const canary = `Browser private report ${Date.now()} <script>window.reportInjected=true</script>`;
  await page.getByLabel('Details', { exact: true }).fill(canary);
  const sent = page.waitForResponse(
    (response) =>
      response.url().includes('/api/reader/reports') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  expect((await sent).status()).toBe(202);
  await expect(
    page.getByText('Issue submitted for editorial review', { exact: true }),
  ).toBeVisible();
  await page.goto('/admin');
  await page.getByLabel('Username').fill('e2e-editor');
  await page.getByLabel('Password').fill(e2ePassword);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await page
    .getByRole('button', { name: 'Reader reports', exact: true })
    .click();
  let card = page.locator('.reader-report-card').filter({ hasText: canary });
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => 'reportInjected' in window)).toBe(false);
  await card
    .getByLabel('Review note')
    .fill('Reviewing the submitted factual concern.');
  await card.getByRole('button', { name: 'Update report' }).click();
  await expect(card).toHaveCount(0);
  await page.getByLabel('Status', { exact: true }).selectOption('REVIEWING');
  card = page.locator('.reader-report-card').filter({ hasText: canary });
  await expect(card).toBeVisible();
  await card
    .getByLabel('Review note')
    .fill('Resolved in triage only; editorial content was not changed.');
  await card.getByRole('button', { name: 'Update report' }).click();
  await expect(card).toHaveCount(0);
  await page.getByLabel('Status', { exact: true }).selectOption('RESOLVED');
  await expect(
    page.locator('.reader-report-card').filter({ hasText: canary }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'Reader reports', exact: true })
    .click();
  await page.getByLabel('Status', { exact: true }).selectOption('RESOLVED');
  await expect(
    page.locator('.reader-report-card').filter({ hasText: canary }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByText(canary, { exact: true })).toHaveCount(0);
  await page.goto(`/story/${slug}?lang=en`);
  await expect(page.locator('h1')).toHaveText(title);
  await expect(page.getByText(canary, { exact: true })).toHaveCount(0);
});

test('lost acknowledgment retries the same submission without duplicate reports', async ({
  page,
}) => {
  await openReport(page);
  const canary = `Duplicate protection report ${Date.now()}`;
  await page.getByLabel('Details', { exact: true }).fill(canary);
  const ids: string[] = [];
  let first = true;
  await page.route('**/api/reader/reports', async (route) => {
    ids.push(route.request().postDataJSON().submissionId);
    const upstream = await route.fetch();
    expect(upstream.status()).toBe(202);
    if (first) {
      first = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{}',
      });
    } else await route.fulfill({ response: upstream });
  });
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.locator('.report-form').getByRole('alert')).toContainText(
    'could not be confirmed',
  );
  await expect(page.getByLabel('Details', { exact: true })).toHaveValue(canary);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(
    page.getByText('Issue submitted for editorial review', { exact: true }),
  ).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  await page.goto('/admin');
  await page.getByLabel('Username').fill('e2e-editor');
  await page.getByLabel('Password').fill(e2ePassword);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await page
    .getByRole('button', { name: 'Reader reports', exact: true })
    .click();
  await expect(
    page.locator('.reader-report-card').filter({ hasText: canary }),
  ).toHaveCount(1);
});

test('Hindi reporting works without newer AbortSignal statics and remains accessible', async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const key of ['any', 'timeout'])
      Object.defineProperty(AbortSignal, key, {
        value: undefined,
        configurable: true,
      });
  });
  await openReport(page, 'hi');
  await page
    .getByLabel('विवरण', { exact: true })
    .fill('कृपया इस समाचार के संदर्भ की जांच करें।');
  await page.getByRole('button', { name: 'भेजें', exact: true }).click();
  await expect(
    page.getByText('मुद्दा संपादकीय समीक्षा के लिए भेजा गया', { exact: true }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include('.report-form')
    .analyze();
  expect(results.violations).toEqual([]);
});

test('rate errors keep the draft and never announce successful submission', async ({
  page,
}) => {
  await openReport(page);
  await page.route('**/api/reader/reports', (route) =>
    route.fulfill({ status: 429, contentType: 'application/json', body: '{}' }),
  );
  await page
    .getByLabel('Details', { exact: true })
    .fill('A report that should remain in the form.');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.locator('.report-form').getByRole('alert')).toContainText(
    'Too many attempts',
  );
  await expect(page.getByLabel('Details', { exact: true })).toHaveValue(
    'A report that should remain in the form.',
  );
  await expect(
    page.getByText('Issue submitted for editorial review', { exact: true }),
  ).toHaveCount(0);
});

test('non-editorial staff cannot see the report inbox', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('Username').fill('e2e-analyst');
  await page.getByLabel('Password').fill(e2ePassword);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(
    page.getByRole('button', { name: 'Audit', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reader reports', exact: true }),
  ).toHaveCount(0);
});
