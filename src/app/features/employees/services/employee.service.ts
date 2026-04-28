import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { PagedResponse, PagedQuery } from '../../../shared/models/paged-response.model';
import {
  EmployeeListItem, EmployeeDetail, EmployeeStats,
  EmployeeTimeEntry, EmployeePayStub, EmployeeJob,
  EmployeeExpense, EmployeeTraining, EmployeeCompliance,
} from '../models/employee.model';

/** Phase 3 F7-broad / WU-22 — paged employee list query parameters. */
export interface EmployeeListPagedQuery extends PagedQuery {
  isActive?: boolean | null;
  teamId?: number | null;
  role?: string;
  department?: string;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/employees`;

  /**
   * Phase 3 F7-broad / WU-22 — backward-compat shim that calls the paged
   * endpoint and unwraps the envelope.
   */
  getEmployees(filters?: {
    search?: string;
    teamId?: number;
    role?: string;
    isActive?: boolean;
  }): Observable<EmployeeListItem[]> {
    return this.getEmployeesPaged({
      q: filters?.search,
      teamId: filters?.teamId,
      role: filters?.role,
      isActive: filters?.isActive,
      pageSize: 200,
    }).pipe(map(p => p.items));
  }

  /**
   * Phase 3 F7-broad / WU-22 — paged employee list. Returns the standard
   * envelope ({ items, totalCount, page, pageSize }).
   */
  getEmployeesPaged(query: EmployeeListPagedQuery = {}): Observable<PagedResponse<EmployeeListItem>> {
    let params = new HttpParams();
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.pageSize != null) params = params.set('pageSize', String(query.pageSize));
    if (query.sort) params = params.set('sort', query.sort);
    if (query.order) params = params.set('order', query.order);
    if (query.q) params = params.set('q', query.q);
    if (query.isActive !== undefined && query.isActive !== null) params = params.set('isActive', String(query.isActive));
    if (query.teamId != null) params = params.set('teamId', String(query.teamId));
    if (query.role) params = params.set('role', query.role);
    if (query.department) params = params.set('department', query.department);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    return this.http.get<PagedResponse<EmployeeListItem>>(this.baseUrl, { params });
  }

  getEmployee(id: number): Observable<EmployeeDetail> {
    return this.http.get<EmployeeDetail>(`${this.baseUrl}/${id}`);
  }

  getEmployeeStats(id: number): Observable<EmployeeStats> {
    return this.http.get<EmployeeStats>(`${this.baseUrl}/${id}/stats`);
  }

  getTimeSummary(id: number, period?: string): Observable<EmployeeTimeEntry[]> {
    let params = new HttpParams();
    if (period) params = params.set('period', period);
    return this.http.get<EmployeeTimeEntry[]>(`${this.baseUrl}/${id}/time-summary`, { params });
  }

  getPaySummary(id: number): Observable<EmployeePayStub[]> {
    return this.http.get<EmployeePayStub[]>(`${this.baseUrl}/${id}/pay-summary`);
  }

  getJobs(id: number): Observable<EmployeeJob[]> {
    return this.http.get<EmployeeJob[]>(`${this.baseUrl}/${id}/jobs`);
  }

  getExpenses(id: number): Observable<EmployeeExpense[]> {
    return this.http.get<EmployeeExpense[]>(`${this.baseUrl}/${id}/expenses`);
  }

  getTraining(id: number): Observable<EmployeeTraining[]> {
    return this.http.get<EmployeeTraining[]>(`${this.baseUrl}/${id}/training`);
  }

  getCompliance(id: number): Observable<EmployeeCompliance[]> {
    return this.http.get<EmployeeCompliance[]>(`${this.baseUrl}/${id}/compliance`);
  }

  getActivity(id: number): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${this.baseUrl}/${id}/activity`);
  }
}
