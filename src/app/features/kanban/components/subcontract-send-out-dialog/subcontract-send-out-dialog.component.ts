import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports: [ReactiveFormsModule, CurrencyPipe, TranslatePipe, DialogComponent, InputComponent, DatepickerComponent, ToggleComponent, ValidationButtonComponent],
  templateUrl: './subcontract-send-out-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcontractSendOutDialogComponent {
  readonly matDialogRef = inject(MatDialogRef<SubcontractSendOutDialogComponent, SubcontractOrder>);
  readonly data = inject<SubcontractSendOutDialogData>(MAT_DIALOG_DATA);
  private readonly subcontractService = inject(SubcontractService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly minReturnDate = todayStart();

  readonly formGroup = new FormGroup({
    vendorName: new FormControl({ value: this.data.operation.vendorName, disabled: true }, { nonNullable: true }),
    quantity: new FormControl<number | null>(this.data.defaultQuantity, [Validators.required, Validators.min(0.0001)]),
    expectedReturnDate: new FormControl<Date | null>(this.defaultReturnDate()),
    createPurchaseOrder: new FormControl(true, { nonNullable: true }),
  });

  readonly violations = FormValidationService.getViolations(this.formGroup, {
    quantity: this.translate.instant('subcontractUi.quantity'),
    expectedReturnDate: this.translate.instant('subcontractUi.expectedReturn'),
  });

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

  private defaultReturnDate(): Date | null {
    const days = this.data.operation.turnTimeDays;
    if (days == null || days <= 0) return null;
    const date = todayStart();
    date.setDate(date.getDate() + Math.ceil(days));
    return date;
  }
}
