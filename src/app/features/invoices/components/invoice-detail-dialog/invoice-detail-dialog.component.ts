import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { InvoiceDetailPanelComponent } from '../invoice-detail-panel/invoice-detail-panel.component';
import { InvoiceDetail } from '../../models/invoice-detail.model';

export interface InvoiceDetailDialogData {
  invoiceId: number;
}

export interface InvoiceDetailDialogResult {
  action: 'edit';
  invoice: InvoiceDetail;
}

@Component({
  selector: 'app-invoice-detail-dialog',
  standalone: true,
  imports: [InvoiceDetailPanelComponent],
  template: `
    <app-invoice-detail-panel
      [invoiceId]="data.invoiceId"
      (closed)="close()"
      (editRequested)="onEditRequested($event)"
      (invoiceChanged)="changed = true" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<InvoiceDetailDialogComponent, InvoiceDetailDialogResult | undefined>);

  protected readonly data = inject<InvoiceDetailDialogData>(MAT_DIALOG_DATA);
  protected changed = false;

  protected close(): void {
    this.dialogRef.close();
  }

  protected onEditRequested(invoice: InvoiceDetail): void {
    this.dialogRef.close({ action: 'edit', invoice });
  }
}
