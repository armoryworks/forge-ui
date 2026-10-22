import { MatDialogRef } from '@angular/material/dialog';

/** Moves focus to a confirm dialog's Cancel button once it opens, unless focus is already inside it. */
export function focusCancelOnOpen(ref: MatDialogRef<unknown, unknown>): void {
  ref.afterOpened().subscribe(() => {
    const container = document.getElementById(ref.id);
    if (!container || container.contains(document.activeElement)) return;
    container.querySelector<HTMLElement>('[data-testid="confirm-dialog-cancel"]')?.focus();
  });
}
