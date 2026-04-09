import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { LeadDetailPanelComponent } from '../lead-detail-panel/lead-detail-panel.component';
import { LeadItem } from '../../models/lead-item.model';

export interface LeadDetailDialogData {
  leadId: number;
}

export interface LeadDetailDialogResult {
  action: 'edit';
  lead: LeadItem;
}

@Component({
  selector: 'app-lead-detail-dialog',
  standalone: true,
  imports: [LeadDetailPanelComponent],
  template: `<app-lead-detail-panel [leadId]="data.leadId" (closed)="close()" (editRequested)="onEditRequested($event)" />`,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<LeadDetailDialogComponent, LeadDetailDialogResult | undefined>);

  protected readonly data = inject<LeadDetailDialogData>(MAT_DIALOG_DATA);

  protected close(): void {
    this.dialogRef.close();
  }

  protected onEditRequested(lead: LeadItem): void {
    this.dialogRef.close({ action: 'edit', lead });
  }
}
