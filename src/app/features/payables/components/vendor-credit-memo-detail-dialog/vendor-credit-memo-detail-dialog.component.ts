import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { VendorCreditMemoDetailPanelComponent } from '../vendor-credit-memo-detail-panel/vendor-credit-memo-detail-panel.component';
import { VendorCreditMemoDetailDialogData } from '../../models/vendor-credit-memo-detail-dialog-data.model';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

@Component({
  selector: 'app-vendor-credit-memo-detail-dialog',
  standalone: true,
  imports: [VendorCreditMemoDetailPanelComponent],
  templateUrl: './vendor-credit-memo-detail-dialog.component.html',
  styleUrl: './vendor-credit-memo-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorCreditMemoDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<VendorCreditMemoDetailDialogComponent, boolean>);

  protected readonly data = inject<VendorCreditMemoDetailDialogData>(MAT_DIALOG_DATA);

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
