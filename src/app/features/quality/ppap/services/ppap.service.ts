import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PpapSubmission } from '../models/ppap-submission.model';
import { PpapElement } from '../models/ppap-element.model';
import { PpapStatus } from '../models/ppap-status.model';
import { CreatePpapRequest } from '../models/create-ppap-request.model';
import { UpdatePpapElementRequest } from '../models/update-ppap-element-request.model';
import { PpapResponseRequest } from '../models/ppap-response-request.model';
import { FileAttachment } from '../../../../shared/models/file.model';

@Injectable({ providedIn: 'root' })
export class PpapService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ppap-submissions`;

  list(filter?: { partId?: number; customerId?: number; status?: PpapStatus }): Observable<PpapSubmission[]> {
    let params = new HttpParams();
    if (filter?.partId) params = params.set('partId', filter.partId);
    if (filter?.customerId) params = params.set('customerId', filter.customerId);
    if (filter?.status) params = params.set('status', filter.status);
    return this.http.get<PpapSubmission[]>(this.base, { params });
  }

  get(id: number): Observable<PpapSubmission> {
    return this.http.get<PpapSubmission>(`${this.base}/${id}`);
  }

  create(request: CreatePpapRequest): Observable<PpapSubmission> {
    return this.http.post<PpapSubmission>(this.base, request);
  }

  updateElement(id: number, elementNumber: number, request: UpdatePpapElementRequest): Observable<PpapElement> {
    return this.http.put<PpapElement>(`${this.base}/${id}/elements/${elementNumber}`, request);
  }

  submit(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/submit`, {});
  }

  recordResponse(id: number, request: PpapResponseRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/response`, request);
  }

  signPsw(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/psw/sign`, {});
  }

  elementFiles(elementId: number): Observable<FileAttachment[]> {
    return this.http.get<FileAttachment[]>(`${environment.apiUrl}/ppap-elements/${elementId}/files`);
  }

  fileDownloadUrl(fileId: number): string {
    return `${environment.apiUrl}/files/${fileId}/download`;
  }
}
