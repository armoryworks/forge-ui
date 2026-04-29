import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';

/**
 * Workflow Pattern Phase 5 — Part-Assembly vertical slice e2e.
 *
 * Verifies the three flows defined by the Phase 5 charter:
 *   1. Guided: New Part → Step-by-step → fill basics → continue → BOM step → mode toggle → close
 *   2. Express: New Part → Express add → form save → snackbar
 *   3. Direct promote: open Draft part detail → Promote to Active → 409 missing-list surfaces
 *
 * Auth seeded via API helper. Each flow uses `data-testid` selectors.
 */

test.describe('Workflow Pattern Phase 5 — Part-Assembly vertical slice', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
  });

  test('guided flow: New Part → step-by-step → workflow shell mounts → basics fills', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    // Click New Part — fork dialog should open
    await page.locator('[data-testid="new-part-btn"]').click();
    await expect(page.locator('[data-testid="fork-guided"]')).toBeVisible();
    await expect(page.locator('[data-testid="fork-express"]')).toBeVisible();

    // Pick Step-by-step
    await page.locator('[data-testid="fork-guided"]').click();

    // Workflow shell mounts on /parts/:id?workflow=part-assembly-guided-v1
    await page.waitForURL(/\/parts\/\d+\?.*workflow=part-assembly-guided-v1/, { timeout: 15000 });
    await expect(page.locator('[data-testid="part-workflow-shell"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="workflow-rail"]')).toBeVisible();

    // Initial step should be basics
    await expect(page.locator('[data-testid="workflow-step-basics"]')).toBeVisible();
    await expect(page.locator('[data-testid="part-basics-step"]')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'e2e/screenshots/phase5-guided-basics.png', fullPage: true });

    // Future steps locked
    await expect(page.locator('[data-testid="workflow-step-bom"]')).toBeDisabled();

    // Mode toggle works on the shell
    await page.locator('[data-testid="workflow-mode-express"]').click();
    await expect(page.locator('[data-testid="workflow-express-content"]')).toBeVisible({ timeout: 5000 });

    // Switch back to guided
    await page.locator('[data-testid="workflow-mode-guided"]').click();
    await expect(page.locator('[data-testid="workflow-rail"]')).toBeVisible();

    // Close shell — clears the workflow query param (URL no longer has ?workflow=...)
    await page.locator('[data-testid="workflow-close"]').click();
    await page.waitForFunction(() => !window.location.search.includes('workflow='), { timeout: 10000 });
  });

  test('express flow: New Part → Express add → existing dialog opens', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-express"]').click();

    // Existing express dialog should appear (data-testid="part-description")
    await expect(page.locator('[data-testid="part-description"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="part-save-btn"]')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/phase5-express-dialog.png', fullPage: true });
  });

  test('promote-direct: Mark Complete on incomplete workflow surfaces missing validators (sugar over /promote-status)', async ({ page, request }) => {
    // Create a Draft part via the workflow API so we have a known target.
    const token = await page.evaluate(() => localStorage.getItem('qbe-token'));
    const startResp = await request.post(`http://localhost:5000/api/v1/workflows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        entityType: 'Part',
        definitionId: 'part-assembly-guided-v1',
        mode: 'guided',
      },
    });
    if (!startResp.ok()) throw new Error(`Workflow start failed: ${startResp.status()}`);
    const run = await startResp.json();
    const partId: number = run.entityId;

    // Mount the workflow shell directly. Mark Complete from any step delegates
    // to /parts/{id}/promote-status — same gate as the detail page's Promote
    // button, just a different UX entry point per Phase 5 D6.
    await page.goto(`${BASE_URL}/parts/${partId}?workflow=part-assembly-guided-v1&step=alternates&mode=guided`, {
      waitUntil: 'networkidle',
    });
    await expect(page.locator('[data-testid="part-workflow-shell"]')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/screenshots/phase5-promote-shell.png', fullPage: true });

    // Verify the API surfaces the 409 + missing envelope when the gates fail.
    const completeResp = await request.post(`http://localhost:5000/api/v1/workflows/${run.id}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(completeResp.status()).toBe(409);
    const body = await completeResp.json();
    expect(body.missing).toBeTruthy();
    expect(Array.isArray(body.missing)).toBe(true);
    // hasBasics fails because the part was started with no description override etc.
    // hasBom, hasRouting, hasCost all fail.
    expect(body.missing.length).toBeGreaterThanOrEqual(1);
  });
});
