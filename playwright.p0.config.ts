import { defineConfig, devices } from '@playwright/test';

const reportRoot = 'artifacts/test-results/playwright-p0';

export default defineConfig({
  testDir: './tests/e2e/p0',
  outputDir: `${reportRoot}/raw`,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: `${reportRoot}/results.json` }],
    ['junit', { outputFile: `${reportRoot}/junit.xml` }],
    ['html', { outputFolder: `${reportRoot}/html`, open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4319',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'pnpm --filter @fulishe/portal-web exec next start --hostname 127.0.0.1 --port 4319',
      env: { PORTAL_API_BASE_URL: 'http://127.0.0.1:4324' },
      url: 'http://127.0.0.1:4319',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'node ./tests/fixtures/p0-enterprise-catalog-server.mjs',
      url: 'http://127.0.0.1:4324/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        'pnpm --filter @fulishe/supplier-portal exec vite preview --host 127.0.0.1 --port 4320 --strictPort',
      url: 'http://127.0.0.1:4320/supplier/',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        'pnpm --filter @fulishe/supplier-portal exec vite --host 127.0.0.1 --port 4323 --strictPort',
      env: { API_PORT: '4322' },
      url: 'http://127.0.0.1:4323/supplier/',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        'pnpm --filter @fulishe/company-admin exec vite preview --host 127.0.0.1 --port 4321 --strictPort',
      url: 'http://127.0.0.1:4321/company-admin/',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
