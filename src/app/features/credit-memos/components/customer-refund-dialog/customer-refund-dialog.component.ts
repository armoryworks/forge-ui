import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerRefundRequest } from '../../models/customer-refund-request.model';
import { REFUND_METHODS } from '../../models/credit-memo-reason-types.const';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { CurrencyService } from '../../../../shared/services/currency.service';
import { toIsoDate, todayStart } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-customer-refund-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, CurrencyDisplayComponent, ValidationButtonComponent,
  ],
  templateUrl: './customer-refund-dialog.component.html',
  styleUrl: './customer-refund-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerRefundDialogComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly baseCurrency = inject(CurrencyService).baseCurrency;

  readonly title = input.required<string>();
  readonly maxAmount = input.required<number>();
  readonly currencyCode = input<string | null>(null);
  readonly defaultFxRate = input<number>(1);
  readonly saving = input(false);
  readonly closed = output<void>();
  readonly submitted = output<CustomerRefundRequest>();

  protected readonly showFxRate = computed(() => {
    const code = this.currencyCode();
    return code !== null && code !== this.baseCurrency();
  });

  protected readonly methodOptions: SelectOption[] = REFUND_METHODS.map(m => ({
    value: m, label: this.translate.instant(`creditMemos.method.${m}`),
  }));

  protected readonly form = new FormGroup({
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    method: new FormControl<string>('Check', { nonNullable: true, validators: [Validators.required] }),
    refundDate: new FormControl<Date | null>(todayStart(), [Validators.required]),
    reference: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    settlementFxRate: new FormControl<number | null>(null, [Validators.min(0.00000001)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    amount: this.translate.instant('creditMemos.refundAmount'),
    method: this.translate.instant('creditMemos.refundMethod'),
    refundDate: this.translate.instant('creditMemos.refundDate'),
  });

  ngOnInit(): void {
    this.form.controls.amount.setValue(this.maxAmount());
    this.form.controls.amount.addValidators(Validators.max(this.maxAmount()));
    this.form.controls.settlementFxRate.setValue(this.defaultFxRate());
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    this.submitted.emit({
      amount: Math.round((f.amount ?? 0) * 100) / 100,
      method: f.method,
      refundDate: toIsoDate(f.refundDate)!,
      reference: f.reference.trim() || null,
      settlementFxRate: this.showFxRate() ? f.settlementFxRate : null,
    });
  }
}
