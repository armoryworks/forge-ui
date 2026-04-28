import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { KanbanJob } from '../../kanban/models/kanban-job.model';

export interface BacklogFilters {
  trackTypeId?: number | null;
  assigneeId?: number | null;
  search?: string;
  /**
   * When true, fetches archived jobs instead of active. Phase 3 / WU-07 / F2 —
   * surfaces archived jobs so admins have a recovery path via the unarchive
   * endpoints (no UI-side recovery existed before).
   */
  isArchived?: boolean;
}

@Injectable({ providedIn: 'root' })
export class BacklogService {
  private readonly http = inject(HttpClient);

  getJobs(filters?: BacklogFilters): Observable<KanbanJob[]> {
    // Phase 3 F7-broad / WU-22 — server returns the paged envelope on /jobs.
    // The backlog still wants the full set so we request the server cap (200)
    // and unwrap. Switch to true server-paging if a backlog grows past 200.
    let params = new HttpParams()
      .set('isArchived', filters?.isArchived ? 'true' : 'false')
      .set('pageSize', '200');
    if (filters?.trackTypeId) {
      params = params.set('trackTypeId', filters.trackTypeId.toString());
    }
    if (filters?.assigneeId) {
      params = params.set('assigneeId', filters.assigneeId.toString());
    }
    if (filters?.search) {
      params = params.set('search', filters.search);
    }
    return this.http.get<PagedResponse<KanbanJob>>(`${environment.apiUrl}/jobs`, { params })
      .pipe(map(p => p.items));
  }
}
