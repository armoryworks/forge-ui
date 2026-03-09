import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { StorageLocation } from '../models/storage-location.model';
import { StorageLocationFlat } from '../models/storage-location-flat.model';
import { BinContentItem } from '../models/bin-content-item.model';
import { BinMovementItem } from '../models/bin-movement-item.model';
import { InventoryPartSummary } from '../models/inventory-part-summary.model';
import { CreateStorageLocationRequest } from '../models/create-storage-location-request.model';
import { PlaceBinContentRequest } from '../models/place-bin-content-request.model';

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
}
