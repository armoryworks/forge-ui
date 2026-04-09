import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { VendorDetailPanelComponent } from '../vendor-detail-panel/vendor-detail-panel.component';

export interface VendorDetailDialogData {
  vendorId: number;
}

@Component({
  selector: 'app-vendor-detail-dialog',
  standalone: true,
  imports: [VendorDetailPanelComponent],
  template: `
    <app-vendor-detail-panel
      [vendorId]="data.vendorId"
      (closed)="close()"
      (vendorChanged)="changed = true" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<VendorDetailDialogComponent, boolean>);

  protected readonly data = inject<VendorDetailDialogData>(MAT_DIALOG_DATA);

  protected changed = false;

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
