/**
 * UI Spatial Landmarks Generator
 *
 * Companion to generate-ui-docs.spec.ts.
 * Navigates to each feature page, extracts visible interactive element
 * positions, and APPENDS a "Finding Controls" section to the existing
 * docs/ui-flows/*.md files.
 *
 * This lets the AI guide users spatially:
 * "The New Job button is in the top-right corner of the toolbar, look for the `add` icon"
 *
 * Run AFTER generate-ui-docs:
 *   npx playwright test --config=e2e/playwright.config.ts generate-ui-landmarks --timeout 300000
 *
 * Safe to re-run — replaces the "Finding Controls" section without touching other content.
 */

import { test, request, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';
const DOCS_DIR = path.resolve(__dirname, '../../../docs/ui-flows');

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function loginAdmin(page: Page) {
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const res = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: 'Admin123!' },
  });
  const data = await res.json();
  await apiContext.dispose();
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
    },
    { token: data.token, user: data.user },
  );
}

// ─── Landmark Extractor ───────────────────────────────────────────────────────

interface LandmarkItem {
  label: string;
  icon: string;
  yZone: string;
  xZone: string;
}

async function extractLandmarks(page: Page): Promise<LandmarkItem[]> {
  return page.evaluate(() => {
    const VW = window.innerWidth || 1920;
    const VH = window.innerHeight || 1080;

    function xZone(cx: number): string {
      if (cx < 70) return 'left sidebar';
      if (cx < 400) return 'left side of toolbar';
      if (cx > VW - 200) return 'top-right corner';
      if (cx > VW - 550) return 'right side of toolbar';
      return 'center';
    }

    function yZone(y: number, h: number): string {
      const cy = y + h / 2;
      if (cy < 44) return 'top header bar';
      if (cy < 130) return 'page toolbar (just below the header)';
      if (cy > VH - 60) return 'bottom action bar';
      if (cy < 280) return 'top of content area';
      if (cy > VH * 0.72) return 'bottom of content area';
      return 'middle of the page';
    }

    const seen = new Set<string>();
    const results: LandmarkItem[] = [];

    const els = document.querySelectorAll(
      [
        'button:not([disabled]):not([style*="display: none"])',
        'a.action-btn',
        'a.icon-btn',
        '.tab-bar .tab',
      ].join(', '),
    );

    for (const el of els) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      if (rect.top < -10 || rect.top > VH + 50) continue;

      const aria = (el as HTMLElement).getAttribute('aria-label')?.trim();
      const title = (el as HTMLElement).getAttribute('title')?.trim();
      const matIcon = el.querySelector('mat-icon, .material-icons-outlined, .material-icons');
      const iconText = matIcon?.textContent?.trim() || '';
      const rawText = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const textNoIcon = rawText.replace(iconText, '').trim();

      // Prefer aria-label > title > visible text > icon name
      let label = aria || title || textNoIcon || iconText;
      if (!label || label.length > 90 || label === iconText && iconText.length < 3) continue;

      // Skip entity ID patterns (J-1050, PO-1234, SO-5, etc.) — these are data, not controls
      if (/^[A-Z]+-\d+$/.test(label)) continue;
      // Skip pure numbers or single-char labels
      if (/^\d+$/.test(label) || label.length < 2) continue;

      // Transform i18n key patterns regardless of source (e.g. "jobs.createJob" → "Create Job")
      // Matches namespace.camelCaseKey with no spaces
      if (/^[a-z]+\.[a-zA-Z]+$/.test(label)) {
        const key = label.split('.')[1];
        label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c: string) => c.toUpperCase()).trim();
        if (iconText && !label.toLowerCase().includes(iconText.replace(/_/g, ' '))) {
          label = `${label} (${iconText})`;
        }
      }

      // Map bare Material Icon names to human-readable button descriptions
      const iconLabelMap: Record<string, string> = {
        chat_bubble_outline: 'Open Chat',
        smart_toy: 'AI Assistant',
        notifications_none: 'Notifications bell',
        dark_mode: 'Toggle dark/light theme',
        light_mode: 'Toggle dark/light theme',
        menu: 'User menu / account',
        search: 'Search',
        settings: 'Settings / Column manager',
        add: 'Add / Create new',
        edit: 'Edit',
        delete: 'Delete',
        close: 'Close / Dismiss',
        save: 'Save',
        refresh: 'Refresh',
        download: 'Download / Export',
        upload_file: 'Upload file',
        more_vert: 'More options',
        filter_list: 'Filter',
        view_column: 'Column manager (show/hide columns)',
        people: 'Swimlane / Team view',
        chevron_right: 'Expand sidebar',
        chevron_left: 'Collapse sidebar',
        help_outline: 'Help / Guided tour',
        expand_more: 'Expand',
        expand_less: 'Collapse',
        print: 'Print',
        share: 'Share',
        content_copy: 'Copy',
        sync: 'Sync',
      };
      if (iconLabelMap[label]) label = iconLabelMap[label];

      if (seen.has(label)) continue;
      seen.add(label);

      results.push({
        label,
        icon: iconText,
        yZone: yZone(rect.top, rect.height),
        xZone: xZone(rect.left + rect.width / 2),
      });
    }
    return results;
  });
}

// ─── Doc Patcher ──────────────────────────────────────────────────────────────

const SECTION_HEADER = '\n## Finding Controls\n';
const SECTION_FOOTER = '\n<!-- /finding-controls -->\n';

function formatLandmarks(items: LandmarkItem[]): string {
  // Group by yZone for readability
  const groups = new Map<string, LandmarkItem[]>();
  const zoneOrder = [
    'top header bar',
    'page toolbar (just below the header)',
    'left sidebar',
    'top of content area',
    'middle of the page',
    'bottom of content area',
    'bottom action bar',
  ];

  for (const item of items) {
    if (!groups.has(item.yZone)) groups.set(item.yZone, []);
    groups.get(item.yZone)!.push(item);
  }

  const lines: string[] = [];
  lines.push(
    'Use these landmarks when you need help locating a specific control.',
    'Positions are described relative to a standard 1920×1080 desktop layout.',
    '',
  );

  for (const zone of [...zoneOrder, ...[...groups.keys()].filter((k) => !zoneOrder.includes(k))]) {
    const zItems = groups.get(zone);
    if (!zItems || zItems.length === 0) continue;

    const zoneLabelMap: Record<string, string> = {
      'top header bar': '🔵 Top Header Bar (always visible, 44px strip at very top)',
      'page toolbar (just below the header)': '🟦 Page Toolbar (below header — search, filters, action buttons)',
      'left sidebar': '◀ Left Sidebar (navigation icons)',
      'top of content area': '📋 Top of Content Area (first rows, column headers)',
      'middle of the page': '📄 Middle of Page (main content)',
      'bottom of content area': '📄 Lower Content Area',
      'bottom action bar': '🟩 Bottom Action Bar (Save / Cancel buttons)',
    };

    lines.push(`### ${zoneLabelMap[zone] || zone}`);
    lines.push('');
    for (const item of zItems) {
      const iconHint = item.icon
        ? ` — look for the \`${item.icon}\` icon`
        : '';
      lines.push(`- **${item.label}**${iconHint} (${item.xZone})`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function patchDoc(filename: string, landmarkMarkdown: string) {
  const filepath = path.join(DOCS_DIR, filename);
  if (!existsSync(filepath)) {
    console.warn(`⚠  ${filename} not found — skipping landmark patch`);
    return;
  }

  let content = readFileSync(filepath, 'utf8');

  // Remove existing section if present
  const startIdx = content.indexOf(SECTION_HEADER);
  if (startIdx !== -1) {
    const endIdx = content.indexOf(SECTION_FOOTER, startIdx);
    content = endIdx !== -1
      ? content.slice(0, startIdx) + content.slice(endIdx + SECTION_FOOTER.length)
      : content.slice(0, startIdx);
  }

  // Append new section before the last heading (UX Analysis) or at the end
  const uxIdx = content.lastIndexOf('\n## UX Analysis');
  const insertAt = uxIdx !== -1 ? uxIdx : content.length;

  const section = `${SECTION_HEADER}\n${landmarkMarkdown}\n${SECTION_FOOTER}`;
  content = content.slice(0, insertAt) + section + content.slice(insertAt);

  writeFileSync(filepath, content, 'utf8');
  console.log(`✓ Patched ${filename} (${landmarkMarkdown.split('\n').length} landmark lines)`);
}

// ─── Page Definitions ─────────────────────────────────────────────────────────

const PAGES: Array<{ doc: string; path: string; extra?: (page: Page) => Promise<void> }> = [
  { doc: '01-dashboard.md', path: '/dashboard' },
  { doc: '02-kanban.md', path: '/kanban' },
  { doc: '03-backlog.md', path: '/backlog' },
  { doc: '04-planning.md', path: '/planning' },
  { doc: '05-parts.md', path: '/parts' },
  { doc: '06-inventory.md', path: '/inventory/stock' },
  { doc: '07-assets.md', path: '/assets' },
  { doc: '08-quality.md', path: '/quality' },
  { doc: '09-leads.md', path: '/leads' },
  { doc: '10-customers.md', path: '/customers' },
  { doc: '11-quotes.md', path: '/quotes' },
  { doc: '12-sales-orders.md', path: '/sales-orders' },
  { doc: '13-purchase-orders.md', path: '/purchase-orders' },
  { doc: '14-shipments.md', path: '/shipments' },
  { doc: '15-invoices.md', path: '/invoices' },
  { doc: '16-payments.md', path: '/payments' },
  { doc: '17-expenses.md', path: '/expenses' },
  { doc: '18-time-tracking.md', path: '/time-tracking' },
  { doc: '19-vendors.md', path: '/vendors' },
  { doc: '20-reports.md', path: '/reports' },
  { doc: '21-calendar.md', path: '/calendar' },
  { doc: '22-chat.md', path: '/chat' },
  { doc: '23-ai-assistant.md', path: '/ai' },
  { doc: '24-shop-floor.md', path: '/shop-floor' },
  { doc: '25-admin.md', path: '/admin/users' },
  { doc: '26-account-employee.md', path: '/account/profile' },
  { doc: '27-notifications.md', path: '/notifications' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

test('Patch all docs with spatial landmarks', async ({ browser }) => {
  test.setTimeout(300_000);

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);

  // Universal layout guide (no page navigation needed — it's always-true)
  const universalGuide = `## Finding Controls — Universal Layout

Every page in QB Engineer follows the same spatial layout. Use this guide first
before looking at page-specific landmarks below.

\`\`\`
┌────────────────────────────────────────────────────────────┐
│  HEADER  (44px)  Logo | Search | Notifications | User      │  ← Top of screen
├──────────────────────────────────────────────────────────  │
│ ◀ │  TOOLBAR  (filters left, action buttons RIGHT)         │  ← Below header
│   ├──────────────────────────────────────────────────────  │
│ S │  CONTENT AREA  (scrollable)                            │  ← Main area
│ I │  • Tables, Kanban board, Forms                         │
│ D │  • Tab bar (if present) just below toolbar             │
│ E │                                                        │
│ B │                                                        │
│ A ├──────────────────────────────────────────────────────  │
│ R │  ACTION BAR  (Save / Cancel — bottom-right)            │  ← Bottom of screen
└───┴────────────────────────────────────────────────────────┘
\`\`\`

### Key Patterns (true everywhere)

| What you want | Where to look |
|:--------------|:--------------|
| Create something new ("New Job", "New Part", etc.) | **Top-right corner** of the page toolbar — blue primary button with a \`add\` plus icon |
| Search / filter the list | **Top-left of toolbar** — the search box or filter dropdowns |
| Change which columns are visible | **Gear icon** (\`settings\`) at the far right of the table header row |
| Sort a column | **Click the column header** — arrow appears; Shift+click to multi-sort |
| Filter a specific column | **Right-click the column header** → Filter, or click the funnel icon in the column header |
| Open a record's details | **Click anywhere on the row** — slides open a detail panel on the right |
| Navigate to a different feature | **Left sidebar** — hover to expand labels; click the icon or label |
| Go back to dashboard | **"QB" logo** in the top-left of the header, or click Dashboard in the sidebar |
| Open notifications | **Bell icon** (\`notifications\`) in the top-right header — badge shows unread count |
| Switch theme (light/dark) | **Moon/sun icon** in the top-right header area |
| Access your profile/account | **Your avatar** (initials circle) in the top-right header |
| Close a dialog | **X button** in the top-right corner of the dialog, or press **Escape** |
| Save a form | **Primary (blue) button** in the **bottom-right** of the dialog |
| Cancel without saving | **"Cancel" button** to the left of the Save button (bottom-right area) |
| Column header sort menu | **Right-click** on any column header for sort, filter, hide, reset options |
`;

  // Write the universal guide to the shell doc
  patchDoc('00-app-shell.md', universalGuide);

  for (const { doc, path: routePath, extra } of PAGES) {
    try {
      await page.goto(`${BASE_URL}${routePath}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      if (extra) await extra(page);

      const landmarks = await extractLandmarks(page);
      if (landmarks.length === 0) {
        console.warn(`  ⚠  No landmarks found for ${doc}`);
        continue;
      }

      const markdown = formatLandmarks(landmarks);
      patchDoc(doc, markdown);
    } catch (err) {
      console.warn(`  ✗ Failed to extract landmarks for ${doc}: ${err}`);
    }
  }

  await context.close();
});

// ─── Dialog Landmarks ─────────────────────────────────────────────────────────

/**
 * Opens key dialogs, extracts their landmark data, and writes a
 * dedicated "Dialog Controls" doc for AI spatial guidance within dialogs.
 */
test('Extract dialog spatial landmarks', async ({ browser }) => {
  test.setTimeout(120_000);

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);

  const dialogGuide: string[] = [
    '# Dialog Controls — Spatial Guide',
    '',
    'All dialogs in QB Engineer share the same layout structure.',
    '',
    '## Universal Dialog Layout',
    '',
    '```',
    '┌─────────────────────────────────────┐',
    '│  Dialog Title              [X Close] │  ← Top of dialog',
    '├─────────────────────────────────────┤',
    '│  Form fields (scroll if tall)        │  ← Body',
    '│  ┌──────────┐  ┌──────────┐          │',
    '│  │ Field 1  │  │ Field 2  │          │  ← 2-column rows',
    '│  └──────────┘  └──────────┘          │',
    '│  ┌────────────────────────┐          │',
    '│  │ Full-width field       │          │',
    '│  └────────────────────────┘          │',
    '├─────────────────────────────────────┤',
    '│              [Cancel]  [Save/Create] │  ← Footer (right-aligned)',
    '└─────────────────────────────────────┘',
    '```',
    '',
    '## Finding Controls Inside Dialogs',
    '',
    '| What you want | Where to look |',
    '|:--------------|:--------------|',
    '| Close the dialog | **X button** in the top-right corner of the dialog header |',
    '| Save/Create | **Blue primary button** in the bottom-right corner of the dialog |',
    '| Cancel | Button to the **left** of the primary button, bottom-right area |',
    '| Scroll through fields | The dialog body scrolls — **scroll down** if you cannot see all fields |',
    '| Select a date | Click the **calendar icon** on the right side of a date field |',
    '| Select from a dropdown | Click the **chevron/arrow** on the right side of a select field |',
    '| Upload a file | Look for a **dashed upload zone** or the `upload_file` icon |',
    '| Validation errors | **Hover over the disabled Save button** — a popover shows what fields are missing |',
    '',
    '## Key Dialog Variants',
    '',
    '### Confirm / Destructive Action Dialog',
    '- Smaller dialog (~400px wide)',
    '- Shows a warning message in the body',
    '- Confirm button is **red** for destructive actions (Delete, Archive)',
    '- Located: center of screen, overlays the page',
    '',
    '### Form Dialogs (Create/Edit)',
    '- Wider dialogs (520–800px)',
    '- Two-column layout for short fields, full-width for long fields',
    '- Required fields are marked with `*` in the label',
    '',
    '### File Upload Dialogs',
    '- Drop zone in the center of the dialog body',
    '- "Click to browse" text — clicking opens the OS file picker',
    '- After upload: file list appears below the drop zone',
    '',
  ];

  const dialogTests: Array<{ route: string; triggerText: string; name: string }> = [
    { route: '/kanban', triggerText: 'New Job', name: 'New Job Dialog' },
    { route: '/parts', triggerText: 'New Part', name: 'New Part Dialog' },
    { route: '/leads', triggerText: 'New Lead', name: 'New Lead Dialog' },
    { route: '/expenses', triggerText: 'New Expense', name: 'New Expense Dialog' },
    { route: '/vendors', triggerText: 'New Vendor', name: 'New Vendor Dialog' },
  ];

  for (const { route, triggerText, name } of dialogTests) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const btn = page.locator('button').filter({ hasText: triggerText }).first();
      if (!(await btn.isVisible().catch(() => false))) continue;

      await btn.click();
      await page.waitForTimeout(800);

      const landmarks = await extractLandmarks(page);
      const dialogLandmarks = landmarks.filter(
        (l) => !['Close', 'close'].includes(l.label),
      );

      if (dialogLandmarks.length > 0) {
        dialogGuide.push(`### ${name}`);
        dialogGuide.push('');
        dialogGuide.push(`_Opened from: \`${route}\` → "${triggerText}" button_`);
        dialogGuide.push('');
        for (const lm of dialogLandmarks) {
          const iconHint = lm.icon ? ` (\`${lm.icon}\` icon)` : '';
          dialogGuide.push(`- **${lm.label}**${iconHint} — ${lm.yZone}, ${lm.xZone}`);
        }
        dialogGuide.push('');
      }

      // Close dialog
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } catch (err) {
      console.warn(`  ✗ Failed dialog extraction for ${name}: ${err}`);
    }
  }

  const filepath = path.join(DOCS_DIR, 'dialogs-spatial-guide.md');
  writeFileSync(filepath, dialogGuide.join('\n'), 'utf8');
  console.log(`✓ Wrote dialogs-spatial-guide.md`);

  await context.close();
});
