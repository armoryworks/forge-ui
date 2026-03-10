import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ShipmentListItem } from '../models/shipment-list-item.model';
import { ShipmentDetail } from '../models/shipment-detail.model';
import { CreateShipmentRequest } from '../models/create-shipment-request.model';

@Injectable({ providedIn: 'root' })
export class ShipmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/shipments`;

  getShipments(salesOrderId?: number, status?: string): Observable<ShipmentListItem[]> {
    let params = new HttpParams();
    if (salesOrderId) params = params.set('salesOrderId', String(salesOrderId));
    if (status) params = params.set('status', status);
    return this.http.get<ShipmentListItem[]>(this.base, { params });
  }

  getShipmentById(id: number): Observable<ShipmentDetail> {
    return this.http.get<ShipmentDetail>(`${this.base}/${id}`);
  }

  createShipment(request: CreateShipmentRequest): Observable<ShipmentDetail> {
    return this.http.post<ShipmentDetail>(this.base, request);
  }

  updateShipment(id: number, request: { carrier?: string; trackingNumber?: string; shippingCost?: number; weight?: number; notes?: string }): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, request);
  }

  shipShipment(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/ship`, {});
  }

  deliverShipment(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/deliver`, {});
  }
}
