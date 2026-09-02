import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const route of [
  '/',
  '/story/open-language-model-india-labs?lang=en',
  '/admin',
]) {
  test(`${route} has no automated accessibility violations`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page).toHaveTitle(/Nuzenio/);
    await expect(page.locator('h1').first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
