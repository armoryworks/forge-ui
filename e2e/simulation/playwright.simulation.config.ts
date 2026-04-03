import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 360 * 60_000,   // 6 hours — full date range runs as one test
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
    screenshot: 'off',
    trace: 'off',
    video: 'off',
    actionTimeout: 8_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'simulation',
      use: { browserName: 'chromium' },
    },
  ],
});
