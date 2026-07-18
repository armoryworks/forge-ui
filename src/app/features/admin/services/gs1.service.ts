import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Gs1Settings } from '../gs1/models/gs1-settings.model';
import { AssignGtinResult } from '../gs1/models/assign-gtin-result.model';

/**
 * GS1 GTIN barcode identity — install-level company-prefix settings plus
 * per-part GTIN assignment. Every endpoint is gated server-side by
 * CAP-MD-GS1; the UI mirrors that gate via capabilityGuard / *appCap.
 */
@Injectable({ providedIn: 'root' })
export class Gs1Service {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/gs1`;

  getSettings(): Observable<Gs1Settings> {
    return this.http.get<Gs1Settings>(`${this.base}/settings`);
  }

  /** Passing an empty/null prefix clears it and reverts the install to internal-only barcodes. */
  updateSettings(companyPrefix: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/settings`, { companyPrefix });
  }

  /** Omit `manualGtin` to auto-allocate the next GTIN from the company prefix. */
  assignGtin(partId: number, manualGtin?: string): Observable<AssignGtinResult> {
    const body = manualGtin ? { manualGtin } : {};
    return this.http.post<AssignGtinResult>(`${this.base}/parts/${partId}/gtin`, body);
  }

  /** Reverts the part to its internal code. */
  removeGtin(partId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/parts/${partId}/gtin`);
  }
}
