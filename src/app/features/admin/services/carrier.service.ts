import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Carrier, CarrierTestResult, CreateCarrierRequest, UpdateCarrierCredentialsRequest } from '../models/carrier.model';

@Injectable({ providedIn: 'root' })
export class CarrierService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/carriers`;

  list(activeOnly?: boolean): Observable<Carrier[]> {
    const params: Record<string, string> = {};
    if (activeOnly !== undefined) params['activeOnly'] = String(activeOnly);
    return this.http.get<Carrier[]>(this.base, { params });
  }

  create(request: CreateCarrierRequest): Observable<Carrier> {
    return this.http.post<Carrier>(this.base, request);
  }

  /** Store API credentials for a carrier. The secret is encrypted server-side and never returned. */
  updateCredentials(id: number, request: UpdateCarrierCredentialsRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/credentials`, request);
  }

  /** Test the carrier's live API connection (a sample rate-shop using the stored credentials). */
  test(id: number): Observable<CarrierTestResult> {
    return this.http.post<CarrierTestResult>(`${this.base}/${id}/test`, {});
  }
}
