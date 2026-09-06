import { expect, test } from '@playwright/test';
import {
  authenticatedApi,
  csrfHeaders,
  e2ePassword,
  regenerateFixtureSummary,
} from './helpers';

test.describe.serial('Milestone 2B editorial operations', () => {
  test('staff login and logout use the protected workspace', async ({
    page,
  }) => {
    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: 'Editorial operations' }),
    ).toBeVisible();
    await page.getByLabel('Username').fill('e2e-admin');
    await page.getByLabel('Password').fill(e2ePassword);
    await page.getByRole('button', { name: 'Sign in securely' }).click();
    await expect(
      page.getByRole('heading', { name: 'Editorial control room' }),
    ).toBeVisible();
    await expect(
      page.getByText('Administrator', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(
      page.getByRole('heading', { name: 'Editorial operations' }),
    ).toBeVisible();
  });

  test('unauthorized access and role-restricted controls are denied', async ({
    page,
  }) => {
    const response = await page.request.get(
      `${apiBaseUrl()}/v1/admin/publishers`,
    );
    expect(response.status()).toBe(401);
    await page.goto('/admin');
    await page.getByLabel('Username').fill('e2e-analyst');
    await page.getByLabel('Password').fill(e2ePassword);
    await page.getByRole('button', { name: 'Sign in securely' }).click();
    await expect(page.getByRole('button', { name: 'Audit' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Source registry' }),
    ).toHaveCount(0);
    const { api, csrf } = await authenticatedApi('e2e-analyst');
    const denied = await api.post('/v1/admin/publishers', {
      headers: csrfHeaders(csrf),
      data: {
        name: 'Denied fixture',
        slug: 'denied-e2e-fixture',
        ownership: 'Fixture',
        contactName: 'Desk',
        contactEmail: 'desk@example.test',
        correctionRoute: 'https://example.test/corrections',
      },
    });
    expect(denied.status()).toBe(403);
    await api.dispose();
  });

  test('publisher onboarding advances only through reviewed states', async ({
    page,
  }) => {
    const { api, csrf } = await authenticatedApi('e2e-publisher-manager');
    const slug = `playwright-publisher-${Date.now()}`;
    const created = await api.post('/v1/admin/publishers', {
      headers: csrfHeaders(csrf),
      data: {
        name: 'Playwright Fictional Publisher',
        slug,
        ownership: 'Playwright Fixture Cooperative',
        contactName: 'Corrections Desk',
        contactEmail: 'corrections@playwright.example',
        correctionRoute: 'https://playwright.example/corrections',
      },
    });
    expect(created.ok()).toBeTruthy();
    const publisher = (await created.json()) as { id: string; version: number };
    let version = publisher.version;
    for (const state of ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED']) {
      const transition = await api.post(
        `/v1/admin/publishers/${publisher.id}/transition`,
        {
          headers: csrfHeaders(csrf),
          data: { expectedVersion: version, state, notes: 'Playwright review' },
        },
      );
      expect(transition.ok(), await transition.text()).toBeTruthy();
      version = ((await transition.json()) as { version: number }).version;
    }
    const domain = await api.post(
      `/v1/admin/publishers/${publisher.id}/domains`,
      {
        headers: csrfHeaders(csrf),
        data: {
          expectedVersion: version,
          domain: `${slug}.example`,
          ownershipEvidence: 'Playwright ownership fixture.',
        },
      },
    );
    expect(domain.ok(), await domain.text()).toBeTruthy();
    const domainRecord = (await domain.json()) as {
      id: string;
      version: number;
    };
    version += 1;
    let domainVersion = domainRecord.version;
    for (const state of ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED']) {
      const snapshot = await (
        await api.get(`/v1/admin/domains/${domainRecord.id}/snapshot`)
      ).json();
      const transition = await api.post(
        `/v1/admin/domains/${domainRecord.id}/transition`,
        {
          headers: csrfHeaders(csrf),
          data: {
            expectedVersion: domainVersion,
            expectedSnapshotHash: snapshot.snapshotHash,
            state,
            notes: 'Playwright domain review',
          },
        },
      );
      expect(transition.ok(), await transition.text()).toBeTruthy();
      domainVersion = ((await transition.json()) as { version: number })
        .version;
    }
    const rights = await api.post(
      `/v1/admin/publishers/${publisher.id}/rights`,
      {
        headers: csrfHeaders(csrf),
        data: {
          expectedVersion: version,
          policyName: 'Playwright fictional excerpt rights',
          evidenceUrl: `https://${slug}.example/rights`,
          effectiveAt: '2026-09-02T00:00:00+05:30',
          headline: true,
          snippet: true,
          generatedSummary: true,
          translation: true,
          fullTextStorage: false,
          fullTextDisplay: false,
        },
      },
    );
    expect(rights.ok(), await rights.text()).toBeTruthy();
    const rightsRecord = (await rights.json()) as {
      id: string;
      version: number;
    };
    version += 1;
    let rightsVersion = rightsRecord.version;
    for (const state of ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED']) {
      const snapshot = await (
        await api.get(`/v1/admin/rights/${rightsRecord.id}/snapshot`)
      ).json();
      expect(Object.keys(snapshot.permissions)).toHaveLength(8);
      expect(snapshot.evidenceUrl).toBe(`https://${slug}.example/rights`);
      const transition = await api.post(
        `/v1/admin/rights/${rightsRecord.id}/transition`,
        {
          headers: csrfHeaders(csrf),
          data: {
            expectedVersion: rightsVersion,
            expectedSnapshotHash: snapshot.snapshotHash,
            state,
            notes: 'Playwright rights review',
          },
        },
      );
      expect(transition.ok(), await transition.text()).toBeTruthy();
      rightsVersion = ((await transition.json()) as { version: number })
        .version;
    }
    const feed = await api.post(`/v1/admin/publishers/${publisher.id}/feeds`, {
      headers: csrfHeaders(csrf),
      data: {
        expectedVersion: version,
        domainId: domainRecord.id,
        rightsPolicyId: rightsRecord.id,
        name: 'Playwright fixture feed',
        url: `https://${slug}.example/feed.xml`,
        language: 'en',
      },
    });
    await page.goto('/admin');
    await page.getByLabel('Username').fill('e2e-publisher-manager');
    await page.getByLabel('Password').fill(e2ePassword);
    await page.getByRole('button', { name: 'Sign in securely' }).click();
    await page
      .getByText('Review Playwright Fictional Publisher · approved', {
        exact: true,
      })
      .click();
    await expect(
      page.getByText('Fictional DNS and contract evidence.', { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByText('Ownership evidence: Playwright ownership fixture.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="https://${slug}.example/rights"]`),
    ).toBeVisible();
    await expect(
      page.getByLabel(
        'Playwright fictional excerpt rights permission snapshot',
      ),
    ).toBeVisible();
    expect(feed.ok(), await feed.text()).toBeTruthy();
    const feedRecord = (await feed.json()) as { id: string; version: number };
    let feedVersion = feedRecord.version;
    const dryRun = await api.post(`/v1/admin/feeds/${feedRecord.id}/dry-run`, {
      headers: csrfHeaders(csrf),
    });
    expect(dryRun.ok(), await dryRun.text()).toBeTruthy();
    expect(await dryRun.json()).toMatchObject({
      valid: true,
      willFetch: false,
    });
    for (const state of ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED']) {
      const transition = await api.post(
        `/v1/admin/feeds/${feedRecord.id}/transition`,
        {
          headers: csrfHeaders(csrf),
          data: {
            expectedVersion: feedVersion,
            state,
            notes: 'Playwright feed review',
          },
        },
      );
      expect(transition.ok(), await transition.text()).toBeTruthy();
      feedVersion = ((await transition.json()) as { version: number }).version;
    }
    const registryResponse = await api.get('/v1/admin/publishers?page_size=50');
    const rows = (
      (await registryResponse.json()) as {
        items: Array<{
          slug: string;
          state: string;
          domains: Array<{ state: string }>;
          rights: Array<{ state: string; fullTextDisplay: boolean }>;
          feeds: Array<{ state: string }>;
        }>;
      }
    ).items;
    const approvedPublisher = rows.find((item) => item.slug === slug)!;
    expect(approvedPublisher.state).toBe('APPROVED');
    expect(approvedPublisher.domains[0].state).toBe('APPROVED');
    expect(approvedPublisher.rights[0]).toMatchObject({
      state: 'APPROVED',
      fullTextDisplay: false,
    });
    expect(approvedPublisher.feeds[0].state).toBe('APPROVED');
    await api.dispose();
  });

  test('high-risk final approval is performed by another staff user', async () => {
    const editor = await authenticatedApi('e2e-editor');
    const clustersResponse = await editor.api.get(
      '/v1/admin/clusters?page_size=50',
    );
    const clusters = (
      (await clustersResponse.json()) as {
        items: Array<{
          id: string;
          slug: string;
          headline: string;
          version: number;
        }>;
      }
    ).items;
    const cluster = clusters.find(
      (item) => item.slug === 'delhi-air-quality-response',
    );
    expect(cluster).toBeTruthy();
    const changed = await editor.api.patch(
      `/v1/admin/clusters/${cluster!.id}/headline`,
      {
        headers: csrfHeaders(editor.csrf),
        data: {
          expectedVersion: cluster!.version,
          headline: `${cluster!.headline} — reviewed fixture update`,
          headlineHi: 'दिल्ली वायु गुणवत्ता प्रतिक्रिया — समीक्षा परीक्षण अपडेट',
        },
      },
    );
    expect(changed.ok(), await changed.text()).toBeTruthy();
    await editor.api.dispose();

    const reviewer = await authenticatedApi('e2e-reviewer');
    const queueResponse = await reviewer.api.get(
      '/v1/admin/review-queue?page_size=50',
    );
    const queue = (
      (await queueResponse.json()) as {
        items: Array<{
          id: string;
          clusterId: string;
          draftedById: string;
          version: number;
        }>;
      }
    ).items;
    const review = queue.find((item) => item.clusterId === cluster!.id);
    expect(review?.draftedById).toBeTruthy();
    const approved = await reviewer.api.post(
      `/v1/admin/reviews/${review!.id}/decision`,
      {
        headers: csrfHeaders(reviewer.csrf),
        data: {
          expectedVersion: review!.version,
          decision: 'APPROVED',
          notes: 'Independent Playwright evidence and wording review.',
        },
      },
    );
    expect(approved.ok(), await approved.text()).toBeTruthy();
    const approval = (await approved.json()) as {
      version: number;
      data: { decision: string };
    };
    expect(approval.data.decision).toBe('APPROVED');
    const deniedPush = await reviewer.api.post(
      `/v1/admin/reviews/${review!.id}/push-approval`,
      {
        headers: csrfHeaders(reviewer.csrf),
        data: { expectedVersion: approval.version },
      },
    );
    expect(deniedPush.status()).toBe(409);
    await reviewer.api.dispose();

    const administrator = await authenticatedApi('e2e-admin');
    const pushReady = await administrator.api.post(
      `/v1/admin/reviews/${review!.id}/push-approval`,
      {
        headers: csrfHeaders(administrator.csrf),
        data: { expectedVersion: approval.version },
      },
    );
    expect(pushReady.ok(), await pushReady.text()).toBeTruthy();
    expect((await pushReady.json()).data.pushApprovedAt).toBeTruthy();
    await administrator.api.dispose();
  });

  test('cluster merge, split and stale version conflict are enforced', async () => {
    const { api, csrf } = await authenticatedApi('e2e-admin');
    const load = async () =>
      (
        (await (await api.get('/v1/admin/clusters?page_size=50')).json()) as {
          items: Array<{
            id: string;
            slug: string;
            headline: string;
            version: number;
            articleIds: string[];
          }>;
        }
      ).items;
    let clusters = await load();
    const conflictTarget = clusters.find(
      (item) => item.slug === 'open-language-model-india-labs',
    )!;
    const first = await api.patch(
      `/v1/admin/clusters/${conflictTarget.id}/headline`,
      {
        headers: csrfHeaders(csrf),
        data: {
          expectedVersion: conflictTarget.version,
          headline: 'India labs publish fictional open-language model update',
          headlineHi:
            'भारत की प्रयोगशालाओं ने काल्पनिक ओपन-लैंग्वेज मॉडल अपडेट जारी किया',
        },
      },
    );
    expect(first.ok()).toBeTruthy();
    const stale = await api.patch(
      `/v1/admin/clusters/${conflictTarget.id}/headline`,
      {
        headers: csrfHeaders(csrf),
        data: {
          expectedVersion: conflictTarget.version,
          headline: 'Stale competing edit must fail clearly',
          headlineHi: 'पुराना प्रतिस्पर्धी संपादन स्पष्ट रूप से विफल होना चाहिए',
        },
      },
    );
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.code).toBe('version_conflict');

    clusters = await load();
    const target = clusters.find(
      (item) => item.slug === 'solar-manufacturing-credit',
    )!;
    const source = clusters.find(
      (item) => item.slug === 'upi-small-value-protection',
    )!;
    const merged = await api.post('/v1/admin/clusters/merge', {
      headers: csrfHeaders(csrf),
      data: {
        targetId: target.id,
        sourceIds: [source.id],
        versions: { [target.id]: target.version, [source.id]: source.version },
      },
    });
    expect(merged.ok(), await merged.text()).toBeTruthy();

    clusters = await load();
    const splitTarget = clusters.find(
      (item) => item.slug === 'national-clean-mobility-framework',
    )!;
    const midpoint = Math.ceil(splitTarget.articleIds.length / 2);
    const split = await api.post(`/v1/admin/clusters/${splitTarget.id}/split`, {
      headers: csrfHeaders(csrf),
      data: {
        expectedVersion: splitTarget.version,
        groups: [
          {
            slug: 'national-clean-mobility-framework-e2e-one',
            headline: `${splitTarget.headline} — first fixture event`,
            headlineHi: 'स्वच्छ परिवहन ढांचा — पहला परीक्षण आयोजन',
            articleIds: splitTarget.articleIds.slice(0, midpoint),
          },
          {
            slug: 'national-clean-mobility-framework-e2e-two',
            headline: `${splitTarget.headline} — second fixture event`,
            headlineHi: 'स्वच्छ परिवहन ढांचा — दूसरा परीक्षण आयोजन',
            articleIds: splitTarget.articleIds.slice(midpoint),
          },
        ],
      },
    });
    expect(split.ok(), await split.text()).toBeTruthy();
    expect((await split.json()).length).toBe(2);
    await api.dispose();
  });

  test('correction propagation is visible on the reader page', async ({
    page,
  }) => {
    const { api, csrf } = await authenticatedApi('e2e-editor');
    const clusters = (
      (await (await api.get('/v1/admin/clusters?page_size=50')).json()) as {
        items: Array<{ id: string; slug: string; version: number }>;
      }
    ).items;
    const cluster = clusters.find(
      (item) => item.slug === 'open-language-model-india-labs',
    )!;
    const opened = await api.post('/v1/admin/corrections', {
      headers: csrfHeaders(csrf),
      data: {
        clusterId: cluster.id,
        description:
          'Playwright correction updates the neutral headline wording.',
        sourceUrl: 'https://official.example/playwright-correction',
        evidence: 'Fictional official correction fixture.',
      },
    });
    const correction = (await opened.json()) as { id: string; version: number };
    const applied = await api.post(
      `/v1/admin/corrections/${correction.id}/apply`,
      {
        headers: csrfHeaders(csrf),
        data: {
          expectedVersion: correction.version,
          clusterExpectedVersion: cluster.version,
          resolution:
            'Preserved the former version and published the corrected wording.',
          headline: 'Corrected fictional open-language model release details',
          headlineHi: 'काल्पनिक ओपन-लैंग्वेज मॉडल रिलीज़ विवरण में सुधार',
        },
      },
    );
    expect(applied.ok(), await applied.text()).toBeTruthy();
    expect((await api.get(`/v1/clusters/${cluster.slug}`)).status()).toBe(404);
    await regenerateFixtureSummary(api, csrf, cluster.id);
    await api.dispose();
    await page.goto('/story/open-language-model-india-labs?lang=en');
    await expect(
      page.getByRole('heading', {
        name: 'Corrected fictional open-language model release details',
      }),
    ).toBeVisible();
    await expect(page.getByText('Playwright correction updates')).toBeVisible();
  });

  test('approved fixture feed supports a no-fetch dry run', async () => {
    const { api, csrf } = await authenticatedApi('e2e-publisher-manager');
    const publishers = (
      (await (await api.get('/v1/admin/publishers?page_size=50')).json()) as {
        items: Array<{ feeds: Array<{ id: string; state: string }> }>;
      }
    ).items;
    const feed = publishers
      .flatMap((item) => item.feeds)
      .find((item) => item.state === 'APPROVED')!;
    const dryRun = await api.post(`/v1/admin/feeds/${feed.id}/dry-run`, {
      headers: csrfHeaders(csrf),
    });
    expect(dryRun.ok(), await dryRun.text()).toBeTruthy();
    expect(await dryRun.json()).toMatchObject({
      valid: true,
      issues: [],
      willFetch: false,
    });
    await api.dispose();
  });
});

function apiBaseUrl(): string {
  return 'http://127.0.0.1:8001';
}
