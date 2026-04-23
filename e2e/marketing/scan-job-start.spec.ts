import { test, chromium, type BrowserContext } from '@playwright/test';
import { mkdir, readdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

const APP_BASE = process.env['SIM_APP_BASE'] ?? 'http://localhost:4200';
const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1';
const EMAIL = process.env['HERO_USER'] ?? 'admin@qbengineer.local';
const PASSWORD = process.env['SEED_USER_PASSWORD'] ?? 'Test1234!';
const OUTPUT_DIR = process.env['HERO_VIDEO_DIR'] ?? join(__dirname, 'output');
const VIDEO_NAME = 'scan-job-start.webm';

// Phone-ish portrait frame — keeps the asset weight low and tells the
// "software lives where the work happens" story more clearly than desktop.
const VIEWPORT = { width: 440, height: 956 };

/**
 * Records the hero "mobile scan → job result" flow. The mobile scan page
 * normally opens the device camera via html5-qrcode; in headless Chromium
 * that fails, so the spec injects a stub camera viewport with a mock
 * barcode to stand in for the live camera preview. The scan result is
 * driven through the component's real manual-entry path so the resulting
 * UI is genuine.
 *
 * Pacing is deliberately slow — every beat holds long enough to read.
 * The runner trims the leading ~1.5s of navigation so the first visible
 * frame is the loaded scan page (matching the hero poster requirement).
 */
test('records mobile scan → job result hero video', async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const login = (await loginRes.json()) as { token: string; user: unknown };

  // The mobile layout gates /m/scan behind an active clock-in — unclocked
  // users get bounced to /m/clock with a yellow "Clock in to access all
  // features" banner. Clock in via API up front so /m/scan renders.
  const clockStatusRes = await fetch(`${API_BASE}/time-tracking/clock-status`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  const clockStatus = clockStatusRes.ok
    ? ((await clockStatusRes.json()) as { isClockedIn?: boolean })
    : { isClockedIn: false };
  if (!clockStatus.isClockedIn) {
    const clockInRes = await fetch(`${API_BASE}/time-tracking/clock-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.token}`,
      },
      body: JSON.stringify({
        eventTypeCode: 'ClockIn',
        scanMethod: 'manual',
        source: 'hero-video',
      }),
    });
    if (!clockInRes.ok) {
      throw new Error(`Clock-in failed: ${clockInRes.status} ${await clockInRes.text()}`);
    }
  }

  const browser = await chromium.launch({ headless: true });
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: {
        dir: OUTPUT_DIR,
        size: VIEWPORT, // video frame size matches viewport — 440×956
      },
      // Block getUserMedia so html5-qrcode fails fast and we can inject
      // our stub viewport without fighting a real camera init loop.
      permissions: [],
    });

    const page = await context.newPage();

    // Forcibly neuter camera APIs so html5-qrcode fails fast and doesn't
    // keep the event loop busy retrying. Installed before any page script
    // runs so the mobile-scan component sees undefined MediaDevices.
    await context.addInitScript(() => {
      try {
        // @ts-expect-error — patching readonly APIs for test isolation
        navigator.mediaDevices = undefined;
      } catch {
        /* noop */
      }
    });

    await page.goto(`${APP_BASE}/`, { waitUntil: 'commit' });
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('qbe-token', token);
        localStorage.setItem('qbe-user', JSON.stringify(user));
        localStorage.setItem('qbe-onboarding-dismissed', 'true');
        // Dark theme feels right for the hero — matches the scanner viewport
        // aesthetic and reads well at thumbnail sizes on the marketing page.
        localStorage.setItem('qbe-theme', 'dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      },
      { token: login.token, user: login.user },
    );

    // Navigate to the mobile scan page
    await page.goto(`${APP_BASE}/m/scan`, { waitUntil: 'load' });
    await page.waitForSelector('.mobile-scan', { timeout: 10_000 });

    // Wait for the html5-qrcode init to fail and fall to the "camera unavailable"
    // state (or leave the scanning spinner in place). We'll replace whichever
    // one renders with our stub.
    await page.waitForTimeout(500);

    // Inject a stubbed camera viewport with a mock Code 128 barcode + scanning
    // crosshair. Replaces the real #qr-reader or the fallback block depending
    // on which the component rendered. Also injects a fixed caption overlay
    // that narrates the scene beats ("this happened → and then this").
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.id = 'hero-stub-style';
      style.textContent = `
        .scanner-viewport, .scanner-fallback {
          position: relative !important;
          display: block !important;
          width: 100% !important;
          aspect-ratio: 1 / 1 !important;
          background: linear-gradient(180deg, #1a1f2b 0%, #0e1420 100%) !important;
          border-radius: 16px !important;
          overflow: hidden !important;
          padding: 0 !important;
        }
        .scanner-viewport > *:not(.hero-camera-stub),
        .scanner-fallback > *:not(.hero-camera-stub) { display: none !important; }
        .hero-camera-stub {
          position: absolute !important; inset: 0 !important;
          background:
            radial-gradient(ellipse at center, rgba(255,255,255,0.06), transparent 60%),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0 2px, transparent 2px 4px);
        }
        .hero-camera-stub__label {
          position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 1px;
          color: rgba(255,255,255,0.55); text-transform: uppercase;
          transition: opacity 200ms ease;
        }
        /* Focus frame is the scanner's internal reticle. The barcode sits
           INSIDE this frame — that's how a real camera sees the label. */
        .hero-camera-stub__frame {
          position: absolute; top: 50%; left: 50%;
          width: 64%; aspect-ratio: 1; transform: translate(-50%, -50%);
          border: 2px solid rgba(107, 214, 169, 0.85);
          border-radius: 12px;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.25);
          pointer-events: none;
          overflow: hidden;
        }
        .hero-camera-stub__frame::before {
          content: ''; position: absolute; left: 0; right: 0;
          height: 2px; background: rgba(107, 214, 169, 0.9);
          box-shadow: 0 0 12px rgba(107, 214, 169, 0.8);
          animation: hero-scanline 2.4s ease-in-out infinite;
        }
        @keyframes hero-scanline {
          0%, 100% { top: 6%; opacity: 0.2; }
          50% { top: 94%; opacity: 1; }
        }
        .hero-camera-stub__barcode {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 78%; padding: 14px 12px;
          background: #f5f5f3; border-radius: 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          display: flex; flex-direction: column; gap: 8px; align-items: center;
          transition: opacity 250ms ease, filter 250ms ease;
        }
        .hero-camera-stub__bars {
          display: flex; gap: 1px; height: 56px; align-items: stretch; width: 100%;
        }
        .hero-camera-stub__bars span { background: #111; display: block; }
        .hero-camera-stub__code {
          font-family: 'IBM Plex Mono', monospace; font-size: 11px;
          letter-spacing: 2px; color: #111;
        }
        /* Sequential caption overlay — narrates cause-effect beats. */
        .hero-caption {
          position: fixed;
          left: 50%; bottom: 28px;
          transform: translate(-50%, 10px);
          max-width: 86%;
          padding: 10px 16px;
          background: rgba(14, 20, 32, 0.92);
          border: 1px solid rgba(107, 214, 169, 0.4);
          border-radius: 6px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          font-family: 'Space Grotesk', sans-serif;
          font-size: 14px; font-weight: 500; line-height: 1.35;
          color: #f5f5f3; text-align: center;
          letter-spacing: 0.2px;
          opacity: 0;
          transition: opacity 260ms ease, transform 260ms ease;
          pointer-events: none;
          z-index: 9999;
        }
        .hero-caption--visible {
          opacity: 1;
          transform: translate(-50%, 0);
        }
        .hero-caption__eyebrow {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(107, 214, 169, 0.95);
          margin-bottom: 3px;
        }
      `;
      document.head.appendChild(style);

      // Deterministic Code 128-ish bar pattern generator.
      const widths = [2, 1, 3, 1, 2, 1, 1, 2, 3, 1, 2, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 2, 3, 1, 2, 1, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1];
      const barsHtml = widths.map((w, i) =>
        `<span style="width:${w * 2}px;opacity:${i % 2 === 0 ? 1 : 0}"></span>`,
      ).join('');

      const stubHtml = `
        <div class="hero-camera-stub" id="hero-stub">
          <span class="hero-camera-stub__label" id="hero-stub-label">Scanning…</span>
          <div class="hero-camera-stub__frame">
            <div class="hero-camera-stub__barcode" id="hero-stub-barcode">
              <div class="hero-camera-stub__bars">${barsHtml}</div>
              <div class="hero-camera-stub__code" id="hero-stub-code">PT-1234</div>
            </div>
          </div>
        </div>
      `;

      const viewport =
        document.querySelector('.scanner-viewport') ??
        document.querySelector('.scanner-fallback');
      if (viewport) {
        viewport.insertAdjacentHTML('beforeend', stubHtml);
      }

      // Caption overlay (fixed position, above the scanner viewport).
      const caption = document.createElement('div');
      caption.className = 'hero-caption';
      caption.id = 'hero-caption';
      caption.innerHTML = '<span class="hero-caption__eyebrow" id="hero-caption-eyebrow"></span><span id="hero-caption-text"></span>';
      document.body.appendChild(caption);
    });

    // Helpers executed in the page context to drive the stub + captions.
    const setCaption = async (eyebrow: string, text: string) => {
      await page.evaluate(({ eyebrow, text }) => {
        const el = document.getElementById('hero-caption');
        const eb = document.getElementById('hero-caption-eyebrow');
        const tx = document.getElementById('hero-caption-text');
        if (!el || !eb || !tx) return;
        eb.textContent = eyebrow;
        tx.textContent = text;
        el.classList.add('hero-caption--visible');
      }, { eyebrow, text });
    };
    const clearCaption = async () => {
      await page.evaluate(() => {
        document.getElementById('hero-caption')?.classList.remove('hero-caption--visible');
      });
    };
    const setStubCode = async (code: string) => {
      await page.evaluate((c) => {
        const el = document.getElementById('hero-stub-code');
        if (el) el.textContent = c;
      }, code);
    };

    const submitScan = async (value: string) => {
      const input = page.locator('[data-testid="scan-manual-input"]');
      await input.waitFor({ state: 'visible', timeout: 5_000 });
      await input.fill('');
      await input.fill(value);
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-testid="scan-manual-submit"]',
        );
        btn?.click();
      });
    };

    const resumeScan = async () => {
      await page.evaluate(() => {
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-testid="scan-again-btn"]',
        );
        btn?.click();
      });
    };

    // ── SCENE START ─────────────────────────────────────────────────
    // BEAT 1: rest on the scanner — operator is hovering over the part label.
    await page.waitForTimeout(1400);
    await setCaption('Step 1', 'Scan the part on the shop floor');
    await page.waitForTimeout(2200);

    // BEAT 2: first decode — PT-1234. Manual entry is auto-opened on camera
    // failure, so we just fill + submit. parseScan matches "PT-1234" and
    // renders the scan-result card as "Part PT-1234".
    await submitScan('PT-1234');
    await page.waitForSelector('.scan-result', { timeout: 5_000 });
    await clearCaption();
    await page.waitForTimeout(220);
    await setCaption('Result', 'Part identified — no typing, no login');
    await page.waitForTimeout(2600);

    // BEAT 3: operator re-arms the scanner to shoot the work-order label.
    await clearCaption();
    await resumeScan();
    await page.waitForTimeout(220);
    await setStubCode('JOB-1050');
    await setCaption('Step 2', 'Scan the linked work order');
    await page.waitForTimeout(2100);

    // BEAT 4: second decode — JOB-1050 → "Job JOB-1050" scan result.
    await submitScan('JOB-1050');
    await page.waitForSelector('.scan-result', { timeout: 5_000 });
    await clearCaption();
    await page.waitForTimeout(220);
    await setCaption('Matched', 'Job opens ready to log partial completion');
    await page.waitForTimeout(2600);

    // BEAT 5: hover Open so the eye lands on the affordance while the
    // caption explains the payoff.
    const openBtn = page.locator('[data-testid="scan-open-btn"]').first();
    if (await openBtn.count()) {
      await openBtn.hover();
    }
    await page.waitForTimeout(1500);

    // Settle tail so the final frame isn't mid-transition.
    await clearCaption();
    await page.waitForTimeout(700);
    // ── SCENE END ───────────────────────────────────────────────────

    await page.close();
  } finally {
    if (context) await context.close();
    await browser.close();
  }

  const files = await readdir(OUTPUT_DIR);
  const webm = files.find(f => f.endsWith('.webm') && f !== VIDEO_NAME);
  if (webm) {
    await rename(join(OUTPUT_DIR, webm), join(OUTPUT_DIR, VIDEO_NAME));
  }
  process.stdout.write(`HERO_WEBM=${join(OUTPUT_DIR, VIDEO_NAME)}\n`);
});
