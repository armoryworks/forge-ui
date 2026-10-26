import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PaymentTerm } from '../../../shared/models/payment-term.model';
import { PaymentTermRequest } from '../../../shared/models/payment-term-request.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';

export interface PaymentTermDialogData { term?: PaymentTerm }

/** Creates or edits payment terms. System terms take a new name and sort order only. */
@Component({
  selector: 'app-payment-term-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, ToggleComponent, ValidationButtonComponent],
  templateUrl: './payment-term-dialog.component.html',
  styleUrl: './payment-term-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentTermDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PaymentTermDialogComponent, PaymentTermRequest | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<PaymentTermDialogData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.term;
  protected readonly isSystem = this.data.term?.isSystem ?? false;

  protected readonly form = new FormGroup({
    code: new FormControl<string>(this.data.term?.code ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(30)] }),
    name: new FormControl<string>(this.data.term?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    netDays: new FormControl<number>(this.data.term?.netDays ?? 30, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(365)] }),
    discountPercent: new FormControl<number>(this.data.term?.discountPercent ?? 0, { nonNullable: true, validators: [Validators.min(0), Validators.max(99.9999)] }),
    discountDays: new FormControl<number>(this.data.term?.discountDays ?? 0, { nonNullable: true, validators: [Validators.min(0)] }),
    isActive: new FormControl<boolean>(this.data.term?.isActive ?? true, { nonNullable: true }),
    sortOrder: new FormControl<number>(this.data.term?.sortOrder ?? 200, { nonNullable: true, validators: [Validators.required] }),
  }, { validators: control => this.discountDaysError(control) });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    code: this.translate.instant('paymentTerms.fieldCode'),
    name: this.translate.instant('paymentTerms.fieldName'),
    netDays: this.translate.instant('paymentTerms.fieldNetDays'),
    discountPercent: this.translate.instant('paymentTerms.fieldDiscountPercent'),
    discountDays: this.translate.instant('paymentTerms.fieldDiscountDays'),
  });

  constructor() {
    if (this.isSystem) {
      for (const name of ['code', 'netDays', 'discountPercent', 'discountDays', 'isActive'] as const) {
        this.form.controls[name].disable();
      }
    }
  }

  private discountDaysError(control: AbstractControl): ValidationErrors | null {
    const { netDays, discountPercent, discountDays } = (control as FormGroup).getRawValue() as { netDays: number; discountPercent: number; discountDays: number };
    if (!discountPercent || discountPercent <= 0) return null;
    return discountDays > 0 && discountDays < netDays
      ? null
      : { discountDays: { message: this.translate.instant('paymentTerms.discountDaysInvalid') } };
  }

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    this.dialogRef.close({
      code: f.code.trim(),
      name: f.name.trim(),
      netDays: Number(f.netDays),
      discountPercent: Number(f.discountPercent) || 0,
      discountDays: Number(f.discountPercent) > 0 ? Number(f.discountDays) : 0,
      isActive: f.isActive,
      sortOrder: Number(f.sortOrder),
    });
  }
}
