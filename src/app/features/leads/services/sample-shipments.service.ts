import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateSampleShipmentRequest,
  SampleShipment,
  UpdateSampleShipmentRequest,
} from '../models/sample-shipment.model';

@Injectable({ providedIn: 'root' })
export class SampleShipmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sample-shipments`;

  list(leadId?: number): Observable<SampleShipment[]> {
    let params = new HttpParams();
    if (leadId) params = params.set('leadId', String(leadId));
    return this.http.get<SampleShipment[]>(this.base, { params });
  }

  create(request: CreateSampleShipmentRequest): Observable<SampleShipment> {
    return this.http.post<SampleShipment>(this.base, request);
  }

  update(id: number, request: UpdateSampleShipmentRequest): Observable<SampleShipment> {
    return this.http.put<SampleShipment>(`${this.base}/${id}`, request);
  }
}
