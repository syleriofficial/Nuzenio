import { defineConfig, devices } from '@playwright/test';

// Non-mutating reader acceptance against an explicitly supplied local preview.
const address = process.env.NUZENIO_READER_TEST_URL;
if (!address) throw new Error('NUZENIO_READER_TEST_URL is required.');
const url = new URL(address);
if (
  url.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost', 'host.docker.internal'].includes(url.hostname) ||
  url.username ||
  url.password
) {
  throw new Error('Reader acceptance must target a local HTTP preview.');
}
export default defineConfig({
  testDir: './e2e',
  testMatch: /reader-mvp\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['./e2e-support/retry-policy-reporter.ts']],
  outputDir:
    process.env.NUZENIO_READER_TEST_OUTPUT ?? './test-results/reader-mvp',
  use: {
    baseURL: url.origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
});
