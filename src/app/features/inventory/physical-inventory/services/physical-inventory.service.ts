import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { AddPhysicalInventoryTagRequest } from '../models/add-physical-inventory-tag-request.model';
import { CreatePhysicalInventoryRequest } from '../models/create-physical-inventory-request.model';
import { PhysicalInventory } from '../models/physical-inventory.model';
import { PhysicalInventoryDetail } from '../models/physical-inventory-detail.model';
import { PhysicalInventoryStatus } from '../models/physical-inventory-status.type';
import { PhysicalInventoryTag } from '../models/physical-inventory-tag.model';
import { PhysicalInventoryVariance } from '../models/physical-inventory-variance.model';

@Injectable({ providedIn: 'root' })
export class PhysicalInventoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inventory/physical-inventory`;

  list(status?: PhysicalInventoryStatus | null): Observable<PhysicalInventory[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<PhysicalInventory[]>(this.base, { params });
  }

  get(id: number): Observable<PhysicalInventoryDetail> {
    return this.http.get<PhysicalInventoryDetail>(`${this.base}/${id}`);
  }

  create(request: CreatePhysicalInventoryRequest): Observable<PhysicalInventoryDetail> {
    return this.http.post<PhysicalInventoryDetail>(this.base, request);
  }

  freeze(id: number): Observable<PhysicalInventoryDetail> {
    return this.http.post<PhysicalInventoryDetail>(`${this.base}/${id}/freeze`, {});
  }

  addTag(id: number, request: AddPhysicalInventoryTagRequest): Observable<PhysicalInventoryTag> {
    return this.http.post<PhysicalInventoryTag>(`${this.base}/${id}/tags`, request);
  }

  enterCount(id: number, tagId: number, quantity: number, notes: string | null = null): Observable<PhysicalInventoryTag> {
    return this.http.put<PhysicalInventoryTag>(`${this.base}/${id}/tags/${tagId}/count`, { quantity, notes });
  }

  submitForReview(id: number): Observable<PhysicalInventoryDetail> {
    return this.http.post<PhysicalInventoryDetail>(`${this.base}/${id}/review`, {});
  }

  reopen(id: number): Observable<PhysicalInventoryDetail> {
    return this.http.post<PhysicalInventoryDetail>(`${this.base}/${id}/reopen`, {});
  }

  variance(id: number): Observable<PhysicalInventoryVariance> {
    return this.http.get<PhysicalInventoryVariance>(`${this.base}/${id}/variance`);
  }

  post(id: number): Observable<PhysicalInventoryDetail> {
    return this.http.post<PhysicalInventoryDetail>(`${this.base}/${id}/post`, {});
  }

  cancel(id: number): Observable<PhysicalInventoryDetail> {
    return this.http.post<PhysicalInventoryDetail>(`${this.base}/${id}/cancel`, {});
  }

  countSheets(id: number, language: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/count-sheets`, { params: { language }, responseType: 'blob' });
  }
}
