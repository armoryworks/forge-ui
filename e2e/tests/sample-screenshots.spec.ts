import { test, expect, devices, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

import { getAuthSession, seedAuth, SEED_PASSWORD } from '../helpers/auth.helper';
import { request } from '@playwright/test';

const API_BASE = 'http://localhost:5000/api/v1/';

/**
 * Pair a kiosk terminal so the Shop Floor display renders the actual
 * welcome / workers grid instead of the "Terminal Setup" admin-login
 * gate. Pairing requires:
 *   1) creating (or finding) a team via POST /display/shop-floor/teams
 *   2) creating a terminal record via POST /display/shop-floor/terminal
 *      with a unique device-token (random UUID)
 *   3) returning the deviceToken + terminal so the caller can seed
 *      `qbe-kiosk-device-token` + `qbe-kiosk-terminal` in the kiosk
 *      page's localStorage before navigating to /display/shop-floor.
 */
async function ensurePairedKiosk(token: string): Promise<{ deviceToken: string; terminal: unknown } | null> {
  try {
    const ctx = await request.newContext({ baseURL: API_BASE, ignoreHTTPSErrors: true });
    const headers = { Authorization: `Bearer ${token}` };
    const teamsResp = await ctx.get('display/shop-floor/teams', { headers });
    let teams: Array<{ id: number; name: string }> = [];
    if (teamsResp.ok()) teams = await teamsResp.json();
    let teamId: number;
    if (teams.length > 0) {
      teamId = teams[0].id;
    } else {
      const createTeamResp = await ctx.post('display/shop-floor/teams', {
        headers, data: { name: 'Marketing Capture Team' },
      });
      if (!createTeamResp.ok()) return null;
      const team = await createTeamResp.json();
      teamId = team.id;
    }
    const deviceToken = `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const terminalResp = await ctx.post('display/shop-floor/terminal', {
      headers,
      data: { name: 'Marketing Capture Kiosk', deviceToken, teamId },
    });
    if (!terminalResp.ok()) return null;
    const terminal = await terminalResp.json();
    await ctx.dispose();
    return { deviceToken, terminal };
  } catch {
    return null;
  }
}

/**
 * Set the operator's PIN. Must be authenticated as the operator (the
 * SetPin handler reads userId from the JWT claim, not the request body).
 * Idempotent — overwrites whatever PIN was previously set, including
 * setting one for the first time. Used so the kiosk scan-login path
 * (badge + PIN) is wireable without touching the seed.
 */
async function ensureOperatorPin(operatorToken: string, pin: string): Promise<boolean> {
  try {
    const ctx = await request.newContext({ baseURL: API_BASE, ignoreHTTPSErrors: true });
    const resp = await ctx.post('auth/set-pin', {
      headers: { Authorization: `Bearer ${operatorToken}` },
      data: { pin },
    });
    await ctx.dispose();
    return resp.ok();
  } catch {
    return false;
  }
}

/**
 * Add a barcode scan identifier for an operator (admin call). Idempotent
 * via a marker prefix — first GETs the existing identifiers, skips the
 * POST when the same value already exists. Without this guard, re-runs
 * 400 on the unique-constraint check inside AddScanIdentifierHandler.
 */
async function ensureOperatorBarcode(adminToken: string, userId: number, barcodeValue: string): Promise<boolean> {
  try {
    const ctx = await request.newContext({ baseURL: API_BASE, ignoreHTTPSErrors: true });
    const headers = { Authorization: `Bearer ${adminToken}` };
    const existing = await ctx.get(`admin/users/${userId}/scan-identifiers`, { headers });
    if (existing.ok()) {
      const list = (await existing.json()) as Array<{ identifierValue: string; identifierType: string }>;
      if (list.some(x => x.identifierType === 'barcode' && x.identifierValue === barcodeValue)) {
        await ctx.dispose();
        return true;
      }
    }
    const resp = await ctx.post(`admin/users/${userId}/scan-identifiers`, {
      headers, data: { identifierType: 'barcode', identifierValue: barcodeValue },
    });
    await ctx.dispose();
    // 201 created OR 400 (already-registered race) both mean we're good.
    return resp.ok() || resp.status() === 400;
  } catch {
    return false;
  }
}

/**
 * Seed a small set of realistic interactions on a customer so the
 * customer-detail Interactions tab renders populated content for the
 * marketing communicate frame instead of the empty-state placeholder.
 * Idempotent — first GETs existing interactions and skips when ≥ 3
 * already exist (any source) so re-runs don't keep stacking entries.
 *
 * The interactions are intentionally believable: a discovery call, a
 * follow-up email with a quote attached, and a status meeting. Subjects
 * and bodies read like something a sales rep actually logs.
 */
async function seedCustomerInteractions(token: string, customerId: number): Promise<boolean> {
  try {
    const ctx = await request.newContext({ baseURL: API_BASE, ignoreHTTPSErrors: true });
    const headers = { Authorization: `Bearer ${token}` };
    const existing = await ctx.get(`customers/${customerId}/interactions`, { headers });
    if (existing.ok()) {
      const list = await existing.json() as Array<unknown>;
      if (Array.isArray(list) && list.length >= 3) {
        await ctx.dispose();
        return true;
      }
    }
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const items = [
      {
        type: 'Call',
        subject: 'Initial discovery — bracket assembly tooling',
        body: 'Spoke with Sarah re: production volume (~200/mo) and existing tooling. They\'re evaluating two suppliers; we need to follow up with a sample quote by Friday.',
        interactionDate: new Date(now - 7 * dayMs).toISOString(),
        durationMinutes: 32,
      },
      {
        type: 'Email',
        subject: 'Quote QT-00018 sent — pricing for Bracket Assy Rev C',
        body: 'Sent the formal quote with tiered pricing for 100/200/500 unit volumes. Included tooling lead-time estimate (~4 weeks) and our standard QC summary.',
        interactionDate: new Date(now - 4 * dayMs).toISOString(),
        durationMinutes: null,
      },
      {
        type: 'Meeting',
        subject: 'On-site review at Apex',
        body: 'Toured the assembly line, reviewed the Rev C drawing changes, and aligned on first-article timing. Sarah confirmed PO will issue this week.',
        interactionDate: new Date(now - 1 * dayMs).toISOString(),
        durationMinutes: 75,
      },
    ];
    for (const item of items) {
      await ctx.post(`customers/${customerId}/interactions`, {
        headers,
        data: {
          contactId: null,
          type: item.type,
          subject: item.subject,
          body: item.body,
          interactionDate: item.interactionDate,
          durationMinutes: item.durationMinutes,
        },
      });
    }
    await ctx.dispose();
    return true;
  } catch {
    return false;
  }
}

/**
 * Make sure the operator has 4 shop-floor jobs assigned to them so the
 * kiosk worker tile + actions overlay render with a populated YOUR JOBS
 * section instead of an empty tile.
 *
 * Previous version hard-coded job IDs 9 / 15 / 4, but each spec run
 * advances those jobs through the workflow (timer start in C-K-F3,
 * Mark Complete in C-K-F4) — after a few runs they're in "Payment
 * Received" (IsShopFloor=false) and the kiosk filters them out, leaving
 * akim's tile empty. The fix is to ask the API for whatever IS in a
 * shop-floor stage right now and claim 4 of those for akim.
 *
 * Algorithm:
 *   1. GET /display/shop-floor — returns every active job in any
 *      stage where IsShopFloor=true. This is exactly the same query
 *      the kiosk uses to render worker tiles, so anything we pick
 *      from this list is guaranteed to render.
 *   2. Prefer jobs that are unassigned (we don't want to steal from
 *      a different worker tile and leave THEM empty). Fall back to
 *      anything if there aren't 4 unassigned.
 *   3. PATCH /jobs/bulk/assign with the picked IDs + akim's user ID.
 *
 * Idempotent — re-runs just re-claim whatever's currently in stage,
 * which may be a different set than last run (because the workflow
 * keeps moving jobs forward), but the outcome is the same: akim has
 * 4 visible jobs.
 */
async function ensureOperatorHasShopFloorJobs(adminToken: string, operatorId: number): Promise<boolean> {
  try {
    const ctx = await request.newContext({ baseURL: API_BASE, ignoreHTTPSErrors: true });
    const headers = { Authorization: `Bearer ${adminToken}` };

    const overviewResp = await ctx.get('display/shop-floor', { headers });
    if (!overviewResp.ok()) {
      await ctx.dispose();
      return false;
    }
    const overview = await overviewResp.json() as { activeJobs?: Array<{ id: number; assigneeId: number | null }> };
    const allJobs = overview.activeJobs ?? [];
    if (allJobs.length === 0) {
      await ctx.dispose();
      return false;
    }

    // Already assigned to akim? We're done — these will render on his tile.
    const alreadyHis = allJobs.filter(j => j.assigneeId === operatorId);
    if (alreadyHis.length >= 4) {
      await ctx.dispose();
      return true;
    }

    const need = 4 - alreadyHis.length;
    const unassigned = allJobs.filter(j => j.assigneeId === null);
    const pickFrom = unassigned.length >= need
      ? unassigned
      : [...unassigned, ...allJobs.filter(j => j.assigneeId !== null && j.assigneeId !== operatorId)];
    const toClaim = pickFrom.slice(0, need).map(j => j.id);

    if (toClaim.length === 0) {
      await ctx.dispose();
      return true;
    }

    const resp = await ctx.patch('jobs/bulk/assign', {
      headers,
      data: { jobIds: toClaim, assigneeId: operatorId },
    });
    await ctx.dispose();
    return resp.ok();
  } catch {
    return false;
  }
}

/**
 * Stop any active timer for the authenticated user. Idempotent — POSTs
 * to /time-tracking/timer/stop and treats both 200 (stopped) and 4xx
 * (no active timer) as success. Used to wash out the kiosk-run state
 * before the mobile capture so the toggle button reliably fires a
 * "Timer started" success snackbar instead of a "Failed to start" error.
 */
async function ensureNoActiveTimer(token: string): Promise<boolean> {
  try {
    const ctx = await request.newContext({ baseURL: API_BASE, ignoreHTTPSErrors: true });
    const resp = await ctx.post('time-tracking/timer/stop', {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    await ctx.dispose();
    return resp.ok() || resp.status() === 400 || resp.status() === 404;
  } catch {
    return false;
  }
}

/** Clock the admin user in so /m/* mobile views show actual content. */
async function ensureClockedIn(token: string, userId: number): Promise<boolean> {
  try {
    const ctx = await request.newContext({ baseURL: API_BASE, ignoreHTTPSErrors: true });
    const headers = { Authorization: `Bearer ${token}` };
    const resp = await ctx.post('display/shop-floor/clock', {
      headers, data: { userId, eventType: 'ClockIn' },
    });
    await ctx.dispose();
    // 200/204 = clocked in; 400 = already clocked in (acceptable for our purposes).
    return resp.ok() || resp.status() === 400;
  } catch {
    return false;
  }
}

/**
 * App sample-screenshot tool — captures a curated 22-frame set of the
 * QB Engineer UI for downstream consumers (marketing pages, docs sites,
 * release notes, demo decks, presentations, etc.).
 *
 * Theme: dark. Mode: headless. Frames cover three storylines:
 *   - Story A "Lead to cash": customer overview, customer interactions,
 *     quote dialog, sales-order dialog, kanban, invoice dialog. Story A
 *     frames are unified around a single customer for narrative continuity.
 *   - Story B "Configured to your shop": discovery wizard arc + default-
 *     vs-trimmed sidebar closer.
 *   - Story C "Shop floor + Mobile": kiosk welcome / queue / detail /
 *     advance, mobile login / queue / scan / detail-with-toast, plus
 *     office-vs-floor closer pair.
 *
 * Output: `SAMPLES_OUT_DIR` env var (absolute path) takes precedence;
 * otherwise frames are written to `public/sample-screenshots/` next to
 * the spec's containing repo. Each subfolder (a-l2c, b-config, c-floor-*)
 * is overwritten on every run. A BATCH-SUMMARY.md sits alongside the
 * frames listing every captured path + caveats.
 *
 * Pre-flight (idempotent — re-runs are safe):
 *   - Pairs a kiosk terminal so /display/shop-floor renders past Setup.
 *   - Seeds three realistic customer interactions on the Story-A
 *     customer so the Interactions tab renders populated.
 *   - Sets the operator's PIN + a marketing barcode so both kiosk auth
 *     paths (badge+PIN, tap+password) work end-to-end.
 *   - Re-assigns three in-production jobs to the operator so the kiosk
 *     YOUR JOBS section renders Start/Done buttons.
 *   - Stops any active timer left from a prior run.
 *   - Clocks the admin and the operator in (mobile views gate on this).
 *
 * Known caveat: the html5-qrcode library used on /m/scan requires
 * `facingMode: "environment"` which Chromium's synthetic camera doesn't
 * satisfy, so the mobile-scan viewfinder shows the "Camera Unavailable"
 * empty state. Re-shoot on a real phone for a fully-realized scan frame.
 */

// Frames land in an output directory determined in this order:
//   1. SAMPLES_OUT_DIR env var (absolute path) — for downstream consumers
//      that want to land the frames directly into a marketing site,
//      release-notes folder, etc. without a copy step.
//   2. Default: `<repo-root>/public/sample-screenshots/` — committed-
//      friendly path that any clone of the repo will produce.
const OUTPUT_ROOT = process.env.SAMPLES_OUT_DIR
  ? path.resolve(process.env.SAMPLES_OUT_DIR)
  : path.resolve(__dirname, '..', '..', 'public', 'sample-screenshots');

const ADMIN_EMAIL = 'admin@qbengineer.local';
// Operator user for the mobile + kiosk tracks. Admin has no jobs
// assigned (admins aren't operators), so the mobile "My Jobs" and
// kiosk YOUR JOBS surfaces render empty when authed as admin. Akim is
// a seeded Engineer who already has shop-floor jobs assigned.
const OPERATOR_EMAIL = 'akim@qbengineer.local';

// Curated seed-data record IDs. The seed list endpoints are sorted
// recency-desc, which means stress-test runs of OTHER specs push their
// garbage names (e.g. "EDGE-004-Cust", "B6-Société Générale 株式会社
// 398a57") to the top. So we navigate directly to specific known-good
// records by ID rather than picking the "first row" from the list.
//
// All five Story-A frames are unified around customer #3 (Apex
// Manufacturing) so the screenshots read as a single customer's
// lifecycle — handy for marketing narrative AND for docs-site context:
//   • Customer 3 = Apex Manufacturing (overview + interactions)
//   • Quote 17  = QT-00010 Draft, P-1001 Precision Mounting Bracket
//                 Assembly @ $1,794.29 × 43, $82,941 with tax — the
//                 "convert moment" frame
//   • Order 16  = SO-2341AP Completed, 2 lines (P-1001 ×75 + P-1006
//                 Pneumatic Manifold Block ×12), $26,116 with tax,
//                 Net45, customer PO APEX-23-0534, shipped via UPS —
//                 the "commit" frame
//   • Invoice 15 = INV-2341AP Paid, $26,116 — pairs visually with the
//                 SO above (same total, same customer)
//
// IMPORTANT: the SalesOrderDetailDialog hits /api/v1/orders/{id}, not
// /api/v1/sales-orders/{id} — those are different aggregates with
// different ID spaces (the latter returns Job entities, despite the
// name). SAMPLE_SO_ID is the /orders ID.
const SAMPLE_CUSTOMER_ID = 3;
const SAMPLE_QUOTE_ID = 17;
const SAMPLE_SO_ID = 16;
const SAMPLE_INVOICE_ID = 15;

// Landscape viewport at 1280×800 (16:10). Big enough that the kiosk
// actions card, kanban with all 10 columns, and dashboard widgets render
// at full desktop layout (well past the 1024px tablet breakpoint), and
// the chrome-stripped clip lands at ~1228×756 — close to the audit
// doc's ~1000×625 source target without needing a post-resize step.
// Smaller than the previous 1600×1000 viewport so dialogs and detail
// surfaces fill more of the captured frame, improving readability when
// the marketing site scales them to display width.
const LANDSCAPE = { width: 1280, height: 800 } as const;
// Mobile emulation uses Playwright's built-in `devices['Pixel 7']`
// descriptor as the base. Pixel 7/8/9 all share the same CSS viewport
// profile (412×839 visible area, 412×915 screen, DPR 2.625), so the
// official Pixel 7 descriptor is the closest correct emulation for a
// "modern Pixel" — Playwright doesn't ship a Pixel 9 descriptor of its
// own. We override only the UA string to keep the Pixel 9 branding.
//
// Why not roll our own viewport: previously this used a hand-rolled
// 412×915 viewport, but 915 is the SCREEN height (including browser
// chrome). Real phones render at ~412×839 of CSS pixels because the
// URL bar + status bar consume the rest. Capturing at 412×915 made
// the source PNGs (1081×2402) taller than what an operator actually
// sees, so frames looked stretched in side-by-side comparisons.
const PIXEL_DEVICE = devices['Pixel 7'];
const PIXEL9_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

/** Captures a screenshot at the given output path, ensuring the dir exists. */
async function shoot(page: Page, outRel: string): Promise<string> {
  const fullPath = path.join(OUTPUT_ROOT, outRel);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  await page.screenshot({ path: fullPath, fullPage: false });
  return fullPath;
}

/**
 * Tight-crop landscape capture for marketing frames. Strips app chrome
 * (left sidebar + top header) by default, snaps to 16:10 aspect, optionally
 * focuses on a specific subject element instead of the full content area.
 *
 * Why: the marketing site renders these images at ~500–600px CSS width with
 * `object-fit: contain`; capturing the full 1600×1000 browser viewport
 * means most of the rendered pixels are dark wasted margin, the in-app
 * sidebar / header / breadcrumb text reads as noise, and the actual
 * subject (a dialog, a detail page, the kanban board) ends up tiny and
 * unreadable. The audit doc spec is "subject + a thin margin, not the
 * whole browser window".
 *
 * Strategy:
 *   1. If `selector` is given, query its bounding box and crop tight to
 *      it with a `margin` border.
 *   2. Otherwise, default to the viewport minus left sidebar (52px) and
 *      top header (44px) — yields 1548×956 ≈ 1.62 ratio (≈16:10).
 *   3. Snap the resulting rect to 16:10 by extending the shorter dimension
 *      symmetrically (centered) so subjects don't get vertically squished
 *      or horizontally clipped.
 *   4. Clamp to the viewport bounds (no out-of-bounds crops).
 */
const SIDEBAR_W = 52;
const HEADER_H = 44;
const TARGET_RATIO = 16 / 10;

function snapTo1610(
  box: { x: number; y: number; width: number; height: number },
  vp: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = box;
  const ratio = width / height;
  if (ratio < TARGET_RATIO) {
    // Too tall — extend width symmetrically.
    const newW = Math.min(vp.width, height * TARGET_RATIO);
    const dx = (newW - width) / 2;
    x = Math.max(0, Math.min(vp.width - newW, x - dx));
    width = newW;
  } else if (ratio > TARGET_RATIO) {
    // Too wide — extend height symmetrically.
    const newH = Math.min(vp.height, width / TARGET_RATIO);
    const dy = (newH - height) / 2;
    y = Math.max(0, Math.min(vp.height - newH, y - dy));
    height = newH;
  }
  // Final clamp (snap may push slightly out of bounds on edge cases).
  if (x < 0) { width += x; x = 0; }
  if (y < 0) { height += y; y = 0; }
  if (x + width > vp.width) width = vp.width - x;
  if (y + height > vp.height) height = vp.height - y;
  return { x, y, width, height };
}

async function tightShoot(
  page: Page,
  outRel: string,
  options: {
    /** CSS selector for the subject. Falls back to viewport-minus-chrome. */
    selector?: string;
    /** Pixel margin to add around the subject's bounding box. Default 16. */
    marginPx?: number;
    /** Viewport size to clamp against. Defaults to LANDSCAPE. */
    viewport?: { width: number; height: number };
    /**
     * Capture the entire viewport without stripping sidebar/header.
     * Use for surfaces that are NOT inside the standard app shell —
     * the Shop Floor kiosk display takes over the full viewport with
     * its own header, so stripping the default chrome would slice off
     * the kiosk's own status bar.
     */
    fullViewport?: boolean;
  } = {},
): Promise<string> {
  const fullPath = path.join(OUTPUT_ROOT, outRel);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const margin = options.marginPx ?? 16;
  const vp = options.viewport ?? LANDSCAPE;

  let rect: { x: number; y: number; width: number; height: number };
  if (options.selector) {
    const el = page.locator(options.selector).first();
    const box = await el.boundingBox().catch(() => null);
    if (box && box.width > 0 && box.height > 0) {
      rect = {
        x: box.x - margin,
        y: box.y - margin,
        width: box.width + 2 * margin,
        height: box.height + 2 * margin,
      };
    } else {
      // Selector missed — fall back per fullViewport flag.
      rect = options.fullViewport
        ? { x: 0, y: 0, width: vp.width, height: vp.height }
        : { x: SIDEBAR_W, y: HEADER_H, width: vp.width - SIDEBAR_W, height: vp.height - HEADER_H };
    }
  } else if (options.fullViewport) {
    rect = { x: 0, y: 0, width: vp.width, height: vp.height };
  } else {
    rect = { x: SIDEBAR_W, y: HEADER_H, width: vp.width - SIDEBAR_W, height: vp.height - HEADER_H };
  }
  rect = snapTo1610(rect, vp);
  await page.screenshot({ path: fullPath, clip: rect });
  return fullPath;
}

/** Sets dark theme by seeding localStorage *before* the app boots. */
async function setDarkTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('qbe-theme', 'dark');
  });
}

/** Helper — scrolls to top and waits a tick for any animations to settle. */
async function settle(page: Page, ms = 500): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(ms);
}

/**
 * Paint a generated "barcode on a slightly used cardboard box" image
 * over the `#qr-reader` viewport on /m/scan. Chromium's synthetic
 * camera (`--use-fake-device-for-media-stream`) renders a moving
 * green/red ball test pattern — fine as a "camera works" signal but
 * reads as radar in marketing frames. Replacing the html5-qrcode
 * <video> with a procedural cardboard+barcode image gives the frame
 * an honest "what an operator sees when scanning a part" look without
 * needing a real camera, ffmpeg, or a Y4M file at the launch arg.
 *
 * Generated entirely on-page via a single 2D canvas so this stays
 * dependency-free. Layers (bottom→top): cardboard base gradient,
 * fluted vertical grain, RGB noise pass, scuff marks, dirt smudges,
 * shipping label (slight tilt, paper gradient, drop shadow), Code-128-
 * lookalike bars, human-readable code text, fine-print product line,
 * lighting vignette.
 */
async function paintBarcodeOnCardboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const reader = document.getElementById('qr-reader');
    const viewport = document.querySelector('.scanner-viewport') as HTMLElement | null;
    if (!reader || !viewport) return;

    const cnv = document.createElement('canvas');
    const W = 800;
    const H = 600;
    cnv.width = W;
    cnv.height = H;
    const ctx = cnv.getContext('2d');
    if (!ctx) return;

    // Cardboard base — warm beige with subtle vertical gradient.
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#c8a878');
    grad.addColorStop(0.5, '#b89568');
    grad.addColorStop(1, '#a08555');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Fluted-cardboard vertical grain — irregular lines.
    for (let x = 0; x < W; x += 8) {
      ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.05 + 0.03})`;
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Per-pixel RGB noise for paper texture.
    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 30;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Scuff marks — short dark scribbles at random angles.
    for (let i = 0; i < 22; i++) {
      ctx.strokeStyle = `rgba(60, 35, 20, ${Math.random() * 0.4 + 0.1})`;
      ctx.lineWidth = Math.random() * 3 + 1;
      ctx.beginPath();
      const sx = Math.random() * W;
      const sy = Math.random() * H;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 30);
      ctx.stroke();
    }

    // Dirt smudges — soft radial gradients.
    for (let i = 0; i < 8; i++) {
      const cx = Math.random() * W;
      const cy = Math.random() * H;
      const r = Math.random() * 50 + 30;
      const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      radial.addColorStop(0, 'rgba(40, 25, 15, 0.3)');
      radial.addColorStop(1, 'rgba(40, 25, 15, 0)');
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shipping label — slight 2.3° tilt.
    ctx.save();
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(-0.04);
    const labelW = 500;
    const labelH = 290;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(-labelW / 2 + 6, -labelH / 2 + 6, labelW, labelH);

    const labelGrad = ctx.createLinearGradient(-labelW / 2, -labelH / 2, labelW / 2, labelH / 2);
    labelGrad.addColorStop(0, '#fbf8f0');
    labelGrad.addColorStop(1, '#ebe4d4');
    ctx.fillStyle = labelGrad;
    ctx.fillRect(-labelW / 2, -labelH / 2, labelW, labelH);

    ctx.strokeStyle = 'rgba(120, 100, 70, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-labelW / 2, -labelH / 2, labelW, labelH);

    // Code-128-lookalike bars — randomised stripe widths.
    const bcX = -labelW / 2 + 32;
    const bcY = -labelH / 2 + 56;
    const bcW = labelW - 64;
    const bcH = 140;
    const widths = [2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 4, 1, 2, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2];
    let cx = bcX;
    let i = 0;
    while (cx < bcX + bcW - 4) {
      const w = widths[i % widths.length];
      if (i % 2 === 0) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(cx, bcY, w * 1.7, bcH);
      }
      cx += w * 1.7;
      i++;
    }

    // Human-readable code under the barcode.
    ctx.fillStyle = '#222';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('P-1001-43-22A', 0, bcY + bcH + 30);

    // Fine-print product line.
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('PRECISION MOUNTING BRACKET ASSY · REV C', 0, bcY + bcH + 52);

    ctx.restore();

    // Soft vignette so edges don't read as flat colour.
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Replace whatever html5-qrcode rendered with our image. Wrap in
    // a relative-positioned div so we can layer the ghosted scan-region
    // guide on top of the cardboard photo.
    reader.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    wrap.style.display = 'block';

    const img = document.createElement('img');
    img.src = cnv.toDataURL('image/png');
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    wrap.appendChild(img);

    // Ghosted scan-region frame — the "place barcode here" guide that
    // any QR/barcode scanner overlays on top of the camera feed.
    // Built as inline SVG so it scales cleanly with the viewport and
    // doesn't depend on the html5-qrcode library's own scan region
    // (which we tore out when we set reader.innerHTML = '').
    //   • Outer dim mask (everything outside the frame goes ~50% darker)
    //   • Inner clear window (no overlay — viewer sees the full image)
    //   • Four corner brackets in primary green
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.innerHTML = `
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
           style="position:absolute;inset:0;width:100%;height:100%;">
        <defs>
          <mask id="scan-window">
            <rect width="100" height="100" fill="white"/>
            <rect x="15" y="28" width="70" height="44" rx="2" ry="2" fill="black"/>
          </mask>
        </defs>
        <rect width="100" height="100" fill="rgba(0,0,0,0.45)" mask="url(#scan-window)"/>
      </svg>
      <div style="position:absolute;left:15%;top:28%;width:70%;height:44%;">
        <span style="position:absolute;left:0;top:0;width:18px;height:18px;border-left:3px solid #00d4aa;border-top:3px solid #00d4aa;"></span>
        <span style="position:absolute;right:0;top:0;width:18px;height:18px;border-right:3px solid #00d4aa;border-top:3px solid #00d4aa;"></span>
        <span style="position:absolute;left:0;bottom:0;width:18px;height:18px;border-left:3px solid #00d4aa;border-bottom:3px solid #00d4aa;"></span>
        <span style="position:absolute;right:0;bottom:0;width:18px;height:18px;border-right:3px solid #00d4aa;border-bottom:3px solid #00d4aa;"></span>
      </div>
    `;
    wrap.appendChild(overlay);

    reader.appendChild(wrap);
    (reader as HTMLElement).style.minHeight = '360px';
    (reader as HTMLElement).style.background = '#000';

    const loading = viewport.querySelector('.scanner-viewport__loading') as HTMLElement | null;
    if (loading) loading.style.display = 'none';
  });
  // Give the <img> a moment to decode before screenshot.
  await page.waitForTimeout(200);
}

test.describe('App sample-screenshot batch', () => {
  test('captures the curated 22-frame set in dark theme', async ({ browser }) => {
    test.setTimeout(180_000); // 3 min budget for the whole batch.

    const session = await getAuthSession(ADMIN_EMAIL, SEED_PASSWORD);

    // Pre-flight: pair a kiosk terminal so /display/shop-floor renders the
    // actual welcome screen instead of the Terminal Setup gate. Returns
    // null if the API isn't reachable, in which case kiosk shots fall
    // back to the unpaired Terminal Setup screen (still useful as a
    // marketing frame, just not the canonical "welcome" surface).
    const kioskPairing = await ensurePairedKiosk(session.token);

    // Pre-flight: clock admin in so mobile views render content past the
    // "Clock in to access all features" gate. Operator-track marketing
    // frames want jobs visible, not the gate banner.
    await ensureClockedIn(session.token, session.user.id);

    // Pre-flight: seed customer interactions on Apex Manufacturing
    // (id 3) so the communicate frame (A-F2) renders a populated
    // Interactions tab instead of the empty-state placeholder.
    await seedCustomerInteractions(session.token, SAMPLE_CUSTOMER_ID);

    // Pre-flight: load the operator session up-front (we need it for the
    // mobile track AND to pre-set the operator's PIN for the kiosk
    // scan-login story). If this fails the operator-track frames fall
    // back to admin (with empty job lists), and the kiosk worker flow
    // skips the PIN-set step.
    const operatorSession = await getAuthSession(OPERATOR_EMAIL, SEED_PASSWORD).catch(() => null);

    // Pre-flight: wire up the operator for kiosk demos.
    //  1. Set their PIN (`1234`) so the kiosk badge+PIN auth is reachable.
    //  2. Add a marketing barcode (`MKT-AKIM-1`) so the same operator is
    //     scannable. Both calls are idempotent — re-runs are safe.
    // The actual capture below uses the simpler tap-name + password
    // path (no PIN entry required), but having both the PIN and barcode
    // configured means the tile/pad UI on screen reads as fully set-up
    // rather than half-staged.
    if (operatorSession) {
      await ensureOperatorPin(operatorSession.token, '1234');
      await ensureOperatorBarcode(session.token, operatorSession.user.id, 'MKT-AKIM-1');
      // Make sure the operator is clocked in too — the kiosk tile reads
      // "Clocked Out" otherwise, which looks half-asleep in marketing.
      await ensureClockedIn(operatorSession.token, operatorSession.user.id);
      // Wash out any active timer left from a prior run so the kiosk
      // F3 click on Start hits a clean state and produces a real
      // start instead of a "Conflict — timer already running" toast.
      await ensureNoActiveTimer(operatorSession.token);
      // Claim 3 shop-floor-stage jobs for the operator so the kiosk
      // YOUR JOBS section is populated with Start/Done buttons. Without
      // this step, every prior run of the spec advances akim's jobs
      // through to "Payment Received" and the kiosk filters them out.
      await ensureOperatorHasShopFloorJobs(session.token, operatorSession.user.id);
    }

    // ─── Landscape captures (16:10 at 1600x1000) ───────────────────────
    const desktop = await browser.newContext({
      viewport: LANDSCAPE,
      colorScheme: 'dark', // also nudge prefers-color-scheme.
      // baseURL doesn't inherit from playwright.config.use into manually-
      // created contexts — only into the test-fixture `page`. Set it here
      // so relative `page.goto('/leads')` calls resolve.
      baseURL: 'http://localhost:4200',
    });
    // Seed dark theme into every page before app boot, so even pre-auth
    // surfaces (the kiosk Terminal Setup screen, the login page) render
    // in dark — they otherwise default to light because no
    // user-preference exists yet. Also seed the kiosk pairing tokens
    // when available so /display/shop-floor renders the welcome grid
    // instead of the Terminal Setup admin-login gate.
    const initStateBlob = JSON.stringify({
      deviceToken: kioskPairing?.deviceToken ?? null,
      terminal: kioskPairing?.terminal ?? null,
    });
    await desktop.addInitScript((blob: string) => {
      const state = JSON.parse(blob) as { deviceToken: string | null; terminal: unknown };
      localStorage.setItem('qbe-theme', 'dark');
      localStorage.setItem('qbe-user-prefs.theme', 'dark');
      // The Shop Floor kiosk has its own theme signal that reads from
      // `sf-theme` in localStorage (independent of `qbe-theme`). Seed it
      // here so /display/shop-floor renders in dark from first paint —
      // otherwise the kiosk frames render light regardless of the rest
      // of the app's dark-theme seed.
      localStorage.setItem('sf-theme', 'dark');
      if (state.deviceToken) {
        localStorage.setItem('qbe-kiosk-device-token', state.deviceToken);
      }
      if (state.terminal) {
        localStorage.setItem('qbe-kiosk-terminal', JSON.stringify(state.terminal));
      }
    }, initStateBlob);
    const page = await desktop.newPage();
    await seedAuth(page, session);
    await setDarkTheme(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const captured: string[] = [];
    const skipped: { name: string; reason: string }[] = [];

    // ─── Story A: Lead to cash ─────────────────────────────────────────
    // Each frame navigates DIRECTLY to a curated record's detail surface
    // by id (see SAMPLE_*_ID constants at top). The previous "click
    // the first row in the list" approach picked up stress-test seed data
    // ("EDGE-004-Cust", "B6-Société Générale 株式会社 398a57") and often
    // fell back to capturing an empty list when the row click didn't
    // resolve a dialog in time.

    // A-F1 — "Capture": prospect/customer entry. The Leads feature is
    // gated by CAP-O2C-LEAD which is disabled on this seed, so we use
    // the customer-overview detail page as the on-message stand-in —
    // the customer record IS the captured prospect.
    try {
      await page.goto(`/customers/${SAMPLE_CUSTOMER_ID}/overview`, { waitUntil: 'networkidle' });
      await settle(page, 1000);
      captured.push(await tightShoot(page, 'a-l2c/f1-capture.png'));
    } catch (err) {
      skipped.push({ name: 'A-F1', reason: String((err as Error).message ?? err) });
    }

    // A-F2 — "Communicate": customer Interactions tab. seedCustomerInteractions
    // posted three realistic interactions (call/email/meeting) before this
    // ran so the table renders populated.
    try {
      await page.goto(`/customers/${SAMPLE_CUSTOMER_ID}/interactions`, { waitUntil: 'networkidle' });
      await settle(page, 1000);
      captured.push(await tightShoot(page, 'a-l2c/f2-communicate.png'));
    } catch (err) {
      skipped.push({ name: 'A-F2', reason: String((err as Error).message ?? err) });
    }

    // A-F3 — "Convert": quote detail dialog with line items + Send /
    // Delete actions. Quote 17 (QT-00010, Apex Manufacturing, $82,941
    // Draft, P-1001 ×43) is the canonical "convert moment" composition.
    // We crop tight to mat-dialog-container so the dimmed list page
    // behind the dialog doesn't bleed in.
    try {
      await page.goto(`/quotes?detail=quote:${SAMPLE_QUOTE_ID}`, { waitUntil: 'networkidle' });
      await settle(page, 1200); // dialog open animation + data fetch
      captured.push(await tightShoot(page, 'a-l2c/f3-convert.png', { selector: 'mat-dialog-container' }));
    } catch (err) {
      skipped.push({ name: 'A-F3', reason: String((err as Error).message ?? err) });
    }

    // A-F4 — "Commit": sales-order detail dialog. Order 16 (SO-2341AP,
    // Apex Manufacturing, Completed, $26,116 with 2 lines + customer
    // PO + Net45) matches the F6 invoice (INV-2341AP) for narrative
    // continuity. mat-dialog-container crop strips the dimmed list page.
    try {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
      await page.goto(`/sales-orders?detail=sales-order:${SAMPLE_SO_ID}`, { waitUntil: 'networkidle' });
      await settle(page, 1200);
      captured.push(await tightShoot(page, 'a-l2c/f4-commit.png', { selector: 'mat-dialog-container' }));
    } catch (err) {
      skipped.push({ name: 'A-F4', reason: String((err as Error).message ?? err) });
    }

    // A-F5 — "Make it": kanban board with ALL 10 production stage
    // columns visible. The default 1280×800 viewport only fits ~6
    // columns; the audit doc specifies "full kanban with all 10
    // columns", so we widen to KANBAN_WIDE (2000×800) just for this
    // capture, then snap back. The chrome-strip clip yields ~1948×756
    // — wider than the 1000×625 source target but the marketing site
    // will scale it via object-fit. The kanban is intentionally the
    // widest frame in the batch.
    // 2000×1250 keeps 16:10 aspect after chrome-strip (1948×1206 ≈ 1.61).
    // Height 800 was too short — snap-to-16:10 was clamping height to
    // viewport, producing a 2.4:1 letterbox kanban that lost rows.
    const KANBAN_WIDE = { width: 2000, height: 1250 };
    try {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
      await page.setViewportSize(KANBAN_WIDE);
      await page.goto('/kanban', { waitUntil: 'networkidle' });
      await settle(page, 1500); // kanban loads + animates in
      captured.push(await tightShoot(page, 'a-l2c/f5-make-it.png', { viewport: KANBAN_WIDE }));
    } catch (err) {
      skipped.push({ name: 'A-F5', reason: String((err as Error).message ?? err) });
    } finally {
      await page.setViewportSize(LANDSCAPE);
    }

    // A-F6 — "Close it": invoice detail dialog. Invoice 15 (INV-2341AP,
    // Apex Manufacturing, Paid, $26,116 with 2 lines + linked SO/Shipment)
    // is the closure of the SO captured in F4. mat-dialog-container crop.
    try {
      await page.goto(`/invoices?detail=invoice:${SAMPLE_INVOICE_ID}`, { waitUntil: 'networkidle' });
      await settle(page, 1200);
      captured.push(await tightShoot(page, 'a-l2c/f6-close-it.png', { selector: 'mat-dialog-container' }));
    } catch (err) {
      skipped.push({ name: 'A-F6', reason: String((err as Error).message ?? err) });
    }

    // ─── Story B: Configured to your shop ───────────────────────────────
    // The discovery wizard is at /admin/discovery. The audit doc treats
    // each step as its own frame. We progress through and capture.

    // B-F1 — wizard step 1
    try {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
      await page.goto('/admin/discovery', { waitUntil: 'networkidle' });
      await settle(page, 1200);
      captured.push(await tightShoot(page, 'b-config/f1-interview.png'));
    } catch (err) {
      skipped.push({ name: 'B-F1', reason: String((err as Error).message ?? err) });
    }

    // Helper — pick first option on the current question, then click Next.
    // The wizard buttons render as "NEXT →" (uppercase, trailing arrow),
    // so the matcher is case-insensitive and substring-only (no anchors).
    // Options render as label-wrapped radios, NOT button.chip — we click
    // the first label inside the question container.
    async function advanceWizardOnce(): Promise<boolean> {
      // Try to satisfy the current question by clicking the first option.
      const optionCandidates = [
        'label:has(input[type="radio"])',
        'label:has(input[type="checkbox"])',
        '.question__option',
        '[role="radio"]',
        '[role="option"]',
      ];
      for (const sel of optionCandidates) {
        const opt = page.locator(sel).first();
        if (await opt.isVisible({ timeout: 600 }).catch(() => false)) {
          await opt.click().catch(() => { /* swallow */ });
          await page.waitForTimeout(250);
          break;
        }
      }
      // Click Next. Substring match handles "NEXT →" / "Next" / "Continue".
      const nextBtn = page.locator('button', { hasText: /next|continue/i }).first();
      if (await nextBtn.isVisible({ timeout: 800 }).catch(() => false)
          && await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
        return true;
      }
      return false;
    }

    // B-F2 — mid-wizard. Advance ~4 questions in.
    try {
      for (let i = 0; i < 4; i++) {
        if (!(await advanceWizardOnce())) break;
      }
      await settle(page, 600);
      captured.push(await tightShoot(page, 'b-config/f2-refine.png'));
    } catch (err) {
      skipped.push({ name: 'B-F2', reason: String((err as Error).message ?? err) });
    }

    // B-F3 — preset recommendation / results. Walk to the end.
    try {
      for (let i = 0; i < 30; i++) {
        // First try to find a finish/recommend button — earlier exit if so.
        const finishBtn = page.locator('button', {
          hasText: /finish|apply|complete|recommend|see preset|see result|review/i,
        }).first();
        if (await finishBtn.isVisible({ timeout: 400 }).catch(() => false)
            && await finishBtn.isEnabled().catch(() => false)) {
          await finishBtn.click();
          await page.waitForTimeout(900);
          break;
        }
        if (!(await advanceWizardOnce())) break;
      }
      await settle(page, 800);
      captured.push(await tightShoot(page, 'b-config/f3-recommend.png'));
    } catch (err) {
      skipped.push({ name: 'B-F3', reason: String((err as Error).message ?? err) });
    }

    // B-F4 — dashboard with sidebar reflecting an applied preset
    try {
      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      await settle(page, 1000);
      captured.push(await tightShoot(page, 'b-config/f4-apply.png'));
    } catch (err) {
      skipped.push({ name: 'B-F4', reason: String((err as Error).message ?? err) });
    }

    // B-Closer Default install — capture admin/capabilities listing as the
    // "everything visible" stand-in. Honest given the real "all on" preset
    // would require a state mutation we're not making here.
    try {
      await page.goto('/admin/capabilities', { waitUntil: 'networkidle' });
      await settle(page, 1000);
      captured.push(await tightShoot(page, 'b-config/closer-default-on.png'));
    } catch (err) {
      skipped.push({ name: 'B-Closer-default', reason: String((err as Error).message ?? err) });
    }

    // B-Closer Your install — dashboard with current sidebar
    try {
      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      await settle(page, 800);
      captured.push(await tightShoot(page, 'b-config/closer-your-install.png'));
    } catch (err) {
      skipped.push({ name: 'B-Closer-your', reason: String((err as Error).message ?? err) });
    }

    // ─── Story C / Track 1 — Kiosk ──────────────────────────────────────

    // C-K-F1 — kiosk welcome. The kiosk takes over the full viewport
    // (no app sidebar / app header), so we use fullViewport so the
    // chrome-strip default doesn't slice into the kiosk's own header.
    try {
      await page.goto('/display/shop-floor', { waitUntil: 'networkidle' });
      await settle(page, 1500);
      captured.push(await tightShoot(page, 'c-floor-kiosk/f1-signin.png', { fullViewport: true }));
    } catch (err) {
      skipped.push({ name: 'C-K-F1', reason: String((err as Error).message ?? err) });
    }

    // C-K-F2/F3/F4 — sign in as the operator and walk through the actions
    // overlay. The kiosk dual-auth: tap a worker tile then enter password
    // (no PIN required), or scan a badge then enter PIN. We use the
    // tap+password path because the seed already gives us akim's password
    // (SEED_PASSWORD) — no extra state mutation needed for auth itself.
    if (operatorSession) {
      try {
        // Reload the kiosk page so we start from a fresh welcome state
        // instead of whatever leftover overlay C-K-F1 captured.
        await page.goto('/display/shop-floor', { waitUntil: 'networkidle' });
        await settle(page, 1500);

        const workerTile = page.locator(`[data-testid="sf-worker-${operatorSession.user.id}"]`);
        await workerTile.waitFor({ state: 'visible', timeout: 5000 });
        await workerTile.click();
        await page.waitForTimeout(600);

        // The PIN overlay rendered — but for password-auth path it labels
        // itself "Enter Password" and the input takes the operator's
        // login password. The data-testid is the same (sf-pin-input).
        const pinInput = page.locator('[data-testid="sf-pin-input"] input');
        await pinInput.waitFor({ state: 'visible', timeout: 3000 });
        await pinInput.fill(SEED_PASSWORD);
        await page.locator('[data-testid="sf-pin-submit"]').click();
        // Auth + actions-phase render takes ~1s + jobs load.
        await page.waitForTimeout(1800);

        // C-K-F2 — actions overlay with the operator's job queue inline.
        captured.push(await tightShoot(page, 'c-floor-kiosk/f2-queue.png', { fullViewport: true }));

        // C-K-F3 — start a timer on the first job (or stop if already
        // active). The button toggles based on hasActiveTimer; we click
        // whichever is rendered. The click triggers a brief loading
        // spinner then the "Done!" feedback banner.
        const startBtn = page.locator('[data-testid="sf-start-timer"]').first();
        const stopBtn = page.locator('[data-testid="sf-stop-timer"]').first();
        const timerBtn = (await startBtn.isVisible({ timeout: 1500 }).catch(() => false))
          ? startBtn
          : stopBtn;
        if (await timerBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await timerBtn.click();
          // Capture the immediate post-click state (spinner or feedback).
          // Wait just long enough for the action to complete + feedback to show.
          await page.waitForTimeout(900);
          captured.push(await tightShoot(page, 'c-floor-kiosk/f3-detail.png', { fullViewport: true }));
        } else {
          // No assigned jobs visible — fall back to capturing the actions
          // card alone. Still on-message but flagged in the summary.
          captured.push(await tightShoot(page, 'c-floor-kiosk/f3-detail.png', { fullViewport: true }));
          skipped.push({
            name: 'C-K-F3 (advisory)',
            reason: 'No timer button rendered (operator has no assigned jobs in this seed); captured the actions card alone.',
          });
        }

        // C-K-F4 — mark a job complete. The completion handler shows the
        // "Done!" feedback banner (sf-actions-card__feedback--success)
        // before auto-dismissing back to the welcome grid. Capture before
        // the banner disappears (default dismiss ~2s).
        const completeBtn = page.locator('[data-testid="sf-complete-job"]').first();
        if (await completeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await completeBtn.click();
          await page.waitForTimeout(700); // banner appears, queue not yet auto-dismissed
          captured.push(await tightShoot(page, 'c-floor-kiosk/f4-advance.png', { fullViewport: true }));
        } else {
          // Same fallback as F3.
          captured.push(await tightShoot(page, 'c-floor-kiosk/f4-advance.png', { fullViewport: true }));
          skipped.push({
            name: 'C-K-F4 (advisory)',
            reason: 'No complete button rendered; captured fallback frame.',
          });
        }
      } catch (err) {
        skipped.push({ name: 'C-K-F2/F3/F4', reason: String((err as Error).message ?? err) });
      }
    } else {
      skipped.push({
        name: 'C-K-F2/F3/F4',
        reason: 'Operator session unavailable — could not sign in to the kiosk.',
      });
    }

    // C-Closer Office (re-use kanban dense view) — same wide viewport
    // as A-F5 so all 10 stage columns are visible. The closer pair
    // (office vs floor) reads honestly when both halves capture the
    // full subject.
    try {
      await page.setViewportSize(KANBAN_WIDE);
      await page.goto('/kanban', { waitUntil: 'networkidle' });
      await settle(page, 1200);
      captured.push(await tightShoot(page, 'c-floor-closer/office.png', { viewport: KANBAN_WIDE }));
    } catch (err) {
      skipped.push({ name: 'C-Closer-Office', reason: String((err as Error).message ?? err) });
    } finally {
      await page.setViewportSize(LANDSCAPE);
    }

    // C-Closer Floor (re-use the kiosk welcome — same dimensions, same
    // subject as C-K-F1; pairs visually with the office kanban). Full
    // viewport because the kiosk has no app shell.
    try {
      await page.goto('/display/shop-floor', { waitUntil: 'networkidle' });
      await settle(page, 1200);
      captured.push(await tightShoot(page, 'c-floor-closer/floor.png', { fullViewport: true }));
    } catch (err) {
      skipped.push({ name: 'C-Closer-Floor', reason: String((err as Error).message ?? err) });
    }

    await desktop.close();

    // ─── Portrait captures (mobile track) ───────────────────────────────
    // Spread Playwright's built-in Pixel 7 descriptor (412×839 viewport,
    // 412×915 screen, DPR 2.625, isMobile, hasTouch) — same CSS profile
    // as Pixel 9. Override the UA to advertise as Pixel 9 for branding.
    const mobile = await browser.newContext({
      ...PIXEL_DEVICE,
      colorScheme: 'dark',
      userAgent: PIXEL9_UA,
      // Auto-grant camera so /m/scan getUserMedia resolves with the fake
      // synthetic video device wired up via Chromium's
      // --use-fake-device-for-media-stream launch arg (see
      // playwright.config.ts). Without both the launch arg AND the
      // permission grant the viewfinder shows the "camera blocked"
      // empty state instead of the synthetic feed.
      permissions: ['camera'],
    });
    await mobile.addInitScript(() => {
      localStorage.setItem('qbe-theme', 'dark');
      localStorage.setItem('qbe-user-prefs.theme', 'dark');
    });
    const mPage = await mobile.newPage();

    // C-M-F1 — login (sign-in screen on mobile viewport)
    try {
      await mPage.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
      await mPage.evaluate(() => localStorage.setItem('qbe-theme', 'dark'));
      await mPage.reload();
      await mPage.waitForLoadState('networkidle');
      await mPage.waitForTimeout(800);
      captured.push(await shoot(mPage, 'c-floor-mobile/f1-signin.png'));
    } catch (err) {
      skipped.push({ name: 'C-M-F1', reason: String((err as Error).message ?? err) });
    }

    // C-M-F2 / F3 / F4 — once logged in, the mobile feature mounts at `/m`
    // (not `/mobile` — that path doesn't exist). Sub-routes:
    //   /m/clock      — clock-in landing
    //   /m/jobs       — operator's job queue (F2 "see your work")
    //   /m/jobs/:id   — operator's job detail with timer toggle (F4 toast)
    //   /m/scan       — barcode scanner (F3 "camera as scanner")
    //
    // Use the operator session loaded above — admin has no jobs assigned,
    // so the mobile "My Jobs" view would render empty as admin.
    try {
      const sessionToUse = operatorSession ?? session;
      await seedAuth(mPage, sessionToUse);
      await mPage.evaluate(() => localStorage.setItem('qbe-theme', 'dark'));
      await mPage.reload();
      await mPage.waitForLoadState('networkidle');
      await mPage.waitForTimeout(1200);

      // F2 — operator job queue
      await mPage.goto('http://localhost:4200/m/jobs', { waitUntil: 'networkidle' });
      await mPage.waitForTimeout(1500);
      captured.push(await shoot(mPage, 'c-floor-mobile/f2-queue.png'));

      // F3 — barcode scanner UI. Chromium's synthetic camera renders
      // a moving green/red ball test pattern that reads as radar in
      // marketing frames. Wait long enough for html5-qrcode to attach
      // its <video>, then paint a generated barcode-on-cardboard image
      // (with ghosted scan-region overlay) over the viewport so the
      // frame shows what an operator actually sees while scanning.
      await mPage.goto('http://localhost:4200/m/scan', { waitUntil: 'networkidle' });
      await mPage.waitForTimeout(2000);
      await paintBarcodeOnCardboard(mPage);
      captured.push(await shoot(mPage, 'c-floor-mobile/f3-scan.png'));

      // F4 — drill into a job from the queue, toggle the timer to
      // produce a snackbar ("Timer started" / "Timer stopped"). The
      // snackbar is the visible audit toast the marketing frame asks
      // for ("a record landed: who, what, when, via: mobile-web").
      //
      // Pre-flight: stop any active timer left over from the kiosk run.
      // Without this, the operator already has a timer running on J-1042
      // (started in C-K-F3) and clicking Start on the mobile view returns
      // a "Failed to start timer" error snackbar instead of the success
      // "Timer started" we want to capture.
      if (operatorSession) {
        await ensureNoActiveTimer(operatorSession.token);
      }
      await mPage.goto('http://localhost:4200/m/jobs', { waitUntil: 'networkidle' });
      await mPage.waitForTimeout(1500);
      const firstJobLink = mPage.locator('a.job-item').first();
      let toastCaptured = false;
      if (await firstJobLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstJobLink.click();
        await mPage.waitForLoadState('networkidle');
        await mPage.waitForTimeout(1200);
        // Find the timer toggle button — the mobile-job-detail template
        // renders a single toggle button that calls `toggleTimer()`.
        // Match by text since there's no testid on the page.
        const timerToggle = mPage.locator('button', {
          hasText: /Start Timer|Stop Timer|Start|Stop/i,
        }).first();
        if (await timerToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          await timerToggle.click();
          // Snackbar appears + auto-dismisses at ~4s; capture mid-display.
          await mPage.waitForTimeout(800);
          captured.push(await shoot(mPage, 'c-floor-mobile/f4-advance.png'));
          toastCaptured = true;
        }
      }
      if (!toastCaptured) {
        // Fallback — capture /m/clock so we still have *something* for F4
        // and flag it for re-shoot.
        await mPage.goto('http://localhost:4200/m/clock', { waitUntil: 'networkidle' });
        await mPage.waitForTimeout(1500);
        captured.push(await shoot(mPage, 'c-floor-mobile/f4-advance.png'));
        skipped.push({
          name: 'C-M-F4 (advisory)',
          reason: 'Could not locate the timer toggle on /m/jobs/:jobId — captured /m/clock as the fallback. Re-shoot after verifying job detail has a clickable Start/Stop Timer button.',
        });
      }
    } catch (err) {
      skipped.push({ name: 'C-M-F2/F3/F4', reason: String((err as Error).message ?? err) });
    }

    await mobile.close();

    // ─── Summary write-out ─────────────────────────────────────────────
    const summary = [
      '# App sample-screenshot batch — run summary',
      '',
      `Generated ${new Date().toISOString()}`,
      '',
      '## Captured (PNG; convert to WebP at ~80% quality before shipping)',
      '',
      ...captured.map(p => `- ${path.relative(OUTPUT_ROOT, p).replace(/\\/g, '/')}`),
      '',
      '## Skipped / needs manual re-shoot',
      '',
      ...(skipped.length === 0
        ? ['(none)']
        : skipped.map(s => `- **${s.name}** — ${s.reason}`)),
      '',
      '## Known caveats (not blockers — these still capture, with notes)',
      '',
      '- **Mobile camera viewfinder** (`c-floor-mobile/f3-scan.png`):',
      '  Chromium\'s `--use-fake-device-for-media-stream` launch arg is set',
      '  + the context grants the camera permission, but `html5-qrcode`',
      '  requests `facingMode: "environment"` which the synthetic device',
      '  does not satisfy — viewfinder still shows "Camera Unavailable".',
      '  The frame captures the rest of the scan UI honestly (manual entry,',
      '  bottom nav, header). For a fully-realized "camera as scanner"',
      '  marketing frame, screenshot on a real phone.',
      '',
      '- **Operator setup pre-flight**: the spec sets the operator',
      '  (`akim@qbengineer.local`) up with PIN `1234` and barcode',
      '  `MKT-AKIM-1` so both kiosk auth paths (badge+PIN and tap+password)',
      '  work end-to-end. Helpers are idempotent — re-runs are safe.',
      '',
      '## Drop-in convention',
      '',
      'Convert PNGs to WebP and replace `.png` with `.webp` in the filenames before',
      'updating `armory-works-ui/src/app/pages/{home,work}/*.html` placeholders.',
      '',
      'On Windows: `magick mogrify -format webp -quality 80 *.png` in each story',
      'subfolder, or use `cwebp -q 80 input.png -o input.webp` per file.',
      '',
      'PowerShell one-liner for all five subfolders:',
      '',
      '```powershell',
      'cd e:\\dev\\armory-works\\armory-works-ui\\public\\stories',
      "foreach ($d in 'a-l2c','b-config','c-floor-kiosk','c-floor-mobile','c-floor-closer') {",
      '  cd $d; magick mogrify -format webp -quality 80 *.png; del *.png; cd ..',
      '}',
      '```',
      '',
    ].join('\n');

    const summaryPath = path.join(OUTPUT_ROOT, 'BATCH-SUMMARY.md');
    fs.writeFileSync(summaryPath, summary, 'utf8');

    // The test passes as long as we got SOME captures. Anything skipped is
    // logged in the summary file rather than failing the run.
    expect(captured.length).toBeGreaterThan(0);
  });
});
