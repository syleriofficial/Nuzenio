import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import ReleaseRetryPolicyReporter, {
  assertReleaseRetriesDisabled,
} from '../e2e-support/retry-policy-reporter';
import releaseConfig from '../playwright.release.config';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

describe('release Playwright retry policy', () => {
  it('finishes both read-only viewports before shared editorial fixture mutations', () => {
    const projects = releaseConfig.projects ?? [];
    const editorial = projects.find((project) => project.name === 'chromium');
    const reader = projects.find(
      (project) => project.name === 'reader-chromium',
    );
    const mobile = projects.find(
      (project) => project.name === 'mobile-chromium',
    );
    expect(editorial?.dependencies).toEqual([
      'reader-chromium',
      'mobile-chromium',
    ]);
    expect(reader?.testMatch).toEqual(/reader-mvp\.spec\.ts/);
    expect(editorial?.testIgnore).toEqual(/reader-mvp\.spec\.ts/);
    expect(mobile?.testMatch).toEqual(
      /(?:accessibility|founder-acceptance|reader-mvp)\.spec\.ts/,
    );
    expect(reader?.dependencies ?? []).toEqual([]);
    expect(mobile?.dependencies ?? []).toEqual([]);
    expect(releaseConfig.retries).toBe(0);
  });

  it('still selects every release check exactly once at its intended viewport', () => {
    const result = spawnSync(
      npmCommand,
      ['--workspace', 'apps/web', 'run', 'test:e2e:release', '--', '--list'],
      { cwd: repositoryRoot, env: process.env, encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const listed = result.stdout
      .split('\n')
      .filter((line) => /^\s*\[[^\]]+\] › /.test(line));
    expect(listed).toHaveLength(42);
    expect(new Set(listed).size).toBe(42);
    expect(
      listed.filter((line) => line.includes('[reader-chromium]')),
    ).toHaveLength(8);
    expect(
      listed.filter((line) => line.includes('[mobile-chromium]')),
    ).toHaveLength(13);
    expect(listed.filter((line) => line.includes('[chromium]'))).toHaveLength(
      21,
    );
    expect(result.stdout).toContain('effective retries=0 for 3 projects');
  });

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
