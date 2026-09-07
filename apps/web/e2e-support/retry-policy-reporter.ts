import type { FullConfig, Reporter } from '@playwright/test/reporter';

type RetryProject = Pick<FullConfig['projects'][number], 'name' | 'retries'>;

export function assertReleaseRetriesDisabled(
  projects: readonly RetryProject[],
): void {
  const retryingProjects = projects.filter((project) => project.retries !== 0);
  if (retryingProjects.length > 0) {
    const summary = retryingProjects
      .map((project) => `${project.name}=${project.retries}`)
      .join(', ');
    throw new Error(
      `Release E2E validation requires effective retries=0; received ${summary}.`,
    );
  }
}

export default class ReleaseRetryPolicyReporter implements Reporter {
  onBegin(config: FullConfig): void {
    if (process.env.NUZENIO_REQUIRE_ZERO_E2E_RETRIES !== 'true') {
      return;
    }
    assertReleaseRetriesDisabled(config.projects);
    process.stdout.write(
      `Nuzenio release E2E retry policy: effective retries=0 for ${config.projects.length} projects.\n`,
    );
  }
}
