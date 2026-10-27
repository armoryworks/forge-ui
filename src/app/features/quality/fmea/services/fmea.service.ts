import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { Fmea } from '../models/fmea.model';
import { FmeaItem } from '../models/fmea-item.model';
import { FmeaStatus } from '../models/fmea-status.model';
import { FmeaType } from '../models/fmea-type.model';
import { CreateFmeaRequest } from '../models/create-fmea-request.model';
import { UpdateFmeaRequest } from '../models/update-fmea-request.model';
import { FmeaItemRequest } from '../models/fmea-item-request.model';
import { RecordFmeaActionRequest } from '../models/record-fmea-action-request.model';

@Injectable({ providedIn: 'root' })
export class FmeaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fmeas`;

  list(filter?: { type?: FmeaType; partId?: number; status?: FmeaStatus }): Observable<Fmea[]> {
    let params = new HttpParams();
    if (filter?.type) params = params.set('type', filter.type);
    if (filter?.partId) params = params.set('partId', filter.partId);
    if (filter?.status) params = params.set('status', filter.status);
    return this.http.get<Fmea[]>(this.base, { params });
  }

  get(id: number): Observable<Fmea> {
    return this.http.get<Fmea>(`${this.base}/${id}`);
  }

  create(request: CreateFmeaRequest): Observable<Fmea> {
    return this.http.post<Fmea>(this.base, request);
  }

  update(id: number, request: UpdateFmeaRequest): Observable<Fmea> {
    return this.http.put<Fmea>(`${this.base}/${id}`, request);
  }

  addItem(id: number, request: FmeaItemRequest): Observable<FmeaItem> {
    return this.http.post<FmeaItem>(`${this.base}/${id}/items`, request);
  }

  updateItem(id: number, itemId: number, request: FmeaItemRequest): Observable<FmeaItem> {
    return this.http.put<FmeaItem>(`${this.base}/${id}/items/${itemId}`, request);
  }

  deleteItem(id: number, itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/items/${itemId}`);
  }

  recordAction(id: number, itemId: number, request: RecordFmeaActionRequest): Observable<FmeaItem> {
    return this.http.post<FmeaItem>(`${this.base}/${id}/items/${itemId}/action`, request);
  }

  linkCapa(id: number, itemId: number, capaId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/items/${itemId}/link-capa`, {}, { params: new HttpParams().set('capaId', capaId) });
  }

  highRpn(threshold: number): Observable<FmeaItem[]> {
    return this.http.get<FmeaItem[]>(`${this.base}/high-rpn`, { params: new HttpParams().set('threshold', threshold) });
  }
}
