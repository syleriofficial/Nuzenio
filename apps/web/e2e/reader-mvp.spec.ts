import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const national = 'national-clean-mobility-framework';
const technology = 'open-language-model-india-labs';
const nationalTitle =
  'Union cabinet clears framework for cleaner intercity transport';
const technologyTitle =
  'Research consortium releases open language model for 12 Indian languages';

test('legacy bookmarks beyond 200 survive detail removal and Saved reloads', async ({
  page,
}) => {
  const ids = [
    national,
    ...Array.from({ length: 199 }, (_, i) => 'old-bookmark-' + i),
    technology,
  ];
  await page.addInitScript((saved) => {
    if (localStorage.getItem('nuzenio-saved') === null)
      localStorage.setItem('nuzenio-saved', JSON.stringify(saved));
  }, ids);
  await page.goto('/saved?lang=en');
  await expect(
    page.getByText('201 bookmarks · Page 1/21', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: technologyTitle, exact: true }),
  ).toBeVisible();
  await page.goto('/story/' + national + '?lang=en');
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await page.goto('/saved?lang=en');
  await page.reload();
  await expect(
    page.getByText('200 bookmarks · Page 1/20', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: technologyTitle, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('nuzenio-saved')!),
    ),
  ).toEqual(ids.slice(1));
});

for (const missing of ['any', 'timeout', 'both'] as const) {
  test(`Saved loads and revalidates without AbortSignal ${missing}`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ missing, technology }) => {
        const methods = missing === 'both' ? ['any', 'timeout'] : [missing];
        for (const method of methods)
          Object.defineProperty(AbortSignal, method, {
            configurable: true,
            value: undefined,
          });
        localStorage.setItem('nuzenio-saved', JSON.stringify([technology]));
      },
      { missing, technology },
    );
    await page.goto('/saved?lang=en');
    await expect(
      page.getByRole('heading', { name: technologyTitle, exact: true }),
    ).toBeVisible();
    await page.route('**/api/reader/story?**', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: '{"error":"Story unavailable."}',
      }),
    );
    await page
      .getByRole('button', { name: 'Refresh stories', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Story no longer publicly available',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: technologyTitle, exact: true }),
    ).toHaveCount(0);
    await page.unroute('**/api/reader/story?**');
    await page
      .getByRole('button', { name: 'Refresh stories', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: technologyTitle, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: technologyTitle, exact: true }),
    ).toBeVisible();
  });
}

test('saved pages bound fetching and keep long unavailable IDs readable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const ids = Array.from({ length: 11 }, (_, index) =>
      ('missing-reader-' + index).padEnd(300, 'x'),
    );
    localStorage.setItem('nuzenio-saved', JSON.stringify(ids));
  });
  await page.goto('/saved?lang=en');
  await expect(
    page.getByRole('heading', {
      name: 'Story no longer publicly available',
      exact: true,
    }),
  ).toHaveCount(10);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Story no longer publicly available',
      exact: true,
    }),
  ).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Remove bookmark', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Story no longer publicly available',
      exact: true,
    }),
  ).toHaveCount(10);
  await expect(
    page.getByRole('button', { name: 'Next', exact: true }),
  ).toBeDisabled();
  const response = await page.request.get(
    '/api/reader/story?slug=' + technology + '&language=en',
  );
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
});

test('card, detail, saved list and another tab share bookmarks across reloads', async ({
  page,
  context,
}) => {
  await page.goto('/?lang=en');
  const card = page.locator('article').filter({
    has: page.getByRole('heading', { name: nationalTitle, exact: true }),
  });
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/story/' + national + '?lang=en');
  await expect(
    page.getByRole('button', { name: 'Saved', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Saved', exact: true }),
  ).toBeVisible();
  const saved = await context.newPage();
  await saved.goto('/saved?lang=en');
  await expect(
    saved.getByRole('heading', { name: nationalTitle, exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(
    saved.getByRole('heading', { name: 'No saved stories yet', exact: true }),
  ).toBeVisible();
  await saved.reload();
  await expect(
    saved.getByRole('heading', { name: 'No saved stories yet', exact: true }),
  ).toBeVisible();
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('nuzenio-saved') ?? '[]'),
  );
  expect(persisted).toEqual([]);
});

test('an explicitly empty followed-topic list survives reload and card state matches', async ({
  page,
}) => {
  await page.goto('/following?lang=en');
  await expect(
    page.getByRole('heading', { name: 'Nothing followed yet', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Technology', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: technologyTitle, exact: true }),
  ).toBeVisible();
  await page.goto('/?lang=en');
  const card = page.locator('article').filter({
    has: page.getByRole('heading', { name: technologyTitle, exact: true }),
  });
  await expect(
    card.getByRole('button', { name: 'Following', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('button', { name: 'Following', exact: true }).click();
  await page.goto('/following?lang=en');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Nothing followed yet', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Technology', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
});

test('source follows persist and hidden sources are excluded consistently with reversible controls', async ({
  page,
}) => {
  await page.goto('/source/janadesh?lang=en');
  await page
    .getByRole('button', { name: 'Follow source', exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Following', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/following?lang=en');
  await expect(
    page.getByRole('heading', { name: nationalTitle, exact: true }),
  ).toBeVisible();
  await page.goto('/source/janadesh?lang=en');
  await page
    .locator('.detail-actions')
    .getByRole('button', { name: 'Hide source', exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Unhide source', exact: true }),
  ).toBeVisible();
  for (const route of [
    '/?lang=en',
    '/following?lang=en',
    '/for-you?lang=en',
    '/search?q=transport&lang=en',
    '/briefs?lang=en',
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole('heading', { name: nationalTitle, exact: true }),
    ).toHaveCount(0);
  }
  // A preference must not rewrite evidence or become an authorization gate.
  await page.goto('/story/' + national + '?lang=en');
  await expect(
    page.getByRole('heading', { name: nationalTitle, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('4 independent publisher organisations', { exact: true }),
  ).toBeVisible();
  await page.goto('/settings?lang=en');
  await page
    .getByRole('button', { name: 'Unhide janadesh', exact: true })
    .click();
  await expect(
    page.getByText('No sources hidden.', { exact: true }),
  ).toBeVisible();
  await page.goto('/following?lang=en');
  await expect(
    page.getByRole('heading', { name: nationalTitle, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Unfollow Janadesh', exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Nothing followed yet', exact: true }),
  ).toBeVisible();
});

test('For You ranking uses actual choices and the off switch persists', async ({
  page,
}) => {
  await page.goto('/following?lang=en');
  await page.getByRole('button', { name: 'Technology', exact: true }).click();
  await page.goto('/for-you?lang=en');
  await expect(page.locator('article h2').first()).toHaveText(technologyTitle);
  await page
    .getByText('Why am I seeing this?', { exact: true })
    .first()
    .click();
  await expect(
    page.getByText('You follow Technology.', { exact: true }),
  ).toBeVisible();
  await page.goto('/settings?lang=en');
  await page
    .getByRole('switch', { name: 'Personalised For You', exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole('switch', { name: 'Personalised For You', exact: true }),
  ).not.toBeChecked();
  await page.goto('/for-you?lang=en');
  await expect(page.locator('article h2').first()).toHaveText(nationalTitle);
  await page
    .getByText('Why am I seeing this?', { exact: true })
    .first()
    .click();
  await expect(
    page
      .locator('article')
      .first()
      .getByText('Recent edition; personalisation is off.', { exact: true }),
  ).toBeVisible();
});

test('bookmarks revalidate withdrawn/error states without showing old stored content', async ({
  page,
}) => {
  await page.goto('/story/' + technology + '?lang=en');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('nuzenio-saved'))).toBe(
    JSON.stringify([technology]),
  );
  await page.goto('/saved?lang=en');
  await expect(
    page.getByRole('heading', { name: technologyTitle, exact: true }),
  ).toBeVisible();
  await page.route('**/api/reader/story?**', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"error":"Story unavailable."}',
    }),
  );
  await page
    .getByRole('button', { name: 'Refresh stories', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Story no longer publicly available',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: technologyTitle, exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/reader/story?**');
  await page.route('**/api/reader/story?**', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await page
    .getByRole('button', { name: 'Refresh stories', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Could not check this story',
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute('**/api/reader/story?**');
  await page
    .getByRole('button', { name: 'Refresh stories', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: technologyTitle, exact: true }),
  ).toBeVisible();
});

test('malformed or blocked storage does not crash or report a successful save', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('nuzenio-saved', '{bad-json');
    localStorage.setItem('nuzenio-followed-topics', 'null');
  });
  await page.goto('/saved?lang=en');
  await expect(
    page.getByRole('heading', { name: 'No saved stories yet', exact: true }),
  ).toBeVisible();
  const blocked = await context.newPage();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage blocked for acceptance test');
      },
    });
  });
  const errors: string[] = [];
  blocked.on('pageerror', (error) => errors.push(error.message));
  await blocked.goto('/story/' + technology + '?lang=en');
  await blocked.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    blocked.getByText(
      'Browser storage is unavailable. Preference changes could not be saved.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    blocked.getByRole('button', { name: 'Saved', exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('saved Hindi/theme/navigation and accessible layouts work on both viewports', async ({
  page,
  isMobile,
}) => {
  await page.goto('/story/' + technology + '?lang=en');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  if (isMobile)
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('link', { name: 'Saved stories', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: technologyTitle, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Switch to Hindi', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'सेव की गई स्टोरी', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'डार्क थीम', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(
    page.getByRole('button', { name: 'सेव', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const path of [
    '/following?lang=en',
    '/settings?lang=en',
    '/for-you?lang=en',
  ]) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
