import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { InvoiceDetailPanelComponent } from '../invoice-detail-panel/invoice-detail-panel.component';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

export interface InvoiceDetailDialogData {
  invoiceId: number;
}

@Component({
  selector: 'app-invoice-detail-dialog',
  standalone: true,
  imports: [InvoiceDetailPanelComponent],
  template: `
    <app-invoice-detail-panel
      [invoiceId]="data.invoiceId"
      (closed)="close()"
      (invoiceChanged)="changed = true" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; } app-invoice-detail-panel { height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<InvoiceDetailDialogComponent, void>);

  protected readonly data = inject<InvoiceDetailDialogData>(MAT_DIALOG_DATA);
  protected changed = false;

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
