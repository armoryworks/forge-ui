import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApprovalRequest, ApprovalWorkflow } from '../models/approval.model';

@Injectable({ providedIn: 'root' })
export class ApprovalsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/approvals`;

  getPendingApprovals(): Observable<ApprovalRequest[]> {
    return this.http.get<ApprovalRequest[]>(`${this.base}/pending`);
  }

  getApprovalHistory(entityType: string, entityId: number): Observable<ApprovalRequest[]> {
    return this.http.get<ApprovalRequest[]>(`${this.base}/history/${entityType}/${entityId}`);
  }

  submitForApproval(data: {
    entityType: string; entityId: number; amount?: number; entitySummary?: string;
  }): Observable<ApprovalRequest> {
    return this.http.post<ApprovalRequest>(`${this.base}/submit`, data);
  }

  approve(requestId: number, comments?: string): Observable<ApprovalRequest> {
    return this.http.post<ApprovalRequest>(`${this.base}/${requestId}/approve`, { comments });
  }

  reject(requestId: number, comments: string): Observable<ApprovalRequest> {
    return this.http.post<ApprovalRequest>(`${this.base}/${requestId}/reject`, { comments });
  }

  delegate(requestId: number, delegateToUserId: number, comments?: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${requestId}/delegate`, { delegateToUserId, comments });
  }

  // Admin
  getWorkflows(): Observable<ApprovalWorkflow[]> {
    return this.http.get<ApprovalWorkflow[]>(`${this.base}/workflows`);
  }

  createWorkflow(data: {
    name: string; entityType: string; description?: string;
    activationConditionsJson?: string; steps: unknown[];
  }): Observable<ApprovalWorkflow> {
    return this.http.post<ApprovalWorkflow>(`${this.base}/workflows`, data);
  }

  updateWorkflow(id: number, data: {
    name: string; entityType: string; description?: string;
    activationConditionsJson?: string; steps: unknown[];
  }): Observable<ApprovalWorkflow> {
    return this.http.put<ApprovalWorkflow>(`${this.base}/workflows/${id}`, data);
  }
}
