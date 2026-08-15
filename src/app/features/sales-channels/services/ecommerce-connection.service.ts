import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ECommerceConnection, ECommercePlatformOption } from '../models/ecommerce-connection.model';
import {
  CreateECommerceConnectionRequest,
  UpdateECommerceConnectionRequest,
} from '../models/create-ecommerce-connection-request.model';

export interface TestConnectionResult {
  success: boolean;
  errorMessage: string | null;
}

/**
 * Stored credentials for storefront and marketplace accounts.
 *
 * <p>Credentials are write-only across this boundary: the API never returns
 * them, so an update with a blank credential field means "leave the stored
 * secret alone" rather than "clear it".</p>
 */
@Injectable({ providedIn: 'root' })
export class ECommerceConnectionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/ecommerce`;

  /** Platform options annotated with whether a connector for each actually exists. */
  getPlatforms(): Observable<ECommercePlatformOption[]> {
    return this.http.get<ECommercePlatformOption[]>(`${this.base}/platforms`);
  }

  getConnections(): Observable<ECommerceConnection[]> {
    return this.http.get<ECommerceConnection[]>(this.base);
  }

  createConnection(body: CreateECommerceConnectionRequest): Observable<ECommerceConnection> {
    return this.http.post<ECommerceConnection>(this.base, body);
  }

  updateConnection(
    id: number,
    body: UpdateECommerceConnectionRequest & { platform: string },
  ): Observable<ECommerceConnection> {
    return this.http.put<ECommerceConnection>(`${this.base}/${id}`, body);
  }

  testConnection(id: number): Observable<TestConnectionResult> {
    return this.http.post<TestConnectionResult>(`${this.base}/${id}/test`, {});
  }
}
