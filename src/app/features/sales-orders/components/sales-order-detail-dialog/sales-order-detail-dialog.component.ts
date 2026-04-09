import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SalesOrderDetailPanelComponent } from '../sales-order-detail-panel/sales-order-detail-panel.component';
import { SalesOrderDetail } from '../../models/sales-order-detail.model';

export interface SalesOrderDetailDialogData {
  salesOrderId: number;
}

export interface SalesOrderDetailDialogResult {
  action: 'edit';
  salesOrder: SalesOrderDetail;
}

@Component({
  selector: 'app-sales-order-detail-dialog',
  standalone: true,
  imports: [SalesOrderDetailPanelComponent],
  template: `
    <app-sales-order-detail-panel
      [salesOrderId]="data.salesOrderId"
      (closed)="close()"
      (editRequested)="onEditRequested($event)"
      (changed)="hasChanges = true" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrderDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SalesOrderDetailDialogComponent, SalesOrderDetailDialogResult | undefined>);

  protected readonly data = inject<SalesOrderDetailDialogData>(MAT_DIALOG_DATA);

  protected hasChanges = false;

  protected close(): void {
    this.dialogRef.close();
  }

  protected onEditRequested(salesOrder: SalesOrderDetail): void {
    this.dialogRef.close({ action: 'edit', salesOrder });
  }
}
