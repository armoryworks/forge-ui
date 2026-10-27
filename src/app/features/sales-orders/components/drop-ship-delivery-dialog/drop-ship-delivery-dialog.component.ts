import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LinkedPurchasingService } from '../../services/line-purchasing.service';

/**
 * Confirms what a vendor delivered straight to the customer on a drop-ship PO line. The quantity ships the sales
 * order line (no stock moves) and makes it invoiceable.
 */
@Component({
  selector: 'app-drop-ship-delivery-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, ValidationButtonComponent],
  templateUrl: './drop-ship-delivery-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropShipDeliveryDialogComponent implements OnInit {
  private readonly service = inject(LinkedPurchasingService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);

  readonly purchaseOrderId = input.required<number>();
  readonly purchaseOrderLineId = input.required<number>();
  readonly poNumber = input.required<string>();
  readonly remainingQuantity = input.required<number>();

  readonly closed = output<void>();
  readonly confirmed = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = new FormGroup({
    deliveredQuantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    trackingNumber: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    deliveredQuantity: this.translate.instant('salesOrderEngines.delivery.quantity'),
    trackingNumber: this.translate.instant('salesOrderEngines.delivery.tracking'),
  });

  ngOnInit(): void {
    this.form.controls.deliveredQuantity.addValidators(Validators.max(this.remainingQuantity()));
    this.form.controls.deliveredQuantity.setValue(this.remainingQuantity());
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.service.confirmDropShipDelivery(this.purchaseOrderId(), this.purchaseOrderLineId(), {
      deliveredQuantity: v.deliveredQuantity ?? 0,
      trackingNumber: v.trackingNumber.trim() || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('salesOrderEngines.delivery.confirmed'));
        this.confirmed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
