import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { VendorReturnDetailPanelComponent } from '../vendor-return-detail-panel/vendor-return-detail-panel.component';
import { VendorReturnDetailDialogData } from '../../models/vendor-return-detail-dialog-data.model';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

@Component({
  selector: 'app-vendor-return-detail-dialog',
  standalone: true,
  imports: [VendorReturnDetailPanelComponent],
  templateUrl: './vendor-return-detail-dialog.component.html',
  styleUrl: './vendor-return-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorReturnDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<VendorReturnDetailDialogComponent, boolean>);

  protected readonly data = inject<VendorReturnDetailDialogData>(MAT_DIALOG_DATA);

  private hasUpdated = false;

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.dialogRef.close(this.hasUpdated);
  }

  protected onUpdated(): void {
    this.hasUpdated = true;
  }
}
