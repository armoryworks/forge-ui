import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
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
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        // --use-fake-device-for-media-stream: getUserMedia returns a synthetic
        //   video track instead of failing in headless (no real camera).
        // --use-fake-ui-for-media-stream: skips the permission prompt; combined
        //   with context.grantPermissions(['camera']) the sample-screenshot
        //   spec gets a populated camera viewfinder for the mobile scan frame.
        // Harmless for other tests — they don't touch getUserMedia.
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            // Suppress scrollbars from showing up in tight-cropped capture
            // frames. The app rarely has scroll on desktop sizes used for
            // captures, but a stray scrollbar in the corner of a clipped
            // dialog frame reads as visual noise on a downstream surface.
            '--hide-scrollbars',
          ],
        },
      },
    },
  ],
});
