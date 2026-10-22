import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PaymentDetailPanelComponent } from '../payment-detail-panel/payment-detail-panel.component';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

export interface PaymentDetailDialogData {
  paymentId: number;
}

@Component({
  selector: 'app-payment-detail-dialog',
  standalone: true,
  imports: [PaymentDetailPanelComponent],
  template: `
    <app-payment-detail-panel
      [paymentId]="data.paymentId"
      (closed)="close()"
      (paymentChanged)="changed = true; close()" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; } app-payment-detail-panel { height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<PaymentDetailDialogComponent, boolean>);

  protected readonly data = inject<PaymentDetailDialogData>(MAT_DIALOG_DATA);

  protected changed = false;

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
