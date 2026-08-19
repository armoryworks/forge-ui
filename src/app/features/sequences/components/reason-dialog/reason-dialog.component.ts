import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';

export interface ReasonDialogData {
  title: string;
  message?: string;
  confirmLabel?: string;
  severity?: 'info' | 'warn' | 'danger';
}

/**
 * Captures a mandatory free-text reason for an irreversible sequence action
 * (override a gate, skip / rework a step, cancel an instance). Resolves to the
 * trimmed reason string, or `undefined` when cancelled.
 */
@Component({
  selector: 'app-reason-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, TextareaComponent],
  templateUrl: './reason-dialog.component.html',
  styleUrl: './reason-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReasonDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ReasonDialogComponent, string>);
  readonly data: ReasonDialogData = inject(MAT_DIALOG_DATA);

  protected readonly reason = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });

  protected confirm(): void {
    const value = this.reason.value.trim();
    if (value.length < 3) {
      this.reason.markAsTouched();
      return;
    }
    this.dialogRef.close(value);
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
