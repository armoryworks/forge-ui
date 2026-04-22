import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ConsentContextResponse } from '../models/consent-context.model';

@Injectable({ providedIn: 'root' })
export class OidcConsentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/oidc/consent`;

  getContext(clientId: string, scope: string): Observable<ConsentContextResponse> {
    const params = new HttpParams()
      .set('client_id', clientId)
      .set('scope', scope);
    return this.http.get<ConsentContextResponse>(`${this.base}/context`, { params });
  }

  grant(clientId: string, scopes: string[]): Observable<void> {
    return this.http.post<void>(`${this.base}/grant`, { clientId, scopes });
  }

  deny(clientId: string, scopes: string[]): Observable<void> {
    return this.http.post<void>(`${this.base}/deny`, { clientId, scopes });
  }

  interactiveLogin(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/oidc/interactive-login`, {});
  }
}
