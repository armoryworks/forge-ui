import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { VendorDetailPanelComponent } from '../vendor-detail-panel/vendor-detail-panel.component';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

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
  styles: [`:host { display: block; width: 100%; height: 100%; } app-vendor-detail-panel { height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<VendorDetailDialogComponent, boolean>);

  protected readonly data = inject<VendorDetailDialogData>(MAT_DIALOG_DATA);

  protected changed = false;

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
