import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';

/**
 * Workflow Pattern Phase 6 — Type-aware fork routing for parts.
 *
 * Verifies the three flows defined by the Phase 6 charter:
 *   1. Raw Material + default (Express) → express form mounts on the
 *      raw-material workflow definition.
 *   2. Assembly + default (Step-by-step) → guided shell mounts with the
 *      assembly definition's full step rail (Phase 5 also tests this; this
 *      test re-verifies the type-aware fork still defaults assemblies to
 *      guided).
 *   3. Raw Material + override to Step-by-step → guided shell mounts with
 *      the raw-material definition (single-step rail) so the user can drive
 *      it via the rail UI even on a simple type.
 *
 * Auth seeded via API helper. Each flow uses `data-testid` selectors.
 */

test.describe('Workflow Pattern Phase 6 — Part raw-material express-only sibling', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
  });

  test('raw-material default: Q1 RawMaterial → Express recommended → continue → express form mounts', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    // Click New Part — fork dialog should open with both questions visible
    await page.locator('[data-testid="new-part-btn"]').click();
    await expect(page.locator('[data-testid="fork-question-type"]')).toBeVisible();
    await expect(page.locator('[data-testid="fork-question-mode"]')).toBeVisible();

    // Pick Q1 — Raw Material
    await page.locator('[data-testid="fork-type-RawMaterial"]').click();

    // Q2 — Express should be the recommended (selected) mode after the click.
    await expect(page.locator('[data-testid="fork-express"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="fork-guided"]')).toHaveAttribute('aria-pressed', 'false');

    // Continue
    await page.locator('[data-testid="fork-continue"]').click();

    // Workflow page mounts with the raw-material express definition.
    await page.waitForURL(/\/parts\/\d+\?.*workflow=part-raw-material-express-v1/, { timeout: 15000 });
    await expect(page.locator('[data-testid="part-workflow-shell"]')).toBeVisible({ timeout: 10000 });

    // Express mode → no rail, express content visible
    await expect(page.locator('[data-testid="workflow-express-content"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="part-express-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="workflow-rail"]')).not.toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/phase6-raw-material-express.png', fullPage: true });
  });

  test('assembly default: Q1 Assembly → Step-by-step recommended → continue → guided shell with full rail', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-type-Assembly"]').click();

    // Q2 — Guided (Step-by-step) should be the recommended mode for assembly.
    await expect(page.locator('[data-testid="fork-guided"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="fork-express"]')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('[data-testid="fork-continue"]').click();

    // Guided shell mounts with the assembly definition.
    await page.waitForURL(/\/parts\/\d+\?.*workflow=part-assembly-guided-v1/, { timeout: 15000 });
    await expect(page.locator('[data-testid="part-workflow-shell"]')).toBeVisible({ timeout: 10000 });

    // Guided mode → full rail with all 5 steps
    await expect(page.locator('[data-testid="workflow-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="workflow-step-basics"]')).toBeVisible();
    await expect(page.locator('[data-testid="workflow-step-bom"]')).toBeVisible();
    await expect(page.locator('[data-testid="workflow-step-routing"]')).toBeVisible();
    await expect(page.locator('[data-testid="workflow-step-costing"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/phase6-assembly-guided.png', fullPage: true });
  });

  test('raw-material override: Q1 RawMaterial → user picks Step-by-step → continue → guided shell with raw-material rail', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    await page.locator('[data-testid="new-part-btn"]').click();

    // Pick Q1 = Raw Material (Express recommended), then override Q2 to Guided.
    await page.locator('[data-testid="fork-type-RawMaterial"]').click();
    await expect(page.locator('[data-testid="fork-express"]')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('[data-testid="fork-guided"]').click();
    await expect(page.locator('[data-testid="fork-guided"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="fork-express"]')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('[data-testid="fork-continue"]').click();

    // Workflow page mounts with the raw-material definition (definition is
    // type-aware) but in guided mode (mode is the user's override).
    await page.waitForURL(/\/parts\/\d+\?.*workflow=part-raw-material-express-v1/, { timeout: 15000 });
    await expect(page.locator('[data-testid="part-workflow-shell"]')).toBeVisible({ timeout: 10000 });

    // Guided mode → rail visible (single-step rail since raw-material has 1 step)
    await expect(page.locator('[data-testid="workflow-rail"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/phase6-raw-material-override-guided.png', fullPage: true });
  });
});
