import { defineConfig, devices } from '@playwright/test';

const databaseUrl =
  process.env.NUZENIO_E2E_DATABASE_URL ??
  'postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio_e2e';
const apiPort = process.env.NUZENIO_E2E_API_PORT ?? '8001';
const webPort = process.env.NUZENIO_E2E_WEB_PORT ?? '3100';
const proxyPort = process.env.NUZENIO_E2E_PROXY_PORT ?? '3101';
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const proxyOrigin = `http://127.0.0.1:${proxyPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'reader-chromium',
      testMatch: /reader-mvp\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'chromium',
      // Reader assertions need the unchanged seed. The editorial suite below
      // deliberately splits those clusters and publishes corrected headlines.
      dependencies: ['reader-chromium', 'mobile-chromium'],
      testIgnore: /reader-mvp\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
      },
      testMatch: /(?:accessibility|founder-acceptance|reader-mvp)\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: `.venv/bin/uvicorn nuzenio_api.main:app --host 127.0.0.1 --port ${apiPort}`,
      cwd: '../api',
      url: `${apiOrigin}/health`,
      reuseExistingServer: false,
      env: {
        NUZENIO_ENVIRONMENT: 'test',
        NUZENIO_DATABASE_URL: databaseUrl,
        NUZENIO_REDIS_URL:
          process.env.NUZENIO_E2E_REDIS_URL ?? 'redis://localhost:6379/2',
        NUZENIO_CORS_ORIGINS: JSON.stringify([webOrigin, proxyOrigin]),
        NUZENIO_COOKIE_SECURE: 'false',
        NUZENIO_SESSION_HASH_PEPPER: 'e2e-only-session-pepper',
        NUZENIO_DEMO_MODE: 'true',
        NUZENIO_LOGIN_KEY_PREFIX: `nuzenio:e2e:auth:${Date.now()}`,
        NUZENIO_LOGIN_ATTEMPT_LIMIT: '100',
        NUZENIO_LOGIN_IP_LIMIT: '500',
        NUZENIO_LOGIN_GLOBAL_LIMIT: '1000',
      },
    },
    {
      command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${webPort}`,
      cwd: '.',
      url: webOrigin,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NUZENIO_API_BASE_URL: apiOrigin,
        NEXT_PUBLIC_API_BASE_URL: apiOrigin,
        NEXT_PUBLIC_ADMIN_API_BASE_URL: apiOrigin,
        NUZENIO_ENABLE_DEMO_FALLBACK: 'false',
      },
    },
  ],
});
