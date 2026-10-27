import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SpcRecordPanelComponent } from '../../../quality/components/spc-record-panel/spc-record-panel.component';
import { SpcRecordDialogData } from '../../models/spc-record-dialog-data.model';

@Component({
  selector: 'app-spc-record-dialog',
  standalone: true,
  imports: [DialogComponent, SpcRecordPanelComponent],
  templateUrl: './spc-record-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpcRecordDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SpcRecordDialogComponent>);
  protected readonly data = inject<SpcRecordDialogData>(MAT_DIALOG_DATA);

  protected close(): void {
    this.dialogRef.close();
  }
}
