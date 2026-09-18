import { defineConfig, devices } from '@playwright/test';

// No backend, database setup/reset, real publishers or existing previews.
// Dev UI and production-denial are separate sequential runs (same unused port).
const production = process.env.NUZENIO_SOURCE_CARD_TEST_PRODUCTION === 'true';
const port = process.env.NUZENIO_SOURCE_CARD_TEST_PORT ?? '3198';
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e-source-cards',
  testMatch: production ? /production\.spec\.ts/ : /preview\.spec\.ts/,
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: [['list'], ['./e2e-support/retry-policy-reporter.ts']],
  use: { baseURL: origin, serviceWorkers: 'block', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: production
      ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
      : `npm run dev -- --webpack --hostname 127.0.0.1 --port ${port}`,
    url: `${origin}/icon-192.png`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      NUZENIO_ENVIRONMENT: 'development',
      NUZENIO_FREE_SOURCE_PREVIEW: 'true',
      NUZENIO_DEMO_MODE: 'true',
      NUZENIO_FEED_KILL_SWITCH: 'true',
      NUZENIO_ENABLE_DEMO_FALLBACK: 'false',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
