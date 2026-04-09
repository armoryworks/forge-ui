import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { LotDetailPanelComponent } from '../lot-detail-panel/lot-detail-panel.component';

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
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LotDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<LotDetailDialogComponent>);

  protected readonly data = inject<LotDetailDialogData>(MAT_DIALOG_DATA);

  protected close(): void {
    this.dialogRef.close();
  }
}
