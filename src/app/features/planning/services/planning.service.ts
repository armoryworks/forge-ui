import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PlanningCycleListItem } from '../models/planning-cycle-list-item.model';
import { PlanningCycleDetail } from '../models/planning-cycle-detail.model';
import { CreatePlanningCycleRequest } from '../models/create-planning-cycle-request.model';
import { UpdatePlanningCycleRequest } from '../models/update-planning-cycle-request.model';

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/planning-cycles`;

  getCycles(): Observable<PlanningCycleListItem[]> {
    return this.http.get<PlanningCycleListItem[]>(this.base);
  }

  getCurrentCycle(): Observable<PlanningCycleDetail | null> {
    return this.http.get<PlanningCycleDetail | null>(`${this.base}/current`);
  }

  getCycle(id: number): Observable<PlanningCycleDetail> {
    return this.http.get<PlanningCycleDetail>(`${this.base}/${id}`);
  }

  createCycle(request: CreatePlanningCycleRequest): Observable<PlanningCycleDetail> {
    return this.http.post<PlanningCycleDetail>(this.base, request);
  }

  updateCycle(id: number, request: UpdatePlanningCycleRequest): Observable<PlanningCycleDetail> {
    return this.http.put<PlanningCycleDetail>(`${this.base}/${id}`, request);
  }

  activateCycle(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/activate`, {});
  }

  completeCycle(id: number, rolloverIncomplete: boolean): Observable<{ newCycleId: number }> {
    return this.http.post<{ newCycleId: number }>(`${this.base}/${id}/complete`, { rolloverIncomplete });
  }

  commitJob(cycleId: number, jobId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${cycleId}/entries`, { jobId });
  }

  removeEntry(cycleId: number, jobId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${cycleId}/entries/${jobId}`);
  }

  reorderEntries(cycleId: number, items: { jobId: number; sortOrder: number }[]): Observable<void> {
    return this.http.put<void>(`${this.base}/${cycleId}/entries/order`, { items });
  }

  completeEntry(cycleId: number, jobId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${cycleId}/entries/${jobId}/complete`, {});
  }
}
