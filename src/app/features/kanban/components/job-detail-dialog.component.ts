import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { JobDetailPanelComponent } from './job-detail-panel.component';
import { JobDetail } from '../models/job-detail.model';
import { UserRef } from '../models/user-ref.model';
import { KanbanService } from '../services/kanban.service';

export interface JobDetailDialogData {
  jobId: number;
  users?: UserRef[];
  onQuantityChanged?: () => void;
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
      [users]="users()"
      (closed)="close()"
      (editRequested)="onEditRequested($event)"
      (quantityChanged)="data.onQuantityChanged?.()" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; } app-job-detail-panel { height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<JobDetailDialogComponent, JobDetailDialogResult | undefined>);

  protected readonly data = inject<JobDetailDialogData>(MAT_DIALOG_DATA);
  protected readonly users = signal<UserRef[]>(this.data.users ?? []);

  constructor() {
    if (this.users().length === 0) {
      inject(KanbanService).getUsers().subscribe(users => this.users.set(users));
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected onEditRequested(job: JobDetail): void {
    this.dialogRef.close({ action: 'edit', job });
  }
}
