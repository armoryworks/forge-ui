import { defineConfig } from '@playwright/test';

/**
 * Playwright config for interactive scenario runner.
 *
 * Scenarios form a tree — use --grep to select a path:
 *
 *   01-foundation (always first)
 *   ├── 02a-onboarding → 03a-kiosk
 *   ├── 02b-orders → 03b-fulfillment
 *   ├── 02c-production → 03c-quality OR 03d-expenses
 *   └── 02d-full-populate (non-interactive)
 *
 * npm scripts:
 *   npm run scenario:onboarding   # 01 → 02a → 03a (headed, interactive)
 *   npm run scenario:orders       # 01 → 02b → 03b (headed, interactive)
 *   npm run scenario:production   # 01 → 02c → 03c (headed, interactive)
 *   npm run scenario:expenses     # 01 → 02c → 03d (headed, interactive)
 *   npm run scenario:populate     # 01 → 02d (headless, non-interactive)
 */

export default defineConfig({
  testDir: '.',
  testMatch: /\d{2}[a-d]?-.*\.spec\.ts/,
  timeout: 300_000, // 5 min per test — interactive pauses can take time
  retries: 0,
  workers: 1, // Sequential — scenarios depend on each other
  reporter: [
    ['list'],
    ['html', { outputFolder: './scenario-report', open: 'never' }],
  ],

  fullyParallel: false,

  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'scenarios',
      use: { browserName: 'chromium' },
    },
  ],
});
