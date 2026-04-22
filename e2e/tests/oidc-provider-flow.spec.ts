/**
 * OIDC Provider — admin panel end-to-end UI flow.
 *
 * Exercises the admin-facing surface of the OIDC identity-provider feature:
 *   1. Mint a registration ticket via the dialog; verify reveal UI
 *   2. Close and confirm the ticket row appears in the Tickets tab
 *   3. Create a custom scope via the scope editor dialog
 *   4. Confirm the scope appears in the Scopes tab
 *   5. Confirm audit log shows TicketIssued + ScopeCreated events
 *
 * Does NOT exercise /connect/register — the provider surface defaults to
 * ProviderEnabled=false. Dynamic-registration flow is covered by the xUnit
 * handler tests and is E2E-testable only when the provider is explicitly
 * enabled in appsettings.
 */

import { test, expect, type Page } from '@playwright/test';
import { getAuthSession, seedAuth, SEED_PASSWORD } from '../helpers/auth.helper';

test.setTimeout(90_000);

const ADMIN_EMAIL = 'admin@qbengineer.local';

async function loginAsAdmin(page: Page): Promise<void> {
  const session = await getAuthSession(ADMIN_EMAIL, SEED_PASSWORD);
  await seedAuth(page, { token: session.token, user: session.user });
}

async function openInboundTab(page: Page): Promise<void> {
  await page.goto('http://localhost:4200/admin/integrations');
  // Integrations panel has sub-tabs: Outbound / Inbound. OIDC lives on Inbound.
  const inboundTab = page.getByRole('tab', { name: 'Inbound', exact: true });
  await inboundTab.waitFor({ state: 'visible', timeout: 30_000 });
  await inboundTab.click();
  await expect(page.locator('app-oidc-provider-panel')).toBeVisible({ timeout: 15_000 });
}

async function selectOidcSection(page: Page, sectionLabel: string): Promise<void> {
  const panel = page.locator('app-oidc-provider-panel');
  await panel.getByRole('tab', { name: sectionLabel, exact: true }).click();
  // Give the mat-tab body a tick to swap
  await page.waitForTimeout(150);
}

test.describe('OIDC provider admin flow', () => {
  test('mints ticket, creates scope, and records audit events', async ({ page }) => {
    await loginAsAdmin(page);
    await openInboundTab(page);

    const clientNameStamp = `E2E Client ${Date.now()}`;
    const scopeNameStamp  = `qb.e2e.${Date.now().toString(36)}`;

    // --- 1. Mint a registration ticket -------------------------------------
    await page.getByRole('button', { name: 'Mint registration ticket' }).click();
    // app-dialog is a content-projection host with no layout — target the
    // inner [role="dialog"] element which has real geometry. The title flips
    // from "Mint registration ticket" → "Registration ticket issued" after
    // submit, so match either.
    const dialog = page
      .locator('.dialog[role="dialog"]')
      .filter({ hasText: /Mint registration ticket|Registration ticket issued/ })
      .first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // Shared app-input CVA uses one-way [value]="value()" + (input) event.
    // Use real keystrokes (pressSequentially) to ensure Angular picks up the
    // value through the input event + onChange propagation.
    const nameInput = dialog.locator('input[placeholder="Armory Works"]');
    await nameInput.click();
    await nameInput.pressSequentially(clientNameStamp, { delay: 8 });
    await nameInput.press('Tab');

    const redirectInput = dialog.locator('input[placeholder="https://app.example.com/auth/callback"]');
    await redirectInput.click();
    await redirectInput.pressSequentially('https://test.example.com/auth/callback', { delay: 8 });
    await redirectInput.press('Tab');

    // The dialog uses OnPush + reactive-form-based canSubmit signal. Clicking
    // a benign toggle inside the form triggers the event-driven CD pass that
    // re-evaluates canSubmit after form.valid flipped true. (Toggle on-then-off
    // leaves form state unchanged but fires change detection.)
    const toggle = dialog.locator('mat-slide-toggle').first();
    await toggle.click();
    await toggle.click();

    // Submit
    const mintBtn = dialog.getByRole('button', { name: 'Mint ticket', exact: true });
    await expect(mintBtn).toBeEnabled({ timeout: 10_000 });
    await mintBtn.click();

    // --- 2. Assert the reveal panel shows a oidt_ ticket -------------------
    const revealedTicket = dialog.locator('.reveal__ticket code');
    await expect(revealedTicket).toBeVisible({ timeout: 10_000 });
    const ticketText = (await revealedTicket.textContent())?.trim() ?? '';
    expect(ticketText).toMatch(/^oidt_/);
    expect(ticketText.length).toBeGreaterThan(20);

    // Done → close dialog
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // --- 3. Verify the new ticket appears in the Tickets tab ---------------
    await selectOidcSection(page, 'Tickets');
    const ticketsTable = page.locator('app-oidc-provider-panel app-data-table').filter({
      has: page.locator('[data-testid="tableId-oidc-tickets"], thead'),
    }).first();
    // Match the row via the ticket prefix (first 8 chars of the raw ticket)
    const prefix = ticketText.substring(0, 8);
    await expect(
      page.locator('app-oidc-provider-panel tbody tr', { hasText: prefix }),
    ).toHaveCount(1, { timeout: 10_000 });

    // --- 4. Create a custom scope ------------------------------------------
    await selectOidcSection(page, 'Scopes');
    await page.getByRole('button', { name: 'Create custom scope' }).click();
    const scopeDialog = page
      .locator('.dialog[role="dialog"]', { hasText: /scope/i })
      .first();
    await expect(scopeDialog).toBeVisible({ timeout: 10_000 });

    // Shared CVA inputs want real keystrokes to be consistently picked up by
    // Angular's (input) binding → propagateChange flow. Target via placeholder
    // which is unique per field.
    const nameField = scopeDialog.locator('input[placeholder="qb.parts.read"]');
    await nameField.click();
    await nameField.pressSequentially(scopeNameStamp, { delay: 8 });
    await nameField.press('Tab');

    const displayField = scopeDialog.locator('input[placeholder="Read parts catalog"]');
    await displayField.click();
    await displayField.pressSequentially('E2E Test Scope', { delay: 8 });
    await displayField.press('Tab');

    const descField = scopeDialog.locator(
      'textarea[placeholder="Shown on the consent screen. Explain what this scope grants."]',
    );
    await descField.click();
    await descField.pressSequentially('Created by Playwright e2e spec', { delay: 4 });
    await descField.press('Tab');

    // Claim mappings JSON must be a JSON object (defaults to '{}'). The validator
    // rejects arrays, strings, and invalid JSON — leave the default, don't overwrite.

    // Save — the button label can be "Save" or "Create"
    const saveBtn = scopeDialog.getByRole('button', { name: /save|create/i }).first();
    await saveBtn.click();
    await expect(scopeDialog).toBeHidden({ timeout: 10_000 });

    // --- 5. Confirm scope appears in the Scopes list -----------------------
    await expect(
      page.locator('app-oidc-provider-panel tbody tr', { hasText: scopeNameStamp }),
    ).toHaveCount(1, { timeout: 10_000 });

    // --- 6. Audit log shows the lifecycle events ---------------------------
    await selectOidcSection(page, 'Audit');
    // Expect at least one TicketIssued row and one ScopeCreated row to exist.
    // These are events just generated in this test run, so they're guaranteed
    // to appear on the top page even if historical audit data is present.
    await expect(
      page.locator('app-oidc-provider-panel tbody tr', { hasText: /TicketIssued/i }),
    ).not.toHaveCount(0, { timeout: 10_000 });
    await expect(
      page.locator('app-oidc-provider-panel tbody tr', { hasText: /ScopeCreated/i }),
    ).not.toHaveCount(0, { timeout: 10_000 });
  });
});
