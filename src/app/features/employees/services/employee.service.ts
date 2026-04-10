import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  EmployeeListItem, EmployeeDetail, EmployeeStats,
  EmployeeTimeEntry, EmployeePayStub, EmployeeJob,
  EmployeeExpense, EmployeeTraining, EmployeeCompliance,
} from '../models/employee.model';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/employees`;

  getEmployees(filters?: {
    search?: string;
    teamId?: number;
    role?: string;
    isActive?: boolean;
  }): Observable<EmployeeListItem[]> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.teamId != null) params = params.set('teamId', String(filters.teamId));
    if (filters?.role) params = params.set('role', filters.role);
    if (filters?.isActive != null) params = params.set('isActive', String(filters.isActive));
    return this.http.get<EmployeeListItem[]>(this.baseUrl, { params });
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
