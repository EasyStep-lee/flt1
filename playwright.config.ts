import { defineConfig, devices } from '@playwright/test';

const reportRoot = 'artifacts/test-results/playwright';
const portalOrigin = 'http://127.0.0.1:4319';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/p0/**',
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
    baseURL: portalOrigin,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command:
      'pnpm --filter @fulishe/portal-web exec next start --hostname 127.0.0.1 --port 4319',
    url: portalOrigin,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
