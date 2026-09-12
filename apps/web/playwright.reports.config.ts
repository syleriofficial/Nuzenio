import { defineConfig } from '@playwright/test';
import readerConfig from './playwright.reader.config';

// Explicit local test stack only: reports/staff fixtures are mutated, never
// publication content. Do not point this suite at the founder's shared preview.
export default defineConfig(readerConfig, {
  testMatch: /reader-reports\.spec\.ts/,
});
