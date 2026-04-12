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
import { ActivityItem } from '../../../shared/models/activity.model';
import { Operation, OperationMaterial } from '../models/operation.model';
import { CreateOperationRequest } from '../models/create-operation-request.model';
import { UpdateOperationRequest } from '../models/update-operation-request.model';
import { CreateOperationMaterialRequest } from '../models/create-operation-material-request.model';
import { AddPartPriceRequest, PartPrice } from '../models/part-price.model';
import { PartAlternate, CreatePartAlternateRequest, UpdatePartAlternateRequest } from '../models/part-alternate.model';

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

  getOperations(partId: number): Observable<Operation[]> {
    return this.http.get<Operation[]>(`${this.base}/${partId}/operations`);
  }

  createOperation(partId: number, request: CreateOperationRequest): Observable<Operation> {
    return this.http.post<Operation>(`${this.base}/${partId}/operations`, request);
  }

  updateOperation(partId: number, operationId: number, request: UpdateOperationRequest): Observable<Operation> {
    return this.http.patch<Operation>(`${this.base}/${partId}/operations/${operationId}`, request);
  }

  deleteOperation(partId: number, operationId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${partId}/operations/${operationId}`);
  }

  createOperationMaterial(partId: number, operationId: number, request: CreateOperationMaterialRequest): Observable<OperationMaterial> {
    return this.http.post<OperationMaterial>(`${this.base}/${partId}/operations/${operationId}/materials`, request);
  }

  deleteOperationMaterial(partId: number, operationId: number, materialId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${partId}/operations/${operationId}/materials/${materialId}`);
  }

  getOperationFiles(partId: number, operationId: number): Observable<FileAttachment[]> {
    return this.http.get<FileAttachment[]>(`${environment.apiUrl}/operations/${operationId}/files`);
  }

  deleteOperationFile(fileId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/files/${fileId}`);
  }

  getOperationActivity(partId: number, operationId: number): Observable<ActivityItem[]> {
    return this.http.get<ActivityItem[]>(`${this.base}/${partId}/operations/${operationId}/activity`);
  }

  addOperationComment(partId: number, operationId: number, comment: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${partId}/operations/${operationId}/activity`, { comment });
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

  getPartAlternates(partId: number): Observable<PartAlternate[]> {
    return this.http.get<PartAlternate[]>(`${this.base}/${partId}/alternates`);
  }

  createPartAlternate(partId: number, request: CreatePartAlternateRequest): Observable<PartAlternate> {
    return this.http.post<PartAlternate>(`${this.base}/${partId}/alternates`, request);
  }

  updatePartAlternate(partId: number, alternateId: number, request: UpdatePartAlternateRequest): Observable<PartAlternate> {
    return this.http.patch<PartAlternate>(`${this.base}/${partId}/alternates/${alternateId}`, request);
  }

  deletePartAlternate(partId: number, alternateId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${partId}/alternates/${alternateId}`);
  }
}
