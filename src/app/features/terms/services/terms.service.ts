import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { TermsDocument } from '../models/terms-document.model';
import { TermsScope } from '../models/terms-scope.model';
import { CreateTermsDocumentRequest } from '../models/create-terms-document-request.model';
import { UpdateTermsDocumentRequest } from '../models/update-terms-document-request.model';

/** Optional filters for the terms list endpoint (`?scope=&customerId=&partId=&isActive=`). */
export interface TermsListFilters {
  scope?: TermsScope;
  customerId?: number;
  partId?: number;
  isActive?: boolean;
}

/**
 * S3 — terms & conditions CRUD. Company-scope mutations require the Admin role
 * (server returns 403 otherwise); Customer/Part scope is available to the
 * broader admin roles. Errors are surfaced by the global HttpErrorInterceptor,
 * so callers just handle the success path.
 */
@Injectable({ providedIn: 'root' })
export class TermsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/terms`;

  list(filters: TermsListFilters = {}): Observable<TermsDocument[]> {
    let params = new HttpParams();
    if (filters.scope) params = params.set('scope', filters.scope);
    if (filters.customerId != null) params = params.set('customerId', String(filters.customerId));
    if (filters.partId != null) params = params.set('partId', String(filters.partId));
    if (filters.isActive != null) params = params.set('isActive', String(filters.isActive));
    return this.http.get<TermsDocument[]>(this.base, { params });
  }

  create(request: CreateTermsDocumentRequest): Observable<TermsDocument> {
    return this.http.post<TermsDocument>(this.base, request);
  }

  update(id: number, request: UpdateTermsDocumentRequest): Observable<TermsDocument> {
    return this.http.put<TermsDocument>(`${this.base}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
