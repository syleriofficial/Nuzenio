import { createServer, request as proxyRequest, type Server } from 'node:http';
import { test, expect, type Page } from '@playwright/test';

let proxy: Server;
const origin = 'http://127.0.0.1:3101';

test.beforeAll(async () => {
  proxy = createServer((req, res) => {
    const upstream = proxyRequest(
      {
        hostname: '127.0.0.1',
        port: req.url?.startsWith('/v1/') ? 8001 : 3100,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.on('error', () => res.destroy());
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) =>
    proxy.listen(3101, '127.0.0.1', resolve),
  );
});
test.afterAll(async () => {
  proxy.closeAllConnections();
  await new Promise<void>((resolve) => proxy.close(() => resolve()));
});

async function controlled(page: Page) {
  await page.goto(origin + '/admin');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => resolve(),
          { once: true },
        ),
      );
  });
}

async function signIn(page: Page, username: string) {
  return page.evaluate(async (name) => {
    const response = await fetch('/v1/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: name,
        password: 'Local-E2E-Staff-Password-42!',
      }),
    });
    if (!response.ok)
      throw new Error('Fixture login failed: ' + response.status);
    return (await response.json()).csrfToken as string;
  }, username);
}

test('private data cannot replay offline after logout or account switching', async ({
  page,
  context,
}) => {
  await controlled(page);
  for (const name of ['e2e-admin', 'e2e-analyst']) {
    const csrf = await signIn(page, name);
    const status = await page.evaluate(async () => {
      const r = await fetch('/v1/admin/clusters', { cache: 'no-store' });
      await r.text();
      return r.status;
    });
    expect(status).toBe(200);
    expect(
      await page.evaluate(
        async (token) =>
          (
            await fetch('/v1/admin/auth/logout', {
              method: 'POST',
              headers: { 'X-CSRF-Token': token },
            })
          ).status,
        csrf,
      ),
    ).toBe(204);
    // Wait for pending cache.put in the vulnerable worker, not for a network service.
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );
    await context.setOffline(true);
    const replay = await page.evaluate(async () => {
      try {
        const r = await fetch('/v1/admin/clusters', { cache: 'no-store' });
        return { status: r.status, body: await r.text() };
      } catch {
        return { status: 0, body: '' };
      }
    });
    expect(replay.body).not.toContain('evidenceIds');
    expect(replay.status === 0 || replay.status >= 400).toBe(true);
    await context.setOffline(false);
  }
});

test('private endpoint responses always forbid storage', async ({ page }) => {
  await controlled(page);
  await signIn(page, 'e2e-admin');
  for (const path of [
    '/v1/admin/auth/session',
    '/v1/admin/clusters',
    '/v1/admin/not-a-route',
  ]) {
    const cache = await page.evaluate(
      async (url) => (await fetch(url)).headers.get('cache-control'),
      path,
    );
    expect(cache).toContain('no-store');
    expect(cache).toContain('private');
  }
});

test('logout clears other tabs and switching to analyst never restores administrator state', async ({
  page,
  context,
}) => {
  await controlled(page);
  async function loginUi(name: string) {
    await page.getByLabel('Username', { exact: true }).fill(name);
    await page
      .getByLabel('Password', { exact: true })
      .fill('Local-E2E-Staff-Password-42!');
    await page.getByRole('button', { name: 'Sign in securely' }).click();
    await expect(
      page.getByRole('heading', { name: 'Editorial control room' }),
    ).toBeVisible();
  }
  await loginUi('e2e-admin');
  // The private read itself passes through the same-origin proxy and active worker.
  expect(
    await page.evaluate(async () => (await fetch('/v1/admin/staff')).status),
  ).toBe(200);
  const other = await context.newPage();
  await other.goto(origin + '/admin');
  await expect(
    other.getByRole('heading', { name: 'Editorial control room' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(other.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(
    other.getByRole('heading', { name: 'Editorial control room' }),
  ).toHaveCount(0);
  await loginUi('e2e-analyst');
  await expect(
    page.getByRole('button', { name: 'Staff & roles', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(async () => (await fetch('/v1/admin/staff')).status),
  ).toBe(403);
  await page.getByRole('button', { name: 'Log out' }).click();
  await context.setOffline(true);
  const replay = await page.evaluate(async () => {
    try {
      return await (await fetch('/v1/admin/staff')).text();
    } catch {
      return '';
    }
  });
  expect(replay).not.toContain('e2e-admin');
  expect(replay).not.toContain('permissions');
  await context.setOffline(false);
  await other.close();
});

test('worker upgrade purges only legacy Nuzenio caches and preserves static offline assets', async ({
  page,
  context,
}) => {
  await controlled(page);
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations())
      await registration.unregister();
    await (
      await caches.open('nuzenio-shell-v1')
    ).put('/v1/admin/clusters', new Response('PRIVATE-LEGACY-CANARY'));
    await (
      await caches.open('other-application-assets')
    ).put('/other-asset', new Response('UNRELATED'));
    const registration = await navigator.serviceWorker.register(
      '/service-worker.js?security-upgrade=1',
      { scope: '/', updateViaCache: 'none' },
    );
    const worker =
      registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) throw new Error('Replacement worker missing');
    if (worker.state !== 'activated')
      await new Promise<void>((resolve, reject) => {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') resolve();
          if (worker.state === 'redundant')
            reject(new Error('Replacement worker failed'));
        });
      });
  });
  const state = await page.evaluate(async () => ({
    keys: await caches.keys(),
    legacy: Boolean(await caches.match('/v1/admin/clusters')),
  }));
  expect(state.keys).toContain('other-application-assets');
  expect(state.keys).not.toContain('nuzenio-shell-v1');
  expect(state.legacy).toBe(false);
  await page.evaluate(async () => {
    await (await fetch('/icon-192.png')).arrayBuffer();
  });
  await context.setOffline(true);
  expect(
    await page.evaluate(async () => (await fetch('/icon-192.png')).status),
  ).toBe(200);
  const leak = await page.evaluate(async () => {
    try {
      return await (await fetch('/v1/admin/clusters')).text();
    } catch {
      return '';
    }
  });
  expect(leak).not.toContain('PRIVATE-LEGACY-CANARY');
});
