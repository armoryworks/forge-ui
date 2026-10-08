import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
export class PinPromptDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PinPromptDialogComponent>);
  private readonly translate = inject(TranslateService);
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

  cancel(): void {
    this.dialogRef.close(null);
  }
}
