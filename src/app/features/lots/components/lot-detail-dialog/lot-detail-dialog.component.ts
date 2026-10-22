import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { LotDetailPanelComponent } from '../lot-detail-panel/lot-detail-panel.component';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

export interface LotDetailDialogData {
  lotId: number;
  lotNumber: string;
}

@Component({
  selector: 'app-lot-detail-dialog',
  standalone: true,
  imports: [LotDetailPanelComponent],
  template: `
    <app-lot-detail-panel
      [lotId]="data.lotId"
      [lotNumber]="data.lotNumber"
      (closed)="close()" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; } app-lot-detail-panel { height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LotDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<LotDetailDialogComponent>);

  protected readonly data = inject<LotDetailDialogData>(MAT_DIALOG_DATA);

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
