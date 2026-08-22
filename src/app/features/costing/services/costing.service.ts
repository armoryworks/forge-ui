import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CostingPeriod,
  CostingCostCenter,
  OverheadPool,
  OverheadPoolBudget,
  WorkCenterCostRate,
  FreezeCostingPeriodResult,
} from '../models/costing.model';

/** Tier-3 activity-based costing API (`/api/v1/costing/tier3`, gated by CAP-COSTING-TIER3-ABC). */
@Injectable({ providedIn: 'root' })
export class CostingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/costing/tier3`;

  listPeriods(): Observable<CostingPeriod[]> {
    return this.http.get<CostingPeriod[]>(`${this.base}/periods`);
  }

  createPeriod(startDate: string, endDate: string): Observable<CostingPeriod> {
    return this.http.post<CostingPeriod>(`${this.base}/periods`, { startDate, endDate });
  }

  freezePeriod(id: number): Observable<FreezeCostingPeriodResult> {
    return this.http.post<FreezeCostingPeriodResult>(`${this.base}/periods/${id}/freeze`, {});
  }

  listRates(periodId: number): Observable<WorkCenterCostRate[]> {
    return this.http.get<WorkCenterCostRate[]>(`${this.base}/periods/${periodId}/rates`);
  }

  listCostCenters(): Observable<CostingCostCenter[]> {
    return this.http.get<CostingCostCenter[]>(`${this.base}/cost-centers`);
  }

  createCostCenter(body: Omit<CostingCostCenter, 'id'>): Observable<CostingCostCenter> {
    return this.http.post<CostingCostCenter>(`${this.base}/cost-centers`, body);
  }

  listPools(costCenterId?: number): Observable<OverheadPool[]> {
    let params = new HttpParams();
    if (costCenterId != null) params = params.set('costCenterId', costCenterId);
    return this.http.get<OverheadPool[]>(`${this.base}/pools`, { params });
  }

  createPool(body: Omit<OverheadPool, 'id'>): Observable<OverheadPool> {
    return this.http.post<OverheadPool>(`${this.base}/pools`, body);
  }

  upsertBudget(
    overheadCostPoolId: number,
    costingPeriodId: number,
    budgetAmount: number,
    budgetDriverQty: number,
  ): Observable<OverheadPoolBudget> {
    return this.http.put<OverheadPoolBudget>(`${this.base}/budgets`, {
      overheadCostPoolId,
      costingPeriodId,
      budgetAmount,
      budgetDriverQty,
    });
  }
}
