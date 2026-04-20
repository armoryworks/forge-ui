import { test, expect } from '@playwright/test';

// Exercises the three trigger paths on the login form's submit button:
//   1. Field change → auto-show (keyboard users who never focus the disabled
//      button because disabled buttons can't receive focus per HTML spec).
//   2. Mouse over the disabled submit button → show.
//   3. Mouse leave → delayed hide (2s), not immediate.

test.describe('ValidationPopoverDirective triggers', () => {
  test('auto-shows on field change, re-shows on hover, hides after delay', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('[data-testid="login-email"] input');
    const submitBtn = page.locator('[data-testid="login-submit"]');
    const popover = page.locator('app-validation-popover-content');

    await emailInput.waitFor({ state: 'visible', timeout: 10_000 });

    // On initial render the form is invalid but the popover must NOT be
    // showing — it should only show in response to an interaction.
    await expect(popover).toHaveCount(0);

    // ── 1. Field change → auto-show ───────────────────────────────────
    // Enter then clear an email to force the required→error transition.
    await emailInput.focus();
    await emailInput.fill('not-an-email');
    await emailInput.blur();

    await expect(popover).toBeVisible({ timeout: 3_000 });
    await expect(popover).toHaveClass(/is-visible/);

    // ── 2. Auto-hide kicks in after ~4s ───────────────────────────────
    // Move focus well away so no hover/focus is keeping it open.
    await page.mouse.move(0, 0);
    await expect(popover).toBeHidden({ timeout: 6_000 });

    // ── 3. Mouse over the still-disabled submit button → re-show ──────
    // Playwright's .hover() retry loop detects the parent <form> as intercepting
    // pointer events (disabled buttons can't receive them per HTML spec), so
    // dispatch the mouseenter directly — the directive binds to this event via
    // Renderer2 and doesn't care how it's delivered.
    await submitBtn.dispatchEvent('mouseenter');
    await expect(popover).toBeVisible({ timeout: 2_000 });

    // ── 4. Mouse leave → delayed hide (still visible at 500ms) ────────
    await submitBtn.dispatchEvent('mouseleave');
    await page.waitForTimeout(500);
    await expect(popover).toBeVisible();

    // Eventually gone after the 2s hide delay + 300ms fade.
    await expect(popover).toBeHidden({ timeout: 4_000 });
  });
});
