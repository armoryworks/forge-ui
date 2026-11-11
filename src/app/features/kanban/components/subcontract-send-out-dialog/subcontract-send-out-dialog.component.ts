import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { todayStart, toIsoDate } from '../../../../shared/utils/date.utils';
import { SubcontractOrder } from '../../models/subcontract-order.model';
import { SubcontractSendOutDialogData } from '../../models/subcontract-send-out-dialog-data.model';
import { SubcontractService } from '../../services/subcontract.service';

@Component({
  selector: 'app-subcontract-send-out-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyPipe, DecimalPipe, TranslatePipe, DialogComponent, InputComponent, DatepickerComponent,
    ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './subcontract-send-out-dialog.component.html',
  styleUrl: './subcontract-send-out-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcontractSendOutDialogComponent {
  readonly matDialogRef = inject(MatDialogRef<SubcontractSendOutDialogComponent, SubcontractOrder>);
  readonly data = inject<SubcontractSendOutDialogData>(MAT_DIALOG_DATA);
  private readonly subcontractService = inject(SubcontractService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly minReturnDate = todayStart();
  private readonly committed = this.data.operation.committedQuantity ?? 0;
  private readonly maxSend = this.data.operation.maxSendQuantity ?? null;

  readonly formGroup = new FormGroup({
    vendorName: new FormControl({ value: this.data.operation.vendorName, disabled: true }, { nonNullable: true }),
    quantity: new FormControl<number | null>(this.data.defaultQuantity,
      [Validators.required, Validators.min(0.0001), this.withinSendLimit()]),
    expectedReturnDate: new FormControl<Date | null>(this.defaultReturnDate()),
    createPurchaseOrder: new FormControl(true, { nonNullable: true }),
    overrunAck: new FormControl(false, { nonNullable: true }),
  }, { validators: this.overrunConfirmed() });

  private readonly quantity = toSignal(this.formGroup.controls.quantity.valueChanges,
    { initialValue: this.formGroup.controls.quantity.value });

  protected readonly overrun = computed(() => this.overrunOf(this.quantity()));

  readonly violations = FormValidationService.getViolations(this.formGroup, {
    quantity: this.translate.instant('subcontractUi.quantity'),
    expectedReturnDate: this.translate.instant('subcontractUi.expectedReturn'),
  });

  constructor() {
    this.formGroup.controls.quantity.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formGroup.controls.overrunAck.setValue(false, { emitEvent: false }));
  }

  save(): void {
    if (this.formGroup.invalid || this.saving()) return;

    this.saving.set(true);
    const raw = this.formGroup.getRawValue();
    this.subcontractService.sendOut(this.data.jobId, this.data.operation.operationId, {
      quantity: raw.quantity!,
      unitCost: 0,
      expectedReturnDate: toIsoDate(raw.expectedReturnDate),
      createPurchaseOrder: raw.createPurchaseOrder,
    }).subscribe({
      next: (order) => {
        this.saving.set(false);
        this.snackbar.success(order.poNumber
          ? this.translate.instant('subcontractUi.sentWithPo', { vendor: order.vendorName, po: order.poNumber })
          : this.translate.instant('subcontractUi.sent', { vendor: order.vendorName }));
        this.matDialogRef.close(order);
      },
      error: () => this.saving.set(false),
    });
  }

  private overrunOf(quantity: number | null): number {
    const sending = Number(quantity ?? 0);
    if (sending <= 0 || (this.maxSend !== null && sending > this.maxSend)) return 0;
    return Math.max(0, Math.round((this.committed + sending - this.data.operation.jobQuantity) * 10000) / 10000);
  }

  private withinSendLimit(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null =>
      this.maxSend !== null && Number(control.value ?? 0) > this.maxSend
        ? { sendLimit: { message: this.translate.instant('subcontractUi.overLimit', { max: this.maxSend }) } }
        : null;
  }

  private overrunConfirmed(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null =>
      this.overrunOf(group.get('quantity')?.value ?? null) > 0 && !group.get('overrunAck')?.value
        ? { overrunAck: { message: this.translate.instant('subcontractUi.overrunConfirmFirst') } }
        : null;
  }

  private defaultReturnDate(): Date | null {
    const days = this.data.operation.turnTimeDays;
    if (days == null || days <= 0) return null;
    const date = todayStart();
    date.setDate(date.getDate() + Math.ceil(days));
    return date;
  }
}
