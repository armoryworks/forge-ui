import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { PaymentMilestone } from '../../../../shared/models/payment-milestone.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { PaymentScheduleService } from '../../services/payment-schedule.service';

export interface MarkMilestonePaidDialogData {
  milestone: PaymentMilestone;
}

/** Result: the updated milestone (dialog resolves undefined on cancel). */
export type MarkMilestonePaidDialogResult = PaymentMilestone;

/**
 * Small S2 action dialog: record a (possibly partial) payment against a
 * milestone. Pre-fills the outstanding balance; payments accumulate server-
 * side and the milestone flips to Paid once fully covered.
 */
@Component({
  selector: 'app-mark-milestone-paid-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, CurrencyDisplayComponent, CurrencyInputComponent,
    InputComponent, ValidationButtonComponent,
  ],
  templateUrl: './mark-milestone-paid-dialog.component.html',
  styleUrl: './mark-milestone-paid-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkMilestonePaidDialogComponent {
  private readonly paymentScheduleService = inject(PaymentScheduleService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef =
    inject(MatDialogRef<MarkMilestonePaidDialogComponent, MarkMilestonePaidDialogResult | undefined>);
  protected readonly data = inject<MarkMilestonePaidDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  /** Outstanding balance — the sensible default for the amount field. */
  protected readonly remaining =
    Math.max(0, Math.round((this.data.milestone.amountDue - this.data.milestone.paidAmount) * 100) / 100);

  protected readonly form = new FormGroup({
    paidAmount: new FormControl<number | null>(this.remaining > 0 ? this.remaining : null, [
      Validators.required, Validators.min(0.01),
    ]),
    paidReference: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    paidAmount: this.translate.instant('quotes.paymentSchedule.paidAmount'),
    paidReference: this.translate.instant('quotes.paymentSchedule.paidReference'),
  });

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const v = this.form.getRawValue();
    this.paymentScheduleService.markPaid(this.data.milestone.id, {
      paidAmount: v.paidAmount!,
      paidReference: v.paidReference.trim() || undefined,
    }).subscribe({
      next: (milestone) => {
        this.saving.set(false);
        this.dialogRef.close(milestone);
      },
      // Server rejections (waived/paid milestone, etc.) are toasted by the
      // global HttpErrorInterceptor — no local toast.
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
