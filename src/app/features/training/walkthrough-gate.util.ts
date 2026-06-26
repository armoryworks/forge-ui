import { WalkthroughAdvanceGate } from './models/walkthrough-content.model';

export interface AttachedGate {
  /** Remove the listener. Safe to call multiple times. */
  detach: () => void;
  /** False when the gate could not bind (target element missing) — caller should fail open. */
  attached: boolean;
}

/**
 * Listens for the interaction described by `gate` and invokes `onSatisfied` once
 * it happens. Returns a detach handle. If the target element can't be resolved,
 * `attached` is false so the caller can unlock the step rather than trap the user.
 */
export function attachAdvanceGate(
  gate: WalkthroughAdvanceGate,
  stepElement: Element | undefined,
  onSatisfied: () => void,
): AttachedGate {
  const target: EventTarget | null =
    gate.event === 'keydown'
      ? document
      : gate.selector
        ? document.querySelector(gate.selector)
        : stepElement ?? null;

  if (!target) return { detach: () => {}, attached: false };

  let done = false;
  const handler = (ev: Event): void => {
    if (done) return;
    if (!gateMatches(gate, ev)) return;
    done = true;
    detach();
    onSatisfied();
  };

  // Capture phase for keydown so we observe global shortcuts even if the app
  // stops propagation while handling them.
  const useCapture = gate.event === 'keydown';
  target.addEventListener(gate.event, handler, useCapture);

  function detach(): void {
    target!.removeEventListener(gate.event, handler, useCapture);
  }

  return { detach, attached: true };
}

function gateMatches(gate: WalkthroughAdvanceGate, ev: Event): boolean {
  if (gate.event === 'keydown') {
    const e = ev as KeyboardEvent;
    if (gate.key && e.key.toLowerCase() !== gate.key.toLowerCase()) return false;
    // Treat Ctrl as the primary modifier — Cmd (metaKey) on macOS.
    if (gate.ctrlKey && !(e.ctrlKey || e.metaKey)) return false;
    if (gate.shiftKey && !e.shiftKey) return false;
    if (gate.altKey && !e.altKey) return false;
    return true;
  }

  if (gate.predicate === 'nonempty') {
    const t = ev.target as { value?: unknown } | null;
    const v = t && 'value' in t ? t.value : '';
    return String(v ?? '').trim().length > 0;
  }

  // click / change with no predicate — any occurrence satisfies.
  return true;
}
