import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  PartPurchaseUnit,
  CreatePartPurchaseUnitRequest,
  UpdatePartPurchaseUnitRequest,
} from '../models/part-purchase-unit.model';

/**
 * UoM purchase-units effort — CRUD for a part's purchasable sizes/forms.
 * Thin wrapper over /api/v1/parts/{partId}/purchase-units.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseUnitsService {
  private readonly http = inject(HttpClient);

  private base(partId: number): string {
    return `${environment.apiUrl}/parts/${partId}/purchase-units`;
  }

  list(partId: number): Observable<PartPurchaseUnit[]> {
    return this.http.get<PartPurchaseUnit[]>(this.base(partId));
  }

  create(partId: number, body: CreatePartPurchaseUnitRequest): Observable<PartPurchaseUnit> {
    return this.http.post<PartPurchaseUnit>(this.base(partId), body);
  }

  update(partId: number, id: number, body: UpdatePartPurchaseUnitRequest): Observable<PartPurchaseUnit> {
    return this.http.put<PartPurchaseUnit>(`${this.base(partId)}/${id}`, body);
  }

  delete(partId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base(partId)}/${id}`);
  }
}
