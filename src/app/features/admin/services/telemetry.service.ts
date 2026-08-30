import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  TelemetryAgreement, TelemetryConsentRecord, TelemetryStatus,
} from '../models/telemetry.model';

/**
 * Remote health monitoring — the opt-in that lets Armory Works notice this system has
 * a problem. Lives under admin settings rather than the capability system: it's a
 * consent decision about data leaving the building, not a feature toggle.
 */
@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/settings/telemetry`;

  /** The agreement text and sample payload, served by this install itself. */
  getAgreement(): Observable<TelemetryAgreement> {
    return this.http.get<TelemetryAgreement>(`${this.base}/agreement`);
  }

  getStatus(): Observable<TelemetryStatus> {
    return this.http.get<TelemetryStatus>(this.base);
  }

  /** Record the answer. The server stamps the agreement version, not the client. */
  recordConsent(accepted: boolean, acceptedByEmail?: string | null): Observable<TelemetryStatus> {
    return this.http.post<TelemetryStatus>(`${this.base}/consent`, { accepted, acceptedByEmail });
  }

  getConsentHistory(): Observable<TelemetryConsentRecord[]> {
    return this.http.get<TelemetryConsentRecord[]>(`${this.base}/consent-history`);
  }
}
