import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,        // 2 min per week scenario
  retries: 0,              // Never retry — failures are logged, not re-thrown
  workers: 1,              // Sequential — clock must be controlled single-threaded
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report/simulation', open: 'never' }],
    ['json', { outputFile: '../playwright-report/simulation/results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
    screenshot: 'on',
    trace: 'on',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'simulation',
      use: { browserName: 'chromium' },
    },
  ],
});
