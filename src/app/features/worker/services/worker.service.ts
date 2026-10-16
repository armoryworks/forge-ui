import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { WorkerJobListItem } from '../models/worker-job-list-item.model';
import { WorkerTask } from '../models/worker-task.model';

@Injectable({ providedIn: 'root' })
export class WorkerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/jobs`;

  getMyTasks(assigneeId: number): Observable<WorkerTask[]> {
    const params = new HttpParams().set('assigneeId', assigneeId).set('pageSize', 200);
    return this.http.get<PagedResponse<WorkerJobListItem>>(this.base, { params }).pipe(
      map(res => (res?.items ?? []).map(item => this.toTask(item))),
    );
  }

  private toTask(item: WorkerJobListItem): WorkerTask {
    return {
      id: item.id,
      jobNumber: item.jobNumber,
      title: item.title,
      stageName: item.stageName,
      stageColor: item.stageColor,
      priority: item.priorityName,
      customerName: item.customerName,
      dueDate: item.dueDate ? new Date(item.dueDate) : null,
      subtaskCount: item.operationsTotal ?? 0,
      subtasksCompleted: item.operationsComplete ?? 0,
    };
  }
}
