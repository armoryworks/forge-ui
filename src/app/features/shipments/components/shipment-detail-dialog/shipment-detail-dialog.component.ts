import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ShipmentDetailPanelComponent } from '../shipment-detail-panel/shipment-detail-panel.component';
import { ShipmentDetail } from '../../models/shipment-detail.model';

export interface ShipmentDetailDialogData {
  shipmentId: number;
}

export interface ShipmentDetailDialogResult {
  action: 'edit';
  shipment: ShipmentDetail;
}

@Component({
  selector: 'app-shipment-detail-dialog',
  standalone: true,
  imports: [ShipmentDetailPanelComponent],
  template: `
    <app-shipment-detail-panel
      [shipmentId]="data.shipmentId"
      (closed)="close()"
      (editRequested)="onEditRequested($event)" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ShipmentDetailDialogComponent, ShipmentDetailDialogResult | undefined>);

  protected readonly data = inject<ShipmentDetailDialogData>(MAT_DIALOG_DATA);

  protected close(): void {
    this.dialogRef.close();
  }

  protected onEditRequested(shipment: ShipmentDetail): void {
    this.dialogRef.close({ action: 'edit', shipment });
  }
}
