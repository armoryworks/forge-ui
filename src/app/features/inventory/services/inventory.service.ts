import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AtpResult, AtpBucket } from '../models/atp.model';
import { StorageLocation } from '../models/storage-location.model';
import { StorageLocationFlat } from '../models/storage-location-flat.model';
import { BinContentItem } from '../models/bin-content-item.model';
import { BinMovementItem } from '../models/bin-movement-item.model';
import { InventoryPartSummary } from '../models/inventory-part-summary.model';
import { CreateStorageLocationRequest } from '../models/create-storage-location-request.model';
import { PlaceBinContentRequest } from '../models/place-bin-content-request.model';
import { ReceivingRecord } from '../models/receiving-record.model';
import { TransferStockRequest } from '../models/transfer-stock-request.model';
import { AdjustStockRequest } from '../models/adjust-stock-request.model';
import { CycleCount } from '../models/cycle-count.model';
import { Reservation } from '../models/reservation.model';
import { CreateReservationRequest } from '../models/create-reservation-request.model';
import { LowStockAlert } from '../models/low-stock-alert.model';
import { PendingInspectionItem } from '../models/pending-inspection.model';
import { UnitOfMeasure } from '../models/unit-of-measure.model';
import { UomConversion } from '../models/uom-conversion.model';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inventory`;

  getLocationTree(): Observable<StorageLocation[]> {
    return this.http.get<StorageLocation[]>(`${this.base}/locations`);
  }

  getBinLocations(): Observable<StorageLocationFlat[]> {
    return this.http.get<StorageLocationFlat[]>(`${this.base}/locations/bins`);
  }

  createLocation(request: CreateStorageLocationRequest): Observable<StorageLocation> {
    return this.http.post<StorageLocation>(`${this.base}/locations`, request);
  }

  getBinContents(locationId: number): Observable<BinContentItem[]> {
    return this.http.get<BinContentItem[]>(`${this.base}/locations/${locationId}/contents`);
  }

  placeBinContent(request: PlaceBinContentRequest): Observable<BinContentItem> {
    return this.http.post<BinContentItem>(`${this.base}/bin-contents`, request);
  }

  getPartInventory(search?: string): Observable<InventoryPartSummary[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<InventoryPartSummary[]>(`${this.base}/parts`, { params });
  }

  getMovements(locationId?: number, entityType?: string, entityId?: number, take = 100): Observable<BinMovementItem[]> {
    let params = new HttpParams();
    if (locationId) params = params.set('locationId', locationId);
    if (entityType) params = params.set('entityType', entityType);
    if (entityId) params = params.set('entityId', entityId);
    params = params.set('take', take);
    return this.http.get<BinMovementItem[]>(`${this.base}/movements`, { params });
  }

  // ── Low Stock Alerts ──

  getLowStockAlerts(): Observable<LowStockAlert[]> {
    return this.http.get<LowStockAlert[]>(`${this.base}/low-stock`);
  }

  // ── Receiving ──

  receiveGoods(request: { purchaseOrderLineId: number; quantityReceived: number; locationId?: number; lotNumber?: string; notes?: string }): Observable<ReceivingRecord> {
    return this.http.post<ReceivingRecord>(`${this.base}/receive`, request);
  }

  getReceivingHistory(purchaseOrderId?: number, partId?: number, take = 50): Observable<ReceivingRecord[]> {
    let params = new HttpParams();
    if (purchaseOrderId) params = params.set('purchaseOrderId', purchaseOrderId);
    if (partId) params = params.set('partId', partId);
    params = params.set('take', take);
    return this.http.get<ReceivingRecord[]>(`${this.base}/receiving-history`, { params });
  }

  // ── Stock Operations ──

  transferStock(request: TransferStockRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/transfer`, request);
  }

  adjustStock(request: AdjustStockRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/adjust`, request);
  }

  // ── Cycle Counts ──

  getCycleCounts(locationId?: number, status?: string): Observable<CycleCount[]> {
    let params = new HttpParams();
    if (locationId) params = params.set('locationId', locationId);
    if (status) params = params.set('status', status);
    return this.http.get<CycleCount[]>(`${this.base}/cycle-counts`, { params });
  }

  createCycleCount(locationId: number, notes?: string): Observable<CycleCount> {
    return this.http.post<CycleCount>(`${this.base}/cycle-counts`, { locationId, notes });
  }

  updateCycleCount(id: number, request: { status?: string; notes?: string; lines?: { id: number; actualQuantity: number; notes?: string }[] }): Observable<void> {
    return this.http.put<void>(`${this.base}/cycle-counts/${id}`, request);
  }

  // ── Reservations ──

  getReservations(partId?: number, jobId?: number): Observable<Reservation[]> {
    let params = new HttpParams();
    if (partId) params = params.set('partId', partId);
    if (jobId) params = params.set('jobId', jobId);
    return this.http.get<Reservation[]>(`${this.base}/reservations`, { params });
  }

  createReservation(request: CreateReservationRequest): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.base}/reservations`, request);
  }

  releaseReservation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/reservations/${id}`);
  }

  // ── Receiving Inspection ──

  getPendingInspections(): Observable<PendingInspectionItem[]> {
    return this.http.get<PendingInspectionItem[]>(`${this.base}/pending-inspection`);
  }

  recordInspectionResult(receivingRecordId: number, data: {
    result: string; acceptedQuantity?: number; rejectedQuantity?: number;
    notes?: string; createNcrOnReject?: boolean; qcInspectionId?: number;
  }): Observable<void> {
    return this.http.post<void>(`${this.base}/inspect/${receivingRecordId}`, data);
  }

  waiveInspection(receivingRecordId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/inspect/${receivingRecordId}/waive`, {});
  }

  // ── Units of Measure ──

  getUnitsOfMeasure(category?: string): Observable<UnitOfMeasure[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    return this.http.get<UnitOfMeasure[]>(`${this.base}/uom`, { params });
  }

  createUnitOfMeasure(data: Omit<UnitOfMeasure, 'id' | 'isActive'>): Observable<UnitOfMeasure> {
    return this.http.post<UnitOfMeasure>(`${this.base}/uom`, data);
  }

  updateUnitOfMeasure(id: number, data: Omit<UnitOfMeasure, 'id' | 'isActive'>): Observable<UnitOfMeasure> {
    return this.http.put<UnitOfMeasure>(`${this.base}/uom/${id}`, data);
  }

  getUomConversions(partId?: number): Observable<UomConversion[]> {
    let params = new HttpParams();
    if (partId) params = params.set('partId', partId.toString());
    return this.http.get<UomConversion[]>(`${this.base}/uom/conversions`, { params });
  }

  createUomConversion(data: {
    fromUomId: number; toUomId: number; conversionFactor: number;
    partId?: number; isReversible?: boolean;
  }): Observable<UomConversion> {
    return this.http.post<UomConversion>(`${this.base}/uom/conversions`, data);
  }

  convertQuantity(fromUomId: number, toUomId: number, quantity: number, partId?: number):
    Observable<{ convertedQuantity: number; conversionFactor: number }> {
    let params = new HttpParams()
      .set('fromUomId', fromUomId.toString())
      .set('toUomId', toUomId.toString())
      .set('quantity', quantity.toString());
    if (partId) params = params.set('partId', partId.toString());
    return this.http.get<{ convertedQuantity: number; conversionFactor: number }>(
      `${this.base}/uom/convert`, { params });
  }

  // ── ATP ──

  getAtp(partId: number, quantity = 1): Observable<AtpResult> {
    const params = new HttpParams().set('quantity', quantity.toString());
    return this.http.get<AtpResult>(`${this.base}/atp/${partId}`, { params });
  }

  getAtpTimeline(partId: number, from?: string, to?: string): Observable<AtpBucket[]> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<AtpBucket[]>(`${this.base}/atp/${partId}/timeline`, { params });
  }
}
