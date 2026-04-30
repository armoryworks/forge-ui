import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { isCapabilityDisabledError } from '../../../shared/errors/capability-disabled.error';
import { CapabilityService } from '../../../shared/services/capability.service';
import { PlanningCycleListItem } from '../models/planning-cycle-list-item.model';
import { PlanningCycleDetail } from '../models/planning-cycle-detail.model';
import { CreatePlanningCycleRequest } from '../models/create-planning-cycle-request.model';
import { UpdatePlanningCycleRequest } from '../models/update-planning-cycle-request.model';

const PLANNING_CAPABILITY = 'CAP-PLAN-MRP';

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly http = inject(HttpClient);
  private readonly capability = inject(CapabilityService);
  private readonly base = `${environment.apiUrl}/planning-cycles`;

  /** Phase 4 Phase-D — true when planning capability is disabled. */
  readonly capabilityDisabled = signal(false);

  getCycles(): Observable<PlanningCycleListItem[]> {
    if (this.isDisabled()) {
      this.capabilityDisabled.set(true);
      return of([]);
    }
    return this.http.get<PlanningCycleListItem[]>(this.base).pipe(
      tap(() => this.capabilityDisabled.set(false)),
      catchError((err) => this.handleErrorAsEmpty<PlanningCycleListItem[]>(err, [])),
    );
  }

  /**
   * Returns the active cycle for the current user. Pre-checks the
   * `CAP-PLAN-MRP` capability and short-circuits to `null` when disabled —
   * the dashboard widget renders "no active cycle" without firing a 403.
   */
  getCurrentCycle(): Observable<PlanningCycleDetail | null> {
    if (this.isDisabled()) {
      this.capabilityDisabled.set(true);
      return of(null);
    }
    return this.http.get<PlanningCycleDetail | null>(`${this.base}/current`).pipe(
      tap(() => this.capabilityDisabled.set(false)),
      catchError((err) => this.handleErrorAsEmpty<PlanningCycleDetail | null>(err, null)),
    );
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

  private isDisabled(): boolean {
    return this.capability.isKnown(PLANNING_CAPABILITY)
      && !this.capability.isEnabled(PLANNING_CAPABILITY);
  }

  /**
   * Layer-2 safety net: if a `CapabilityDisabledError` slips through the
   * boot-time race window (descriptor not loaded yet at call time), treat
   * the call as if the pre-check had short-circuited it. Other errors
   * propagate.
   */
  private handleErrorAsEmpty<T>(err: unknown, fallback: T): Observable<T> {
    if (isCapabilityDisabledError(err)) {
      this.capabilityDisabled.set(true);
      return of(fallback);
    }
    return throwError(() => err);
  }
}
