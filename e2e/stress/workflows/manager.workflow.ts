import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { randomDelay, testId, maybe, randomPick, randomInt } from '../../lib/random.lib';

/**
 * Manager workflow — simulates a production manager's daily review loop.
 *
 * Covers: dashboard KPIs, kanban board review, job detail inspection,
 * backlog triage, time tracking oversight, expense review, report viewing,
 * planning cycles, lead pipeline, chat updates, and notification management.
 *
 * ~22 steps per iteration. Non-critical failures are caught so the loop
 * continues; critical navigation failures throw to signal the orchestrator.
 */
export function getManagerWorkflow(): Workflow {
  return {
    name: 'manager',
    steps: [
      // ---------------------------------------------------------------
      // 1. Navigate to dashboard
      // ---------------------------------------------------------------
      {
        id: 'mgr-01',
        name: 'Navigate to dashboard',
        execute: async (page: Page) => {
          await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });

          // Wait for dashboard widgets or KPI chips to render
          await page.locator('.dashboard-widget, app-kpi-chip, app-dashboard-widget').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 2. Review dashboard KPIs
      // ---------------------------------------------------------------
      {
        id: 'mgr-02',
        name: 'Review dashboard KPIs',
        execute: async (page: Page) => {
          try {
            const widgets = page.locator('.dashboard-widget, app-dashboard-widget');
            const widgetCount = await widgets.count();

            // Scroll through widgets to simulate reading
            for (let i = 0; i < Math.min(widgetCount, 4); i++) {
              await widgets.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(300, 800));
            }

            // Check for KPI chips
            const kpiChips = page.locator('app-kpi-chip');
            const chipCount = await kpiChips.count();
            if (chipCount > 0) {
              await kpiChips.first().scrollIntoViewIfNeeded();
            }
          } catch {
            // Non-critical — dashboard may have varying widget counts
          }

          await page.waitForTimeout(randomDelay(800, 2000));
        },
      },

      // ---------------------------------------------------------------
      // 3. Navigate to kanban
      // ---------------------------------------------------------------
      {
        id: 'mgr-03',
        name: 'Navigate to kanban',
        execute: async (page: Page) => {
          await page.goto('/kanban', { waitUntil: 'domcontentloaded', timeout: 15000 });

          // Wait for the board columns to appear
          await page.locator('.kanban-column, .board-column, app-kanban-column-header').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 4. Review board status — count cards per column
      // ---------------------------------------------------------------
      {
        id: 'mgr-04',
        name: 'Review board status',
        execute: async (page: Page) => {
          try {
            const columns = page.locator('.kanban-column, .board-column');
            const columnCount = await columns.count();

            // Scroll through columns to review
            for (let i = 0; i < Math.min(columnCount, 6); i++) {
              await columns.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(200, 600));
            }

            // Check for overdue indicators
            const overdueCards = page.locator('.job-card--overdue, .card--overdue, [class*="overdue"]');
            await overdueCards.count(); // Just count, no assertion
          } catch {
            // Board layout may vary
          }

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 5. Open a random job card
      // ---------------------------------------------------------------
      {
        id: 'mgr-05',
        name: 'Open a random job',
        execute: async (page: Page) => {
          try {
            const jobCards = page.locator('.job-card, .kanban-card, [class*="job-card"]');
            const cardCount = await jobCards.count();

            if (cardCount > 0) {
              const index = randomInt(0, Math.min(cardCount - 1, 9));
              await jobCards.nth(index).click();

              // Wait for detail dialog or panel to open
              await page.locator('app-dialog, mat-dialog-container, app-detail-side-panel').first()
                .waitFor({ state: 'visible', timeout: 8000 });
            }
          } catch {
            // No cards or dialog failed to open — non-critical
          }

          await page.waitForTimeout(randomDelay(800, 2000));
        },
      },

      // ---------------------------------------------------------------
      // 6. Check job activity tab
      // ---------------------------------------------------------------
      {
        id: 'mgr-06',
        name: 'Check job activity',
        execute: async (page: Page) => {
          try {
            // Look for activity tab within the dialog/panel
            const activityTab = page.locator('.tab, [role="tab"]', { hasText: /activity|log|history/i });
            if (await activityTab.count() > 0) {
              await activityTab.first().click();
              await page.waitForTimeout(randomDelay(500, 1200));

              // Wait for activity timeline entries
              const timeline = page.locator('app-activity-timeline, .activity-timeline, .activity-item');
              await timeline.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
            }
          } catch {
            // Activity tab may not exist in all views
          }

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 7. Close job detail
      // ---------------------------------------------------------------
      {
        id: 'mgr-07',
        name: 'Close job detail',
        execute: async (page: Page) => {
          try {
            // Try close button first
            const closeBtn = page.locator(
              'button[aria-label="Close"], .dialog__close-btn, button:has(> .material-icons-outlined:text("close"))',
            );
            if (await closeBtn.count() > 0) {
              await closeBtn.first().click();
            } else {
              // Fallback: press Escape
              await page.keyboard.press('Escape');
            }

            await page.waitForTimeout(randomDelay(300, 800));

            // Wait for dialog/panel to close
            await page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
          } catch {
            // Already closed or was never open
            await page.keyboard.press('Escape');
          }

          await page.waitForTimeout(randomDelay(300, 800));
        },
      },

      // ---------------------------------------------------------------
      // 8. Navigate to backlog
      // ---------------------------------------------------------------
      {
        id: 'mgr-08',
        name: 'Navigate to backlog',
        execute: async (page: Page) => {
          await page.goto('/backlog', { waitUntil: 'domcontentloaded', timeout: 15000 });

          // Wait for data table to appear
          await page.locator('app-data-table').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 9. Sort backlog by due date
      // ---------------------------------------------------------------
      {
        id: 'mgr-09',
        name: 'Sort by due date',
        execute: async (page: Page) => {
          try {
            const dueDateHeader = page.locator('app-data-table thead th', { hasText: /due date/i }).first();
            await dueDateHeader.click();
            await page.waitForTimeout(randomDelay(300, 800));

            // Click again for descending if desired
            if (maybe(0.5)) {
              await dueDateHeader.click();
              await page.waitForTimeout(randomDelay(200, 500));
            }
          } catch {
            // Column may not exist or sort failed
          }

          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 10. Review backlog items
      // ---------------------------------------------------------------
      {
        id: 'mgr-10',
        name: 'Review backlog items',
        execute: async (page: Page) => {
          try {
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();

            // Scroll through visible rows
            const scrollCount = Math.min(rowCount, 8);
            for (let i = 0; i < scrollCount; i++) {
              await rows.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(150, 400));
            }

            // Maybe click a row to preview
            if (maybe(0.3) && rowCount > 0) {
              const randomRow = randomInt(0, Math.min(rowCount - 1, 5));
              await rows.nth(randomRow).click();
              await page.waitForTimeout(randomDelay(500, 1000));

              // Close any opened detail
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(200, 500));
            }
          } catch {
            // Empty backlog or row interaction failed
          }

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 11. Navigate to time tracking
      // ---------------------------------------------------------------
      {
        id: 'mgr-11',
        name: 'Navigate to time tracking',
        execute: async (page: Page) => {
          await page.goto('/time-tracking', { waitUntil: 'domcontentloaded', timeout: 15000 });

          await page.locator('app-data-table, .time-tracking').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 12. Review time entries
      // ---------------------------------------------------------------
      {
        id: 'mgr-12',
        name: 'Review time entries',
        execute: async (page: Page) => {
          try {
            const rows = page.locator('app-data-table tbody tr');
            await rows.first().waitFor({ state: 'visible', timeout: 10000 });

            const rowCount = await rows.count();

            // Scroll through recent entries
            for (let i = 0; i < Math.min(rowCount, 6); i++) {
              await rows.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(150, 400));
            }

            // Maybe sort by duration or date
            if (maybe(0.4)) {
              const sortColumn = randomPick(['Date', 'Duration', 'Employee', 'User']);
              const header = page.locator('app-data-table thead th', { hasText: new RegExp(sortColumn, 'i') });
              if (await header.count() > 0) {
                await header.first().click();
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            // Time entries may be empty
          }

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 13. Navigate to expenses
      // ---------------------------------------------------------------
      {
        id: 'mgr-13',
        name: 'Navigate to expenses',
        execute: async (page: Page) => {
          await page.goto('/expenses', { waitUntil: 'domcontentloaded', timeout: 15000 });

          await page.locator('app-data-table, .expenses').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 14. Review expense reports
      // ---------------------------------------------------------------
      {
        id: 'mgr-14',
        name: 'Review expense reports',
        execute: async (page: Page) => {
          try {
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();

            if (rowCount > 0) {
              // Scroll through expenses
              for (let i = 0; i < Math.min(rowCount, 5); i++) {
                await rows.nth(i).scrollIntoViewIfNeeded();
                await page.waitForTimeout(randomDelay(200, 500));
              }

              // Maybe sort by status to find pending approvals
              if (maybe(0.5)) {
                const statusHeader = page.locator('app-data-table thead th', { hasText: /status/i });
                if (await statusHeader.count() > 0) {
                  await statusHeader.first().click();
                  await page.waitForTimeout(randomDelay(300, 600));
                }
              }

              // Maybe click an expense to review detail
              if (maybe(0.3) && rowCount > 0) {
                await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click();
                await page.waitForTimeout(randomDelay(800, 1500));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(200, 500));
              }
            }
          } catch {
            // Empty or interaction failed
          }

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 15. Navigate to reports
      // ---------------------------------------------------------------
      {
        id: 'mgr-15',
        name: 'Navigate to reports',
        execute: async (page: Page) => {
          await page.goto('/reports', { waitUntil: 'domcontentloaded', timeout: 15000 });

          // Wait for report list or builder to load
          await page.locator('app-data-table, .report-list, .reports, app-page-layout').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 16. Open a report
      // ---------------------------------------------------------------
      {
        id: 'mgr-16',
        name: 'Open a report',
        execute: async (page: Page) => {
          try {
            // Look for report cards, rows, or links
            const reportItems = page.locator(
              'app-data-table tbody tr, .report-card, .report-item, [data-testid*="report"]',
            );
            const itemCount = await reportItems.count();

            if (itemCount > 0) {
              const index = randomInt(0, Math.min(itemCount - 1, 5));
              await reportItems.nth(index).click();
              await page.waitForTimeout(randomDelay(1000, 2500));

              // Wait for report to render (chart or table)
              await page.locator('canvas, app-data-table, .chart-container, .report-content').first()
                .waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

              // Scroll through report content
              const reportContent = page.locator('.report-content, .report-results, main');
              if (await reportContent.count() > 0) {
                await reportContent.first().evaluate((el) => el.scrollBy(0, 300));
                await page.waitForTimeout(randomDelay(500, 1000));
              }

              // Navigate back to report list
              if (maybe(0.7)) {
                await page.goBack();
                await page.waitForTimeout(randomDelay(300, 800));
              }
            }
          } catch {
            // No reports available or navigation failed
          }

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 17. Navigate to planning
      // ---------------------------------------------------------------
      {
        id: 'mgr-17',
        name: 'Navigate to planning',
        execute: async (page: Page) => {
          await page.goto('/planning', { waitUntil: 'domcontentloaded', timeout: 15000 });

          // Wait for planning content
          await page.locator('app-page-layout, app-data-table, .planning').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          await page.waitForTimeout(randomDelay(500, 1500));

          try {
            // Check for active planning cycle
            const cycleInfo = page.locator('.planning-cycle, .cycle-header, [class*="cycle"]');
            if (await cycleInfo.count() > 0) {
              await cycleInfo.first().scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(300, 800));
            }

            // Maybe browse planning entries
            const entries = page.locator('app-data-table tbody tr, .planning-entry');
            const entryCount = await entries.count();
            for (let i = 0; i < Math.min(entryCount, 4); i++) {
              await entries.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(150, 400));
            }
          } catch {
            // Planning page may be empty
          }

          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 18. Navigate to leads
      // ---------------------------------------------------------------
      {
        id: 'mgr-18',
        name: 'Navigate to leads',
        execute: async (page: Page) => {
          await page.goto('/leads', { waitUntil: 'domcontentloaded', timeout: 15000 });

          await page.locator('app-data-table, .leads').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          await page.waitForTimeout(randomDelay(500, 1200));

          try {
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();

            // Scroll through leads
            for (let i = 0; i < Math.min(rowCount, 5); i++) {
              await rows.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(150, 400));
            }

            // Maybe sort by status or value
            if (maybe(0.4)) {
              const col = randomPick(['Status', 'Value', 'Company', 'Source']);
              const header = page.locator('app-data-table thead th', { hasText: new RegExp(col, 'i') });
              if (await header.count() > 0) {
                await header.first().click();
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            // Leads table may be empty
          }

          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 19. Navigate to chat
      // ---------------------------------------------------------------
      {
        id: 'mgr-19',
        name: 'Navigate to chat',
        execute: async (page: Page) => {
          await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 15000 });

          // Wait for chat UI to render
          await page.locator('.chat-room, .chat-list, app-page-layout, [class*="chat"]').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          await page.waitForTimeout(randomDelay(500, 1500));

          try {
            // Select a chat room if available
            const rooms = page.locator('.chat-room-item, .room-item, [class*="room"]');
            const roomCount = await rooms.count();
            if (roomCount > 0) {
              await rooms.nth(randomInt(0, Math.min(roomCount - 1, 3))).click();
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            // Chat rooms may not be available
          }

          await page.waitForTimeout(randomDelay(300, 800));
        },
      },

      // ---------------------------------------------------------------
      // 20. Send manager update message
      // ---------------------------------------------------------------
      {
        id: 'mgr-20',
        name: 'Send manager update',
        execute: async (page: Page) => {
          try {
            const messageInput = page.locator(
              '[data-testid="chat-message-input"], textarea[placeholder*="message" i], .chat-input textarea, .chat-input input',
            );

            if (await messageInput.count() > 0) {
              const iterationId = testId('review');
              const message = `Manager daily review: all systems operational. Stress test iteration ${iterationId} complete.`;

              await messageInput.first().click();
              await page.waitForTimeout(randomDelay(200, 500));
              await messageInput.first().fill(message);
              await page.waitForTimeout(randomDelay(300, 800));

              // Send via Enter or send button
              const sendBtn = page.locator(
                '[data-testid="chat-send-btn"], button[aria-label*="send" i], button:has(.material-icons-outlined:text("send"))',
              );
              if (await sendBtn.count() > 0) {
                await sendBtn.first().click();
              } else {
                await page.keyboard.press('Enter');
              }

              await page.waitForTimeout(randomDelay(500, 1200));
            }
          } catch {
            // Chat input unavailable — non-critical
          }

          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 21. Check notifications
      // ---------------------------------------------------------------
      {
        id: 'mgr-21',
        name: 'Check notifications',
        execute: async (page: Page) => {
          try {
            // Click the notification bell in the header
            const bellBtn = page.locator(
              '[data-testid="notification-bell"], button[aria-label*="notification" i], .notification-bell, button:has(.material-icons-outlined:text("notifications"))',
            );

            if (await bellBtn.count() > 0) {
              await bellBtn.first().click();
              await page.waitForTimeout(randomDelay(500, 1200));

              // Wait for notification panel to appear
              const panel = page.locator('.notification-panel, app-notification-panel, [class*="notification-panel"]');
              if (await panel.count() > 0) {
                await panel.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

                // Scroll through notifications
                const items = page.locator('.notification-item, .notification-entry, [class*="notification-item"]');
                const itemCount = await items.count();
                for (let i = 0; i < Math.min(itemCount, 5); i++) {
                  await items.nth(i).scrollIntoViewIfNeeded();
                  await page.waitForTimeout(randomDelay(150, 400));
                }
              }
            }
          } catch {
            // Notification bell may not be visible
          }

          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 22. Dismiss / mark notifications as read
      // ---------------------------------------------------------------
      {
        id: 'mgr-22',
        name: 'Dismiss notifications',
        execute: async (page: Page) => {
          try {
            const panel = page.locator('.notification-panel, app-notification-panel, [class*="notification-panel"]');

            if (await panel.count() > 0 && await panel.first().isVisible()) {
              // Try to mark all as read
              if (maybe(0.5)) {
                const markAllBtn = page.locator(
                  'button:has-text("Mark all"), button:has-text("mark all read"), [data-testid="mark-all-read"]',
                );
                if (await markAllBtn.count() > 0) {
                  await markAllBtn.first().click();
                  await page.waitForTimeout(randomDelay(300, 800));
                }
              }

              // Try marking individual notifications as read
              if (maybe(0.4)) {
                const unreadItems = page.locator(
                  '.notification-item--unread, .notification-item:not(.notification-item--read)',
                );
                const unreadCount = await unreadItems.count();

                const toMark = Math.min(unreadCount, randomInt(1, 3));
                for (let i = 0; i < toMark; i++) {
                  try {
                    await unreadItems.nth(i).click();
                    await page.waitForTimeout(randomDelay(200, 500));
                  } catch {
                    break;
                  }
                }
              }

              // Close the notification panel
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(200, 500));
            } else {
              // Panel wasn't open — just close any backdrop
              await page.keyboard.press('Escape');
            }
          } catch {
            // Notification panel may already be closed
            await page.keyboard.press('Escape').catch(() => {});
          }

          await page.waitForTimeout(randomDelay(500, 1500));
        },
      },
    ],
  };
}
