import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { KanbanJob } from '../models/kanban-job.model';
import { JobsTableQuery } from '../models/jobs-table-query.model';
import { JobsTablePageRequest } from '../models/jobs-table-page-request.model';

/** One page of the jobs table from `GET /jobs`: the board's filters plus the table's sort and column filters. */
@Injectable({ providedIn: 'root' })
export class JobsTableService {
  private readonly http = inject(HttpClient);

  getPage(query: JobsTableQuery, request: JobsTablePageRequest): Observable<PagedResponse<KanbanJob>> {
    return this.http.get<PagedResponse<KanbanJob>>(`${environment.apiUrl}/jobs`, { params: this.params(query, request) });
  }

  private params(query: JobsTableQuery, request: JobsTablePageRequest): HttpParams {
    const f = query.filters;
    let params = new HttpParams()
      .set('page', String(request.page))
      .set('pageSize', String(request.pageSize));
    if (request.sort) params = params.set('sort', request.sort).set('order', request.order);
    if (query.trackTypeId != null) params = params.set('trackTypeId', String(query.trackTypeId));
    if (query.includeArchived) params = params.set('includeArchived', 'true');
    if (f.activeOnly) params = params.set('activeOnly', 'true');
    if (f.search.trim()) params = params.set('q', f.search.trim());
    if (f.teamId != null) params = params.set('teamId', String(f.teamId));
    if (f.customerId != null) params = params.set('customerId', String(f.customerId));
    if (f.overdueOnly) params = params.set('overdueOnly', 'true');
    if (f.onHoldOnly) params = params.set('onHoldOnly', 'true');
    if (query.myWorkUserId != null) params = params.set('assigneeId', String(query.myWorkUserId));
    const filters = query.assigneeIds.length
      ? [...request.filters, `assigneeId:in:${query.assigneeIds.join('|')}`]
      : request.filters;
    for (const entry of filters) params = params.append('filter', entry);
    return params;
  }
}
