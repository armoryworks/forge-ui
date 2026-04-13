import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { randomDelay, testId, maybe, randomPick, randomInt, randomAmount, randomDate } from '../../lib/random.lib';

/**
 * Office/Sales worker workflow — simulates a user managing the quote-to-cash
 * pipeline: customers, quotes, sales orders, invoices, payments, vendors,
 * purchase orders, shipments, and chat updates.
 *
 * Runs in a continuous loop (~25 steps per iteration).
 */

const CUSTOMER_SEARCH_TERMS = ['Hart', 'Wilson', 'Precision', 'Acme', 'Global', 'Smith', 'Tech', 'Industries'];
const VENDOR_SEARCH_TERMS = ['Metal', 'Supply', 'Steel', 'Plastics', 'Components', 'Tool'];
const CUSTOMER_TABS = ['overview', 'contacts', 'orders', 'invoices', 'quotes'];

const TABLE_ROW = 'app-data-table tbody tr';
const DIALOG = '.cdk-overlay-container .mat-mdc-dialog-container, .cdk-overlay-container app-dialog';
const SIDE_PANEL = 'app-detail-side-panel .panel';

export function getOfficeWorkflow(): Workflow {
  return {
    name: 'office',
    steps: [
      // ---------------------------------------------------------------
      // 1. Dashboard
      // ---------------------------------------------------------------
      {
        id: 'ofc-01',
        name: 'Navigate to dashboard',
        execute: async (page: Page) => {
          await page.goto('/dashboard', { waitUntil: 'load', timeout: 15_000 });
          await page.waitForSelector('.dashboard, app-dashboard', { timeout: 10_000 });
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 2. Customer list
      // ---------------------------------------------------------------
      {
        id: 'ofc-02',
        name: 'Navigate to customers',
        execute: async (page: Page) => {
          await page.goto('/customers', { waitUntil: 'load', timeout: 15_000 });
          await page.waitForSelector('app-data-table', { timeout: 10_000 });
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 3. Search for a customer
      // ---------------------------------------------------------------
      {
        id: 'ofc-03',
        name: 'Search for a customer',
        execute: async (page: Page) => {
          const term = randomPick(CUSTOMER_SEARCH_TERMS);
          try {
            const searchInput = page.locator('[data-testid="customer-search"] input, app-input input').first();
            await searchInput.click({ timeout: 5_000 });
            await searchInput.fill(term);
            await page.waitForTimeout(randomDelay(800, 1500));
            // Clear the search to restore full list for next step
            await searchInput.fill('');
            await page.waitForTimeout(randomDelay(300, 600));
          } catch {
            // Search input may not be present — non-critical
          }
        },
      },

      // ---------------------------------------------------------------
      // 4. Open customer detail
      // ---------------------------------------------------------------
      {
        id: 'ofc-04',
        name: 'Open customer detail',
        execute: async (page: Page) => {
          const rows = page.locator(TABLE_ROW);
          const count = await rows.count();
          if (count === 0) {
            await page.waitForTimeout(randomDelay(500, 1000));
            return;
          }
          const rowIndex = randomInt(0, Math.min(count - 1, 9));
          await rows.nth(rowIndex).click({ timeout: 5_000 });
          // Customer row click navigates to /customers/:id/overview
          await page.waitForURL(/\/customers\/\d+\/overview/, { timeout: 10_000 });
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 5. Browse customer tabs
      // ---------------------------------------------------------------
      {
        id: 'ofc-05',
        name: 'Browse customer tabs',
        execute: async (page: Page) => {
          // Only run if we're on a customer detail page
          if (!page.url().includes('/customers/')) {
            return;
          }
          const tabsToVisit = maybe(0.6) ? 3 : 2;
          for (let i = 0; i < tabsToVisit; i++) {
            const tabName = randomPick(CUSTOMER_TABS);
            try {
              const tab = page.locator('[role="tab"], .tab', { hasText: new RegExp(tabName, 'i') }).first();
              if (await tab.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await tab.click();
                await page.waitForTimeout(randomDelay(800, 2000));
              }
            } catch {
              // Tab may not exist — non-critical
            }
          }
        },
      },

      // ---------------------------------------------------------------
      // 6. Go back to customers list
      // ---------------------------------------------------------------
      {
        id: 'ofc-06',
        name: 'Go back to customers list',
        execute: async (page: Page) => {
          await page.goto('/customers', { waitUntil: 'load', timeout: 15_000 });
          await page.waitForSelector('app-data-table', { timeout: 10_000 });
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ---------------------------------------------------------------
      // 7. Navigate to quotes
      // ---------------------------------------------------------------
      {
        id: 'ofc-07',
        name: 'Navigate to quotes',
        execute: async (page: Page) => {
          await page.goto('/quotes', { waitUntil: 'load', timeout: 15_000 });
          await page.waitForSelector('app-data-table', { timeout: 10_000 });
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 8. Create a new quote (sometimes)
      // ---------------------------------------------------------------
      {
        id: 'ofc-08',
        name: 'Create a new quote',
        execute: async (page: Page) => {
          if (!maybe(0.4)) {
            // Skip creation 60% of the time to avoid flooding the DB
            await page.waitForTimeout(randomDelay(500, 1000));
            return;
          }

          try {
            // Click the New Quote button
            const newBtn = page.getByRole('button', { name: /new quote/i }).first();
            await newBtn.click({ timeout: 5_000 });
            await page.waitForTimeout(randomDelay(400, 800));

            // Wait for dialog to appear
            await page.waitForSelector(DIALOG, { timeout: 5_000 });

            // Select a customer in the dialog
            const customerField = page.locator('[data-testid="quote-customer"] mat-select, [data-testid="quote-customer"] input').first();
            if (await customerField.isVisible({ timeout: 3_000 }).catch(() => false)) {
              // If it's a mat-select, click to open and pick first option
              const isSelect = await page.locator('[data-testid="quote-customer"] mat-select').count();
              if (isSelect > 0) {
                await page.locator('[data-testid="quote-customer"] mat-select').first().click();
                await page.waitForTimeout(300);
                const options = page.locator('.cdk-overlay-container mat-option');
                const optCount = await options.count();
                if (optCount > 0) {
                  await options.nth(randomInt(0, Math.min(optCount - 1, 4))).click();
                  await page.waitForTimeout(300);
                }
              } else {
                // Entity picker — type to search
                await customerField.fill('');
                await customerField.type(randomPick(CUSTOMER_SEARCH_TERMS).substring(0, 3));
                await page.waitForTimeout(600);
                const autocompleteOpts = page.locator('.cdk-overlay-container mat-option');
                if (await autocompleteOpts.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
                  await autocompleteOpts.first().click();
                  await page.waitForTimeout(300);
                }
              }
            }

            // Fill optional due date
            if (maybe(0.5)) {
              try {
                const dateField = page.locator('[data-testid="quote-due-date"] input, [data-testid="quote-dueDate"] input').first();
                if (await dateField.isVisible({ timeout: 2_000 }).catch(() => false)) {
                  await dateField.fill(randomDate(7, 60));
                  await page.keyboard.press('Escape');
                  await page.waitForTimeout(200);
                }
              } catch {
                // Date field optional
              }
            }

            // Click Save
            const saveBtn = page.getByRole('button', { name: /save|create/i }).first();
            if (await saveBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
              await saveBtn.click();
              await page.waitForTimeout(randomDelay(800, 1500));
            } else {
              // Form may be invalid — close the dialog
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);
            }
          } catch {
            // Quote creation failed — dismiss any open dialog
            try {
              await page.keyboard.press('Escape');
              await page.waitForTimeout(300);
            } catch { /* ignore */ }
          }
        },
      },

      // ---------------------------------------------------------------
      // 9. Browse quotes — sort by column
      // ---------------------------------------------------------------
      {
        id: 'ofc-09',
        name: 'Browse quotes',
        execute: async (page: Page) => {
          try {
            const headers = page.locator('app-data-table thead th');
            const headerCount = await headers.count();
            if (headerCount > 1) {
              const sortIndex = randomInt(0, Math.min(headerCount - 1, 4));
              await headers.nth(sortIndex).click();
              await page.waitForTimeout(randomDelay(500, 1000));
            }
            // Scroll through the table
            const tableBody = page.locator('app-data-table .data-table__scroll');
            if (await tableBody.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await tableBody.evaluate((el) => el.scrollBy(0, 300));
              await page.waitForTimeout(randomDelay(600, 1200));
            }
          } catch {
            // Non-critical browsing action
          }
        },
      },

      // ---------------------------------------------------------------
      // 10. Navigate to sales orders
      // ---------------------------------------------------------------
      {
        id: 'ofc-10',
        name: 'Navigate to sales orders',
        execute: async (page: Page) => {
          await page.goto('/sales-orders', { waitUntil: 'load', timeout: 15_000 });
          await page.waitForSelector('app-data-table', { timeout: 10_000 });
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 11. Browse sales orders
      // ---------------------------------------------------------------
      {
        id: 'ofc-11',
        name: 'Browse sales orders',
        execute: async (page: Page) => {
          try {
            const rows = page.locator(TABLE_ROW);
            const count = await rows.count();
            // Scroll through the table if there are rows
            if (count > 5) {
              const tableScroll = page.locator('app-data-table .data-table__scroll');
              if (await tableScroll.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await tableScroll.evaluate((el) => el.scrollBy(0, 400));
                await page.waitForTimeout(randomDelay(500, 1000));
              }
            }
          } catch {
            // Non-critical
          }
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 12. Open a sales order detail
      // ---------------------------------------------------------------
      {
        id: 'ofc-12',
        name: 'Open a sales order detail',
        execute: async (page: Page) => {
          try {
            const rows = page.locator(TABLE_ROW);
            const count = await rows.count();
            if (count > 0) {
              const rowIndex = randomInt(0, Math.min(count - 1, 9));
              await rows.nth(rowIndex).click({ timeout: 5_000 });
              await page.waitForTimeout(500);
              // Wait for dialog or panel to appear
              const dialogOrPanel = page.locator(DIALOG).first().or(page.locator(SIDE_PANEL).first());
              await dialogOrPanel.waitFor({ state: 'visible', timeout: 8_000 });
              await page.waitForTimeout(randomDelay(800, 2000));
            }
          } catch {
            // No rows or detail failed to open — non-critical
          }
        },
      },

      // ---------------------------------------------------------------
      // 13. Close sales order detail
      // ---------------------------------------------------------------
      {
        id: 'ofc-13',
        name: 'Close sales order detail',
        execute: async (page: Page) => {
          try {
            // Try close button in dialog or side panel
            const closeBtn = page.locator(
              'app-dialog .dialog__close, app-detail-side-panel .panel__close, .mat-mdc-dialog-container button[aria-label="Close"]',
            ).first();
            if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
              await closeBtn.click();
              await page.waitForTimeout(randomDelay(300, 600));
            } else {
              await page.keyboard.press('Escape');
              await page.waitForTimeout(300);
            }
          } catch {
            // May not have a detail open
          }
        },
      },

      // ---------------------------------------------------------------
      // 14. Navigate to vendors
      // ---------------------------------------------------------------
      {
        id: 'ofc-14',
        name: 'Navigate to vendors',
        execute: async (page: Page) => {
          await page.goto('/vendors', { waitUntil: 'load', timeout: 15_000 });
          await page.waitForSelector('app-data-table', { timeout: 10_000 });
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 15. Search vendors
      // ---------------------------------------------------------------
      {
        id: 'ofc-15',
        name: 'Search vendors',
        execute: async (page: Page) => {
          const term = randomPick(VENDOR_SEARCH_TERMS);
          try {
            const searchInput = page.locator('[data-testid="vendor-search"] input, app-input input').first();
            await searchInput.click({ timeout: 5_000 });
            await searchInput.fill(term);
            await page.waitForTimeout(randomDelay(800, 1500));
            await searchInput.fill('');
            await page.waitForTimeout(randomDelay(300, 600));
          } catch {
            // Non-critical
          }
        },
      },

      // ---------------------------------------------------------------
      // 16. Open vendor detail (side panel)
      // ---------------------------------------------------------------
      {
        id: 'ofc-16',
        name: 'Open vendor detail',
        execute: async (page: Page) => {
          try {
            const rows = page.locator(TABLE_ROW);
            const count = await rows.count();
            if (count > 0) {
              const rowIndex = randomInt(0, Math.min(count - 1, 9));
              await rows.nth(rowIndex).click({ timeout: 5_000 });
              await page.waitForTimeout(500);
              // Vendor detail opens as a side panel or dialog
              const panelOrDialog = page.locator(SIDE_PANEL).first().or(page.locator(DIALOG).first());
              await panelOrDialog.waitFor({ state: 'visible', timeout: 8_000 });
              await page.waitForTimeout(randomDelay(800, 1500));
            }
          } catch {
            // No vendors or panel failed to open
          }
        },
      },

      // ---------------------------------------------------------------
      // 17. Switch to PO tab in vendor detail
      // ---------------------------------------------------------------
      {
        id: 'ofc-17',
        name: 'Switch to purchase orders tab in vendor detail',
        execute: async (page: Page) => {
          try {
            const panel = page.locator(SIDE_PANEL).first().or(page.locator(DIALOG).first());
            if (await panel.isVisible({ timeout: 2_000 }).catch(() => false)) {
              // Look for a Purchase Orders tab within the detail
              const poTab = page.locator('[role="tab"], .tab', { hasText: /purchase.?orders|po/i }).first();
              if (await poTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await poTab.click();
                await page.waitForTimeout(randomDelay(800, 1500));
              }

              // Maybe also check the scorecard tab
              if (maybe(0.4)) {
                const scorecardTab = page.locator('[role="tab"], .tab', { hasText: /scorecard|info/i }).first();
                if (await scorecardTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
                  await scorecardTab.click();
                  await page.waitForTimeout(randomDelay(600, 1200));
                }
              }
            }
          } catch {
            // Tab navigation non-critical
          }
        },
      },

      // ---------------------------------------------------------------
      // 18. Close vendor detail
      // ---------------------------------------------------------------
      {
        id: 'ofc-18',
        name: 'Close vendor detail',
        execute: async (page: Page) => {
          try {
            const panelClose = page.locator('app-detail-side-panel .panel__close').first();
            if (await panelClose.isVisible({ timeout: 2_000 }).catch(() => false)) {
              await panelClose.click();
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }
            const dialogClose = page.locator('app-dialog .dialog__close, .mat-mdc-dialog-container button[aria-label="Close"]').first();
            if (await dialogClose.isVisible({ timeout: 2_000 }).catch(() => false)) {
              await dialogClose.click();
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
          } catch {
            // Already closed or no panel open
          }
        },
      },

      // ---------------------------------------------------------------
      // 19. Navigate to purchase orders
      // ---------------------------------------------------------------
      {
        id: 'ofc-19',
        name: 'Navigate to purchase orders',
        execute: async (page: Page) => {
          await page.goto('/purchase-orders', { waitUntil: 'load', timeout: 15_000 });
          await page.waitForSelector('app-data-table', { timeout: 10_000 });
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 20. Browse purchase orders
      // ---------------------------------------------------------------
      {
        id: 'ofc-20',
        name: 'Browse purchase orders',
        execute: async (page: Page) => {
          try {
            // Sort by a random column
            const headers = page.locator('app-data-table thead th');
            const headerCount = await headers.count();
            if (headerCount > 1) {
              await headers.nth(randomInt(0, Math.min(headerCount - 1, 4))).click();
              await page.waitForTimeout(randomDelay(400, 800));
            }
            // Scroll through the table
            const tableScroll = page.locator('app-data-table .data-table__scroll');
            if (await tableScroll.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await tableScroll.evaluate((el) => el.scrollBy(0, 300));
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            // Non-critical
          }
        },
      },

      // ---------------------------------------------------------------
      // 21. Navigate to invoices
      // ---------------------------------------------------------------
      {
        id: 'ofc-21',
        name: 'Navigate to invoices',
        execute: async (page: Page) => {
          await page.goto('/invoices', { waitUntil: 'load', timeout: 15_000 });
          await page.waitForSelector('app-data-table', { timeout: 10_000 });
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 22. Browse invoices — check statuses
      // ---------------------------------------------------------------
      {
        id: 'ofc-22',
        name: 'Browse invoices',
        execute: async (page: Page) => {
          try {
            const rows = page.locator(TABLE_ROW);
            const count = await rows.count();

            // Open a random invoice detail if rows exist
            if (count > 0 && maybe(0.5)) {
              const rowIndex = randomInt(0, Math.min(count - 1, 9));
              await rows.nth(rowIndex).click({ timeout: 5_000 });
              await page.waitForTimeout(500);
              const dialogOrPanel = page.locator(DIALOG).first().or(page.locator(SIDE_PANEL).first());
              if (await dialogOrPanel.isVisible({ timeout: 5_000 }).catch(() => false)) {
                await page.waitForTimeout(randomDelay(800, 1500));
                // Close it
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
              }
            }

            // Sort by status column
            const statusHeader = page.locator('app-data-table thead th', { hasText: /status/i }).first();
            if (await statusHeader.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await statusHeader.click();
              await page.waitForTimeout(randomDelay(400, 800));
            }
          } catch {
            // Non-critical browsing
          }
        },
      },

      // ---------------------------------------------------------------
      // 23. Navigate to shipments
      // ---------------------------------------------------------------
      {
        id: 'ofc-23',
        name: 'Navigate to shipments',
        execute: async (page: Page) => {
          await page.goto('/shipments', { waitUntil: 'load', timeout: 15_000 });
          try {
            await page.waitForSelector('app-data-table', { timeout: 10_000 });
          } catch {
            // Shipments page may have no table yet
          }
          await page.waitForTimeout(randomDelay(800, 1500));

          // Optionally open a shipment detail
          if (maybe(0.3)) {
            try {
              const rows = page.locator(TABLE_ROW);
              const count = await rows.count();
              if (count > 0) {
                await rows.nth(randomInt(0, Math.min(count - 1, 4))).click({ timeout: 5_000 });
                await page.waitForTimeout(500);
                const dialogOrPanel = page.locator(DIALOG).first().or(page.locator(SIDE_PANEL).first());
                if (await dialogOrPanel.isVisible({ timeout: 5_000 }).catch(() => false)) {
                  await page.waitForTimeout(randomDelay(800, 1500));
                  await page.keyboard.press('Escape');
                  await page.waitForTimeout(300);
                }
              }
            } catch {
              // Non-critical
            }
          }
        },
      },

      // ---------------------------------------------------------------
      // 24. Navigate to payments (sometimes)
      // ---------------------------------------------------------------
      {
        id: 'ofc-24',
        name: 'Navigate to payments',
        execute: async (page: Page) => {
          if (!maybe(0.5)) {
            // Skip 50% of the time — not every loop needs payments
            await page.waitForTimeout(randomDelay(300, 600));
            return;
          }
          await page.goto('/payments', { waitUntil: 'load', timeout: 15_000 });
          try {
            await page.waitForSelector('app-data-table', { timeout: 10_000 });
            // Browse payment rows
            const rows = page.locator(TABLE_ROW);
            const count = await rows.count();
            if (count > 0 && maybe(0.4)) {
              await rows.nth(randomInt(0, Math.min(count - 1, 4))).click({ timeout: 5_000 });
              await page.waitForTimeout(500);
              const dialogOrPanel = page.locator(DIALOG).first().or(page.locator(SIDE_PANEL).first());
              if (await dialogOrPanel.isVisible({ timeout: 5_000 }).catch(() => false)) {
                await page.waitForTimeout(randomDelay(600, 1200));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
              }
            }
          } catch {
            // Payments page may be empty
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ---------------------------------------------------------------
      // 25. Navigate to chat and send office update
      // ---------------------------------------------------------------
      {
        id: 'ofc-25',
        name: 'Send office update in chat',
        execute: async (page: Page) => {
          await page.goto('/chat', { waitUntil: 'load', timeout: 15_000 });
          await page.waitForTimeout(randomDelay(800, 1500));

          try {
            // Select the first visible chat room
            const rooms = page.locator('.chat-room, .room-item, [class*="room"]').first();
            if (await rooms.isVisible({ timeout: 5_000 }).catch(() => false)) {
              await rooms.click();
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Type and send a message
            const msgInput = page.locator(
              '[data-testid="chat-message-input"] input, [data-testid="chat-message-input"] textarea, .chat-input input, .chat-input textarea, textarea[placeholder*="message" i]',
            ).first();
            if (await msgInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
              const messages = [
                'Office update: reviewed customer pipeline, quotes and orders status check complete',
                `Pipeline check complete. ${randomInt(2, 8)} quotes pending review, ${randomInt(1, 5)} SOs awaiting shipment.`,
                `Updated vendor contacts. PO follow-ups scheduled for ${randomDate(1, 5)}.`,
                'Invoice batch reviewed. All current invoices reconciled.',
                `Customer follow-up done. ${randomInt(1, 4)} new quote requests to process.`,
              ];
              const message = randomPick(messages);
              await msgInput.click();
              await msgInput.fill(message);
              await page.waitForTimeout(randomDelay(300, 600));

              // Send via Enter key or send button
              const sendBtn = page.locator('button[aria-label*="send" i], button:has(.material-icons-outlined:text("send"))').first();
              if (await sendBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await sendBtn.click();
              } else {
                await page.keyboard.press('Enter');
              }
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            // Chat interaction non-critical
          }
        },
      },
    ],
  };
}
