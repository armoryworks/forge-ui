import { defineConfig } from '@playwright/test';

// Screenshot / doc-generation / visual-audit specs. These exist to PRODUCE
// artifacts (docs, screenshots, audits), not to assert behavior, and they are
// RAM-hungry (fullPage captures of complex screens, navigating every page) —
// so on the small ubuntu-latest runner they consistently exceed memory and
// flake, while passing on a well-resourced box. They run as a separate,
// NON-GATING 'docgen' project (see nightly.yml) so they can't redden the gate.
// The 'functional' project (real behavior assertions) is the green gate.
const DOCGEN_ARTIFACTS = [
  '**/generate-ui-*.spec.ts',      // generate-ui-docs, generate-ui-landmarks
  '**/*-audit.spec.ts',            // button/dialog/chat/ux/training-uat audits
  '**/*screenshot*.spec.ts',       // *-screenshots, screenshot-*, dashboard-screenshot
  '**/*-verify.spec.ts',           // visual *-verify specs
  '**/demo-tour.spec.ts',
  '**/debug-w4-fill.spec.ts',
  '**/state-forms-test.spec.ts',
  '**/line-widths.spec.ts',
  '**/responsive-dashboard.spec.ts',
  '**/admin-onboarding.spec.ts',
];

// Shared Chromium launch settings for both projects.
const chromiumUse = {
  browserName: 'chromium' as const,
  // PLAYWRIGHT_CHANNEL=chrome drives the system Google Chrome instead of the
  // bundled chromium — needed on hosts where Playwright ships no chromium build
  // (e.g. Ubuntu 26.04 + Playwright 1.58). Unset (the default) keeps the
  // bundled browser for CI/containers.
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  // --use-fake-device-for-media-stream: getUserMedia returns a synthetic
  //   video track instead of failing in headless (no real camera).
  // --use-fake-ui-for-media-stream: skips the permission prompt; combined
  //   with context.grantPermissions(['camera']) the sample-screenshot
  //   spec gets a populated camera viewfinder for the mobile scan frame.
  // --hide-scrollbars: keeps stray scrollbars out of clipped capture frames.
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--hide-scrollbars',
    ],
  },
};

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  // Whole-run ceiling, set below the nightly job's timeout-minutes (120) so the
  // suite stops itself gracefully — with a clear "globalTimeout exceeded"
  // report — instead of being SIGTERM'd by the runner mid-test (which marks
  // every in-flight test failed at the same instant and reads as a mass
  // failure). 100 min leaves ~20 min for teardown + artifact upload.
  globalTimeout: 100 * 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    // The green gate: behavior-asserting tests.
    { name: 'functional', use: chromiumUse, testIgnore: DOCGEN_ARTIFACTS },
    // Non-gating artifact generators (run on their own job in nightly.yml).
    { name: 'docgen', use: chromiumUse, testMatch: DOCGEN_ARTIFACTS },
  ],
});
