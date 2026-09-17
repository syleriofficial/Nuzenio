import { defineConfig, devices } from '@playwright/test';

// Production-browser UI regressions use intercepted admin HTTP responses only.
// No API server, database reset, or access to the founder preview is needed.
const port = process.env.NUZENIO_ADMIN_FORM_TEST_PORT ?? '3197';
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: /admin-create-forms\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['./e2e-support/retry-policy-reporter.ts']],
  use: {
    baseURL: origin,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `${origin}/admin`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_ADMIN_API_BASE_URL: origin,
      NUZENIO_ENABLE_DEMO_FALLBACK: 'false',
    },
  },
});
