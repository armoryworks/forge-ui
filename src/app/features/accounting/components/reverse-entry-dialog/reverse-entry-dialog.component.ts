import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { ReverseJournalEntryInput } from '../../models/accounting.models';

export interface ReverseEntryDialogData {
  entryNumber: number;
}

/**
 * §5A "Reverse / correct" dialog: captures the reversal date + a required reason, then returns a
 * {@link ReverseJournalEntryInput}. The reversal itself is posted server-side (the engine posts an
 * equal-and-opposite entry and flips the original to Reversed) — this dialog never edits anything.
 */
@Component({
  selector: 'app-reverse-entry-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, DatepickerComponent, ValidationButtonComponent],
  templateUrl: './reverse-entry-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReverseEntryDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ReverseEntryDialogComponent, ReverseJournalEntryInput | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<ReverseEntryDialogData>(MAT_DIALOG_DATA);

  protected readonly form = new FormGroup({
    reversalDate: new FormControl<Date | null>(this.today(), [Validators.required]),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    reversalDate: this.translate.instant('accounting.reverse.date'),
    reason: this.translate.instant('accounting.reverse.reason'),
  });

  protected close(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    this.dialogRef.close({
      reversalDate: (toIsoDate(raw.reversalDate) ?? '').slice(0, 10),
      reason: raw.reason.trim(),
    });
  }

  private today(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
