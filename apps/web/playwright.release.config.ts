import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

export default defineConfig(baseConfig, {
  retries: 0,
  reporter: [['list'], ['./e2e-support/retry-policy-reporter.ts']],
});
