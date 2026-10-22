/** Implemented by a MatDialog component that handles Escape itself, normally by running its own cancel or close path. */
export interface DialogEscapeHandler {
  onDialogEscape(): void;
}

/** Dialog data a caller can pass to keep a dialog open on Escape: `{ escapeCloses: false }`. */
export interface DialogEscapeOptions {
  escapeCloses?: boolean;
}
