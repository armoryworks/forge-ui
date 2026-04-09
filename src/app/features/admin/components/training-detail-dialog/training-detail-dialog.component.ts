import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TrainingDetailPanelComponent } from '../training-detail-panel/training-detail-panel.component';

export interface TrainingDetailDialogData {
  moduleId?: number;
  userId?: number;
}

@Component({
  selector: 'app-training-detail-dialog',
  standalone: true,
  imports: [TrainingDetailPanelComponent],
  template: `
    <app-training-detail-panel
      [userId]="data.userId!"
      (closed)="close()" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<TrainingDetailDialogComponent>);

  protected readonly data = inject<TrainingDetailDialogData>(MAT_DIALOG_DATA);

  protected close(): void {
    this.dialogRef.close();
  }
}
