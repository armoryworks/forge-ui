import { test, expect } from '@playwright/test';

// The login submit is wrapped in <app-validation-button>. Its UX was redesigned
// away from the old auto-show-on-field-change ValidationPopoverDirective (now
// deleted) to a click-to-toggle affordance:
//   • a warning trigger (count badge) is shown whenever the form has violations;
//   • the popover listing those violations only opens when the trigger is clicked;
//   • resolving the violations hides the trigger.

test.describe('Validation button (login submit)', () => {
  test('warning trigger shows when invalid, click toggles the popover, clears when valid', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('[data-testid="login-email"] input');
    const passwordInput = page.locator('[data-testid="login-password"] input');
    const trigger = page.locator('.validation-button__trigger');
    // The popover overlay (role=alertdialog) only attaches while open.
    const popover = page.locator('[role="alertdialog"]');

    await emailInput.waitFor({ state: 'visible', timeout: 10_000 });

    // Invalid on load (email + password required) → the warning trigger is
    // shown, but the popover stays CLOSED until the user opens it (no
    // unsolicited auto-show).
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(popover).toHaveCount(0);

    // ── Click the trigger → popover opens and lists the violations. ──────
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(popover).toBeVisible({ timeout: 2_000 });
    await expect(popover.locator('li')).not.toHaveCount(0);

    // ── Click again → popover closes. ───────────────────────────────────
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(popover).toHaveCount(0);

    // ── Resolving every violation hides the trigger entirely. ────────────
    await emailInput.fill('admin@forge.local');
    await passwordInput.fill('any-password');
    await expect(trigger).toBeHidden();
  });
});
