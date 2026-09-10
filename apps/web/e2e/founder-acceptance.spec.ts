import { expect, test } from '@playwright/test';

const readerRoutes = [
  { path: '/?lang=en', heading: 'Top News' },
  { path: '/for-you?lang=en', heading: 'For You' },
  { path: '/local?lang=en', heading: 'Delhi NCR' },
  { path: '/briefs?lang=en', heading: 'Daily Briefs' },
  { path: '/following?lang=en', heading: 'Following' },
  { path: '/search?q=technology&lang=en', heading: 'Search' },
  { path: '/source/janadesh?lang=en', heading: 'Janadesh' },
  {
    path: '/story/open-language-model-india-labs?lang=en',
    heading: null,
  },
];

test('founder reader routes render at the acceptance viewport', async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const failedDocuments: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (
      response.request().resourceType() === 'document' &&
      response.status() >= 500
    )
      failedDocuments.push(`${response.status()} ${response.url()}`);
  });

  for (const route of readerRoutes) {
    const response = await page.goto(route.path);
    expect(response?.status(), route.path).toBe(200);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    if (route.heading) await expect(heading).toContainText(route.heading);
    else await expect(heading).not.toHaveText('');
    await expect(page).toHaveTitle(/Nuzenio/);
  }

  await page.goto('/for-you?lang=en');
  await expect(page.getByText('Why am I seeing this?').first()).toBeVisible();
  expect(failedDocuments).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test('English and Hindi switching updates visible copy and route data', async ({
  page,
}) => {
  await page.goto('/?lang=en');
  await expect(page.locator('h1').first()).toHaveText('Top News');

  await page.getByRole('button', { name: 'Switch to Hindi' }).click();
  await expect(page).toHaveURL(/(?:\?|&)lang=hi(?:&|$)/);
  await expect(page.locator('h1').first()).toHaveText('मुख्य समाचार');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page).toHaveURL(/(?:\?|&)lang=en(?:&|$)/);
  await expect(page.locator('h1').first()).toHaveText('Top News');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
