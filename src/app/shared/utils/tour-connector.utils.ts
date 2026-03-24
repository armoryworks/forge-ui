/**
 * SVG connector drawn between the driver.js popover and the highlighted element.
 * No dark overlay — this replaces it with a dashed outline + bezier arrow.
 *
 * Color: var(--warning) amber — stands out against teal column borders and white surfaces.
 * White halo behind strokes ensures visibility on both dark and light backgrounds.
 *
 * Group mode: when the active element has `data-tour="X"` and other elements
 * have `data-tour-group="X"`, each group element gets its own highlight rect
 * and connector arrow.
 *
 * Centering strategy: driver.js positions the popover via floating-ui's
 * `transform: translate(x, y)`. We use the SEPARATE CSS `translate` property
 * which composes additively (translate × transform = final position). This means
 * floating-ui can keep updating `transform` without overriding our centering.
 */

const NS         = 'http://www.w3.org/2000/svg';
const SHAPE_CLASS = 'qb-tour-shape';
const COLOR       = 'var(--warning)';
const HALO        = 'rgba(255,255,255,0.85)';
const PAD         = 7;

// Viewport position the popover should stay at regardless of scroll.
// Set when popover is centered; updated when user drags.
// null = no active pin (tour not running or step uses viewport element).
let pinnedViewportX: number | null = null;
let pinnedViewportY: number | null = null;

// ── Overlay scroll fix ────────────────────────────────────────────────────────
// Driver.js creates a full-screen overlay even at opacity 0. Its default
// pointer-events:auto intercepts wheel/touch events and breaks board scroll.
// We inject a single rule to make it pass-through.
const STYLE_ID = 'qb-tour-overlay-fix';

function injectOverlayFix(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  // driver.js injects `.driver-active * { pointer-events: none }` which kills scroll on
  // all board/page elements, and `:not(body):has(> .driver-active-element) { overflow: hidden }`
  // which locks layout. Since we use overlayOpacity:0 there is no visual blocker — undo both.
  s.textContent = [
    // Re-enable pointer events for all page content (allows scroll + drag).
    // driver.js injects `.driver-active * { pointer-events: none }` which kills all scroll.
    '.driver-active *{pointer-events:auto!important}',
    // Keep the driver overlay SVG, our connector SVG, and ALL CDK overlay elements
    // (Material tooltips, menus, dialogs) pass-through / non-interactive.
    // Without this, Material tooltip overlays receive mouseenter, causing the trigger
    // button to fire mouseleave → tooltip hides → button regains hover → tooltip shows
    // → rapid 300-500ms flash cycle.
    // ID selector (#qb-tour-connector specificity 1,0,0) beats the class rule above.
    '.driver-overlay,#qb-tour-connector,.cdk-overlay-container,.cdk-overlay-container *{pointer-events:none!important}',
  ].join('');
  document.head.appendChild(s);
}

function removeOverlayFix(): void {
  document.getElementById(STYLE_ID)?.remove();
}

// ── CSS translate helpers ─────────────────────────────────────────────────────
// We position the popover via the CSS `translate` property (not `transform`).
// floating-ui only touches `transform`, so both compose without conflict.

function getPopoverTranslate(popover: HTMLElement): [number, number] {
  const t = popover.style.translate;
  if (!t || t === 'none') return [0, 0];
  const parts = t.trim().split(/\s+/);
  return [parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 0];
}

function setPopoverTranslate(popover: HTMLElement, x: number, y: number): void {
  popover.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
}

function clearPopoverTranslate(popover: HTMLElement): void {
  popover.style.translate = '';
}

// ── Draggable popover ─────────────────────────────────────────────────────────
/**
 * Makes the popover draggable by its title bar. Idempotent.
 * Drag is tracked via the CSS `translate` property so it composes with
 * floating-ui's `transform` positioning without conflicts.
 * Uses document-level pointermove/up — no setPointerCapture so browser scroll
 * gestures are never intercepted.
 */
export function setupPopoverDraggable(): void {
  const popover = document.querySelector('.driver-popover') as HTMLElement | null;
  if (!popover || popover.dataset['qbDrag'] === '1') return;
  popover.dataset['qbDrag'] = '1';

  const handle = (popover.querySelector('.driver-popover-title') as HTMLElement | null) ?? popover;
  handle.style.cursor    = 'grab';
  handle.style.userSelect = 'none';
  handle.title = 'Drag to move';

  let dragging = false;
  let startX = 0, startY = 0, originX = 0, originY = 0;

  const onDocMove = (e: PointerEvent) => {
    if (!dragging) return;
    setPopoverTranslate(popover, originX + e.clientX - startX, originY + e.clientY - startY);
  };

  const onDocUp = () => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = 'grab';
    document.removeEventListener('pointermove',   onDocMove);
    document.removeEventListener('pointerup',     onDocUp);
    document.removeEventListener('pointercancel', onDocUp);
    // Update pin so scroll maintains the dragged position, not the original center
    const r = popover.getBoundingClientRect();
    pinnedViewportX = r.left;
    pinnedViewportY = r.top;
  };

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    // Read current CSS translate (our offset) as drag origin
    [originX, originY] = getPopoverTranslate(popover);
    handle.style.cursor = 'grabbing';
    document.addEventListener('pointermove',   onDocMove);
    document.addEventListener('pointerup',     onDocUp);
    document.addEventListener('pointercancel', onDocUp);
  });
}

// ── Scroll container detection ────────────────────────────────────────────────
function findScrollContainerRect(el: HTMLElement): DOMRect {
  let node: HTMLElement | null = el.parentElement;
  let depth = 0;
  while (node && node !== document.documentElement && depth < 12) {
    const style = window.getComputedStyle(node);
    if (/auto|scroll/.test(style.overflowX) || /auto|scroll/.test(style.overflow)) {
      return node.getBoundingClientRect();
    }
    node = node.parentElement;
    depth++;
  }
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

function isViewportElement(el: HTMLElement): boolean {
  if (el === document.body || el === document.documentElement) return true;
  const r = el.getBoundingClientRect();
  return r.width > window.innerWidth * 0.85 && r.height > window.innerHeight * 0.85;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
function makePath(d: string, stroke: string, width: string, dash: string, marker?: string): SVGPathElement {
  const p = document.createElementNS(NS, 'path');
  p.classList.add(SHAPE_CLASS);
  p.setAttribute('d', d);
  p.setAttribute('stroke', stroke);
  p.setAttribute('stroke-width', width);
  p.setAttribute('stroke-dasharray', dash);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  if (marker) p.setAttribute('marker-end', marker);
  return p;
}

export function createTourSvg(): SVGSVGElement {
  injectOverlayFix();

  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  svg.id = 'qb-tour-connector';
  Object.assign(svg.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100vw', height: '100vh',
    pointerEvents: 'none',
    // Must be above driver.js overlay (10000) and CDK compositing layers,
    // but below driver.js popover (1,000,000,000).
    zIndex: '999999',
    overflow: 'visible',
  });

  const defs = document.createElementNS(NS, 'defs');

  const mkHalo = document.createElementNS(NS, 'marker');
  mkHalo.setAttribute('id', 'qb-tour-arrow-halo');
  mkHalo.setAttribute('markerWidth', '12'); mkHalo.setAttribute('markerHeight', '12');
  mkHalo.setAttribute('refX', '9');        mkHalo.setAttribute('refY', '4');
  mkHalo.setAttribute('orient', 'auto');
  const haloArrow = document.createElementNS(NS, 'path');
  haloArrow.setAttribute('d', 'M0,0 L0,8 L10,4 z');
  haloArrow.setAttribute('fill', HALO);
  mkHalo.appendChild(haloArrow);
  defs.appendChild(mkHalo);

  const mk = document.createElementNS(NS, 'marker');
  mk.setAttribute('id', 'qb-tour-arrow');
  mk.setAttribute('markerWidth', '10'); mk.setAttribute('markerHeight', '10');
  mk.setAttribute('refX', '8');        mk.setAttribute('refY', '3.5');
  mk.setAttribute('orient', 'auto');
  const arrow = document.createElementNS(NS, 'path');
  arrow.setAttribute('d', 'M0,0 L0,7 L9,3.5 z');
  arrow.setAttribute('fill', COLOR);
  mk.appendChild(arrow);
  defs.appendChild(mk);

  svg.appendChild(defs);
  return svg;
}

export function clearTourConnector(svg: SVGSVGElement): void {
  svg.querySelectorAll(`.${SHAPE_CLASS}`).forEach(el => el.remove());
  // Reset our centering/nudge translate and pin so the next step starts fresh
  const popover = document.querySelector('.driver-popover') as HTMLElement | null;
  if (popover) clearPopoverTranslate(popover);
  pinnedViewportX = null;
  pinnedViewportY = null;
}

export function attachScrollRefresh(svg: SVGSVGElement): () => void {
  // Coalesce rapid-fire scroll events (e.g., from CDK drop list columns) into a
  // single rAF update so we don't flood the DOM with repeated shape removal/redraw.
  let pending = false;
  const refresh = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      updateTourConnector(svg);
    });
  };
  window.addEventListener('scroll', refresh, { capture: true, passive: true });
  return () => {
    window.removeEventListener('scroll', refresh, { capture: true } as EventListenerOptions);
    removeOverlayFix();
  };
}

// ── Highlight rect ────────────────────────────────────────────────────────────
function drawHighlightRect(svg: SVGSVGElement, eRect: DOMRect): void {
  const haloRect = document.createElementNS(NS, 'rect');
  haloRect.classList.add(SHAPE_CLASS);
  haloRect.setAttribute('x',            String(eRect.left   - PAD));
  haloRect.setAttribute('y',            String(eRect.top    - PAD));
  haloRect.setAttribute('width',        String(eRect.width  + PAD * 2));
  haloRect.setAttribute('height',       String(eRect.height + PAD * 2));
  haloRect.setAttribute('fill',         'none');
  haloRect.setAttribute('stroke',       HALO);
  haloRect.setAttribute('stroke-width', '5');
  svg.appendChild(haloRect);

  const outline = document.createElementNS(NS, 'rect');
  outline.classList.add(SHAPE_CLASS);
  outline.setAttribute('x',            String(eRect.left   - PAD));
  outline.setAttribute('y',            String(eRect.top    - PAD));
  outline.setAttribute('width',        String(eRect.width  + PAD * 2));
  outline.setAttribute('height',       String(eRect.height + PAD * 2));
  outline.setAttribute('fill',         'rgba(255,200,0,0.06)');
  outline.setAttribute('stroke',       COLOR);
  outline.setAttribute('stroke-width', '2.5');
  outline.setAttribute('stroke-dasharray', '6 3');
  svg.appendChild(outline);

  const corners: [number, number][] = [
    [eRect.left   - PAD - 4, eRect.top    - PAD - 4],
    [eRect.right  + PAD - 3, eRect.top    - PAD - 4],
    [eRect.left   - PAD - 4, eRect.bottom + PAD - 3],
    [eRect.right  + PAD - 3, eRect.bottom + PAD - 3],
  ];
  for (const [cx, cy] of corners) {
    const hSq = document.createElementNS(NS, 'rect');
    hSq.classList.add(SHAPE_CLASS);
    hSq.setAttribute('x', String(cx - 1)); hSq.setAttribute('y', String(cy - 1));
    hSq.setAttribute('width', '9'); hSq.setAttribute('height', '9');
    hSq.setAttribute('fill', HALO);
    svg.appendChild(hSq);

    const sq = document.createElementNS(NS, 'rect');
    sq.classList.add(SHAPE_CLASS);
    sq.setAttribute('x', String(cx)); sq.setAttribute('y', String(cy));
    sq.setAttribute('width', '7'); sq.setAttribute('height', '7');
    sq.setAttribute('fill', COLOR);
    svg.appendChild(sq);
  }
}

// ── Centering + nudging (step-change only) ────────────────────────────────────
/**
 * Centers the popover in the viewport by setting the CSS `translate` property.
 * The CSS `translate` property composes with floating-ui's `transform` additively,
 * so floating-ui can reposition via `transform` without overriding our centering.
 *
 * Must be called after floating-ui has set its initial `transform` (i.e., inside
 * a requestAnimationFrame from the `onHighlighted` callback).
 */
function centerPopover(popover: HTMLElement): void {
  const r = popover.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const [tx, ty] = getPopoverTranslate(popover);
  const cx = (window.innerWidth  - r.width)  / 2;
  const cy = (window.innerHeight - r.height) / 2;
  // Delta: how far we need to shift from current screen position to center.
  // Since translate composes before transform: final = (tx + dx) + floatingUiX
  // We want final = cx = r.left (current) + dx → dx = cx - r.left
  setPopoverTranslate(popover, tx + (cx - r.left), ty + (cy - r.top));
  // Pin this viewport position so scroll doesn't drift the popover
  pinnedViewportX = cx;
  pinnedViewportY = cy;
}

/**
 * Re-applies the pinned viewport position on each scroll frame.
 * floating-ui's autoUpdate repositions `transform` when the board scrolls;
 * our `translate` offset stays fixed, so the final position drifts.
 * This function corrects the `translate` to keep the popover at its pinned spot.
 */
function maintainPinnedPosition(popover: HTMLElement): void {
  if (pinnedViewportX === null || pinnedViewportY === null) return;
  const r = popover.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const [tx, ty] = getPopoverTranslate(popover);
  setPopoverTranslate(popover, tx + (pinnedViewportX - r.left), ty + (pinnedViewportY - r.top));
}

function nudgePopoverFromElements(popover: HTMLElement, els: HTMLElement[]): void {
  const pad   = 12;
  const pRect = popover.getBoundingClientRect();
  let overlaps = false;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (pRect.right > r.left - pad && pRect.left < r.right + pad &&
        pRect.bottom > r.top - pad && pRect.top  < r.bottom + pad) {
      overlaps = true;
      break;
    }
  }
  if (!overlaps) return;

  const maxBottom  = Math.max(...els.map(e => e.getBoundingClientRect().bottom));
  const minTop     = Math.min(...els.map(e => e.getBoundingClientRect().top));
  const spaceBelow = window.innerHeight - maxBottom;

  const [tx, ty] = getPopoverTranslate(popover);
  if (spaceBelow >= minTop) {
    const shift = maxBottom + pad + 8 - pRect.top;
    if (shift > 0) setPopoverTranslate(popover, tx, ty + shift);
  } else {
    const shift = pRect.bottom - (minTop - pad - 8);
    if (shift > 0) setPopoverTranslate(popover, tx, ty - shift);
  }
  // Re-read final position after nudge and update pin so scroll maintains it
  const finalRect = popover.getBoundingClientRect();
  pinnedViewportX = finalRect.left;
  pinnedViewportY = finalRect.top;
}

// ── Orthogonal (L-shaped) connector ───────────────────────────────────────────
/**
 * Draws a two-segment axis-aligned path with exactly one 90-degree corner.
 *
 * Direction rules:
 *   - Popover below element  → exits popover top,    enters element bottom — horizontal first
 *   - Popover above element  → exits popover bottom, enters element top    — horizontal first
 *   - Popover right          → exits popover left,   enters element right  — vertical first
 *   - Popover left           → exits popover right,  enters element left   — vertical first
 *
 * Corner placement:
 *   - Horizontal-first (vertical layout): corner at (endX, startY)
 *     — moves horizontally to align with element X, then drops/rises to element edge
 *   - Vertical-first (horizontal layout): corner at (startX, endY)
 *     — moves vertically to align with element Y, then runs horizontally to element edge
 */
function drawOrthogonalConnector(svg: SVGSVGElement, eRect: DOMRect, pRect: DOMRect): void {
  const eCx = eRect.left + eRect.width  / 2;
  const eCy = eRect.top  + eRect.height / 2;
  const pCx = pRect.left + pRect.width  / 2;
  const pCy = pRect.top  + pRect.height / 2;

  let startX: number, startY: number, endX: number, endY: number;
  let cornerX: number, cornerY: number;

  if (pRect.top >= eRect.bottom) {
    // Popover below — exit top of popover, enter bottom of element, horizontal first
    startX = pCx; startY = pRect.top;
    endX   = eCx; endY   = eRect.bottom + PAD;
    cornerX = endX; cornerY = startY;
  } else if (pRect.bottom <= eRect.top) {
    // Popover above — exit bottom of popover, enter top of element, horizontal first
    startX = pCx; startY = pRect.bottom;
    endX   = eCx; endY   = eRect.top - PAD;
    cornerX = endX; cornerY = startY;
  } else if (pRect.left >= eRect.right) {
    // Popover right — exit left of popover, enter right of element, vertical first
    startX = pRect.left;        startY = pCy;
    endX   = eRect.right + PAD; endY   = eCy;
    cornerX = startX; cornerY = endY;
  } else {
    // Popover left — exit right of popover, enter left of element, vertical first
    startX = pRect.right;      startY = pCy;
    endX   = eRect.left - PAD; endY   = eCy;
    cornerX = startX; cornerY = endY;
  }

  const d = `M ${startX} ${startY} L ${cornerX} ${cornerY} L ${endX} ${endY}`;
  svg.appendChild(makePath(d, HALO,  '5',   'none'));
  svg.appendChild(makePath(d, COLOR, '2.5', '6 3', 'url(#qb-tour-arrow)'));
}

// ── Main update ───────────────────────────────────────────────────────────────
export function updateTourConnector(svg: SVGSVGElement, options?: { center?: boolean }): void {
  // Remove only the SVG shapes — do NOT call clearTourConnector() here because that
  // resets the CSS translate and pinned position, which causes scroll drift.
  svg.querySelectorAll(`.${SHAPE_CLASS}`).forEach(el => el.remove());

  const activeEl = document.querySelector('.driver-active-element') as HTMLElement | null;
  const popover  = document.querySelector('.driver-popover')         as HTMLElement | null;
  if (!activeEl || !popover) return;
  if (isViewportElement(activeEl)) return;

  const shouldCenter = options?.center === true;

  if (shouldCenter) {
    // Step change: start fresh — clear old translate and pin before re-centering.
    clearPopoverTranslate(popover);
    pinnedViewportX = null;
    pinnedViewportY = null;
  } else {
    // Scroll update: re-apply the pinned viewport position to counteract
    // floating-ui's autoUpdate repositioning the `transform` on scroll.
    maintainPinnedPosition(popover);
  }

  const dataTourValue = activeEl.getAttribute('data-tour');
  const groupEls = dataTourValue
    ? (Array.from(document.querySelectorAll(`[data-tour-group~="${dataTourValue}"]`)) as HTMLElement[])
    : [];

  if (groupEls.length > 0) {
    const clipRect = findScrollContainerRect(groupEls[0]);
    const visibleGroupEls = groupEls.filter(el => {
      const r  = el.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      return cx >= clipRect.left && cx <= clipRect.right
          && cy >= clipRect.top  && cy <= clipRect.bottom;
    });
    for (const el of visibleGroupEls) {
      drawHighlightRect(svg, el.getBoundingClientRect());
    }
    if (shouldCenter) {
      centerPopover(popover);
      nudgePopoverFromElements(popover, visibleGroupEls);
    }
    const freshPRect = popover.getBoundingClientRect();
    for (const el of visibleGroupEls) {
      drawOrthogonalConnector(svg, el.getBoundingClientRect(), freshPRect);
    }
    return;
  }

  if (shouldCenter) centerPopover(popover);
  const pRect = popover.getBoundingClientRect();
  const eRect = activeEl.getBoundingClientRect();
  drawHighlightRect(svg, eRect);
  drawOrthogonalConnector(svg, eRect, pRect);
}
