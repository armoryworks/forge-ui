import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PartDetailPanelComponent } from '../part-detail-panel/part-detail-panel.component';

export interface PartDetailDialogData {
  partId: number;
}

@Component({
  selector: 'app-part-detail-dialog',
  standalone: true,
  imports: [PartDetailPanelComponent],
  template: `
    <app-part-detail-panel
      [partId]="data.partId"
      (closed)="close()"
      (editRequested)="onEditRequested($event)" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PartDetailDialogComponent>);
  protected readonly data = inject<PartDetailDialogData>(MAT_DIALOG_DATA);

  protected close(): void {
    this.dialogRef.close();
  }

  protected onEditRequested(part: unknown): void {
    this.dialogRef.close({ action: 'edit', part });
  }
}
