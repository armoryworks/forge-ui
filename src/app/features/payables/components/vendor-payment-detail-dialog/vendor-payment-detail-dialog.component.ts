import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { VendorPaymentDetailPanelComponent } from '../vendor-payment-detail-panel/vendor-payment-detail-panel.component';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

export interface VendorPaymentDetailDialogData {
  paymentId: number;
}

// ⚡ ACCOUNTING BOUNDARY — opened via DetailDialogService ('vendor-payment').
@Component({
  selector: 'app-vendor-payment-detail-dialog',
  standalone: true,
  imports: [VendorPaymentDetailPanelComponent],
  template: `
    <app-vendor-payment-detail-panel
      [paymentId]="data.paymentId"
      (closed)="close()"
      (paymentChanged)="changed = true" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; } app-vendor-payment-detail-panel { height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorPaymentDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<VendorPaymentDetailDialogComponent, boolean>);

  protected readonly data = inject<VendorPaymentDetailDialogData>(MAT_DIALOG_DATA);

  protected changed = false;

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
