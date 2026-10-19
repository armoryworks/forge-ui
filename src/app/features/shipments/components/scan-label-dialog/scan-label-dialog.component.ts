import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { BarcodeScanInputComponent } from '../../../../shared/components/barcode-scan-input/barcode-scan-input.component';
import { ScanLabelDialogData } from '../../models/scan-label-dialog-data.model';

/**
 * Asks for the shipment's printed label to be scanned before it ships. Closes with the scanned code,
 * or with undefined when cancelled. The code is never filled in for the user: the scan is the proof
 * that the right label is on the right parcel.
 */
@Component({
  selector: 'app-scan-label-dialog',
  standalone: true,
  imports: [TranslatePipe, DialogComponent, BarcodeScanInputComponent],
  templateUrl: './scan-label-dialog.component.html',
  styleUrl: './scan-label-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanLabelDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ScanLabelDialogComponent, string | undefined>);
  protected readonly data = inject<ScanLabelDialogData>(MAT_DIALOG_DATA);

  protected onScanned(code: string): void {
    const trimmed = code.trim();
    if (!trimmed) return;
    this.dialogRef.close(trimmed);
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
