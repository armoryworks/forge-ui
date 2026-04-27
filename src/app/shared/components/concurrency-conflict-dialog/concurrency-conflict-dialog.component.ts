import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TranslatePipe } from '@ngx-translate/core';

export interface ConcurrencyConflictDialogData {
  resource: string | null;
}

export type ConcurrencyConflictResolution = 'reload' | 'cancel';

/**
 * Phase 3 / WU-11 / TODO E1 — modal shown on 412 Precondition Failed.
 *
 * Two-button dialog: "Reload" re-fetches the entity (default action), or
 * "Cancel" dismisses the dialog and leaves the user's edits in place.
 *
 * Cases: CONC-OPTIMISTIC-LOCK-001.
 */
@Component({
  selector: 'app-concurrency-conflict-dialog',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe],
  templateUrl: './concurrency-conflict-dialog.component.html',
  styleUrl: './concurrency-conflict-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConcurrencyConflictDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ConcurrencyConflictDialogComponent, ConcurrencyConflictResolution>);
  readonly data: ConcurrencyConflictDialogData = inject(MAT_DIALOG_DATA);

  reload(): void {
    this.dialogRef.close('reload');
  }

  cancel(): void {
    this.dialogRef.close('cancel');
  }
}
