import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { JobDetailPanelComponent } from './job-detail-panel.component';
import { JobDetail } from '../models/job-detail.model';

export interface JobDetailDialogData {
  jobId: number;
}

@Component({
  selector: 'app-job-detail-dialog',
  standalone: true,
  imports: [JobDetailPanelComponent],
  template: `
    <app-job-detail-panel
      [jobId]="data.jobId"
      (closed)="close()"
      (editRequested)="onEditRequested($event)" />
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<JobDetailDialogComponent>);
  private readonly router = inject(Router);

  protected readonly data = inject<JobDetailDialogData>(MAT_DIALOG_DATA);

  protected close(): void {
    this.dialogRef.close();
  }

  protected onEditRequested(job: JobDetail): void {
    this.dialogRef.close();
    this.router.navigate(['/kanban'], { queryParams: { jobId: job.jobNumber } });
  }
}
