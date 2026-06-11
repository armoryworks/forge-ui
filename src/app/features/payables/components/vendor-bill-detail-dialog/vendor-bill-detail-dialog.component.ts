import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { VendorBillDetailPanelComponent } from '../vendor-bill-detail-panel/vendor-bill-detail-panel.component';

export interface VendorBillDetailDialogData {
  billId: number;
}

// ⚡ ACCOUNTING BOUNDARY — opened via DetailDialogService ('vendor-bill').
@Component({
  selector: 'app-vendor-bill-detail-dialog',
  standalone: true,
  imports: [VendorBillDetailPanelComponent],
  template: `
    <app-vendor-bill-detail-panel
      [billId]="data.billId"
      (closed)="close()"
      (billChanged)="changed = true" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorBillDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<VendorBillDetailDialogComponent, boolean>);

  protected readonly data = inject<VendorBillDetailDialogData>(MAT_DIALOG_DATA);

  protected changed = false;

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
