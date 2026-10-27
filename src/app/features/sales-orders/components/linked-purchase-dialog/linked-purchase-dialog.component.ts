import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { LinkedPurchasingService } from '../../services/line-purchasing.service';
import { LinkedPurchaseType } from '../../models/linked-purchase-type.type';
import { SalesOrderLine } from '../../models/sales-order-line.model';

/**
 * Raises a drop-ship or back-to-back purchase order for one sales order line: the vendor (empty = the part's
 * preferred vendor), the quantity (up to what the line still needs), the unit cost (empty = the vendor's price)
 * and the expected date.
 */
@Component({
  selector: 'app-linked-purchase-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, CurrencyInputComponent, DatepickerComponent, DialogComponent,
    EntityPickerComponent, InputComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './linked-purchase-dialog.component.html',
  styleUrl: './linked-purchase-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkedPurchaseDialogComponent implements OnInit {
  private readonly service = inject(LinkedPurchasingService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);

  readonly type = input.required<LinkedPurchaseType>();
  readonly salesOrderId = input.required<number>();
  readonly line = input.required<SalesOrderLine>();
  readonly openQuantity = input.required<number>();

  readonly closed = output<void>();
  readonly created = output<number>();

  protected readonly saving = signal(false);
  protected readonly titleKey = computed(() =>
    this.type() === 'DropShip' ? 'salesOrderEngines.purchase.dropShipTitle' : 'salesOrderEngines.purchase.backToBackTitle');
  protected readonly hintKey = computed(() =>
    this.type() === 'DropShip' ? 'salesOrderEngines.purchase.dropShipHint' : 'salesOrderEngines.purchase.backToBackHint');

  protected readonly form = new FormGroup({
    vendorId: new FormControl<number | null>(null),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    unitCost: new FormControl<number | null>(null, [Validators.min(0)]),
    expectedDeliveryDate: new FormControl<Date | null>(null),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    quantity: this.translate.instant('salesOrderEngines.purchase.quantity'),
    unitCost: this.translate.instant('salesOrderEngines.purchase.unitCost'),
    notes: this.translate.instant('common.notes'),
  });

  ngOnInit(): void {
    this.form.controls.quantity.addValidators(Validators.max(this.openQuantity()));
    this.form.controls.quantity.setValue(this.openQuantity());
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.service.createPurchase(this.type(), this.salesOrderId(), this.line().id, {
      vendorId: v.vendorId ?? 0,
      quantity: v.quantity,
      unitCost: v.unitCost,
      expectedDeliveryDate: toIsoDate(v.expectedDeliveryDate),
      notes: v.notes.trim() || null,
    }).subscribe({
      next: result => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('salesOrderEngines.purchase.created'));
        this.created.emit(result.purchaseOrderId);
      },
      error: () => this.saving.set(false),
    });
  }
}
