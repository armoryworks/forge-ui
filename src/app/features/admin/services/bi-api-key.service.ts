import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  BiApiKey,
  CreateBiApiKeyRequest,
  CreateBiApiKeyResponse,
} from '../models/bi-api-key.model';

/**
 * Phase 3 / WU-04 retrofit — admin-only BI API key management. Backed by
 * `forge.api/Controllers/BiApiKeysController.cs` (gated on
 * `[Authorize(Roles = "Admin")]` via the default JWT scheme).
 */
@Injectable({ providedIn: 'root' })
export class BiApiKeyService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/bi-api-keys`;

  list(): Observable<BiApiKey[]> {
    return this.http.get<BiApiKey[]>(this.base);
  }

  create(request: CreateBiApiKeyRequest): Observable<CreateBiApiKeyResponse> {
    return this.http.post<CreateBiApiKeyResponse>(this.base, request);
  }

  revoke(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
