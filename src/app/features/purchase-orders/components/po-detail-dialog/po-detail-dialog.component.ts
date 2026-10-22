import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PoDetailPanelComponent } from '../po-detail-panel/po-detail-panel.component';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

export interface PoDetailDialogData {
  purchaseOrderId: number;
}

@Component({
  selector: 'app-po-detail-dialog',
  standalone: true,
  imports: [PoDetailPanelComponent],
  template: `
    <app-po-detail-panel
      [purchaseOrderId]="data.purchaseOrderId"
      (closed)="close()"
      (changed)="onChanged()" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; } app-po-detail-panel { height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<PoDetailDialogComponent, boolean>);

  protected readonly data = inject<PoDetailDialogData>(MAT_DIALOG_DATA);

  private hasChanged = false;

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.dialogRef.close(this.hasChanged);
  }

  protected onChanged(): void {
    this.hasChanged = true;
  }
}
