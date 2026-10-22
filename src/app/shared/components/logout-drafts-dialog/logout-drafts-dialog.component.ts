import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { Draft } from '../../models/draft.model';
import { DateTimePipe } from '../../pipes/date-time.pipe';
import { DialogEscapeHandler } from '../../models/dialog-escape.model';

export interface LogoutDraftsDialogData {
  drafts: Draft[];
}

export interface LogoutDraftsDialogResult {
  action: 'logout' | 'navigate' | 'cancel';
  draft?: Draft;
}

@Component({
  selector: 'app-logout-drafts-dialog',
  standalone: true,
  imports: [DateTimePipe],
  templateUrl: './logout-drafts-dialog.component.html',
  styleUrl: './logout-drafts-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoutDraftsDialogComponent implements DialogEscapeHandler {
  readonly dialogRef = inject(MatDialogRef<LogoutDraftsDialogComponent>);
  readonly data: LogoutDraftsDialogData = inject(MAT_DIALOG_DATA);

  navigateTo(draft: Draft): void {
    this.dialogRef.close({ action: 'navigate', draft } satisfies LogoutDraftsDialogResult);
  }

  logout(): void {
    this.dialogRef.close({ action: 'logout' } satisfies LogoutDraftsDialogResult);
  }

  onDialogEscape(): void {
    this.cancel();
  }

  cancel(): void {
    this.dialogRef.close({ action: 'cancel' } satisfies LogoutDraftsDialogResult);
  }
}
