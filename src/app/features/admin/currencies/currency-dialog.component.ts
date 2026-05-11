import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Currency, CreateCurrencyRequest, UpdateCurrencyRequest } from '../models/currency.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';

export interface CurrencyDialogData { currency?: Currency }
export type CurrencyDialogResult = CreateCurrencyRequest | UpdateCurrencyRequest;

@Component({
  selector: 'app-currency-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './currency-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CurrencyDialogComponent, CurrencyDialogResult | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<CurrencyDialogData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.currency;

  protected readonly form = new FormGroup({
    code: new FormControl<string>(this.data.currency?.code ?? '', { nonNullable: true, validators: [Validators.required, Validators.minLength(3), Validators.maxLength(3), Validators.pattern(/^[A-Z]{3}$/)] }),
    name: new FormControl<string>(this.data.currency?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    symbol: new FormControl<string>(this.data.currency?.symbol ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(8)] }),
    decimalPlaces: new FormControl<number>(this.data.currency?.decimalPlaces ?? 2, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(8)] }),
    isBaseCurrency: new FormControl<boolean>(this.data.currency?.isBaseCurrency ?? false, { nonNullable: true }),
    isActive: new FormControl<boolean>(this.data.currency?.isActive ?? true, { nonNullable: true }),
    sortOrder: new FormControl<number>(this.data.currency?.sortOrder ?? 100, { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    code: this.translate.instant('admin.currencies.fieldCode'),
    name: this.translate.instant('admin.currencies.fieldName'),
    symbol: this.translate.instant('admin.currencies.fieldSymbol'),
    decimalPlaces: this.translate.instant('admin.currencies.fieldDecimalPlaces'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    if (this.isEdit) {
      const payload: UpdateCurrencyRequest = {
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        symbol: f.symbol.trim(),
        decimalPlaces: f.decimalPlaces,
        isBaseCurrency: f.isBaseCurrency,
        isActive: f.isActive,
        sortOrder: f.sortOrder,
      };
      this.dialogRef.close(payload);
    } else {
      const payload: CreateCurrencyRequest = {
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        symbol: f.symbol.trim(),
        decimalPlaces: f.decimalPlaces,
        isBaseCurrency: f.isBaseCurrency,
        sortOrder: f.sortOrder,
      };
      this.dialogRef.close(payload);
    }
  }
}
