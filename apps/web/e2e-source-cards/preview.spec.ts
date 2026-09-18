import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('offline cards, original languages, provenance, responsive accessibility and no fetches', async ({
  page,
  baseURL,
}) => {
  const outside: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin !== baseURL ||
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/v1/')
    ) {
      outside.push(url.origin + url.pathname);
      await route.abort();
    } else await route.continue();
  });
  const response = await page.goto('/preview/source-cards');
  expect(response?.status()).toBe(200);
  // Next's development renderer forces revalidation for page responses. This
  // route contains only fictional data; production denial is separately no-store.
  expect(response?.headers()['cache-control']).toContain('no-cache');
  expect(response?.headers()['cache-control']).toContain('must-revalidate');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(
    page.getByRole('heading', { name: 'From the source.' }),
  ).toBeVisible();
  await expect(page.locator('[data-fixture-card]')).toHaveCount(4);
  await expect(page.getByText('Disabled · not reviewed')).toHaveCount(2);
  const englishHeadline = page.locator(
    '[data-fixture-card="fixture-pib-en-library"] h3',
  );
  const original = await englishHeadline.innerText();
  for (const link of await page.locator('[data-fixture-card] a').all()) {
    expect(new URL((await link.getAttribute('href'))!).hostname).toMatch(
      /\.example$/,
    );
    await expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  }
  await page.getByRole('link', { name: 'हिंदी', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'सीधे स्रोत से।' }),
  ).toBeVisible();
  await expect(englishHeadline).toHaveText(original);
  await expect(englishHeadline).toHaveAttribute('lang', 'en');
  await page
    .getByRole('combobox', { name: 'मूल भाषा', exact: true })
    .selectOption('hi');
  await page
    .getByRole('combobox', { name: 'स्रोत का उदाहरण', exact: true })
    .selectOption('global-voices');
  await page.getByRole('button', { name: 'फ़िल्टर लगाएँ' }).click();
  await expect(page.locator('[data-fixture-card]')).toHaveCount(1);
  await expect(page.locator('[data-fixture-card] h3')).toHaveAttribute(
    'lang',
    'hi',
  );
  await page.reload();
  await expect(page.locator('[data-fixture-card]')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
