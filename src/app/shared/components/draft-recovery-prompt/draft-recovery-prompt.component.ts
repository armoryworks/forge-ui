import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { Draft } from '../../models/draft.model';
import { DateTimePipe } from '../../pipes/date-time.pipe';
import { DialogEscapeHandler } from '../../models/dialog-escape.model';

export interface DraftRecoveryPromptData {
  drafts: Draft[];
  mode: 'recovery' | 'expiry';
}

export interface DraftRecoveryPromptResult {
  action: 'navigate' | 'keep' | 'discard' | 'dismiss';
  draft?: Draft;
}

@Component({
  selector: 'app-draft-recovery-prompt',
  standalone: true,
  imports: [DateTimePipe],
  templateUrl: './draft-recovery-prompt.component.html',
  styleUrl: './draft-recovery-prompt.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftRecoveryPromptComponent implements DialogEscapeHandler {
  readonly dialogRef = inject(MatDialogRef<DraftRecoveryPromptComponent>);
  readonly data: DraftRecoveryPromptData = inject(MAT_DIALOG_DATA);

  get title(): string {
    return this.data.mode === 'recovery'
      ? 'Unsaved Work Found'
      : 'Unsaved Work Expiring Soon';
  }

  get description(): string {
    return this.data.mode === 'recovery'
      ? 'You have unsaved changes from a previous session:'
      : 'The following unsaved work will be removed soon:';
  }

  navigateTo(draft: Draft): void {
    this.dialogRef.close({ action: 'navigate', draft } satisfies DraftRecoveryPromptResult);
  }

  keepAll(): void {
    this.dialogRef.close({ action: 'keep' } satisfies DraftRecoveryPromptResult);
  }

  discardAll(): void {
    this.dialogRef.close({ action: 'discard' } satisfies DraftRecoveryPromptResult);
  }

  onDialogEscape(): void {
    this.dismiss();
  }

  dismiss(): void {
    this.dialogRef.close({ action: 'dismiss' } satisfies DraftRecoveryPromptResult);
  }
}
