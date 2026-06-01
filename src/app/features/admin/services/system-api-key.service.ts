import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  SystemApiKey,
  CreateSystemApiKeyRequest,
  CreateSystemApiKeyResponse,
} from '../models/system-api-key.model';

/**
 * Admin-only user-bound system API key management. Backed by
 * `forge.api/Controllers/SystemApiKeysController.cs` — gated on
 * `[Authorize(Roles = "Admin")]` + `CAP-IDEN-AUTH-API-KEYS`.
 *
 * Companion to `BiApiKeyService`: same CRUD shape, distinct entity. Keys
 * issued here authenticate AS a real ApplicationUser (audit + activity rows
 * attribute correctly).
 */
@Injectable({ providedIn: 'root' })
export class SystemApiKeyService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/system-api-keys`;

  list(): Observable<SystemApiKey[]> {
    return this.http.get<SystemApiKey[]>(this.base);
  }

  create(request: CreateSystemApiKeyRequest): Observable<CreateSystemApiKeyResponse> {
    return this.http.post<CreateSystemApiKeyResponse>(this.base, request);
  }

  revoke(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
