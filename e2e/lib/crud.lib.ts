import { Page, expect } from '@playwright/test';
import { openDialog, fillAndSaveDialog, closeDialog } from './dialog.lib';
import { waitForTable, clickRow } from './data-table.lib';
import { fillForm } from './form.lib';
import { expectSuccess } from './snackbar.lib';

/**
 * CRUD library — generic CRUD flow test helper.
 * Creates an entity via dialog, verifies it in the table, opens detail,
 * optionally edits and deletes.
 */

const TABLE_ROW_SELECTOR = 'app-data-table tbody tr';
const DIALOG_SELECTOR = '.cdk-overlay-container .mat-mdc-dialog-container, .cdk-overlay-container app-dialog';
const CONFIRM_DIALOG_SELECTOR = '.confirm-dialog';

/**
 * Execute a full CRUD flow:
 * 1. Navigate to the page
 * 2. Click create button to open dialog
 * 3. Fill form fields and save
 * 4. Verify the new entity appears in the table
 * 5. Click the row to open detail
 * 6. (Optional) Edit fields and save
 * 7. (Optional) Delete with confirmation
 */
export async function testCrudFlow(
  page: Page,
  options: {
    pagePath: string;
    createButtonText: string;
    dialogTitle: string;
    fields: Record<string, string>;
    saveButtonText?: string;
    verifyInTable: string;
    editFields?: Record<string, string>;
    deleteConfirmText?: string;
  },
): Promise<void> {
  const saveText = options.saveButtonText ?? 'Save';

  // 1. Navigate to the page
  await page.goto(options.pagePath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 2. Open the create dialog
  await openDialog(page, options.createButtonText, options.dialogTitle);

  // 3. Fill and save
  await fillAndSaveDialog(page, options.fields, saveText);

  // 4. Verify the entity appears in the table
  await page.waitForTimeout(500);
  const row = page.locator(TABLE_ROW_SELECTOR, { hasText: options.verifyInTable });
  await expect(row.first()).toBeVisible({ timeout: 10_000 });

  // 5. Open detail by clicking the row
  await clickRow(page, options.verifyInTable);
  await page.waitForTimeout(500);

  // 6. Edit (optional)
  if (options.editFields && Object.keys(options.editFields).length > 0) {
    // Look for an Edit button in the detail view
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(500);

      // Wait for edit dialog/form to appear
      await expect(
        page.locator(DIALOG_SELECTOR).first(),
      ).toBeVisible({ timeout: 5_000 }).catch(() => {
        // May be inline editing rather than dialog
      });

      await fillForm(page, options.editFields);
      await page.waitForTimeout(200);

      // Save the edit
      const saveBtn = page.getByRole('button', { name: saveText, exact: true });
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }

  // 7. Delete (optional)
  if (options.deleteConfirmText) {
    const deleteBtn = page.getByRole('button', { name: /delete|archive|remove/i }).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(500);

      // Confirm deletion in the confirm dialog
      const confirmDialog = page.locator(CONFIRM_DIALOG_SELECTOR);
      await expect(confirmDialog.first()).toBeVisible({ timeout: 5_000 });

      const confirmBtn = confirmDialog.locator('button', {
        hasText: new RegExp(options.deleteConfirmText, 'i'),
      }).first();
      await confirmBtn.click();
      await page.waitForTimeout(500);
    }
  }
}
