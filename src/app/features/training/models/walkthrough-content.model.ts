export interface WalkthroughPopover {
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Optional interaction gate on a walkthrough step. When present and the module
 * has NOT been completed before (first run), the step is "locked" — the Next
 * button is disabled until the user actually performs the interaction, at which
 * point the tour advances automatically. On a repeat run (already completed) the
 * gate is advisory only: Next stays available so the user can skip ahead.
 */
export interface WalkthroughAdvanceGate {
  /** DOM event that can satisfy the step. */
  event: 'input' | 'change' | 'click' | 'keydown';
  /**
   * Element to listen on (CSS selector). Defaults to the step's highlighted
   * element. For `keydown` the listener is always document-level (global shortcut).
   */
  selector?: string;
  /** For `keydown`: the key to match, case-insensitive (e.g. 'k', 'Enter'). */
  key?: string;
  /** For `keydown`: require the primary modifier (Ctrl on Win/Linux, Cmd on macOS). */
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  /** For `input`/`change`: require the target's value to be non-empty. */
  predicate?: 'nonempty';
  /** Short instruction shown while the step is locked (e.g. 'Type a search term to continue.'). */
  hint?: string;
}

export interface WalkthroughStep {
  element?: string;
  popover: WalkthroughPopover;
  advanceOn?: WalkthroughAdvanceGate;
}

export interface WalkthroughContent {
  appRoute: string;
  startButtonLabel: string;
  steps: WalkthroughStep[];
}
