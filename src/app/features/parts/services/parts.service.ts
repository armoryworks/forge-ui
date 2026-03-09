import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  PartListItem,
  PartDetail,
  CreatePartRequest,
  UpdatePartRequest,
  CreateBOMEntryRequest,
  UpdateBOMEntryRequest,
  PartStatus,
  PartType,
} from '../models/parts.model';

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
}
