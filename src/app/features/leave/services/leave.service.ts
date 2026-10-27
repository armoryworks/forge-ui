import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AdjustLeaveBalanceRequest } from '../models/adjust-leave-balance-request.model';
import { CreateLeaveRequest } from '../models/create-leave-request.model';
import { LeaveBalance } from '../models/leave-balance.model';
import { LeaveBalanceAdjustment } from '../models/leave-balance-adjustment.model';
import { LeavePolicy } from '../models/leave-policy.model';
import { LeavePolicyRequest } from '../models/leave-policy-request.model';
import { LeaveRequest } from '../models/leave-request.model';
import { LeaveRequestStatus } from '../models/leave-request-status.type';
import { LeaveUser } from '../models/leave-user.model';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/leave`;

  getPolicies(activeOnly = true): Observable<LeavePolicy[]> {
    return this.http.get<LeavePolicy[]>(`${this.base}/policies`, { params: new HttpParams().set('activeOnly', activeOnly) });
  }

  createPolicy(request: LeavePolicyRequest): Observable<LeavePolicy> {
    return this.http.post<LeavePolicy>(`${this.base}/policies`, request);
  }

  updatePolicy(id: number, request: LeavePolicyRequest): Observable<LeavePolicy> {
    return this.http.put<LeavePolicy>(`${this.base}/policies/${id}`, request);
  }

  getBalances(userId: number): Observable<LeaveBalance[]> {
    return this.http.get<LeaveBalance[]>(`${this.base}/balances/${userId}`);
  }

  getAllBalances(): Observable<LeaveBalance[]> {
    return this.http.get<LeaveBalance[]>(`${this.base}/balances`);
  }

  getAdjustments(userId: number): Observable<LeaveBalanceAdjustment[]> {
    return this.http.get<LeaveBalanceAdjustment[]>(`${this.base}/balances/${userId}/adjustments`);
  }

  adjustBalance(userId: number, request: AdjustLeaveBalanceRequest): Observable<LeaveBalanceAdjustment> {
    return this.http.post<LeaveBalanceAdjustment>(`${this.base}/balances/${userId}/adjust`, request);
  }

  getRequests(userId?: number | null, status?: LeaveRequestStatus | null): Observable<LeaveRequest[]> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    if (status) params = params.set('status', status);
    return this.http.get<LeaveRequest[]>(`${this.base}/requests`, { params });
  }

  createRequest(request: CreateLeaveRequest): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(`${this.base}/requests`, request);
  }

  cancelRequest(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/cancel`, {});
  }

  approveRequest(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/approve`, {});
  }

  denyRequest(id: number, reason?: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/deny`, { reason: reason ?? null });
  }

  getUsers(): Observable<LeaveUser[]> {
    return this.http.get<LeaveUser[]>(`${environment.apiUrl}/users`);
  }
}
