import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// Separate database/server run: old editorial tests intentionally exercise the
// fixture feed runner, while this offline inbox requires the network kill switch.
const servers = Array.isArray(base.webServer) ? base.webServer : [];
export default defineConfig({
  ...base,
  testDir: './e2e-draft',
  retries: 0,
  reporter: [['list'], ['./e2e-support/retry-policy-reporter.ts']],
  projects: [
    {
      name: 'draft-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'draft-mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: servers.map((server) =>
    server.cwd === '../api'
      ? {
          ...server,
          env: {
            ...server.env,
            NUZENIO_DRAFT_INBOX_ENABLED: 'true',
            NUZENIO_FEED_KILL_SWITCH: 'true',
          },
        }
      : server,
  ),
});
