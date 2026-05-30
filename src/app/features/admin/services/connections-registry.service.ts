import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { IntegrationRecord } from '../models/integration-record.model';

/**
 * Admin-only read-only federated registry over every credential / connection
 * the install holds. Backed by
 * `forge.api/Controllers/ConnectionsController.cs` — gated `[Authorize(Roles
 * = "Admin")]` + `CAP-IDEN-AUTH-API-KEYS`.
 *
 * The UI never mutates via this surface — every row carries `manageRoute`
 * pointing at the native admin page for that source.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionsRegistryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/connections`;

  list(): Observable<IntegrationRecord[]> {
    return this.http.get<IntegrationRecord[]>(this.base);
  }
}
