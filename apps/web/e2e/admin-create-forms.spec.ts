import { expect, test, type Page } from '@playwright/test';

// Exercise the production React UI with controlled HTTP outcomes. No fixture
// account, shared preview, publisher, or database is changed by these tests.
const forms = [
  {
    name: 'publisher',
    tab: 'Source registry',
    disclosure: 'Add publisher draft',
    button: 'Create draft',
    endpoint: '/v1/admin/publishers',
    confirmation: 'Publisher draft created.',
    fields: {
      'Publisher name': 'Form Regression Publisher',
      'Publisher slug': 'form-regression-publisher',
      Ownership: 'Fictional cooperative',
      'Contact name': 'Fixture desk',
      'Contact email': 'desk@form.example',
      'Correction route': 'https://form.example/corrections',
    },
    payload: {
      name: 'Form Regression Publisher',
      slug: 'form-regression-publisher',
      ownership: 'Fictional cooperative',
      contactName: 'Fixture desk',
      contactEmail: 'desk@form.example',
      correctionRoute: 'https://form.example/corrections',
    },
  },
  {
    name: 'correction',
    tab: 'Corrections',
    disclosure: 'Open a correction',
    button: 'Open correction',
    endpoint: '/v1/admin/corrections',
    confirmation: 'Correction opened for review and propagation.',
    fields: {
      'Correction description': 'Check the fictional assertion',
      'Correction source URL': 'https://form.example/evidence',
      'Correction evidence': 'Offline fixture evidence only',
    },
    payload: {
      clusterId: 'cluster-2',
      description: 'Check the fictional assertion',
      sourceUrl: 'https://form.example/evidence',
      evidence: 'Offline fixture evidence only',
    },
  },
] as const;

type FormCase = (typeof forms)[number];

async function prepare(page: Page, form: FormCase) {
  const state = {
    posts: [] as unknown[],
    outcome: 'success' as 'success' | 'rejected' | 'network',
    failRefresh: false,
    saved: false,
    releasePost: undefined as (() => void) | undefined,
    holdPost: false,
  };
  const record =
    form.name === 'publisher'
      ? {
          id: 'created-publisher',
          ...form.payload,
          state: 'DRAFT',
          version: 1,
          domains: [],
          rights: [],
          feeds: [],
        }
      : {
          id: 'created-correction',
          ...form.payload,
          status: 'OPEN',
          version: 1,
          raisedAt: '2026-09-17T00:00:00Z',
        };
  await page.route('**/v1/admin/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, json: body });
    if (path === '/v1/admin/auth/session') {
      return fulfill({
        id: 'form-test-staff',
        username: 'form-test',
        displayName: 'Form regression staff',
        role: 'ADMINISTRATOR',
        permissions: ['publisher:manage', 'correction:manage'],
        expiresAt: '2099-01-01T00:00:00Z',
        csrfToken: 'form-test-csrf',
      });
    }
    if (path === form.endpoint && request.method() === 'POST') {
      state.posts.push(request.postDataJSON());
      expect(request.headers()['x-csrf-token']).toBe('form-test-csrf');
      if (state.holdPost) {
        await new Promise<void>((resolve) => {
          state.releasePost = resolve;
        });
      }
      if (state.outcome === 'network') return route.abort('failed');
      if (state.outcome === 'rejected') {
        return fulfill(
          {
            error: {
              code: 'invalid_input',
              message: 'Fixture validation failed.',
            },
          },
          422,
        );
      }
      state.saved = true;
      return fulfill(record, 201);
    }
    if (path === form.endpoint && state.saved && state.failRefresh) {
      return fulfill(
        {
          error: {
            code: 'unavailable',
            message: 'Fixture refresh unavailable.',
          },
        },
        503,
      );
    }
    const items =
      path === '/v1/admin/clusters'
        ? [1, 2].map((number) => ({
            id: `cluster-${number}`,
            headline: `Fictional cluster ${number}`,
          }))
        : path === form.endpoint && state.saved
          ? [record]
          : [];
    return fulfill({
      items,
      pagination: { page: 1, pageSize: 50, total: items.length, totalPages: 1 },
    });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: form.tab, exact: true }).click();
  await page.getByText(form.disclosure, { exact: true }).click();
  for (const [label, value] of Object.entries(form.fields)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  if (form.name === 'correction') {
    await page
      .getByRole('combobox', { name: /^Story cluster/ })
      .selectOption('cluster-2');
  }
  return state;
}

async function expectValues(page: Page, form: FormCase, reset: boolean) {
  for (const [label, value] of Object.entries(form.fields)) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(
      reset ? '' : value,
    );
  }
  if (form.name === 'correction') {
    await expect(
      page.getByRole('combobox', { name: /^Story cluster/ }),
    ).toHaveValue(reset ? 'cluster-1' : 'cluster-2');
  }
}

let pageErrors: string[];
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
});
test.afterEach(() => {
  expect(pageErrors, 'No uncaught React submit/reset errors').toEqual([]);
});

for (const form of forms) {
  test(`${form.name}: delayed success resets once and blocks duplicate submissions`, async ({
    page,
  }) => {
    const state = await prepare(page, form);
    state.holdPost = true;
    const button = page.getByRole('button', { name: form.button, exact: true });
    const htmlForm = button.locator('xpath=ancestor::form');
    // Same-tick events also exercise the synchronous guard, before React commits.
    await htmlForm.evaluate((element: HTMLFormElement) => {
      element.dataset.testResets = '0';
      element.addEventListener('reset', () => {
        element.dataset.testResets = String(
          Number(element.dataset.testResets) + 1,
        );
      });
      element.requestSubmit();
      element.requestSubmit();
    });
    try {
      await expect.poll(() => state.posts.length).toBe(1);
      await expect(button).toBeDisabled();
      await expect(htmlForm).toHaveAttribute('aria-busy', 'true');
      await expectValues(page, form, false);
      for (const label of Object.keys(form.fields)) {
        await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
      }
    } finally {
      state.holdPost = false;
      state.releasePost?.();
    }
    await expect(
      page.getByText(form.confirmation, { exact: true }),
    ).toBeVisible();
    await expectValues(page, form, true);
    await expect(button).toBeEnabled();
    await expect(htmlForm).toHaveAttribute('aria-busy', 'false');
    await expect(htmlForm).toHaveAttribute('data-test-resets', '1');
    expect(state.posts).toEqual([form.payload]);
    const savedText =
      form.name === 'publisher' ? form.payload.name : form.payload.description;
    await expect(page.getByText(savedText, { exact: true })).toHaveCount(1);
  });

  for (const outcome of ['rejected', 'network'] as const) {
    test(`${form.name}: ${outcome} failure preserves input and permits a successful retry`, async ({
      page,
    }) => {
      const state = await prepare(page, form);
      state.outcome = outcome;
      const button = page.getByRole('button', {
        name: form.button,
        exact: true,
      });
      await button.click();
      await expect(page.locator('.admin-error-state')).toContainText(
        outcome === 'rejected'
          ? 'Fixture validation failed.'
          : 'The operation could not be completed.',
      );
      await expectValues(page, form, false);
      await expect(button).toBeEnabled();
      expect(state.posts).toEqual([form.payload]);
      state.outcome = 'success';
      await button.click();
      await expect(
        page.getByText(form.confirmation, { exact: true }),
      ).toBeVisible();
      await expectValues(page, form, true);
      await expect(button).toBeEnabled();
      expect(state.posts).toEqual([form.payload, form.payload]);
    });
  }

  test(`${form.name}: committed save resets even if list refresh fails`, async ({
    page,
  }) => {
    const state = await prepare(page, form);
    state.failRefresh = true;
    await page.getByRole('button', { name: form.button, exact: true }).click();
    await expect(
      page.getByText(form.confirmation, { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.admin-error-state')).toContainText(
      'Fixture refresh unavailable.',
    );
    await expectValues(page, form, true);
    state.failRefresh = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.locator('.admin-error-state')).toHaveCount(0);
    expect(state.posts).toEqual([form.payload]);
  });
}
