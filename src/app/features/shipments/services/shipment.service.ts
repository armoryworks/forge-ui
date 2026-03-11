import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ShipmentListItem } from '../models/shipment-list-item.model';
import { ShipmentDetail } from '../models/shipment-detail.model';
import { CreateShipmentRequest } from '../models/create-shipment-request.model';
import { ShipmentPackage } from '../models/shipment-package.model';
import { CreateShipmentPackageRequest } from '../models/create-shipment-package-request.model';
import { ShippingRate } from '../models/shipping-rate.model';
import { ShippingLabel } from '../models/shipping-label.model';
import { ShipmentTracking } from '../models/shipment-tracking.model';

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

  // Packages
  getPackages(shipmentId: number): Observable<ShipmentPackage[]> {
    return this.http.get<ShipmentPackage[]>(`${this.base}/${shipmentId}/packages`);
  }

  addPackage(shipmentId: number, request: CreateShipmentPackageRequest): Observable<ShipmentPackage> {
    return this.http.post<ShipmentPackage>(`${this.base}/${shipmentId}/packages`, request);
  }

  updatePackage(shipmentId: number, packageId: number, request: Partial<CreateShipmentPackageRequest & { status: string }>): Observable<ShipmentPackage> {
    return this.http.patch<ShipmentPackage>(`${this.base}/${shipmentId}/packages/${packageId}`, request);
  }

  removePackage(shipmentId: number, packageId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${shipmentId}/packages/${packageId}`);
  }

  // Shipping Rates
  getRates(shipmentId: number): Observable<ShippingRate[]> {
    return this.http.get<ShippingRate[]>(`${this.base}/${shipmentId}/rates`);
  }

  createLabel(shipmentId: number, carrierId: string, serviceName: string): Observable<ShippingLabel> {
    return this.http.post<ShippingLabel>(`${this.base}/${shipmentId}/label`, { carrierId, serviceName });
  }

  // Tracking
  getTracking(shipmentId: number): Observable<ShipmentTracking> {
    return this.http.get<ShipmentTracking>(`${this.base}/${shipmentId}/tracking`);
  }
}
