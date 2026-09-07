import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { assertReleaseRetriesDisabled } from '../e2e-support/retry-policy-reporter';

describe('release Playwright retry policy', () => {
  it('accepts only effective zero-retry projects', () => {
    expect(() =>
      assertReleaseRetriesDisabled([
        { name: 'chromium', retries: 0 },
        { name: 'mobile-chromium', retries: 0 },
      ]),
    ).not.toThrow();
  });

  it('rejects any effective project retry', () => {
    expect(() =>
      assertReleaseRetriesDisabled([
        { name: 'chromium', retries: 1 },
        { name: 'mobile-chromium', retries: 0 },
      ]),
    ).toThrow(
      'Release E2E validation requires effective retries=0; received chromium=1.',
    );
  });

  it('wires the CI release gate to the direct workspace command', () => {
    const workflow = readFileSync(
      new URL('../../../.github/workflows/ci.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain('NUZENIO_REQUIRE_ZERO_E2E_RETRIES: "true"');
    expect(workflow).toContain('npm run test:e2e:setup');
    expect(workflow).toContain(
      'npm --workspace apps/web run test:e2e -- --retries=0',
    );
    expect(workflow).not.toContain('npm run test:e2e -- --retries=0');
  });
});
