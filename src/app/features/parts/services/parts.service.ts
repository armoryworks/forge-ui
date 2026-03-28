import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PartListItem } from '../models/part-list-item.model';
import { PartDetail } from '../models/part-detail.model';
import { CreatePartRequest } from '../models/create-part-request.model';
import { UpdatePartRequest } from '../models/update-part-request.model';
import { CreateBOMEntryRequest } from '../models/create-bom-entry-request.model';
import { UpdateBOMEntryRequest } from '../models/update-bom-entry-request.model';
import { PartStatus } from '../models/part-status.type';
import { PartType } from '../models/part-type.type';
import { PartRevision } from '../models/part-revision.model';
import { CreatePartRevisionRequest } from '../models/create-part-revision-request.model';
import { PartInventorySummary } from '../models/part-inventory-summary.model';
import { FileAttachment } from '../../../shared/models/file.model';
import { ProcessStep } from '../models/process-step.model';
import { CreateProcessStepRequest } from '../models/create-process-step-request.model';
import { UpdateProcessStepRequest } from '../models/update-process-step-request.model';
import { AddPartPriceRequest, PartPrice } from '../models/part-price.model';

@Injectable({ providedIn: 'root' })
export class PartsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parts`;

  getParts(status?: PartStatus, type?: PartType, search?: string): Observable<PartListItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (type) params = params.set('type', type);
    if (search) params = params.set('search', search);
    return this.http.get<PartListItem[]>(this.base, { params });
  }

  getPartById(id: number): Observable<PartDetail> {
    return this.http.get<PartDetail>(`${this.base}/${id}`);
  }

  createPart(request: CreatePartRequest): Observable<PartDetail> {
    return this.http.post<PartDetail>(this.base, request);
  }

  updatePart(id: number, request: UpdatePartRequest): Observable<PartDetail> {
    return this.http.patch<PartDetail>(`${this.base}/${id}`, request);
  }

  createBOMEntry(partId: number, request: CreateBOMEntryRequest): Observable<PartDetail> {
    return this.http.post<PartDetail>(`${this.base}/${partId}/bom`, request);
  }

  updateBOMEntry(partId: number, bomEntryId: number, request: UpdateBOMEntryRequest): Observable<PartDetail> {
    return this.http.patch<PartDetail>(`${this.base}/${partId}/bom/${bomEntryId}`, request);
  }

  deleteBOMEntry(partId: number, bomEntryId: number): Observable<PartDetail> {
    return this.http.delete<PartDetail>(`${this.base}/${partId}/bom/${bomEntryId}`);
  }

  deletePart(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getRevisions(partId: number): Observable<PartRevision[]> {
    return this.http.get<PartRevision[]>(`${this.base}/${partId}/revisions`);
  }

  createRevision(partId: number, request: CreatePartRevisionRequest): Observable<PartRevision> {
    return this.http.post<PartRevision>(`${this.base}/${partId}/revisions`, request);
  }

  getFilesByRevision(partId: number, revisionId: number): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${environment.apiUrl}/parts/${partId}/revisions/${revisionId}/files`);
  }

  getPartFiles(partId: number): Observable<FileAttachment[]> {
    return this.http.get<FileAttachment[]>(`${environment.apiUrl}/parts/${partId}/files`);
  }

  getPartInventorySummary(partId: number): Observable<PartInventorySummary> {
    return this.http.get<PartInventorySummary>(`${this.base}/${partId}/inventory-summary`);
  }

  linkAccountingItem(partId: number, externalId: string, externalRef: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${partId}/link-accounting-item`, { externalId, externalRef });
  }

  unlinkAccountingItem(partId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${partId}/link-accounting-item`);
  }

  getProcessSteps(partId: number): Observable<ProcessStep[]> {
    return this.http.get<ProcessStep[]>(`${this.base}/${partId}/process-steps`);
  }

  createProcessStep(partId: number, request: CreateProcessStepRequest): Observable<ProcessStep> {
    return this.http.post<ProcessStep>(`${this.base}/${partId}/process-steps`, request);
  }

  updateProcessStep(partId: number, stepId: number, request: UpdateProcessStepRequest): Observable<ProcessStep> {
    return this.http.patch<ProcessStep>(`${this.base}/${partId}/process-steps/${stepId}`, request);
  }

  deleteProcessStep(partId: number, stepId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${partId}/process-steps/${stepId}`);
  }

  getFileDownloadUrl(fileId: number): string {
    return `${environment.apiUrl}/files/${fileId}/download`;
  }

  getPartThumbnails(partIds: number[]): Observable<{ partId: number; thumbnailUrl: string | null }[]> {
    if (partIds.length === 0) return of([]);
    let params = new HttpParams();
    for (const id of partIds) {
      params = params.append('partIds', String(id));
    }
    return this.http.get<{ partId: number; thumbnailUrl: string | null }[]>(`${this.base}/thumbnails`, { params });
  }

  getPartPrices(partId: number): Observable<PartPrice[]> {
    return this.http.get<PartPrice[]>(`${this.base}/${partId}/prices`);
  }

  addPartPrice(partId: number, request: AddPartPriceRequest): Observable<PartPrice> {
    return this.http.post<PartPrice>(`${this.base}/${partId}/prices`, request);
  }
}
