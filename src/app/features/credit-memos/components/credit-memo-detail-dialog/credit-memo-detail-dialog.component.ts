import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { CreditMemoDetailPanelComponent } from '../credit-memo-detail-panel/credit-memo-detail-panel.component';
import { CreditMemoDetailDialogData } from '../../models/credit-memo-detail-dialog-data.model';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

@Component({
  selector: 'app-credit-memo-detail-dialog',
  standalone: true,
  imports: [CreditMemoDetailPanelComponent],
  templateUrl: './credit-memo-detail-dialog.component.html',
  styleUrl: './credit-memo-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditMemoDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<CreditMemoDetailDialogComponent, boolean>);

  protected readonly data = inject<CreditMemoDetailDialogData>(MAT_DIALOG_DATA);

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
