import { defineConfig, devices } from '@playwright/test';

const databaseUrl =
  process.env.NUZENIO_E2E_DATABASE_URL ??
  'postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio_e2e';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      testMatch: /accessibility\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command:
        '.venv/bin/uvicorn nuzenio_api.main:app --host 127.0.0.1 --port 8001',
      cwd: '../api',
      url: 'http://127.0.0.1:8001/health',
      reuseExistingServer: false,
      env: {
        NUZENIO_ENVIRONMENT: 'test',
        NUZENIO_DATABASE_URL: databaseUrl,
        NUZENIO_REDIS_URL:
          process.env.NUZENIO_E2E_REDIS_URL ?? 'redis://localhost:6379/2',
        NUZENIO_CORS_ORIGINS:
          '["http://127.0.0.1:3100","http://127.0.0.1:3101"]',
        NUZENIO_COOKIE_SECURE: 'false',
        NUZENIO_SESSION_HASH_PEPPER: 'e2e-only-session-pepper',
        NUZENIO_DEMO_MODE: 'true',
        NUZENIO_LOGIN_KEY_PREFIX: `nuzenio:e2e:auth:${Date.now()}`,
        NUZENIO_LOGIN_ATTEMPT_LIMIT: '100',
        NUZENIO_LOGIN_IP_LIMIT: '500',
        NUZENIO_LOGIN_GLOBAL_LIMIT: '1000',
      },
    },
    {
      command:
        'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
      cwd: '.',
      url: 'http://127.0.0.1:3100',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NUZENIO_API_BASE_URL: 'http://127.0.0.1:8001',
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8001',
        NEXT_PUBLIC_ADMIN_API_BASE_URL: 'http://127.0.0.1:8001',
        NUZENIO_ENABLE_DEMO_FALLBACK: 'false',
      },
    },
  ],
});
