import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { CustomerReturnDetailPanelComponent } from '../customer-return-detail-panel/customer-return-detail-panel.component';

export interface CustomerReturnDetailDialogData {
  customerReturnId: number;
}

@Component({
  selector: 'app-customer-return-detail-dialog',
  standalone: true,
  imports: [CustomerReturnDetailPanelComponent],
  template: `
    <app-customer-return-detail-panel
      [customerReturnId]="data.customerReturnId"
      (closed)="close()"
      (updated)="onUpdated()" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReturnDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CustomerReturnDetailDialogComponent, boolean>);

  protected readonly data = inject<CustomerReturnDetailDialogData>(MAT_DIALOG_DATA);

  private hasUpdated = false;

  protected close(): void {
    this.dialogRef.close(this.hasUpdated);
  }

  protected onUpdated(): void {
    this.hasUpdated = true;
  }
}
