import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';
import { DialogEscapeService } from '../../../../shared/services/dialog-escape.service';

export interface PinPromptDialogData {
  title?: string;
}

@Component({
  selector: 'app-pin-prompt-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './pin-prompt-dialog.component.html',
  styleUrl: './pin-prompt-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PinPromptDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<PinPromptDialogComponent>);
  private readonly translate = inject(TranslateService);
  private readonly dialogEscape = inject(DialogEscapeService);
  readonly data: PinPromptDialogData = inject(MAT_DIALOG_DATA);

  readonly pinControl = new FormControl('', [
    Validators.required,
    Validators.minLength(4),
    Validators.maxLength(6),
    Validators.pattern(/^\d{4,6}$/),
  ]);

  readonly error = signal<string | null>(null);

  get title(): string {
    return this.data?.title ?? this.translate.instant('kioskFlows.pin.title');
  }

  confirm(): void {
    const pin = this.pinControl.value?.trim();
    if (!pin || pin.length < 4 || pin.length > 6) {
      this.error.set(this.translate.instant('kioskFlows.pin.lengthError'));
      return;
    }
    if (!/^\d+$/.test(pin)) {
      this.error.set(this.translate.instant('kioskFlows.pin.digitsOnly'));
      return;
    }
    this.dialogRef.close(pin);
  }

  onDialogEscape(): void {
    this.dialogEscape.closeUnlessDirty(!!this.pinControl.value, () => this.cancel());
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
