import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Currency, SetExchangeRateRequest } from '../models/currency.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { DatepickerComponent } from '../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { toIsoDate } from '../../../shared/utils/date.utils';

export interface ExchangeRateDialogData { currencies: Currency[] }

@Component({
  selector: 'app-exchange-rate-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, SelectComponent, InputComponent, DatepickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './exchange-rate-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExchangeRateDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ExchangeRateDialogComponent, SetExchangeRateRequest | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<ExchangeRateDialogData>(MAT_DIALOG_DATA);

  protected readonly currencyOptions: SelectOption[] = this.data.currencies
    .filter(c => c.isActive)
    .map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }));

  protected readonly form = new FormGroup({
    fromCurrencyId: new FormControl<number | null>(null, [Validators.required]),
    toCurrencyId: new FormControl<number | null>(null, [Validators.required]),
    rate: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0000001)]),
    effectiveDate: new FormControl<Date | null>(new Date(), [Validators.required]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    fromCurrencyId: this.translate.instant('admin.currencies.fieldFromCurrency'),
    toCurrencyId: this.translate.instant('admin.currencies.fieldToCurrency'),
    rate: this.translate.instant('admin.currencies.fieldRate'),
    effectiveDate: this.translate.instant('admin.currencies.fieldEffectiveDate'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    if (f.fromCurrencyId === f.toCurrencyId) return; // Don't submit a self-pair
    const iso = toIsoDate(f.effectiveDate!) ?? '';
    this.dialogRef.close({
      fromCurrencyId: f.fromCurrencyId!,
      toCurrencyId: f.toCurrencyId!,
      rate: f.rate!,
      effectiveDate: iso.slice(0, 10), // YYYY-MM-DD only
    });
  }
}
