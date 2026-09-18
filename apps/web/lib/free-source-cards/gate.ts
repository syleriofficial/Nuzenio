export function sourceCardPreviewEnabled(
  env: Record<string, string | undefined>,
): boolean {
  // Runtime production builds always reject this route, even with all flags set.
  // This is a loopback-only developer showcase, not an authenticated inbox.
  return (
    env.NODE_ENV === 'development' &&
    (env.NUZENIO_ENVIRONMENT === 'development' ||
      env.NUZENIO_ENVIRONMENT === 'test') &&
    env.NUZENIO_FREE_SOURCE_PREVIEW === 'true' &&
    env.NUZENIO_DEMO_MODE === 'true' &&
    env.NUZENIO_FEED_KILL_SWITCH === 'true'
  );
}
