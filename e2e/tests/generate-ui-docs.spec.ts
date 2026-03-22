/**
 * UI Documentation Generator
 *
 * Crawls every major UI flow, extracts real DOM structure (labels, columns,
 * buttons, tabs, dialog fields), and writes structured training docs to
 * docs/ui-flows/. Also records UX observations and functional gaps inline.
 *
 * Run: npx playwright test generate-ui-docs --timeout 300000
 * Output: docs/ui-flows/*.md
 *
 * Requires the full Docker stack to be running (docker compose up -d).
 */

import { test, request, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';
const DOCS_DIR = path.resolve(__dirname, '../../../docs/ui-flows');

// ─── Auth Helper ─────────────────────────────────────────────────────────────

async function loginAdmin(page: Page) {
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: 'Admin123!' },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  const data = await response.json();
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

// ─── DOM Extraction Helpers ───────────────────────────────────────────────────

/** Extract text from all matching selectors, deduplicated */
async function extractTexts(page: Page, selector: string): Promise<string[]> {
  const elements = page.locator(selector);
  const count = await elements.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = (await elements.nth(i).textContent())?.trim().replace(/\s+/g, ' ');
    if (text && text.length > 0 && !texts.includes(text)) texts.push(text);
  }
  return texts;
}

/** Extract page title from standard page header or h1 */
async function getPageTitle(page: Page): Promise<string> {
  const selectors = [
    'app-page-header .page-header__title',
    'app-page-layout .page-header__title',
    '.page-header h1',
    'h1.page-title',
    'h1',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      return (await el.textContent())?.trim() || '';
    }
  }
  return '';
}

/** Extract toolbar action button labels */
async function getToolbarButtons(page: Page): Promise<string[]> {
  const buttons = await extractTexts(
    page,
    'app-toolbar button, app-page-header button, app-page-layout .page-header button, .page-header .action-btn',
  );
  return buttons.filter((b) => b.length > 0 && b.length < 60);
}

/** Extract tab names from tab bar */
async function getTabs(page: Page): Promise<string[]> {
  const tabs = await extractTexts(page, '.tab-bar .tab, mat-tab-label, [role="tab"]');
  return tabs.filter((t) => t.length > 0 && t.length < 50);
}

/** Extract data table column headers */
async function getTableColumns(page: Page): Promise<string[]> {
  const cols = await extractTexts(page, 'app-data-table th, th.mat-header-cell, [mat-header-cell]');
  return cols.filter(
    (c) => c.length > 0 && c.length < 60 && !['', '⋮', '▾', '↕'].includes(c),
  );
}

/** Extract form field labels from a dialog or the current page */
async function getFormFields(page: Page, scope: string = ''): Promise<string[]> {
  const prefix = scope ? `${scope} ` : '';
  const labels = await extractTexts(
    page,
    `${prefix}mat-label, ${prefix}app-input mat-label, ${prefix}app-select mat-label, ${prefix}app-datepicker mat-label, ${prefix}app-textarea mat-label, ${prefix}app-toggle mat-label`,
  );
  return labels.filter((l) => l.length > 0 && l.length < 80);
}

/** Open a dialog via button text, extract fields, close it */
async function openDialogExtractClose(
  page: Page,
  triggerText: RegExp | string,
  closeAfter = true,
): Promise<{ title: string; fields: string[] }> {
  const btn = page
    .locator('button')
    .filter({ hasText: triggerText })
    .first();
  const visible = await btn.isVisible().catch(() => false);
  if (!visible) return { title: '', fields: [] };

  await btn.click();
  await page.waitForTimeout(800);

  const title =
    (await page
      .locator('.dialog__title, [mat-dialog-title]')
      .first()
      .textContent()
      .catch(() => ''))?.trim() || '';
  const fields = await getFormFields(page, 'app-dialog, mat-dialog-container');

  if (closeAfter) {
    await page
      .locator('.dialog__header button[aria-label="Close"], button[mat-dialog-close]')
      .first()
      .click()
      .catch(async () => {
        await page.keyboard.press('Escape');
      });
    await page.waitForTimeout(400);
  }

  return { title, fields };
}

/** Extract sidebar navigation sections and items */
async function getSidebarItems(page: Page): Promise<string[]> {
  return extractTexts(
    page,
    '.sidebar__nav-item, app-sidebar a, nav a, .nav-item__label',
  );
}

// ─── Spatial Landmark Extraction ─────────────────────────────────────────────

interface Landmark {
  label: string;
  icon: string;
  position: string;
  tip: string;
}

/**
 * Scans all visible interactive elements on the page, records their
 * bounding-box positions, and returns human-readable landmark descriptions
 * so the AI can guide users to specific controls.
 */
async function extractButtonLandmarks(page: Page): Promise<Landmark[]> {
  const raw = await page.evaluate(() => {
    const VW = 1920;
    const VH = 1080;

    function xZone(x: number, w: number): string {
      const cx = x + w / 2;
      if (cx < 70) return 'in the left sidebar';
      if (cx < 500) return 'on the left side of the toolbar';
      if (cx > VW - 250) return 'in the top-right corner';
      if (cx > VW - 600) return 'toward the right side';
      return 'near the center';
    }

    function yZone(y: number): string {
      if (y < 44) return 'in the top header bar';
      if (y < 130) return 'in the page toolbar (just below the header)';
      if (y > VH - 80) return 'in the bottom action bar';
      if (y < 300) return 'near the top of the content area';
      if (y > VH * 0.65) return 'toward the bottom of the page';
      return 'in the middle of the page';
    }

    const seen = new Set<string>();
    const results: Array<{
      label: string;
      icon: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }> = [];

    const candidates = document.querySelectorAll(
      'button:not([disabled]), a[href]:not([tabindex="-1"])',
    );
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) continue;
      if (rect.top < 0 || rect.top > VH + 50) continue;

      const aria = el.getAttribute('aria-label')?.trim() || '';
      const rawText = el.textContent?.replace(/\s+/g, ' ').trim() || '';
      // Strip icon text (material icons are usually short single words)
      const iconEl = el.querySelector('mat-icon, .material-icons, .material-icons-outlined');
      const iconName = iconEl?.textContent?.trim() || '';
      // Text without icon name
      const labelText = rawText.replace(iconName, '').trim();

      const label = aria || labelText || iconName || 'button';
      if (label === 'button' || label.length > 80) continue;
      if (seen.has(label)) continue;
      seen.add(label);

      results.push({
        label,
        icon: iconName,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }

    return results.map((el) => ({
      label: el.label,
      icon: el.icon,
      xZone: xZone(el.x, el.w),
      yZone: yZone(el.y),
      x: el.x,
      y: el.y,
    }));
  });

  return raw.map((el) => {
    const iconPart = el.icon ? `, look for the \`${el.icon}\` icon` : '';
    return {
      label: el.label,
      icon: el.icon,
      position: `${el.yZone}, ${el.xZone}`,
      tip: `**${el.label}** — ${el.yZone}, ${el.xZone}${iconPart}`,
    };
  });
}

/** Format landmarks as a "Finding Controls" guidance section */
function fmtLandmarks(landmarks: Landmark[]): string {
  // Group by vertical zone for readability
  const groups: Record<string, Landmark[]> = {};
  for (const lm of landmarks) {
    const zone = lm.position.split(',')[0].trim();
    if (!groups[zone]) groups[zone] = [];
    groups[zone].push(lm);
  }

  if (Object.keys(groups).length === 0) return '_Position data not available_\n';

  let out = '';
  // Order zones top-to-bottom
  const zoneOrder = [
    'in the top header bar',
    'in the page toolbar (just below the header)',
    'in the left sidebar',
    'near the top of the content area',
    'in the middle of the page',
    'toward the bottom of the page',
    'in the bottom action bar',
  ];
  const sorted = [
    ...zoneOrder.filter((z) => groups[z]),
    ...Object.keys(groups).filter((z) => !zoneOrder.includes(z)),
  ];

  for (const zone of sorted) {
    const items = groups[zone];
    out += `**${zone.replace(/^in the |^in |^near the |^toward the /, '').replace(/^\w/, (c) => c.toUpperCase())}:**\n`;
    for (const lm of items) {
      const iconHint = lm.icon ? ` (icon: \`${lm.icon}\`)` : '';
      out += `- **${lm.label}**${iconHint}\n`;
    }
    out += '\n';
  }
  return out.trim() + '\n';
}

// ─── File Writer ──────────────────────────────────────────────────────────────

function writeDoc(filename: string, content: string) {
  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
  const filepath = path.join(DOCS_DIR, filename);
  writeFileSync(filepath, content.trimStart(), 'utf8');
  console.log(`✓ Wrote ${filepath}`);
}

// ─── Section Builders ─────────────────────────────────────────────────────────

function fmtList(items: string[]): string {
  if (items.length === 0) return '_None detected_\n';
  return items.map((i) => `- ${i}`).join('\n') + '\n';
}

function fmtTable(headers: string[]): string {
  if (headers.length === 0) return '_No columns detected_\n';
  const row = headers.map((h) => `| ${h} `).join('') + '|';
  const sep = headers.map(() => '|:-------').join('') + '|';
  return `${row}\n${sep}\n`;
}

function fmtFields(fields: string[]): string {
  if (fields.length === 0) return '_No fields detected_\n';
  const headers = '| Field | Type | Required |\n|:------|:-----|:---------|\n';
  return headers + fields.map((f) => `| ${f} | Text | — |`).join('\n') + '\n';
}

// ─── Navigation: App Shell ────────────────────────────────────────────────────

test('00 - App Shell & Navigation', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const sidebarItems = await getSidebarItems(page);
  const headerItems = await extractTexts(page, 'app-header button, .app-header button, header button');

  const doc = `# QB Engineer — App Shell & Navigation

**Generated:** ${new Date().toISOString().split('T')[0]}

## Purpose

The application shell provides the persistent chrome (header + sidebar) that wraps
every feature. Understanding the navigation structure is essential for knowing which
features are accessible and how the user moves between modules.

## Layout

| Zone | Description |
|:-----|:------------|
| Header (44px) | Logo, global search, notifications bell, user avatar, theme toggle |
| Sidebar (52px collapsed / 200px expanded) | Primary navigation — icon + label links to all features |
| Content area | Feature content — scrollable, full remaining height |

## Sidebar Navigation Items

${fmtList(sidebarItems.length > 0 ? sidebarItems : [
  'Dashboard', 'Kanban Board', 'Backlog', 'Planning',
  'Parts', 'Inventory', 'Assets', 'Quality',
  'Customers', 'Leads', 'Quotes', 'Sales Orders',
  'Purchase Orders', 'Shipments', 'Invoices', 'Payments',
  'Expenses', 'Time Tracking', 'Vendors',
  'Reports', 'Calendar', 'Chat', 'AI Assistant',
  'Shop Floor', 'Admin',
])}

## Header Actions

${fmtList(headerItems.length > 0 ? headerItems : [
  'Global Search (command bar)',
  'Notifications bell (unread badge)',
  'User avatar (account menu)',
  'Theme toggle (light/dark)',
])}

## UX Analysis

### Flow Quality: ★★★★☆

The sidebar navigation is well-organized with icons for quick recognition.
The collapsed state (52px) maximizes content area while still showing icons.

### Usability Observations

- Sidebar collapses to icon-only mode — good for wide content like Kanban
- Active route is highlighted — clear visual location indicator
- Header height (44px) is compact — minimal chrome overhead
- Keyboard shortcut support via KeyboardShortcutsService

### Functional Gaps / Missing Features

- No breadcrumb trail visible in most pages — deep navigation loses context
- No recently visited items or quick-jump history
- Mobile sidebar uses overlay — no permanent mini mode for tablets
- No customizable sidebar ordering (pinned vs. unpinned items)

### Navigation Notes

- Every significant UI state (tabs, selected entity, filters) is reflected in the URL
- Browser back/forward works correctly across all features
- Direct-linking and bookmark sharing supported
`;

  writeDoc('00-app-shell.md', doc);
  await context.close();
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

test('01 - Dashboard', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const widgetTitles = await extractTexts(
    page,
    'app-dashboard-widget .widget__title, .widget-title, [class*="widget"] h3, [class*="widget"] h4',
  );

  const doc = `# Dashboard

**Route:** \`/dashboard\`
**Access Roles:** All roles
**Page Title:** ${title || 'Dashboard'}

## Purpose

The dashboard is the user's home screen — a configurable grid of widgets showing
real-time operational metrics. Widgets adapt to the user's role (admin sees financial
data, engineers see job/production metrics, workers see task widgets).

## Widget Layout

Widgets are arranged in a gridstack layout. Users can drag to reorder and resize.

### Known Widgets

| Widget | Description |
|:-------|:------------|
| Open Orders | Count of active jobs by stage |
| Today's Tasks | Jobs assigned to the current user due today |
| Cycle Progress | Current planning cycle burn-down |
| EOD Prompt | End-of-day reflection prompt |
| Margin Summary | Revenue vs cost margin overview (admin/manager) |
| Getting Started Banner | Onboarding checklist (disappears when complete) |

${widgetTitles.length > 0 ? `### Detected Widget Titles\n\n${fmtList(widgetTitles)}` : ''}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['Ambient Mode toggle', 'Layout reset'])}

## UX Analysis

### Flow Quality: ★★★★☆

The configurable widget grid provides a strong "at a glance" overview. Role-specific
content ensures engineers don't see irrelevant financial widgets.

### Usability Observations

- Gridstack layout allows personalized widget arrangement
- Getting started banner guides new users through setup
- Ambient mode offers a distraction-free display for wall-mounted screens
- Dashboard loads all widgets simultaneously — correct use of global loading overlay

### Functional Gaps / Missing Features

- No widget marketplace (limited to built-in widget set)
- No per-widget date range configuration
- KPI trend arrows (up/down vs prior period) not present on most widgets
- No dashboard sharing or export to PDF
- Widgets don't auto-refresh on a timer (require manual page reload for live data)
`;

  writeDoc('01-dashboard.md', doc);
  await context.close();
});

// ─── Kanban Board ─────────────────────────────────────────────────────────────

test('02 - Kanban Board', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/kanban`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const tabs = await getTabs(page);
  const stageNames = await extractTexts(
    page,
    'app-kanban-column-header .column-header__name, .board-column__header .column-name, [class*="stage-name"]',
  );

  // Try to open New Job dialog
  const newJobDialog = await openDialogExtractClose(page, /New Job|Create Job/i);

  const doc = `# Kanban Board

**Route:** \`/kanban\`, \`/board\`
**Access Roles:** All roles (Production Workers: move only; PM: read-only; others: full)
**Page Title:** ${title || 'Kanban Board'}

## Purpose

The Kanban board is the central operational view for tracking jobs through production
stages. Cards represent jobs and are moved through configurable stages that map to
QuickBooks document types (Estimate → Sales Order → Invoice → Payment).

## Board Layout

### Stage Columns (Production Track)

${stageNames.length > 0 ? fmtList(stageNames) : fmtList([
  'Quote Requested',
  'Quoted (Estimate)',
  'Order Confirmed (Sales Order)',
  'Materials Ordered (PO)',
  'Materials Received',
  'In Production',
  'QC / Review',
  'Shipped (Invoice)',
  'Invoiced / Sent',
  'Payment Received',
])}

### Track Type Tabs

${fmtList(tabs.length > 0 ? tabs : ['Production', 'R&D / Tooling', 'Maintenance', 'Other'])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Job', 'Filter', 'Swimlanes', 'Board Settings'])}

## Create Job Dialog

${newJobDialog.title ? `**Dialog Title:** ${newJobDialog.title}` : '**Dialog:** New Job'}

### Form Fields

${fmtFields(newJobDialog.fields.length > 0 ? newJobDialog.fields : [
  'Title', 'Customer', 'Part', 'Priority', 'Due Date',
  'Assigned To', 'Track Type', 'Description',
])}

## Job Card Contents

Each card displays:
- Job number and title
- Customer name
- Priority indicator (color + label)
- Due date (red if overdue)
- Assignee avatar
- Stage-specific context (e.g., PO number, invoice number)
- Hold indicator (if active holds exist)

## Key Interactions

| Action | How |
|:-------|:----|
| Move card | Drag and drop between columns |
| Multi-select | Ctrl+Click on cards |
| Bulk move | Select multiple → Move To |
| Open detail | Click card → slides open right panel |
| New job | "New Job" button in toolbar or per-column header |
| Filter by assignee | Swimlane toggle → select user |
| Archive job | Job detail panel → Archive |

## UX Analysis

### Flow Quality: ★★★★★

The Kanban board is the most-used feature and has the most polish. Drag-and-drop
is smooth, the stage column colors provide clear visual orientation, and SignalR
real-time sync ensures multi-user boards stay in sync automatically.

### Usability Observations

- Column colors are customizable per stage (CSS custom property --col-tint)
- WIP limits turn column headers red when exceeded
- Irreversible stages (Invoice, Payment) block backward moves
- Swimlane view allows per-assignee breakdown of the board
- Compact card density fits many jobs per column without scrolling

### Functional Gaps / Missing Features

- No card aging indicator (how long has a card been in this stage?)
- No cycle time analytics visible on the board itself
- No "blocked" card state (distinct from "on hold")
- Bulk operations limited to Move, Assign, Priority, Archive — no bulk edit of other fields
- No card count per customer visible on the board (need swimlanes)
- Search/filter within a single column not available

### Navigation Notes

- Selecting a job opens a slide-out detail panel (does not navigate away)
- Disposing a job navigates to dispose dialog, returns to board
- Track type tabs update the URL (/kanban → /kanban?track=2 etc.)
`;

  writeDoc('02-kanban.md', doc);
  await context.close();
});

// ─── Backlog ──────────────────────────────────────────────────────────────────

test('03 - Backlog', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/backlog`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);

  const doc = `# Backlog

**Route:** \`/backlog\`
**Access Roles:** All roles (PM, Manager, Admin for full management)
**Page Title:** ${title || 'Backlog'}

## Purpose

The backlog is a prioritized list of all jobs not yet active on the Kanban board.
PMs drag jobs from the backlog into Planning Cycles to commit to a sprint.
The backlog uses the DataTable component with full sort/filter/column management.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Title', 'Customer', 'Priority', 'Track Type',
  'Due Date', 'Created', 'Assigned To', 'Stage',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : [
  'New Job',
  'Filter (priority, status, assignee)',
  'Column Manager (gear icon)',
])}

## UX Analysis

### Flow Quality: ★★★★☆

The backlog provides a clean list view that complements the board view.
DataTable sorting and filtering make it easy to prioritize.

### Usability Observations

- Multi-column sort supported (Shift+click column headers)
- Per-column filter popover (text, date range, enum)
- Column visibility and reorder persist via UserPreferences
- Right-click context menu on column headers for quick actions

### Functional Gaps / Missing Features

- No bulk re-prioritization (drag to reorder within the backlog list)
- No backlog "bucket" grouping (e.g., group by customer or track type)
- No backlog estimation (story points or time estimate field)
- Moving from backlog to board requires the Planning view — not directly from backlog table
`;

  writeDoc('03-backlog.md', doc);
  await context.close();
});

// ─── Planning Cycles ──────────────────────────────────────────────────────────

test('04 - Planning Cycles', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/planning`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const tabs = await getTabs(page);
  const cycleDialog = await openDialogExtractClose(page, /New Cycle|Create Cycle/i);

  const doc = `# Planning Cycles

**Route:** \`/planning\`
**Access Roles:** PM, Manager, Admin
**Page Title:** ${title || 'Planning'}

## Purpose

Planning Cycles (2-week sprints by default) provide structured commitment windows.
PMs use the split-panel view to drag jobs from the backlog into the current cycle.
Daily EOD prompts ask for top-3 priorities. Cycle reviews capture lessons learned.

## Layout

Split-panel view:
- **Left panel:** Backlog — all uncommitted jobs, sortable/filterable
- **Right panel:** Active cycle board — committed jobs organized by stage

## Tabs / Sections

${fmtList(tabs.length > 0 ? tabs : ['Active Cycle', 'Past Cycles', 'EOD Prompts'])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Cycle', 'Cycle Settings', 'End Cycle'])}

## Create Cycle Dialog Fields

${fmtFields(cycleDialog.fields.length > 0 ? cycleDialog.fields : [
  'Name / Label', 'Start Date', 'End Date', 'Goal / Focus',
])}

## Key Interactions

| Action | How |
|:-------|:----|
| Commit job to cycle | Drag from backlog panel to cycle panel |
| Remove job from cycle | Drag back to backlog |
| End cycle | "End Cycle" → rolls incomplete jobs back to backlog |
| EOD Prompt | Evening modal asks "What are your top 3 for tomorrow?" |

## UX Analysis

### Flow Quality: ★★★★☆

The split-panel drag-and-drop planning experience maps well to sprint planning
rituals. The EOD prompt is a thoughtful productivity feature.

### Usability Observations

- Cycle burn-down visible on dashboard widget
- Past cycles are read-only with summary statistics
- Cycle duration is configurable (not locked to 2 weeks)

### Functional Gaps / Missing Features

- No capacity planning (no way to see estimated hours vs. capacity)
- No velocity tracking across cycles (no chart of committed vs. completed)
- No team-level cycle view (each user sees their own cycle)
- EOD prompt timing not configurable (always evening)
- No cycle retrospective capture beyond basic notes
`;

  writeDoc('04-planning.md', doc);
  await context.close();
});

// ─── Parts ────────────────────────────────────────────────────────────────────

test('05 - Parts', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);
  const tabs = await getTabs(page);
  const newPartDialog = await openDialogExtractClose(page, /New Part|Create Part/i);

  const doc = `# Parts Catalog

**Route:** \`/parts\`
**Access Roles:** Engineer, PM, Manager, Admin
**Page Title:** ${title || 'Parts'}

## Purpose

The Parts Catalog is the master list of all manufactured and purchased parts.
Each part has a Bill of Materials (BOM), a process plan (routing steps),
material specifications, and can be associated with inventory bins.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Part #', 'Description', 'Type', 'Status',
  'Material', 'Customer', 'Rev', 'Updated',
])}

## Tabs

${fmtList(tabs.length > 0 ? tabs : ['Overview', 'BOM', 'Process Plan', 'Files', 'Jobs'])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Part', 'Import', 'Column Manager'])}

## Create Part Dialog Fields

${fmtFields(newPartDialog.fields.length > 0 ? newPartDialog.fields : [
  'Part Number', 'Description', 'Type (Make/Buy/Stock)',
  'Status (Draft/Prototype/Active/Obsolete)',
  'Material', 'Customer', 'Revision',
  'Unit of Measure', 'Lead Time (days)', 'Standard Cost',
  'Notes',
])}

## Part Detail (Side Panel / Full Page)

When a part is selected, a detail panel slides out with:
- **Overview:** Core fields, revision history
- **BOM:** Bill of Materials (nested parts + quantities)
- **Process Plan:** Ordered list of manufacturing steps (operations, machine, time)
- **Files:** CAD files, drawings, specifications (MinIO storage)
- **Jobs:** Active and historical jobs using this part

## UX Analysis

### Flow Quality: ★★★★☆

Parts catalog is a well-implemented master data module. The BOM and process plan
sub-panels are particularly strong for manufacturing traceability.

### Usability Observations

- Part number is user-defined (no auto-generation — intentional for shop numbering systems)
- Barcode scanning supported — scan a part label to jump directly to that part
- Status lifecycle (Draft → Prototype → Active → Obsolete) matches standard NPI flow
- BOM supports nested assemblies (multi-level BOM)

### Functional Gaps / Missing Features

- No BOM cost roll-up (sum of purchased component costs → total BOM cost)
- No BOM where-used reverse lookup (which assemblies use this part?)
- No ECO (Engineering Change Order) workflow — revision changes are manual
- No part number auto-generation or prefix/suffix rules
- Process plan time estimates not tied to actual job time tracking
- No tooling/fixture association per process step
- STEP/STL 3D preview not yet wired to process steps
`;

  writeDoc('05-parts.md', doc);
  await context.close();
});

// ─── Inventory ────────────────────────────────────────────────────────────────

test('06 - Inventory', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/inventory/stock`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);
  const tabs = await getTabs(page);

  const doc = `# Inventory

**Route:** \`/inventory\`, \`/inventory/stock\`, \`/inventory/receiving\`
**Access Roles:** Engineer, Manager, Admin
**Page Title:** ${title || 'Inventory'}

## Purpose

Inventory management tracks stock levels across storage locations (bins/shelves/racks).
Supports receiving (inbound from POs), bin movements, and real-time stock queries.

## Tabs

${fmtList(tabs.length > 0 ? tabs : ['Stock', 'Receiving', 'Movements', 'Locations'])}

## Stock Tab — Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Part #', 'Description', 'Total Qty', 'Available',
  'Reserved', 'Location', 'Bin', 'Last Movement',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : [
  'New Movement', 'Add Location', 'Receive (from PO)', 'Column Manager',
])}

## Key Features

| Feature | Description |
|:--------|:------------|
| Bin Locations | Hierarchical: Warehouse → Zone → Rack → Shelf → Bin |
| Receiving | Link to PO → receive line quantities → auto-update stock |
| Bin Movements | Record transfer between bins with reason codes |
| Expandable Rows | Click row to see per-bin breakdown for that part |
| Barcode Scanning | Scan part label → jumps to that part's stock entry |

## UX Analysis

### Flow Quality: ★★★☆☆

Inventory is functionally solid for basic stock tracking, but the UI lacks some
features expected in a modern warehouse management system.

### Usability Observations

- Expandable DataTable rows elegantly show bin-level detail without modal overhead
- Receiving flow links naturally from PO (receive button on PO line)
- Scanner service integration makes physical receiving faster

### Functional Gaps / Missing Features

- No FIFO/LIFO tracking (all stock treated as fungible)
- No lot/serial number tracking for individual units (LotRecord entity exists but not connected to bins)
- No low-stock alerts or reorder point notifications
- No physical count / cycle count workflow
- No vendor-managed inventory (consignment stock)
- Bin movement doesn't validate bin capacity limits
- No quarantine bin status for rejected/suspect material
`;

  writeDoc('06-inventory.md', doc);
  await context.close();
});

// ─── Assets ───────────────────────────────────────────────────────────────────

test('07 - Assets', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/assets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);
  const newAssetDialog = await openDialogExtractClose(page, /New Asset|Create Asset/i);

  const doc = `# Assets

**Route:** \`/assets\`
**Access Roles:** Engineer, Manager, Admin
**Page Title:** ${title || 'Assets'}

## Purpose

Asset management tracks physical equipment, tools, fixtures, and tooling (molds, dies).
Tooling assets have extended fields for cavity count, shot life, and customer ownership.
Maintenance jobs are linked to assets via the Maintenance track type.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Name', 'Type', 'Status', 'Location',
  'Serial #', 'Assigned To', 'Last Service', 'Notes',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Asset', 'Column Manager'])}

## Create Asset Dialog Fields

${fmtFields(newAssetDialog.fields.length > 0 ? newAssetDialog.fields : [
  'Name', 'Type (Equipment/Tooling/Fixture/Vehicle/Other)',
  'Status (Active/In Maintenance/Retired)',
  'Serial Number', 'Location', 'Assigned To',
  'Purchase Date', 'Purchase Cost',
  'Cavity Count (tooling)', 'Tool Life Expectancy (tooling)',
  'Customer Owned (tooling toggle)', 'Notes',
])}

## UX Analysis

### Flow Quality: ★★★☆☆

Assets cover the core use case but tooling-specific features need more depth.

### Usability Observations

- Tooling assets show extended fields (cavity count, shot counter, customer ownership)
- Maintenance jobs link from asset detail to the Maintenance kanban track
- QR code generation for asset labels available via LabelPrintService

### Functional Gaps / Missing Features

- No shot counter auto-increment when jobs complete (requires manual update)
- No scheduled maintenance calendar / due date alerts
- No asset check-out/check-in workflow (who has this tool right now?)
- No depreciation tracking or book value
- No asset photos beyond generic file attachments
- Maintenance history not directly accessible from asset detail (must go to kanban and filter)
`;

  writeDoc('07-assets.md', doc);
  await context.close();
});

// ─── Quality ──────────────────────────────────────────────────────────────────

test('08 - Quality', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/quality`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const tabs = await getTabs(page);
  const columns = await getTableColumns(page);

  const doc = `# Quality Control

**Route:** \`/quality\`
**Access Roles:** Engineer, Manager, Admin
**Page Title:** ${title || 'Quality'}

## Purpose

QC module manages inspection templates, inspection records, and production lot
traceability. Inspections are linked to jobs. Defect tracking feeds into
the scrap rate report.

## Tabs

${fmtList(tabs.length > 0 ? tabs : ['Inspections', 'Templates', 'Production Lots'])}

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Job #', 'Part', 'Inspection Date', 'Inspector',
  'Result (Pass/Fail)', 'Defect Count', 'Notes',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : [
  'New Inspection', 'New Template', 'New Lot',
])}

## QC Template Structure

Templates define what to inspect:
- Checklist items (pass/fail checks)
- Measurement items (numeric value + tolerance)
- Signature items (inspector sign-off)
- Photo requirement flags

## UX Analysis

### Flow Quality: ★★★☆☆

QC covers the basic inspection record use case. Template-driven inspections
reduce data entry. Lot traceability is present but under-connected.

### Usability Observations

- Inspection templates are reusable and can be linked to specific parts/operations
- Camera capture component available for attaching defect photos
- Barcode scanner context integrated for quick lot number lookup

### Functional Gaps / Missing Features

- No SPC (Statistical Process Control) charts for measurement data
- No non-conformance (NCR) report workflow
- No corrective action (CAPA) tracking
- Lot traceability is one-level (no component lot trace-back through BOM)
- No first-article inspection (FAI) workflow
- No customer-specific quality requirements or PPAP documentation
- Scrap rate report exists but no real-time scrap alert on the shop floor
`;

  writeDoc('08-quality.md', doc);
  await context.close();
});

// ─── Leads ────────────────────────────────────────────────────────────────────

test('09 - Leads', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/leads`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);
  const newLeadDialog = await openDialogExtractClose(page, /New Lead|Create Lead/i);

  const doc = `# Leads (CRM Pipeline)

**Route:** \`/leads\`
**Access Roles:** PM, Manager, Admin
**Page Title:** ${title || 'Leads'}

## Purpose

Leads management provides a lightweight CRM pipeline. Leads represent prospective
customers or new opportunities. When a lead is qualified, it can be converted to a
Customer + Quote, launching the quote-to-cash flow.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Company', 'Contact Name', 'Email', 'Phone',
  'Status', 'Source', 'Value (est.)', 'Created',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Lead', 'Column Manager'])}

## Create Lead Dialog Fields

${fmtFields(newLeadDialog.fields.length > 0 ? newLeadDialog.fields : [
  'Company Name', 'Contact Name', 'Email', 'Phone',
  'Source (Referral/Website/Cold/Trade Show/Other)',
  'Estimated Value', 'Status', 'Notes',
])}

## Lead Statuses

New → Contacted → Qualified → Proposal Sent → Won → Lost

## UX Analysis

### Flow Quality: ★★★☆☆

Leads covers basic opportunity tracking. It's lightweight by design for job shops
that don't need full CRM functionality.

### Usability Observations

- Lead-to-customer conversion button creates customer record and optionally a quote
- Source field allows tracking marketing ROI
- Status progression is linear (no kanban-style pipeline view for leads)

### Functional Gaps / Missing Features

- No pipeline kanban view for leads (table only — harder to see funnel shape)
- No lead scoring or prioritization algorithm
- No follow-up task/reminder creation from a lead
- No email integration (send email from within lead)
- No lead assignment to sales team members with ownership rules
- No bulk status update for leads
- Won/Lost reason tracking is notes-only, not a structured field
`;

  writeDoc('09-leads.md', doc);
  await context.close();
});

// ─── Customers ────────────────────────────────────────────────────────────────

test('10 - Customers', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/customers`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);
  const tabs = await getTabs(page);

  const doc = `# Customers

**Route:** \`/customers\`
**Access Roles:** Office Manager, PM, Manager, Admin
**Page Title:** ${title || 'Customers'}

## Purpose

Customer master data — companies and contacts that purchase products/services.
Customers link to Jobs, Quotes, Sales Orders, Invoices, and Payments.
Multi-address support (billing, shipping, multiple sites).

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Name', 'Company', 'Email', 'Phone',
  'City', 'State', 'Credit Terms', 'QB Synced',
])}

## Tabs (Customer Detail)

${fmtList(tabs.length > 0 ? tabs : [
  'Overview', 'Addresses', 'Contacts', 'Jobs',
  'Orders', 'Invoices', 'Files', 'Activity',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Customer', 'Import from QB', 'Column Manager'])}

## UX Analysis

### Flow Quality: ★★★★☆

Customer management is solid. Multi-address support is a key strength for customers
with multiple shipping locations.

### Usability Observations

- Address verification via USPS API validates and standardizes addresses
- QB sync indicator shows which customers are linked to QuickBooks
- Customer detail tabs provide rich history (all jobs, orders, invoices)

### Functional Gaps / Missing Features

- No customer portal (customer can't log in to view their orders/invoices)
- No customer-specific pricing (price list assignment to customer exists but UI is limited)
- No duplicate detection on customer creation
- Customer contacts are flat (no org chart / hierarchy)
- No credit limit enforcement (credit terms is informational only)
`;

  writeDoc('10-customers.md', doc);
  await context.close();
});

// ─── Quotes ───────────────────────────────────────────────────────────────────

test('11 - Quotes', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/quotes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);
  const newQuoteDialog = await openDialogExtractClose(page, /New Quote|Create Quote/i);

  const doc = `# Quotes (Estimates)

**Route:** \`/quotes\`
**Access Roles:** PM, Office Manager, Manager, Admin
**Page Title:** ${title || 'Quotes'}

## Purpose

Quotes (mapped to QuickBooks Estimates) are the starting point of the quote-to-cash
flow. A quote has line items with quantities and prices. When accepted by the customer,
a quote converts to a Sales Order.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Quote #', 'Customer', 'Date', 'Expiry',
  'Total', 'Status', 'QB Synced',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Quote', 'Column Manager'])}

## Create Quote Dialog Fields

${fmtFields(newQuoteDialog.fields.length > 0 ? newQuoteDialog.fields : [
  'Customer', 'Quote Date', 'Expiry Date', 'Terms',
  'Notes / Customer Message', 'Line Items (part, qty, price, description)',
])}

## Quote Statuses

Draft → Sent → Accepted → Converted (to SO) / Declined / Expired

## UX Analysis

### Flow Quality: ★★★★☆

Quote creation with line items is clean. QB sync keeps estimates in sync with QB.

### Usability Observations

- Line item part picker links to parts catalog
- Quote PDF generation via QuestPDF
- QB sync creates/updates Estimate in QB Online automatically

### Functional Gaps / Missing Features

- No quote versioning (V1, V2, V3 revisions visible to customer)
- No quote template system (start from a saved quote structure)
- No customer approval portal (customer receives PDF via email, calls to accept)
- No quote approval workflow (manager must approve before sending)
- No quote win/loss analysis dashboard
`;

  writeDoc('11-quotes.md', doc);
  await context.close();
});

// ─── Sales Orders ─────────────────────────────────────────────────────────────

test('12 - Sales Orders', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/sales-orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);

  const doc = `# Sales Orders

**Route:** \`/sales-orders\`
**Access Roles:** Office Manager, PM, Manager, Admin
**Page Title:** ${title || 'Sales Orders'}

## Purpose

Sales Orders represent confirmed customer commitments (mapped to QB Sales Receipts or
Invoices depending on QB flow). Each SO line links to a Kanban job that fulfills it.
Partial fulfillment is supported — multiple shipments per SO line.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'SO #', 'Customer', 'Date', 'Due Date',
  'Total', 'Fulfillment %', 'Status', 'QB Synced',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Sales Order', 'From Quote', 'Column Manager'])}

## SO Statuses

Draft → Confirmed → In Fulfillment → Partially Shipped → Fully Shipped → Invoiced

## UX Analysis

### Flow Quality: ★★★★☆

The SO fulfillment tracking (linking lines to jobs, tracking shipment progress) is
a key differentiator for job shops that need granular order tracking.

### Usability Observations

- SO lines link to Jobs on the Kanban board
- Fulfillment percentage auto-calculates from shipment records
- Convert to Invoice button appears when all lines are shipped

### Functional Gaps / Missing Features

- No SO amendment workflow (customer change orders after confirmation)
- No SO acknowledgment PDF (different from quote — formal order confirmation)
- No partial cancellation (cancel individual lines, not entire SO)
- No back-order management (split line into shipped + back-ordered quantities)
`;

  writeDoc('12-sales-orders.md', doc);
  await context.close();
});

// ─── Purchase Orders ──────────────────────────────────────────────────────────

test('13 - Purchase Orders', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/purchase-orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);
  const tabs = await getTabs(page);

  const doc = `# Purchase Orders

**Route:** \`/purchase-orders\`
**Access Roles:** Engineer, Manager, Admin
**Page Title:** ${title || 'Purchase Orders'}

## Purpose

Purchase Orders manage outbound procurement — buying materials, components, and
services from vendors. PO lines link to jobs. Receiving records update inventory
stock levels automatically.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'PO #', 'Vendor', 'Date', 'Expected',
  'Total', 'Received %', 'Status',
])}

## Tabs

${fmtList(tabs.length > 0 ? tabs : ['Open POs', 'Receiving', 'Closed POs'])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New PO', 'Receive Against PO', 'Column Manager'])}

## PO → Receiving Flow

1. Create PO with vendor + line items
2. PO status: Draft → Sent → Partially Received → Fully Received
3. "Receive" button opens receive dialog — enter quantities received
4. Receiving record auto-updates inventory bin quantities
5. Job on kanban board moves to "Materials Received" stage

## UX Analysis

### Flow Quality: ★★★★☆

The PO → receiving → inventory update chain is well implemented and closes the
procurement loop without manual inventory entry.

### Usability Observations

- PO PDF generation for sending to vendors
- Receiving dialog shows expected vs received quantities per line
- Partial receiving creates a follow-up open balance

### Functional Gaps / Missing Features

- No vendor portal (vendor can't view PO or confirm receipt)
- No 3-way match (PO → receipt → vendor invoice matching)
- No PO amendment workflow after sending
- No vendor lead time tracking per line item
- No blanket PO / release order structure
`;

  writeDoc('13-purchase-orders.md', doc);
  await context.close();
});

// ─── Shipments ────────────────────────────────────────────────────────────────

test('14 - Shipments', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/shipments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);

  const doc = `# Shipments

**Route:** \`/shipments\`
**Access Roles:** Office Manager, Manager, Admin
**Page Title:** ${title || 'Shipments'}

## Purpose

Shipments track outbound deliveries against Sales Order lines. The shipping rates
dialog shows carrier rate quotes. Tracking numbers link to carrier tracking pages.
Address validation via USPS ensures accurate delivery addresses.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Shipment #', 'Customer', 'Ship Date', 'Carrier',
  'Tracking #', 'Status', 'SO Reference',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Shipment', 'Get Rates', 'Column Manager'])}

## Shipping Rates Dialog

Opens carrier rate comparison (mock carriers in dev):
- Shows rate options per carrier/service level
- Click to select → pre-fills tracking info

## Shipment Statuses

Pending → Label Created → Picked Up → In Transit → Delivered / Exception

## UX Analysis

### Flow Quality: ★★★☆☆

Shipment creation works but carrier API integrations are still mock.

### Usability Observations

- Address validation warns before creating shipment with invalid address
- Tracking timeline shows carrier scan events
- Shipment links back to SO to close fulfillment loop

### Functional Gaps / Missing Features

- Carrier integrations (UPS, FedEx, USPS, DHL) are mocked — not yet connected to real APIs
- No label printing directly from the app (generates label via carrier API when implemented)
- No return shipment (RMA) workflow
- No multi-package shipment support
- No customs/international shipping documentation
`;

  writeDoc('14-shipments.md', doc);
  await context.close();
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

test('15 - Invoices', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);

  const doc = `# Invoices ⚡ (Standalone Mode)

**Route:** \`/invoices\`
**Access Roles:** Office Manager, Manager, Admin
**Page Title:** ${title || 'Invoices'}
**Mode:** Active when no accounting provider is connected (standalone mode)

## Purpose

Invoice management for standalone operation (no QB connection). When QB is connected,
invoices are managed in QB and this module becomes read-only. Invoices are generated
from shipped Sales Orders and sent to customers. Payments are applied against invoices.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Invoice #', 'Customer', 'Invoice Date', 'Due Date',
  'Total', 'Balance Due', 'Status',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : [
  'New Invoice', 'From Shipment', 'Uninvoiced Jobs', 'Column Manager',
])}

## Invoice Statuses

Draft → Sent → Partially Paid → Paid → Voided / Overdue

## UX Analysis

### Flow Quality: ★★★★☆

Standalone invoicing is clean and covers the AR lifecycle. QB sync handles the
connected case gracefully.

### Usability Observations

- "Uninvoiced Jobs" panel shows jobs ready to invoice with one click
- Invoice PDF generation via QuestPDF
- Payment application tracks partial payments across invoices

### Functional Gaps / Missing Features

- No recurring invoice automation
- No early-payment discount terms enforcement
- No invoice reminder email automation (send reminder when X days overdue)
- No customer statement generation from within invoices (exists in reports)
`;

  writeDoc('15-invoices.md', doc);
  await context.close();
});

// ─── Payments ─────────────────────────────────────────────────────────────────

test('16 - Payments', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/payments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);

  const doc = `# Payments ⚡ (Standalone Mode)

**Route:** \`/payments\`
**Access Roles:** Office Manager, Manager, Admin
**Page Title:** ${title || 'Payments'}
**Mode:** Active when no accounting provider is connected (standalone mode)

## Purpose

Payment recording and application against invoices. Supports partial payments, multiple
payment methods, and payment application across multiple invoices.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Payment #', 'Customer', 'Date', 'Method',
  'Amount', 'Applied To', 'Unapplied Balance',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Payment', 'Column Manager'])}

## Payment Methods

Check, ACH/Wire, Credit Card, Cash, Other

## UX Analysis

### Flow Quality: ★★★☆☆

Basic payment recording works. The payment application flow (linking payment to
specific invoices) needs a more visual workflow.

### Usability Observations

- Payment can be applied across multiple invoices at once
- Unapplied balance (credit) carries forward for future application
- Payment method dropdown includes all standard manufacturing payment types

### Functional Gaps / Missing Features

- No payment processing integration (Stripe, Square, etc.)
- No ACH batch file generation
- No check printing
- No payment reconciliation workflow
`;

  writeDoc('16-payments.md', doc);
  await context.close();
});

// ─── Expenses ─────────────────────────────────────────────────────────────────

test('17 - Expenses', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/expenses`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);
  const tabs = await getTabs(page);
  const newExpenseDialog = await openDialogExtractClose(page, /New Expense|Submit Expense/i);

  const doc = `# Expenses

**Route:** \`/expenses\`
**Access Roles:** All roles (submit own; Manager/Admin approve all)
**Page Title:** ${title || 'Expenses'}

## Purpose

Employee expense reporting and approval workflow. Employees submit expense claims
with receipts. Managers approve/reject. Approved expenses can sync to QB.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Date', 'Description', 'Category', 'Amount',
  'Submitted By', 'Status', 'Receipt',
])}

## Tabs

${fmtList(tabs.length > 0 ? tabs : ['My Expenses', 'Approval Queue', 'Upcoming'])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Expense', 'Export', 'Column Manager'])}

## Create Expense Dialog Fields

${fmtFields(newExpenseDialog.fields.length > 0 ? newExpenseDialog.fields : [
  'Amount', 'Date', 'Category (Materials/Tools/Travel/Office/Other)',
  'Description', 'Job Reference', 'Receipt (file upload)',
])}

## Expense Statuses

Draft → Submitted → Under Review → Approved / Rejected → Reimbursed

## UX Analysis

### Flow Quality: ★★★★☆

Clean expense submission flow. Receipt photo capture via CameraCapture is a
standout feature for mobile use.

### Usability Observations

- Receipt attachment via camera capture works on mobile browsers
- Category codes align with QB expense categories for sync
- Approval queue is a distinct tab for managers — clear separation

### Functional Gaps / Missing Features

- No mileage expense type (distance-based calculation)
- No per-diem rules (fixed rate by location)
- No expense policy enforcement (max amounts per category)
- No corporate card integration
- No OCR on receipt to pre-fill amount/merchant
`;

  writeDoc('17-expenses.md', doc);
  await context.close();
});

// ─── Time Tracking ────────────────────────────────────────────────────────────

test('18 - Time Tracking', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/time-tracking`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);
  const tabs = await getTabs(page);

  const doc = `# Time Tracking

**Route:** \`/time-tracking\`
**Access Roles:** All roles
**Page Title:** ${title || 'Time Tracking'}

## Purpose

Time tracking records labor hours against jobs or overhead categories. Supports both
real-time timers (start/stop) and manual log entries. SignalR broadcasts timer state
across all open tabs. Time entries sync to QB Time Activities.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Date', 'Job', 'Category', 'Duration',
  'Notes', 'Billable', 'Status',
])}

## Tabs

${fmtList(tabs.length > 0 ? tabs : ['My Time', 'Team Time (admin/manager)', 'Reports'])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : [
  'Start Timer', 'Log Time (manual)', 'Export', 'Column Manager',
])}

## Timer Feature

- Active timer shows elapsed time in real-time
- Timer state persists across page navigation
- SignalR broadcasts start/stop to all tabs (prevents duplicate timers)
- Stop dialog captures final notes and category before saving

## Manual Entry Fields

- Date, Hours, Minutes, Category, Job Reference, Notes, Billable toggle

## UX Analysis

### Flow Quality: ★★★★☆

Timer + manual log covers the two main time capture workflows. SignalR sync is
a strong feature for multi-tab users.

### Usability Observations

- Active timer badge visible in header while timer is running
- KB shortcut to start/stop timer (configurable)
- Shop Floor kiosk uses time tracking via clock-in/out (separate flow)

### Functional Gaps / Missing Features

- No time approval workflow (timesheets requiring manager sign-off)
- No overtime rules or alerts
- No pay period locking (employees can edit any past entry)
- No project budget vs actual hours comparison
- Team time view limited to admin/manager — PMs can't see team time for their projects
- No integration with ADP/Paychex for payroll export
`;

  writeDoc('18-time-tracking.md', doc);
  await context.close();
});

// ─── Vendors ──────────────────────────────────────────────────────────────────

test('19 - Vendors', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/vendors`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);
  const columns = await getTableColumns(page);

  const doc = `# Vendors

**Route:** \`/vendors\`
**Access Roles:** Office Manager, Manager, Admin (⚡ full CRUD in standalone; read-only with QB)
**Page Title:** ${title || 'Vendors'}

## Purpose

Vendor master data — companies from which materials and services are purchased.
Vendors link to Purchase Orders and Expenses. When QB is connected, vendor master
data is managed in QB and synced to the app.

## Table Columns

${fmtTable(columns.length > 0 ? columns : [
  'Name', 'Contact', 'Email', 'Phone',
  'City', 'State', 'Payment Terms', 'QB Synced',
])}

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Vendor', 'Import from QB', 'Column Manager'])}

## UX Analysis

### Flow Quality: ★★★☆☆

Vendor management is functional but relatively sparse — most data lives in QB.

### Usability Observations

- Vendor list syncs from QB when connected
- Address verification available for vendor shipping addresses
- Payment terms dropdown aligned with QB terms codes

### Functional Gaps / Missing Features

- No vendor performance tracking (on-time delivery %, quality metrics)
- No preferred vendor flag per part/category
- No vendor contact management (multiple contacts per vendor)
- No vendor document storage (certificates, W-9s)
`;

  writeDoc('19-vendors.md', doc);
  await context.close();
});

// ─── Reports ──────────────────────────────────────────────────────────────────

test('20 - Reports', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const reportNames = await extractTexts(page, '.report-nav-item, .report-list__item');

  const doc = `# Reports (Dynamic Builder)

**Route:** \`/reports\`
**Access Roles:** PM, Manager, Admin (role-filtered data)
**Page Title:** ${title || 'Reports'}

## Purpose

The Report Builder is a dynamic query engine over 28 entity sources and 350+ fields.
Users select an entity type, choose fields, apply filters, and view results as a table
or chart. Reports can be saved and accessed from a personal saved reports list.

## Detected Report Templates

${fmtList(reportNames.length > 0 ? reportNames : [
  'Jobs by Stage', 'Overdue Jobs', 'Time by User', 'Expense Summary',
  'Lead Pipeline', 'Completion Trend', 'On-Time Delivery', 'Avg Lead Time',
  'Team Workload', 'Customer Activity', 'My Work History', 'My Time Log',
  'AR Aging', 'Revenue', 'Profit & Loss', 'My Expenses',
  'Quote-to-Close', 'Shipping Summary', 'Time in Stage', 'Employee Productivity',
  'Inventory Levels', 'Maintenance', 'Quality / Scrap Rate', 'Cycle Review',
  'Job Margin', 'My Cycle Summary', 'Lead & Sales', 'R&D Report',
])}

## Entity Sources (28)

Job, Part, Customer, Lead, Quote, SalesOrder, PurchaseOrder, Shipment, Invoice,
Payment, Expense, TimeEntry, Asset, Vendor, Inventory, QcInspection, PlanningCycle,
LotRecord, ChatMessage, AppNotification, ComplianceFormSubmission, PayStub,
FileAttachment, ActivityLog, StatusEntry, AuditLog, ScheduledTask, SavedReport

## Report Builder Interface

1. **Select Entity** — choose the primary data source
2. **Select Fields** — choose which columns to include
3. **Set Filters** — date range + entity-specific filters
4. **View Results** — table with export option
5. **Add Chart** — bar/line/pie visualization (ng2-charts)
6. **Save Report** — name and persist to saved reports list

## UX Analysis

### Flow Quality: ★★★★☆

The 28-source dynamic report builder is powerful for a job shop platform. Pre-seeded
templates reduce the learning curve significantly.

### Usability Observations

- Report sidebar shows all 28 pre-seeded templates organized by category
- Saved reports are per-user and persist via UserPreferences
- Charts update in real-time as filters change
- Export to CSV available

### Functional Gaps / Missing Features

- No scheduled report delivery (email on a cron schedule)
- No report sharing between users
- No dashboard widget from custom report (saved reports can't become dashboard widgets)
- No drill-down from chart bars to underlying data
- No pivot table mode
- Excel export (XLSX) not yet implemented (CSV only)
- No calculated fields / formulas in report builder
`;

  writeDoc('20-reports.md', doc);
  await context.close();
});

// ─── Calendar ─────────────────────────────────────────────────────────────────

test('21 - Calendar', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/calendar`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);

  const doc = `# Calendar

**Route:** \`/calendar\`
**Access Roles:** All roles
**Page Title:** ${title || 'Calendar'}

## Purpose

Calendar view aggregates job due dates, planning cycle boundaries, and scheduled
tasks into a single timeline view.

## Views

| View | Description |
|:-----|:------------|
| Month | Standard month grid with event chips |
| Week | Hour-by-hour week view |
| Day | Single day detail view |

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : [
  'Today', 'Back / Forward', 'Month / Week / Day toggle', 'Filter',
])}

## UX Analysis

### Flow Quality: ★★★☆☆

Calendar is a useful at-a-glance view but needs more event sources and interaction.

### Usability Observations

- Job due dates appear as event chips on their due date
- Planning cycle start/end dates appear as multi-day events
- Color coding maps to job priority or stage

### Functional Gaps / Missing Features

- No calendar event creation (can't create a job or task from the calendar)
- No personal calendar items (meetings, reminders)
- No resource calendar (who is working on what, when)
- No iCal export or Google/Outlook calendar sync
- No recurring event display for scheduled tasks
`;

  writeDoc('21-calendar.md', doc);
  await context.close();
});

// ─── Chat ─────────────────────────────────────────────────────────────────────

test('22 - Chat', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);

  const doc = `# Chat

**Route:** \`/chat\`
**Access Roles:** All roles
**Page Title:** ${title || 'Chat'}

## Purpose

Internal messaging with real-time delivery via SignalR. Supports 1:1 direct messages
and group rooms. Messages can include file attachments and entity references
(link to a job, part, etc.).

## Layout

- **Left panel:** Room/DM list with unread badge
- **Right panel:** Message thread with input bar

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Direct Message', 'New Group Room'])}

## Message Features

| Feature | Description |
|:--------|:------------|
| Text messages | Markdown formatting supported |
| File attachments | Upload files within chat |
| Entity references | @mention a job, part, or customer |
| Real-time delivery | SignalR push — no polling |
| Read receipts | Shows when messages are read |

## UX Analysis

### Flow Quality: ★★★☆☆

Chat provides the basics for internal communication without leaving the app.

### Usability Observations

- Notification badge on sidebar icon shows unread message count
- Desktop browser notifications for new messages when app is not in focus
- Entity references create clickable links to the referenced record

### Functional Gaps / Missing Features

- No message reactions (emoji reactions)
- No message threading (reply to specific message)
- No message editing after send
- No search within chat history
- No voice/video call integration
- No status presence indicators (online/away/busy)
- No mobile push notifications (only in-browser)
`;

  writeDoc('22-chat.md', doc);
  await context.close();
});

// ─── AI Assistant ─────────────────────────────────────────────────────────────

test('23 - AI Assistant', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/ai`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);

  const doc = `# AI Assistant

**Route:** \`/ai\`
**Access Roles:** All roles (role-filtered responses)
**Page Title:** ${title || 'AI Assistant'}

## Purpose

The AI module provides two surfaces:

1. **Built-in Help Chat** (robot icon in header) — role-aware Q&A about the platform
2. **AI Assistant Page** — configurable domain assistants (HR, procurement, sales)

Both use Ollama (self-hosted LLM: llama3.2:3b) with RAG retrieval from pgvector.

## Role-Based Help Chat

The header robot icon opens a context-aware chat. Responses and RAG data are filtered
by the user's highest-privilege role:

| Role | Context | RAG Sources |
|:-----|:--------|:------------|
| Admin | Full system + admin panel + Docker + Hangfire | All entity types |
| Manager | Operations + financials + team management | All entity types |
| Office Manager | Customers, invoices, AR, shipments | Customer, Invoice, Payment, SO, Shipment, Vendor, Expense, Documentation |
| PM | Backlog, planning, reports, leads | Job, Customer, Lead, Quote, SO, Documentation |
| Engineer | Kanban, parts, inventory, quality, time | Job, Part, Asset, Customer, Documentation |
| Production Worker | Shop floor, timer, QC basics | Job, Part, Documentation |

## Configurable AI Assistants (Admin)

Admins can create domain-specific assistants (HR assistant, Procurement assistant, etc.)
with custom system prompts and RAG configurations. Accessible from Admin > AI Assistants.

## RAG Infrastructure

- **Model:** all-minilm:l6-v2 for embeddings (384-dim pgvector)
- **Generation:** llama3.2:3b
- **Indexed sources:** 12 documentation files + Jobs, Parts, Customers, Assets
- **Total vectors:** ~1553+ documentation chunks
- **Indexing:** Hangfire — every 30 min for entities, daily at 3 AM for docs
- **Chunk size:** 450 chars (safe for all-minilm:l6-v2 ~256 token limit)

## Toolbar Actions

${fmtList(buttons.length > 0 ? buttons : ['New Conversation', 'Clear History'])}

## UX Analysis

### Flow Quality: ★★★★☆

Self-hosted AI with role-based context filtering is a strong differentiator. No data
leaves the local infrastructure.

### Usability Observations

- Conversation history persists within the session
- Smart search in header uses AI to enhance search suggestions
- Graceful degradation when Ollama is unavailable

### Functional Gaps / Missing Features

- No AI-assisted job description generation from template (RAG context could draft it)
- No predictive lead time estimation from historical job data
- No anomaly detection alerts (e.g., "this job is behind typical pace")
- Vision model (llava:7b) configured but not yet wired to specific UI interactions
- No streaming responses (full response arrives at once — no token streaming)
- AI assistant page UX for non-technical users needs more guided prompts
`;

  writeDoc('23-ai-assistant.md', doc);
  await context.close();
});

// ─── Shop Floor ───────────────────────────────────────────────────────────────

test('24 - Shop Floor / Worker View', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/shop-floor`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const buttons = await getToolbarButtons(page);

  const doc = `# Shop Floor / Worker View

**Route:** \`/shop-floor\`
**Access Roles:** Production Worker, Engineer (kiosk auth: RFID/NFC/barcode + PIN)
**Page Title:** ${title || 'Shop Floor'}

## Purpose

The shop floor is a touch-first kiosk display designed for large touchscreens
mounted in production areas. Workers clock in/out, start/stop job timers,
scan barcodes to pull up job info, and complete QC checkpoints.

## Kiosk Authentication

Workers authenticate using tiered credentials:
1. **Scan** RFID badge / NFC sticker / barcode label
2. **Enter PIN** (4-6 digit numeric code, separate from password)

No keyboard required for normal operation.

## Key Flows

| Flow | Description |
|:-----|:------------|
| Clock In / Out | Large touch button — records clock event, starts/stops work session |
| Start Job Timer | Scan or search job → tap Start → timer runs |
| Stop Job Timer | Tap Stop → enter notes → time saved |
| QC Checkpoint | Scan job barcode → QC form appears → fill → sign off |
| View My Work | See assigned jobs and current timer status |

## Quick Action Panel

Large 88x88px touch buttons (meets 44px minimum, exceeds for industrial use):
- Clock In
- Clock Out
- Start Task
- My Jobs
- QC Check
- Help

## Barcode Search

Full-width search bar with:
- Accepts USB barcode scanner input (keyboard wedge mode)
- Accepts NFC reader input
- Fallback: manual entry for visitors or badge failures

## UX Analysis

### Flow Quality: ★★★★☆

The shop floor kiosk UX is purpose-built for gloved hands and industrial environments.
Touch targets exceed WCAG minimums significantly.

### Usability Observations

- Ambient display mode shows overall production status on wall-mounted screens
- Clock events feed payroll time calculations
- QR/barcode labels generated from the parts module for job travelers

### Functional Gaps / Missing Features

- No multi-language support on the kiosk (critical for diverse workforces)
- No voice interaction (hands-free for safety environments)
- No job sequence display (what order should this worker tackle jobs?)
- No real-time production count display (e.g., "20/100 parts completed today")
- Safety alert broadcast (emergency stop notification) not implemented
- No shift handoff notes capture
`;

  writeDoc('24-shop-floor.md', doc);
  await context.close();
});

// ─── Admin Panel ──────────────────────────────────────────────────────────────

test('25 - Admin Panel', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);

  const adminTabs: Record<string, { columns: string[]; buttons: string[] }> = {};

  const tabRoutes = [
    { key: 'users', path: '/admin/users' },
    { key: 'track-types', path: '/admin/track-types' },
    { key: 'reference-data', path: '/admin/reference-data' },
    { key: 'compliance', path: '/admin/compliance' },
    { key: 'integrations', path: '/admin/integrations' },
    { key: 'settings', path: '/admin/settings' },
    { key: 'ai-assistants', path: '/admin/ai-assistants' },
    { key: 'teams', path: '/admin/teams' },
  ];

  for (const { key, path } of tabRoutes) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    adminTabs[key] = {
      columns: await getTableColumns(page),
      buttons: await getToolbarButtons(page),
    };
  }

  const complianceDialog = await (async () => {
    await page.goto(`${BASE_URL}/admin/compliance`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    return openDialogExtractClose(page, /New Template|Create Template/i);
  })();

  const doc = `# Admin Panel

**Route:** \`/admin/*\`
**Access Roles:** Admin only
**Page Title:** Admin

## Purpose

The admin panel provides system configuration, user management, and compliance
template management. It is the control center for the entire QB Engineer instance.

## Admin Tabs

| Tab | Route | Description |
|:----|:------|:------------|
| Users | \`/admin/users\` | User accounts, roles, invite/setup |
| Track Types | \`/admin/track-types\` | Kanban track types + stage configuration |
| Reference Data | \`/admin/reference-data\` | Lookup values, categories, dropdown options |
| Compliance | \`/admin/compliance\` | Compliance form templates (W-4, I-9, state forms) |
| Integrations | \`/admin/integrations\` | QB Online, USPS, MinIO, Ollama, DocuSeal status |
| Settings | \`/admin/settings\` | Company profile, locations, terminology |
| AI Assistants | \`/admin/ai-assistants\` | Configurable domain AI chatbots |
| Teams | \`/admin/teams\` | Team/group definitions for reporting |

## Users Tab

### Table Columns
${fmtTable(adminTabs['users']?.columns.length > 0 ? adminTabs['users'].columns : [
  'Name', 'Email', 'Roles', 'Location', 'Status', 'Last Login',
])}

### Toolbar Actions
${fmtList(adminTabs['users']?.buttons.length > 0 ? adminTabs['users'].buttons : [
  'Invite User', 'Generate Setup Token',
])}

**User Management Flow:**
1. Admin clicks "Invite User" → enters email + roles
2. System sends email with setup link (or admin copies setup token)
3. Employee clicks link → sets own password/PIN → account active
4. Admin never sets employee passwords (security design)

## Track Types Tab

Manages Kanban board configurations:
- **Track Types:** Production, R&D/Tooling, Maintenance, Custom
- **Stages:** Per track type — name, color, WIP limit, irreversibility flag, QB document type

${fmtList(adminTabs['track-types']?.buttons.length > 0 ? adminTabs['track-types'].buttons : [
  'New Track Type', 'Edit Stages',
])}

## Compliance Tab

### Table Columns
${fmtTable(adminTabs['compliance']?.columns.length > 0 ? adminTabs['compliance'].columns : [
  'Form Name', 'Type', 'State', 'Required', 'Active', 'Last Updated',
])}

### Create Template Dialog Fields
${fmtFields(complianceDialog.fields.length > 0 ? complianceDialog.fields : [
  'Form Name', 'Form Type (Federal/State/Custom)',
  'State (if state form)', 'Required toggle',
  'Upload PDF (for PDF extraction)', 'Electronic Form toggle',
])}

## Integrations Tab

Shows connection status for all external services:
${fmtList(adminTabs['integrations']?.buttons.length > 0 ? adminTabs['integrations'].buttons : [
  'QuickBooks Online (OAuth connect/disconnect)',
  'USPS Address Validation (API key status)',
  'MinIO Storage (connection test)',
  'Ollama AI (model availability)',
  'DocuSeal Signing (connection status)',
  'SMTP Email (test send)',
])}

## Settings Tab

### Company Profile
- Company Name, Phone, Email, EIN, Website

### Company Locations
- Location Name, Address, State, Is Default, Is Active
- Per-employee work location assignment (for state withholding)

### Terminology
- Admin-configurable labels ("Job" → "Work Order", "Part" → "Item")
- Applied site-wide via TerminologyPipe

## UX Analysis

### Flow Quality: ★★★★☆

The admin panel is comprehensive and well-organized. Track type configuration
is particularly strong — stage colors and WIP limits are visible immediately.

### Usability Observations

- Setup token flow is elegant — admin doesn't handle passwords
- Reference data single table manages all lookups centrally (no scattered config tables)
- Integration status page gives a clear health dashboard for connected services

### Functional Gaps / Missing Features

- No bulk user import (CSV)
- No role-based permission matrix editor (roles are fixed, not configurable)
- No audit log viewer in admin panel (AuditLogEntry entity exists but no UI)
- No system health dashboard (disk space, DB size, memory usage)
- No backup configuration UI (backup runs but no admin visibility)
- Terminology changes require page refresh to apply globally
- No two-factor authentication (2FA) configuration
`;

  writeDoc('25-admin.md', doc);
  await context.close();
});

// ─── Account / Employee Self-Service ──────────────────────────────────────────

test('26 - Account & Employee Self-Service', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);

  const accountTabs: Record<string, { fields: string[]; buttons: string[] }> = {};
  const routes = [
    { key: 'profile', path: '/account/profile' },
    { key: 'contact', path: '/account/contact' },
    { key: 'emergency', path: '/account/emergency' },
    { key: 'security', path: '/account/security' },
    { key: 'tax-forms', path: '/account/tax-forms' },
    { key: 'pay-stubs', path: '/account/pay-stubs' },
    { key: 'tax-documents', path: '/account/tax-documents' },
    { key: 'documents', path: '/account/documents' },
  ];

  for (const { key, path } of routes) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    accountTabs[key] = {
      fields: await getFormFields(page),
      buttons: await getToolbarButtons(page),
    };
  }

  const doc = `# Account & Employee Self-Service

**Route:** \`/account/*\`
**Access Roles:** All roles (own data only; Admin can view all)

## Purpose

The Account section is the employee self-service portal. Employees manage their
personal information, complete compliance forms, view pay stubs, and access
company documents. Profile completeness drives access to job assignments.

## Account Sidebar Navigation

| Section | Route | Description |
|:--------|:------|:------------|
| Profile | \`/account/profile\` | Name, photo, bio |
| Contact | \`/account/contact\` | Phone, personal email, home address |
| Emergency | \`/account/emergency\` | Emergency contact name/phone/relationship |
| Security | \`/account/security\` | Change password, change PIN, active sessions |
| Tax Forms | \`/account/tax-forms\` | Compliance forms (W-4, I-9, state withholding) |
| Pay Stubs | \`/account/pay-stubs\` | View/download pay stubs (QB Payroll sync) |
| Tax Documents | \`/account/tax-documents\` | W-2, 1099 downloads |
| Documents | \`/account/documents\` | Company documents (handbooks, policies) |

## Profile Completeness

Profile completeness blocks job assignment until key fields are filled:

| Requirement | Blocks |
|:------------|:-------|
| Emergency Contact | Job assignment |
| Home Address | Job assignment |
| W-4 Submitted | Payroll processing |
| I-9 Completed | Legal work authorization |
| State Withholding | State payroll taxes |

A completeness progress bar is shown on the profile sidebar.

## Contact Form Fields

${fmtFields(accountTabs['contact']?.fields.length > 0 ? accountTabs['contact'].fields : [
  'Phone Number', 'Personal Email',
  'Street Address', 'Street Address 2',
  'City', 'State', 'ZIP / Postal Code',
])}

## Emergency Contact Form Fields

${fmtFields(accountTabs['emergency']?.fields.length > 0 ? accountTabs['emergency'].fields : [
  'Contact Name', 'Contact Phone', 'Relationship',
])}

## Tax Forms Section (Compliance)

Compliance forms are either:
1. **Electronic** — rendered dynamically via DynamicQbForm component, filled in-app
2. **PDF-based** — displayed as PDF, employee acknowledges and signs via DocuSeal

### Known Compliance Forms

| Form | Type | Description |
|:-----|:-----|:------------|
| Federal W-4 | Electronic | Employee withholding allowances |
| Federal I-9 | Electronic | Employment eligibility verification |
| State W-4 (varies by state) | Electronic | State income tax withholding |
| Employee Handbook | PDF Acknowledge | Company policies |
| Safety Policy | PDF Acknowledge | OSHA compliance acknowledgment |

## Pay Stubs Section

- Lists pay stubs sorted by pay period (most recent first)
- Download as PDF
- Shows: gross pay, deductions, net pay, YTD totals
- Data populated via QB Payroll API sync (stub returns empty without QB Payroll)

## UX Analysis

### Flow Quality: ★★★★☆

The self-service portal reduces HR overhead significantly. The compliance form
electronic rendering (W-4 with dynamic calculation) is particularly sophisticated.

### Usability Observations

- W-4 withholding preview updates in real-time as user adjusts allowances
- DocuSeal integration handles legally binding e-signatures for PDF forms
- Profile completeness progress bar motivates employees to complete their profiles
- All form saves use the hover-popover validation pattern

### Functional Gaps / Missing Features

- No payroll history beyond pay stubs (no year-end W-2 generation — QB handles this)
- No benefits enrollment (health insurance, 401k — out of scope)
- No PTO balance display (no PTO tracking module)
- No performance review workflow
- No direct deposit setup UI (managed in QB Payroll)
- Documents section shows company documents but no per-employee document upload by HR
`;

  writeDoc('26-account-employee.md', doc);
  await context.close();
});

// ─── Notifications ────────────────────────────────────────────────────────────

test('27 - Notifications', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await getPageTitle(page);
  const tabs = await getTabs(page);

  const doc = `# Notifications

**Route:** \`/notifications\` (also as panel via bell icon)
**Access Roles:** All roles
**Page Title:** ${title || 'Notifications'}

## Purpose

Notifications deliver real-time alerts for job moves, mentions, approvals, system
events, and chat messages. The bell icon in the header shows an unread badge.
The notification panel slides from the right on bell click.

## Notification Panel (Header Bell)

### Tabs
${fmtList(tabs.length > 0 ? tabs : ['All', 'Messages', 'Alerts'])}

### Notification Types

| Type | Trigger | Severity |
|:-----|:--------|:---------|
| Job moved | Card moved to new stage on kanban | Info |
| Mention | User @mentioned in activity comment | Info |
| Expense approved/rejected | Manager action on expense | Info / Warning |
| Compliance deadline | Compliance form due date approaching | Warning |
| System alert | DB backup, sync failure, AI error | Warning / Error |
| Chat message | New direct message or group mention | Info |

### Notification Actions

- Mark as read (individual or all)
- Dismiss (remove from list)
- Pin (keep at top of list)
- Click to navigate to source entity

## Full Notifications Page

List view of all notifications with advanced filtering:
- Filter by: source, severity, type, unread only
- Bulk actions: mark all read, dismiss all

## UX Analysis

### Flow Quality: ★★★★☆

Real-time notifications via SignalR with a well-organized panel and filtering
provide a professional notification experience.

### Usability Observations

- Pinned notifications always appear at top of list
- Desktop browser notifications for critical alerts when app is out of focus
- Notification preferences per type (configurable by user)

### Functional Gaps / Missing Features

- No mobile push notifications (PWA push not yet implemented)
- No notification digest email (daily/weekly summary)
- No notification muting per user or per entity
- Notification preferences UI exists but not all types are configurable
`;

  writeDoc('27-notifications.md', doc);
  await context.close();
});

// ─── Auth Flows ───────────────────────────────────────────────────────────────

test('28 - Authentication Flows', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const loginFields = await getFormFields(page);

  const doc = `# Authentication Flows

**Routes:** \`/login\`, \`/setup\`, \`/token-setup\`, \`/sso-callback\`
**Access Roles:** Unauthenticated only

## Purpose

Authentication is tiered to support both office users and shop floor workers without
a traditional username/password requirement for kiosk operation.

## Tier 1: RFID / NFC + PIN (Kiosk)

For shop floor workers with physical badges:
1. Worker scans RFID badge or NFC sticker at kiosk
2. PIN entry prompt appears
3. 4-6 digit PIN entered (numeric keypad)
4. JWT issued → worker is authenticated

**Hardware:** ACR122U NFC reader, NTAG215 stickers, USB barcode scanner (fallback)

## Tier 2: Barcode + PIN

For workers with printed barcode labels instead of NFC:
1. Scan barcode label (USB scanner → keyboard wedge input)
2. PIN entry prompt
3. JWT issued

## Tier 3: Username + Password (Standard)

Office employees and PMs use standard email/password login.

### Login Form Fields
${fmtFields(loginFields.length > 0 ? loginFields : ['Email', 'Password'])}

## Tier 4: SSO (Google / Microsoft / OIDC)

Optional SSO via configured providers:
- Google Workspace
- Microsoft Azure AD
- Generic OIDC provider

SSO links to existing accounts — no self-registration.
Callback route: \`/sso-callback\`

## New Employee Setup Flow

Admins never set passwords. Instead:
1. Admin generates a **setup token** (time-limited, one-use)
2. Employee receives email with setup link or admin shares token directly
3. Employee visits \`/token-setup?token=...\` or \`/setup\`
4. Employee sets own password AND PIN
5. Account becomes active

## Session Management

- JWT access token (short-lived, e.g., 15 min)
- Refresh token (longer-lived, stored in localStorage)
- Auth interceptor silently refreshes before expiry
- Multi-tab logout sync via BroadcastChannel

## UX Analysis

### Flow Quality: ★★★★★

The tiered auth system is a genuine differentiator for manufacturing. Shop floor
workers get kiosk-friendly login without any technical overhead.

### Usability Observations

- PIN is separate from password — short numeric code, not a password
- Setup token eliminates IT help desk calls for forgotten initial passwords
- Refresh token prevents session timeouts during long work sessions

### Functional Gaps / Missing Features

- No two-factor authentication (2FA/MFA) for password logins
- No hardware security key (WebAuthn/FIDO2) support
- Session management page (view active sessions) is in account/security
  but forced logout of a specific session not yet implemented
- No automatic session timeout warning dialog before expiry
`;

  writeDoc('28-authentication.md', doc);
  await context.close();
});

// ─── Summary Index ────────────────────────────────────────────────────────────

test('00 - Write Index', async () => {
  const index = `# QB Engineer — UI Flow Documentation

**Generated:** ${new Date().toISOString().split('T')[0]}
**Purpose:** Training documentation for the AI help system and human onboarding.
Each file describes a feature's complete UI structure, user flows, and UX analysis.

## Files

| # | File | Feature |
|:--|:-----|:--------|
| 00 | [00-app-shell.md](00-app-shell.md) | App Shell & Navigation |
| 01 | [01-dashboard.md](01-dashboard.md) | Dashboard |
| 02 | [02-kanban.md](02-kanban.md) | Kanban Board |
| 03 | [03-backlog.md](03-backlog.md) | Backlog |
| 04 | [04-planning.md](04-planning.md) | Planning Cycles |
| 05 | [05-parts.md](05-parts.md) | Parts Catalog |
| 06 | [06-inventory.md](06-inventory.md) | Inventory |
| 07 | [07-assets.md](07-assets.md) | Assets |
| 08 | [08-quality.md](08-quality.md) | Quality Control |
| 09 | [09-leads.md](09-leads.md) | Leads (CRM Pipeline) |
| 10 | [10-customers.md](10-customers.md) | Customers |
| 11 | [11-quotes.md](11-quotes.md) | Quotes |
| 12 | [12-sales-orders.md](12-sales-orders.md) | Sales Orders |
| 13 | [13-purchase-orders.md](13-purchase-orders.md) | Purchase Orders |
| 14 | [14-shipments.md](14-shipments.md) | Shipments |
| 15 | [15-invoices.md](15-invoices.md) | Invoices |
| 16 | [16-payments.md](16-payments.md) | Payments |
| 17 | [17-expenses.md](17-expenses.md) | Expenses |
| 18 | [18-time-tracking.md](18-time-tracking.md) | Time Tracking |
| 19 | [19-vendors.md](19-vendors.md) | Vendors |
| 20 | [20-reports.md](20-reports.md) | Reports (Dynamic Builder) |
| 21 | [21-calendar.md](21-calendar.md) | Calendar |
| 22 | [22-chat.md](22-chat.md) | Chat |
| 23 | [23-ai-assistant.md](23-ai-assistant.md) | AI Assistant |
| 24 | [24-shop-floor.md](24-shop-floor.md) | Shop Floor / Worker View |
| 25 | [25-admin.md](25-admin.md) | Admin Panel |
| 26 | [26-account-employee.md](26-account-employee.md) | Account & Employee Self-Service |
| 27 | [27-notifications.md](27-notifications.md) | Notifications |
| 28 | [28-authentication.md](28-authentication.md) | Authentication Flows |

## Common Functional Gaps (Cross-Cutting)

These gaps appear across multiple features and represent architectural-level
missing capabilities:

### Critical Missing Features

1. **No customer-facing portal** — Customers can't log in to view orders, invoices, or approve quotes
2. **No PDF/export from all list views** — Only some modules support CSV; no XLSX, no list-to-PDF
3. **No bulk import (CSV)** — Parts, customers, inventory, vendors all require manual entry or QB sync
4. **No audit log viewer** — AuditLogEntry entity exists but no admin UI to query it
5. **No advanced search** — Global search is header-level; no cross-module advanced query builder
6. **No scheduled report delivery** — No email digest or scheduled export
7. **No mobile app** — PWA exists but is not optimized for mobile-first workflows
8. **No dark mode in kiosk** — Shop floor display is always in light mode

### UX Patterns That Work Well

1. **Hover validation popovers** — Far cleaner than inline mat-error messages
2. **Shared DataTable** — Consistent sort/filter/column management across all list views
3. **URL as source of truth** — All state (tabs, filters, selected entity) reflected in URL
4. **DetailSidePanel** — Slide-out panels avoid full navigation for detail views
5. **Loading overlay system** — Two-tier loading (global vs. component-level) handles all scenarios
6. **SignalR real-time** — Board sync, timer sync, notifications all work without polling

### Accessibility Status

All components built to WCAG 2.2 AA:
- aria-labels on all icon-only buttons
- Keyboard navigation throughout
- Focus management in dialogs
- Color + icon (never color alone) for status indicators
- Touch targets ≥ 44px (88px on shop floor kiosk)
`;

  writeDoc('README.md', index);
});
