import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { Draft } from '../../models/draft.model';

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
  imports: [DatePipe],
  templateUrl: './draft-recovery-prompt.component.html',
  styleUrl: './draft-recovery-prompt.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftRecoveryPromptComponent {
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

  dismiss(): void {
    this.dialogRef.close({ action: 'dismiss' } satisfies DraftRecoveryPromptResult);
  }
}
