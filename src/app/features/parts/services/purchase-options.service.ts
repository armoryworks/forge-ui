import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  PartPurchaseOption,
  CreatePartPurchaseOptionRequest,
  UpdatePartPurchaseOptionRequest,
} from '../models/part-purchase-option.model';

/**
 * UoM purchase-options effort — CRUD for a part's purchasable sizes/forms.
 * Thin wrapper over /api/v1/parts/{partId}/purchase-options.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseOptionsService {
  private readonly http = inject(HttpClient);

  private base(partId: number): string {
    return `${environment.apiUrl}/parts/${partId}/purchase-options`;
  }

  list(partId: number): Observable<PartPurchaseOption[]> {
    return this.http.get<PartPurchaseOption[]>(this.base(partId));
  }

  create(partId: number, body: CreatePartPurchaseOptionRequest): Observable<PartPurchaseOption> {
    return this.http.post<PartPurchaseOption>(this.base(partId), body);
  }

  update(partId: number, id: number, body: UpdatePartPurchaseOptionRequest): Observable<PartPurchaseOption> {
    return this.http.put<PartPurchaseOption>(`${this.base(partId)}/${id}`, body);
  }

  delete(partId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base(partId)}/${id}`);
  }
}
