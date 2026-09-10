import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import ReleaseRetryPolicyReporter, {
  assertReleaseRetriesDisabled,
} from '../e2e-support/retry-policy-reporter';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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
    expect(workflow).not.toContain('NUZENIO_REQUIRE_ZERO_E2E_RETRIES');
    expect(workflow).toContain('npm run test:e2e:setup');
    expect(workflow).toContain('npm --workspace apps/web run test:e2e:release');
    expect(workflow).not.toContain('npm run test:e2e -- --retries=0');
  });

  it.each([undefined, '', 'true', 'TRUE', 'false', 'malformed'])(
    'cannot disable the reporter with the legacy flag value %s',
    (flag) => {
      const previous = process.env.NUZENIO_REQUIRE_ZERO_E2E_RETRIES;
      if (flag === undefined) {
        delete process.env.NUZENIO_REQUIRE_ZERO_E2E_RETRIES;
      } else {
        process.env.NUZENIO_REQUIRE_ZERO_E2E_RETRIES = flag;
      }
      try {
        const reporter = new ReleaseRetryPolicyReporter();
        expect(() =>
          reporter.onBegin({
            projects: [
              { name: 'chromium', retries: 1 },
              { name: 'mobile-chromium', retries: 0 },
            ],
          } as never),
        ).toThrow(
          'Release E2E validation requires effective retries=0; received chromium=1.',
        );
      } finally {
        if (previous === undefined) {
          delete process.env.NUZENIO_REQUIRE_ZERO_E2E_RETRIES;
        } else {
          process.env.NUZENIO_REQUIRE_ZERO_E2E_RETRIES = previous;
        }
      }
    },
  );

  it.each([undefined, '', 'TRUE', 'false', 'malformed'])(
    'rejects a resolved retry through the release command with legacy flag %s',
    (flag) => {
      const environment = { ...process.env };
      if (flag === undefined) {
        delete environment.NUZENIO_REQUIRE_ZERO_E2E_RETRIES;
      } else {
        environment.NUZENIO_REQUIRE_ZERO_E2E_RETRIES = flag;
      }
      const result = spawnSync(
        npmCommand,
        [
          '--workspace',
          'apps/web',
          'run',
          'test:e2e:release',
          '--',
          '--list',
          '--retries=1',
        ],
        {
          cwd: repositoryRoot,
          env: environment,
          encoding: 'utf8',
        },
      );
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain(
        'Release E2E validation requires effective retries=0',
      );
    },
  );
});
