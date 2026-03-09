import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { KanbanJob } from '../../kanban/models/kanban-job.model';

export interface BacklogFilters {
  trackTypeId?: number | null;
  assigneeId?: number | null;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class BacklogService {
  private readonly http = inject(HttpClient);

  getJobs(filters?: BacklogFilters): Observable<KanbanJob[]> {
    let params = new HttpParams().set('isArchived', 'false');
    if (filters?.trackTypeId) {
      params = params.set('trackTypeId', filters.trackTypeId.toString());
    }
    if (filters?.assigneeId) {
      params = params.set('assigneeId', filters.assigneeId.toString());
    }
    if (filters?.search) {
      params = params.set('search', filters.search);
    }
    return this.http.get<KanbanJob[]>(`${environment.apiUrl}/jobs`, { params });
  }
}
