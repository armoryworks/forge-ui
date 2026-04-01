import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { JobDetailPanelComponent } from './job-detail-panel.component';
import { JobDetail } from '../models/job-detail.model';
import { UserRef } from '../models/user-ref.model';

export interface JobDetailDialogData {
  jobId: number;
  users?: UserRef[];
}

export interface JobDetailDialogResult {
  action: 'edit';
  job: JobDetail;
}

@Component({
  selector: 'app-job-detail-dialog',
  standalone: true,
  imports: [JobDetailPanelComponent],
  template: `
    <app-job-detail-panel
      [jobId]="data.jobId"
      [users]="data.users ?? []"
      (closed)="close()"
      (editRequested)="onEditRequested($event)" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<JobDetailDialogComponent, JobDetailDialogResult | undefined>);

  protected readonly data = inject<JobDetailDialogData>(MAT_DIALOG_DATA);

  protected close(): void {
    this.dialogRef.close();
  }

  protected onEditRequested(job: JobDetail): void {
    this.dialogRef.close({ action: 'edit', job });
  }
}
