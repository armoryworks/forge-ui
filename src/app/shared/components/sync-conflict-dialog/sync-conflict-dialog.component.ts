import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SyncConflict, SyncConflictResolution } from '../../models/sync-conflict.model';

export interface SyncConflictDialogData {
  conflict: SyncConflict;
}

@Component({
  selector: 'app-sync-conflict-dialog',
  standalone: true,
  templateUrl: './sync-conflict-dialog.component.html',
  styleUrl: './sync-conflict-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncConflictDialogComponent {
  readonly dialogRef = inject(MatDialogRef<SyncConflictDialogComponent, SyncConflictResolution>);
  readonly data: SyncConflictDialogData = inject(MAT_DIALOG_DATA);

  get conflict(): SyncConflict {
    return this.data.conflict;
  }

  get hasLocalValue(): boolean {
    return this.conflict.localValue !== null && this.conflict.localValue !== undefined;
  }

  get localValuePreview(): string {
    try {
      return JSON.stringify(this.conflict.localValue, null, 2);
    } catch {
      return String(this.conflict.localValue);
    }
  }

  keepMine(): void {
    this.dialogRef.close('keep-mine');
  }

  keepServer(): void {
    this.dialogRef.close('keep-server');
  }

  cancel(): void {
    this.dialogRef.close('cancel');
  }
}
