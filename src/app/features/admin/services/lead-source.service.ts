import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateLeadSourceRequest,
  LeadSource,
  UpdateLeadSourceRequest,
} from '../models/lead-source.model';

@Injectable({ providedIn: 'root' })
export class LeadSourceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/lead-sources`;

  list(activeOnly?: boolean): Observable<LeadSource[]> {
    const params: Record<string, string> = {};
    if (activeOnly !== undefined) params['activeOnly'] = String(activeOnly);
    return this.http.get<LeadSource[]>(this.base, { params });
  }

  create(request: CreateLeadSourceRequest): Observable<LeadSource> {
    return this.http.post<LeadSource>(this.base, request);
  }

  update(id: number, request: UpdateLeadSourceRequest): Observable<LeadSource> {
    return this.http.put<LeadSource>(`${this.base}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
