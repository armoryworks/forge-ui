import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ControlledDocument } from '../models/controlled-document.model';
import { ControlledDocumentStatus } from '../models/controlled-document-status.model';
import { CreateControlledDocumentRequest } from '../models/create-controlled-document-request.model';
import { DocumentRevision } from '../models/document-revision.model';
import { WorkInstruction } from '../models/work-instruction.model';

@Injectable({ providedIn: 'root' })
export class ControlledDocumentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/documents/controlled`;

  list(filter?: { category?: string | null; status?: ControlledDocumentStatus | null; partId?: number; operationId?: number }): Observable<ControlledDocument[]> {
    let params = new HttpParams();
    if (filter?.category) params = params.set('category', filter.category);
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.partId) params = params.set('partId', filter.partId);
    if (filter?.operationId) params = params.set('operationId', filter.operationId);
    return this.http.get<ControlledDocument[]>(this.base, { params });
  }

  create(request: CreateControlledDocumentRequest): Observable<ControlledDocument> {
    return this.http.post<ControlledDocument>(this.base, request);
  }

  obsolete(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/obsolete`, {});
  }

  revisions(id: number): Observable<DocumentRevision[]> {
    return this.http.get<DocumentRevision[]>(`${this.base}/${id}/revisions`);
  }

  createRevision(id: number, fileAttachmentId: number, changeDescription: string): Observable<DocumentRevision> {
    return this.http.post<DocumentRevision>(`${this.base}/${id}/revisions`, { fileAttachmentId, changeDescription });
  }

  submitRevision(id: number, revisionId: number): Observable<DocumentRevision> {
    return this.http.post<DocumentRevision>(`${this.base}/${id}/revisions/${revisionId}/submit`, {});
  }

  approveRevision(id: number, revisionId: number): Observable<DocumentRevision> {
    return this.http.post<DocumentRevision>(`${this.base}/${id}/revisions/${revisionId}/approve`, {});
  }

  rejectRevision(id: number, revisionId: number): Observable<DocumentRevision> {
    return this.http.post<DocumentRevision>(`${this.base}/${id}/revisions/${revisionId}/reject`, {});
  }

  workInstructions(operationId: number | null, partId?: number | null): Observable<WorkInstruction[]> {
    let params = new HttpParams();
    if (operationId) params = params.set('operationId', operationId);
    if (partId) params = params.set('partId', partId);
    return this.http.get<WorkInstruction[]>(`${this.base}/work-instructions`, { params });
  }

  fileDownloadUrl(fileId: number): string {
    return `${environment.apiUrl}/files/${fileId}/download`;
  }
}
