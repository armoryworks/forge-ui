import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { randomDelay, testId, maybe, randomPick, randomInt, randomAmount } from '../../lib/random.lib';

// ---------------------------------------------------------------------------
// Data pools for realistic test data generation
// ---------------------------------------------------------------------------

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const JOB_PREFIXES = [
  'Bracket Assembly', 'Shaft Machining', 'Housing Weldment', 'Manifold Block',
  'Adapter Plate', 'Drive Coupling', 'Fixture Build', 'Prototype Sprint',
  'Tool Rework', 'Jig Fabrication', 'Valve Body', 'Motor Mount',
];

const PART_TYPES = ['Manufactured', 'Purchased'];

const PART_DESCRIPTIONS = [
  'Aluminum 6061-T6 bracket, anodized',
  'Stainless 304 bushing, precision ground',
  'UHMW guide rail, CNC machined',
  'Delrin spacer block, tight tolerance',
  'A36 steel gusset plate, welded assembly',
  'Brass fitting, NPT threaded',
  'Titanium pin, medical grade',
  'Nylon roller, injection molded',
];

const ENGINEERING_NOTES = [
  'Updated GD&T callouts per customer feedback',
  'Revised tolerance stack for better fitment',
  'Added chamfer to reduce burr on mating face',
  'Changed material from 6061 to 7075 for strength',
  'Confirmed thread spec matches vendor datasheet',
  'Surface finish changed to Ra 32 per QC report',
  'Added inspection point at critical dimension',
  'Reduced wall thickness per FEA optimization',
];

const CHAT_MESSAGES = [
  'Engineering update: created new job and part for stress testing',
  'Design review complete — releasing to production',
  'BOM updated with revised quantities',
  'Tolerance study shows process is capable at Cpk 1.67',
  'Material cert received and verified',
  'First article passed all dimensional checks',
  'Updated routing to add deburr operation',
];

// ---------------------------------------------------------------------------
// Helper: safe fill for text inputs via data-testid
// ---------------------------------------------------------------------------

async function fillField(page: Page, dataTestId: string, value: string): Promise<void> {
  const field = page.locator(`[data-testid="${dataTestId}"] input`).first();
  await field.waitFor({ state: 'visible', timeout: 5000 });
  await field.click();
  await field.fill(value);
  await page.waitForTimeout(randomDelay(100, 300));
}

// ---------------------------------------------------------------------------
// Helper: safe fill for textareas via data-testid
// ---------------------------------------------------------------------------

async function fillTextarea(page: Page, dataTestId: string, value: string): Promise<void> {
  const field = page.locator(`[data-testid="${dataTestId}"] textarea`).first();
  await field.waitFor({ state: 'visible', timeout: 5000 });
  await field.click();
  await field.fill(value);
  await page.waitForTimeout(randomDelay(100, 300));
}

// ---------------------------------------------------------------------------
// Helper: select a mat-select option via data-testid
// ---------------------------------------------------------------------------

async function selectOption(page: Page, dataTestId: string, optionText: string): Promise<void> {
  const select = page.locator(`[data-testid="${dataTestId}"] mat-select`).first();
  await select.waitFor({ state: 'visible', timeout: 5000 });
  await select.click();
  await page.waitForTimeout(200);
  const option = page.locator('.cdk-overlay-container mat-option', { hasText: optionText }).first();
  await option.waitFor({ state: 'visible', timeout: 3000 });
  await option.click();
  await page.waitForTimeout(randomDelay(100, 300));
}

// ---------------------------------------------------------------------------
// Helper: wait for snackbar confirmation
// ---------------------------------------------------------------------------

async function waitForSnackbar(page: Page): Promise<void> {
  try {
    await page.locator('mat-snack-bar-container').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(randomDelay(500, 1000));
  } catch {
    // Snackbar may have auto-dismissed or not appeared — non-fatal
  }
}

// ---------------------------------------------------------------------------
// Helper: close any open dialog overlay
// ---------------------------------------------------------------------------

async function closeAnyDialog(page: Page): Promise<void> {
  const closeBtn = page.locator('.dialog__header .icon-btn, button[aria-label="Close"]').first();
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(randomDelay(300, 600));
  }
}

// ---------------------------------------------------------------------------
// Helper: dismiss overlay/backdrop if present
// ---------------------------------------------------------------------------

async function dismissOverlay(page: Page): Promise<void> {
  const backdrop = page.locator('.cdk-overlay-backdrop').first();
  if (await backdrop.isVisible({ timeout: 500 }).catch(() => false)) {
    await backdrop.click({ force: true });
    await page.waitForTimeout(300);
  }
}

// ---------------------------------------------------------------------------
// Workflow definition
// ---------------------------------------------------------------------------

export function getEngineerWorkflow(): Workflow {
  return {
    name: 'engineer',
    steps: [
      // -----------------------------------------------------------------
      // Step 1: Navigate to dashboard — verify KPI widgets loaded
      // -----------------------------------------------------------------
      {
        id: 'eng-01',
        name: 'Navigate to dashboard',
        execute: async (page: Page) => {
          await page.goto('/dashboard', { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(randomDelay(500, 1500));

          // Verify at least one KPI widget or dashboard widget rendered
          const widget = page.locator('app-dashboard-widget, app-kpi-chip, .dashboard-widget').first();
          await widget.waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(1000, 2000));
        },
      },

      // -----------------------------------------------------------------
      // Step 2: Navigate to kanban — wait for board columns
      // -----------------------------------------------------------------
      {
        id: 'eng-02',
        name: 'Navigate to kanban board',
        execute: async (page: Page) => {
          await page.goto('/kanban', { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(randomDelay(500, 1500));

          // Wait for at least one kanban column to render
          const column = page.locator('.kanban-column, .board-column, app-kanban-column-header').first();
          await column.waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // -----------------------------------------------------------------
      // Step 3: Create a new job on the kanban board
      // -----------------------------------------------------------------
      {
        id: 'eng-03',
        name: 'Create new job',
        execute: async (page: Page) => {
          const jobTitle = testId('stress-job');
          const priority = randomPick(PRIORITIES);
          const prefix = randomPick(JOB_PREFIXES);
          const description = `${prefix} — stress test run at ${new Date().toISOString()}`;

          // Click "New Job" button
          const newJobBtn = page.getByRole('button', { name: /new job/i }).first();
          if (!(await newJobBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
            // Fallback: look for add icon button in page header
            const addBtn = page.locator('.page-header button, app-page-layout button')
              .filter({ hasText: /new|add/i }).first();
            await addBtn.click();
          } else {
            await newJobBtn.click();
          }
          await page.waitForTimeout(randomDelay(500, 1000));

          // Wait for dialog to appear
          await page.locator('app-dialog, .dialog, mat-dialog-container').first()
            .waitFor({ state: 'visible', timeout: 5000 });

          // Fill job title
          try {
            await fillField(page, 'job-title', jobTitle);
          } catch {
            // Fallback: try generic input inside dialog
            const titleInput = page.locator('mat-dialog-container input, app-dialog input').first();
            await titleInput.click();
            await titleInput.fill(jobTitle);
          }

          // Select priority
          try {
            await selectOption(page, 'job-priority', priority);
          } catch {
            // Priority select may not be present or named differently — skip
          }

          // Fill description if textarea is available
          try {
            await fillTextarea(page, 'job-description', description);
          } catch {
            // Description may be optional or not present
          }

          // Click Save
          await page.waitForTimeout(randomDelay(300, 600));
          const saveBtn = page.getByRole('button', { name: /save/i }).first();
          await saveBtn.click();

          // Wait for dialog to close and snackbar to confirm
          await page.locator('app-dialog, mat-dialog-container').first()
            .waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
          await waitForSnackbar(page);
          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // -----------------------------------------------------------------
      // Step 4: Open the most recent job on the board
      // -----------------------------------------------------------------
      {
        id: 'eng-04',
        name: 'Open job detail from board',
        execute: async (page: Page) => {
          // Click the first job card visible on the board
          const card = page.locator('.kanban-card, .job-card, [class*="card"]')
            .filter({ hasText: /stress-job|job/i }).first();

          if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
            await card.click();
          } else {
            // Fallback: click any card on the board
            const anyCard = page.locator('.kanban-card, .job-card').first();
            if (await anyCard.isVisible({ timeout: 3000 }).catch(() => false)) {
              await anyCard.click();
            }
          }
          await page.waitForTimeout(randomDelay(800, 2000));

          // Verify detail dialog or panel opened
          const detail = page.locator('mat-dialog-container, app-detail-side-panel, .detail-panel').first();
          await detail.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(randomDelay(1000, 2000));
        },
      },

      // -----------------------------------------------------------------
      // Step 5: Edit job details — modify description
      // -----------------------------------------------------------------
      {
        id: 'eng-05',
        name: 'Edit job details',
        execute: async (page: Page) => {
          try {
            // Look for Edit button in dialog/panel
            const editBtn = page.getByRole('button', { name: /edit/i }).first();
            if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await editBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              // Modify description with engineering note
              const note = randomPick(ENGINEERING_NOTES);
              try {
                await fillTextarea(page, 'job-description', note);
              } catch {
                // Try finding any textarea in the dialog
                const textarea = page.locator('mat-dialog-container textarea, app-dialog textarea').first();
                if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
                  await textarea.click();
                  await textarea.fill(note);
                }
              }

              // Save changes
              const saveBtn = page.getByRole('button', { name: /save/i }).first();
              if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await saveBtn.click();
                await waitForSnackbar(page);
              }
            }
          } catch {
            // Edit flow may not be available — non-fatal
          }
          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // -----------------------------------------------------------------
      // Step 6: Close job detail
      // -----------------------------------------------------------------
      {
        id: 'eng-06',
        name: 'Close job detail',
        execute: async (page: Page) => {
          await closeAnyDialog(page);
          await dismissOverlay(page);
          // Press Escape as a final fallback
          await page.keyboard.press('Escape');
          await page.waitForTimeout(randomDelay(300, 800));
        },
      },

      // -----------------------------------------------------------------
      // Step 7: Navigate to backlog — verify DataTable
      // -----------------------------------------------------------------
      {
        id: 'eng-07',
        name: 'Navigate to backlog',
        execute: async (page: Page) => {
          await page.goto('/backlog', { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(randomDelay(500, 1500));

          // Wait for DataTable to render
          const table = page.locator('app-data-table, table, .data-table').first();
          await table.waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 8: Sort backlog by priority column
      // -----------------------------------------------------------------
      {
        id: 'eng-08',
        name: 'Sort backlog by priority',
        execute: async (page: Page) => {
          try {
            // Click the priority column header to sort
            const priorityHeader = page.locator('th, .column-header')
              .filter({ hasText: /priority/i }).first();
            if (await priorityHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
              await priorityHeader.click();
              await page.waitForTimeout(randomDelay(500, 1000));
              // Click again for descending sort (50% chance)
              if (maybe(0.5)) {
                await priorityHeader.click();
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            // Sorting header may not be interactable — non-fatal
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 9: Filter backlog — search for stress test jobs
      // -----------------------------------------------------------------
      {
        id: 'eng-09',
        name: 'Filter backlog for stress jobs',
        execute: async (page: Page) => {
          try {
            // Look for search input in toolbar
            const searchInput = page.locator('[data-testid="backlog-search"] input, app-toolbar app-input input, .page-header app-input input')
              .first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await searchInput.click();
              await searchInput.fill('stress');
              await page.waitForTimeout(randomDelay(800, 1500));

              // Clear search after browsing results
              await searchInput.fill('');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            // Search input may not be accessible — non-fatal
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 10: Navigate to parts catalog
      // -----------------------------------------------------------------
      {
        id: 'eng-10',
        name: 'Navigate to parts catalog',
        execute: async (page: Page) => {
          await page.goto('/parts', { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(randomDelay(500, 1500));

          // Wait for parts table
          const table = page.locator('app-data-table, table, .data-table').first();
          await table.waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 11: Create a new part
      // -----------------------------------------------------------------
      {
        id: 'eng-11',
        name: 'Create new part',
        execute: async (page: Page) => {
          const partNumber = testId('STR-PART');
          const description = randomPick(PART_DESCRIPTIONS);
          const partType = randomPick(PART_TYPES);

          try {
            // Click "New Part" button
            const newPartBtn = page.getByRole('button', { name: /new part/i }).first();
            if (!(await newPartBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
              const addBtn = page.locator('button').filter({ hasText: /new|add/i }).first();
              await addBtn.click();
            } else {
              await newPartBtn.click();
            }
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog, mat-dialog-container').first()
              .waitFor({ state: 'visible', timeout: 5000 });

            // Fill part number
            try {
              await fillField(page, 'part-partNumber', partNumber);
            } catch {
              const input = page.locator('mat-dialog-container input, app-dialog input').first();
              await input.click();
              await input.fill(partNumber);
            }

            // Fill description
            try {
              await fillField(page, 'part-description', description);
            } catch {
              // Description field might be a textarea
              try {
                await fillTextarea(page, 'part-description', description);
              } catch {
                // Skip if not available
              }
            }

            // Select part type
            try {
              await selectOption(page, 'part-partType', partType);
            } catch {
              // Part type may not be a required field — skip
            }

            // Save
            await page.waitForTimeout(randomDelay(300, 600));
            const saveBtn = page.getByRole('button', { name: /save/i }).first();
            await saveBtn.click();

            // Wait for dialog to close and confirmation
            await page.locator('app-dialog, mat-dialog-container').first()
              .waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
            await waitForSnackbar(page);
          } catch (err) {
            console.log(`[engineer] Part creation failed: ${err instanceof Error ? err.message : err}`);
            await closeAnyDialog(page);
            await dismissOverlay(page);
          }
          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // -----------------------------------------------------------------
      // Step 12: Search for the created part
      // -----------------------------------------------------------------
      {
        id: 'eng-12',
        name: 'Search for stress test part',
        execute: async (page: Page) => {
          try {
            const searchInput = page.locator('[data-testid="parts-search"] input, app-toolbar app-input input, .page-header app-input input')
              .first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await searchInput.click();
              await searchInput.fill('STR-PART');
              await page.waitForTimeout(randomDelay(800, 1500));
            }
          } catch {
            // Search may not be available
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 13: Open a part detail — click a row
      // -----------------------------------------------------------------
      {
        id: 'eng-13',
        name: 'Open part detail',
        execute: async (page: Page) => {
          try {
            // Click the first data row in the parts table
            const row = page.locator('app-data-table tbody tr, .data-table tbody tr').first();
            if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
              await row.click();
              await page.waitForTimeout(randomDelay(800, 1500));

              // Verify detail opened (dialog or side panel)
              const detail = page.locator('mat-dialog-container, app-detail-side-panel').first();
              await detail.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
            }
          } catch {
            // Row click may not open detail — non-fatal
          }
          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // -----------------------------------------------------------------
      // Step 14: View part BOM tab
      // -----------------------------------------------------------------
      {
        id: 'eng-14',
        name: 'View part BOM tab',
        execute: async (page: Page) => {
          try {
            // Look for BOM tab in the detail dialog/panel
            const bomTab = page.locator('.tab, [role="tab"]')
              .filter({ hasText: /bom|bill of material/i }).first();
            if (await bomTab.isVisible({ timeout: 2000 }).catch(() => false)) {
              await bomTab.click();
              await page.waitForTimeout(randomDelay(800, 1500));

              // Maybe also check operations tab
              if (maybe(0.4)) {
                const opsTab = page.locator('.tab, [role="tab"]')
                  .filter({ hasText: /operation|routing/i }).first();
                if (await opsTab.isVisible({ timeout: 1000 }).catch(() => false)) {
                  await opsTab.click();
                  await page.waitForTimeout(randomDelay(500, 1000));
                }
              }
            }
          } catch {
            // Tab navigation may fail — non-fatal
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 15: Close part detail
      // -----------------------------------------------------------------
      {
        id: 'eng-15',
        name: 'Close part detail',
        execute: async (page: Page) => {
          await closeAnyDialog(page);
          await dismissOverlay(page);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(randomDelay(300, 800));

          // Clear any search filter
          try {
            const searchInput = page.locator('app-toolbar app-input input, .page-header app-input input').first();
            if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
              await searchInput.fill('');
              await page.waitForTimeout(randomDelay(200, 400));
            }
          } catch {
            // Non-fatal
          }
        },
      },

      // -----------------------------------------------------------------
      // Step 16: Navigate to inventory
      // -----------------------------------------------------------------
      {
        id: 'eng-16',
        name: 'Navigate to inventory',
        execute: async (page: Page) => {
          await page.goto('/inventory', { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(randomDelay(500, 1500));

          const table = page.locator('app-data-table, table, .data-table').first();
          await table.waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 17: Browse stock levels — scroll through inventory rows
      // -----------------------------------------------------------------
      {
        id: 'eng-17',
        name: 'Browse inventory stock levels',
        execute: async (page: Page) => {
          try {
            // Count visible rows
            const rowCount = await page.locator('app-data-table tbody tr').count();

            // Scroll down the table to see more rows
            const tableBody = page.locator('app-data-table .table-scroll, app-data-table tbody').first();
            if (await tableBody.isVisible({ timeout: 2000 }).catch(() => false)) {
              await tableBody.evaluate((el) => {
                el.scrollTop = el.scrollHeight * 0.5;
              });
              await page.waitForTimeout(randomDelay(500, 1000));

              // Scroll back up
              await tableBody.evaluate((el) => {
                el.scrollTop = 0;
              });
            }

            // Maybe expand a row if expandable
            if (maybe(0.3)) {
              const expandBtn = page.locator('app-data-table .expand-btn, app-data-table button[aria-label*="expand"]').first();
              if (await expandBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await expandBtn.click();
                await page.waitForTimeout(randomDelay(500, 1000));
              }
            }
          } catch {
            // Scrolling may fail — non-fatal
          }
          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // -----------------------------------------------------------------
      // Step 18: Navigate to quality
      // -----------------------------------------------------------------
      {
        id: 'eng-18',
        name: 'Navigate to quality',
        execute: async (page: Page) => {
          await page.goto('/quality', { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(randomDelay(500, 1500));

          // Wait for quality page content (table or tabs)
          const content = page.locator('app-data-table, .tab, .quality-content, app-page-layout').first();
          await content.waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 19: Browse inspections — switch tabs, check table
      // -----------------------------------------------------------------
      {
        id: 'eng-19',
        name: 'Browse QC inspections',
        execute: async (page: Page) => {
          try {
            // Switch between inspections and lots tabs
            const inspectionsTab = page.locator('.tab, [role="tab"]')
              .filter({ hasText: /inspection/i }).first();
            if (await inspectionsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
              await inspectionsTab.click();
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Check if lots tab exists and maybe switch to it
            if (maybe(0.5)) {
              const lotsTab = page.locator('.tab, [role="tab"]')
                .filter({ hasText: /lot/i }).first();
              if (await lotsTab.isVisible({ timeout: 1000 }).catch(() => false)) {
                await lotsTab.click();
                await page.waitForTimeout(randomDelay(500, 1000));
              }
            }

            // Count rows in whichever table is visible
            const rowCount = await page.locator('app-data-table tbody tr').count();
          } catch {
            // Quality page browsing is non-fatal
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 20: Navigate to chat
      // -----------------------------------------------------------------
      {
        id: 'eng-20',
        name: 'Navigate to chat',
        execute: async (page: Page) => {
          await page.goto('/chat', { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(randomDelay(500, 1500));

          // Wait for chat interface to load
          const chatContainer = page.locator('app-chat, .chat-container, .chat-room').first();
          await chatContainer.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 21: Send an engineering update in chat
      // -----------------------------------------------------------------
      {
        id: 'eng-21',
        name: 'Send engineering chat message',
        execute: async (page: Page) => {
          try {
            const message = randomPick(CHAT_MESSAGES);

            // Find chat input — could be input or textarea
            const chatInput = page.locator(
              '[data-testid="chat-input"] input, [data-testid="chat-input"] textarea, ' +
              '.chat-input input, .chat-input textarea, ' +
              '.message-input input, .message-input textarea'
            ).first();

            if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await chatInput.click();
              await chatInput.fill(message);
              await page.waitForTimeout(randomDelay(300, 600));

              // Send with Enter key or send button
              const sendBtn = page.locator('button[aria-label*="send"], button[aria-label*="Send"]').first();
              if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await sendBtn.click();
              } else {
                await chatInput.press('Enter');
              }
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            // Chat message send is non-fatal
          }
          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // -----------------------------------------------------------------
      // Step 22: Check notifications — click bell icon
      // -----------------------------------------------------------------
      {
        id: 'eng-22',
        name: 'Check notifications',
        execute: async (page: Page) => {
          try {
            // Click the notification bell in the header
            const bellBtn = page.locator(
              'button[aria-label*="notification"], button[aria-label*="Notification"], ' +
              '.notification-bell, .header button .material-icons-outlined'
            ).filter({ hasText: /notifications/i }).first();

            if (!(await bellBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
              // Fallback: look for any bell-like button in header
              const headerBell = page.locator('app-header button, .app-header button')
                .filter({ has: page.locator('.material-icons-outlined', { hasText: 'notifications' }) })
                .first();
              if (await headerBell.isVisible({ timeout: 1000 }).catch(() => false)) {
                await headerBell.click();
              }
            } else {
              await bellBtn.click();
            }
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Browse notifications panel briefly
            const panel = page.locator('.notification-panel, app-notification-panel').first();
            if (await panel.isVisible({ timeout: 2000 }).catch(() => false)) {
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Close notifications panel — click elsewhere or press Escape
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            // Notification check is non-fatal
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // -----------------------------------------------------------------
      // Step 23: Navigate to time tracking (optional — 60% chance)
      // -----------------------------------------------------------------
      {
        id: 'eng-23',
        name: 'Check time tracking',
        execute: async (page: Page) => {
          if (maybe(0.6)) {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: 15000 });
            await page.waitForTimeout(randomDelay(500, 1500));

            const content = page.locator('app-data-table, .time-entries, app-page-layout').first();
            await content.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } else {
            // Skip time tracking this iteration
            await page.waitForTimeout(randomDelay(200, 500));
          }
        },
      },

      // -----------------------------------------------------------------
      // Step 24: Navigate back to kanban for final check
      // -----------------------------------------------------------------
      {
        id: 'eng-24',
        name: 'Return to kanban board',
        execute: async (page: Page) => {
          await page.goto('/kanban', { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(randomDelay(500, 1500));

          // Verify board is still rendered
          const column = page.locator('.kanban-column, .board-column, app-kanban-column-header').first();
          await column.waitFor({ state: 'visible', timeout: 10000 });

          // Maybe drag a card (30% chance) — simulate quick reorder
          if (maybe(0.3)) {
            try {
              const cards = page.locator('.kanban-card, .job-card');
              const cardCount = await cards.count();
              if (cardCount >= 2) {
                const sourceCard = cards.nth(0);
                const targetCard = cards.nth(Math.min(1, cardCount - 1));

                const sourceBound = await sourceCard.boundingBox();
                const targetBound = await targetCard.boundingBox();

                if (sourceBound && targetBound) {
                  await page.mouse.move(
                    sourceBound.x + sourceBound.width / 2,
                    sourceBound.y + sourceBound.height / 2,
                  );
                  await page.mouse.down();
                  await page.waitForTimeout(randomDelay(200, 400));
                  await page.mouse.move(
                    targetBound.x + targetBound.width / 2,
                    targetBound.y + targetBound.height / 2,
                    { steps: 10 },
                  );
                  await page.mouse.up();
                  await page.waitForTimeout(randomDelay(500, 1000));
                }
              }
            } catch {
              // Drag-drop may fail — non-fatal
            }
          }

          await page.waitForTimeout(randomDelay(1000, 2000));
        },
      },
    ],
  };
}
