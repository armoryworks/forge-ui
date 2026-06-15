import { test, expect, request } from '@playwright/test';

import { getAuthToken, loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const API_BASE = 'http://localhost:5000/api/v1/';

/**
 * Whether an installation capability is enabled (the descriptor endpoint is not
 * itself gated). Company Announcements (CAP-EXT-ANNOUNCEMENTS) ships OFF by
 * default; where it's disabled the SPA short-circuits the announcement create
 * POST client-side, so the create dialog never closes and there is nothing for
 * the subscriber to receive. We can't safely flip a global, installation-wide
 * capability from within a sharded suite, so this test runs wherever the feature
 * is enabled and skips (with a clear reason) where it isn't.
 */
async function isCapabilityEnabled(code: string): Promise<boolean> {
  const token = await getAuthToken('admin@forge.local', SEED_PASSWORD);
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  const res = await ctx.get('capabilities/descriptor');
  const body = await res.json();
  await ctx.dispose();
  return (body.capabilities ?? []).some(
    (c: { code: string; enabled: boolean }) => c.code === code && c.enabled,
  );
}

test.describe('SignalR Announcement Pub-Sub', () => {
  test('announcement created in one browser appears in the subscriber via SignalR (no reload)', async ({ browser }) => {
    test.skip(!(await isCapabilityEnabled('CAP-EXT-ANNOUNCEMENTS')),
      'CAP-EXT-ANNOUNCEMENTS disabled in this installation — announcement create is gated off.');

    // ── 1. Two independent browser contexts ───────────────────────────
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ── 2. Log both in as admin (admin can see the announcements admin panel) ──
      await loginViaApi(pageA, 'admin@forge.local', SEED_PASSWORD);
      await loginViaApi(pageB, 'admin@forge.local', SEED_PASSWORD);

      // ── 3. Subscriber (A) loads first — navigate to the admin panel and wait
      //      for both the initial list and the ChatHub SignalR connection to
      //      establish so the push can't arrive before we're listening. ────
      await pageA.goto('/admin/announcements');
      await pageA.locator('[data-testid="new-announcement-btn"]').waitFor({ state: 'visible', timeout: 15_000 });
      // Give the ChatHub time to negotiate/connect after the initial load.
      await pageA.waitForTimeout(2_000);

      // Capture A's URL so we can prove it never navigated/reloaded during the test.
      const urlABefore = pageA.url();

      // ── 4. Sentinel: install a window-scoped counter that increments on every
      //      full page load. If A reloads, this resets to 1. We add a single
      //      increment now so we can detect a reset. ──────────────────────
      await pageA.evaluate(() => {
        (window as unknown as { __pageLoads: number }).__pageLoads = 1;
      });

      const uniqueTitle = `Pub-Sub Test ${Date.now()}`;
      const uniqueContent = 'Published via UI by a second browser — the first browser must receive this via SignalR without reloading.';

      // Confirm subscriber's table does NOT already show this title.
      await expect(pageA.locator(`td:has-text("${uniqueTitle}")`)).toHaveCount(0);

      // ── 5. Publisher (B) creates the announcement via UI only ─────────
      await pageB.goto('/admin/announcements');
      await pageB.locator('[data-testid="new-announcement-btn"]').waitFor({ state: 'visible', timeout: 15_000 });
      await pageB.locator('[data-testid="new-announcement-btn"]').click();

      // Fill the create-announcement dialog (defaults: severity=Info, scope=CompanyWide).
      await pageB.locator('[data-testid="announcement-title"] input').fill(uniqueTitle);
      await pageB.locator('[data-testid="announcement-content"] textarea').fill(uniqueContent);
      await pageB.locator('[data-testid="announcement-send-btn"]').click();

      // Wait for the MatDialog to close (success closes it automatically).
      await pageB.locator('.cdk-overlay-backdrop').first().waitFor({ state: 'hidden', timeout: 10_000 });

      // ── 6. Subscriber (A) must see the new announcement via SignalR pub-sub ──
      //      No reload, no re-fetch — the push handler prepends the payload
      //      directly to the admin panel's list signal.
      await expect(pageA.locator(`td:has-text("${uniqueTitle}")`)).toBeVisible({ timeout: 10_000 });

      // ── 7. Prove A never reloaded or navigated away ───────────────────
      expect(pageA.url()).toBe(urlABefore);
      const pageLoadsAfter = await pageA.evaluate(() =>
        (window as unknown as { __pageLoads: number }).__pageLoads);
      expect(pageLoadsAfter).toBe(1);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
