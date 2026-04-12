import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { JobCostSummary, JobProfitabilityRow, LaborRate, MaterialIssue, MaterialIssueRequest } from '../models/job-cost.model';
import { OperationTimeAnalysis } from '../models/operation-time.model';

@Injectable({ providedIn: 'root' })
export class JobCostService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  getCostSummary(jobId: number): Observable<JobCostSummary> {
    return this.http.get<JobCostSummary>(`${this.baseUrl}/jobs/${jobId}/cost-summary`);
  }

  getMaterialIssues(jobId: number, page = 1, pageSize = 25): Observable<MaterialIssue[]> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<MaterialIssue[]>(`${this.baseUrl}/jobs/${jobId}/material-issues`, { params });
  }

  issueMaterial(jobId: number, request: MaterialIssueRequest): Observable<MaterialIssue> {
    return this.http.post<MaterialIssue>(`${this.baseUrl}/jobs/${jobId}/material-issues`, request);
  }

  returnMaterial(jobId: number, issueId: number): Observable<MaterialIssue> {
    return this.http.post<MaterialIssue>(`${this.baseUrl}/jobs/${jobId}/material-issues/${issueId}/return`, {});
  }

  recalculateCosts(jobId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/jobs/${jobId}/recalculate-costs`, {});
  }

  getProfitabilityReport(filters?: {
    dateFrom?: string;
    dateTo?: string;
    customerId?: number;
    minMargin?: number;
  }): Observable<JobProfitabilityRow[]> {
    let params = new HttpParams();
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
    if (filters?.customerId) params = params.set('customerId', filters.customerId);
    if (filters?.minMargin != null) params = params.set('minMargin', filters.minMargin);
    return this.http.get<JobProfitabilityRow[]>(`${this.baseUrl}/reports/job-profitability`, { params });
  }

  getLaborRates(userId: number): Observable<LaborRate[]> {
    return this.http.get<LaborRate[]>(`${this.baseUrl}/admin/labor-rates/${userId}`);
  }

  createLaborRate(rate: Omit<LaborRate, 'id'>): Observable<LaborRate> {
    return this.http.post<LaborRate>(`${this.baseUrl}/admin/labor-rates`, rate);
  }

  getOperationTimeSummary(jobId: number): Observable<OperationTimeAnalysis[]> {
    return this.http.get<OperationTimeAnalysis[]>(`${this.baseUrl}/jobs/${jobId}/operation-time-summary`);
  }
}
