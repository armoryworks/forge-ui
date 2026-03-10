import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { WorkerTask } from '../models/worker-task.model';

@Injectable({ providedIn: 'root' })
export class WorkerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/jobs`;

  getMyTasks(assigneeId: number): Observable<WorkerTask[]> {
    const params = new HttpParams().set('assigneeId', assigneeId);
    return this.http.get<WorkerTask[]>(this.base, { params });
  }
}
