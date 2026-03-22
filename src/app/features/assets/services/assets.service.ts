import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AssetItem } from '../models/asset-item.model';
import { CreateAssetRequest } from '../models/create-asset-request.model';
import { UpdateAssetRequest } from '../models/update-asset-request.model';
import { AssetType } from '../models/asset-type.type';
import { AssetStatus } from '../models/asset-status.type';
import { DowntimeLog } from '../models/downtime-log.model';
import { CreateDowntimeRequest } from '../models/create-downtime-request.model';
import { MaintenanceLogListItem } from '../models/maintenance-log-list-item.model';

@Injectable({ providedIn: 'root' })
export class AssetsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/assets`;

  getAssets(type?: AssetType, status?: AssetStatus, search?: string): Observable<AssetItem[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<AssetItem[]>(this.base, { params });
  }

  createAsset(request: CreateAssetRequest): Observable<AssetItem> {
    return this.http.post<AssetItem>(this.base, request);
  }

  updateAsset(id: number, request: UpdateAssetRequest): Observable<AssetItem> {
    return this.http.patch<AssetItem>(`${this.base}/${id}`, request);
  }

  deleteAsset(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // Machine hours
  updateMachineHours(id: number, currentHours: number): Observable<AssetItem> {
    return this.http.patch<AssetItem>(`${this.base}/${id}/hours`, { currentHours });
  }

  // Downtime logging
  getDowntimeLogs(assetId?: number): Observable<DowntimeLog[]> {
    const url = assetId ? `${this.base}/${assetId}/downtime` : `${this.base}/downtime`;
    return this.http.get<DowntimeLog[]>(url);
  }

  createDowntimeLog(assetId: number, request: CreateDowntimeRequest): Observable<DowntimeLog> {
    return this.http.post<DowntimeLog>(`${this.base}/${assetId}/downtime`, request);
  }

  getMaintenanceLogs(assetId: number): Observable<MaintenanceLogListItem[]> {
    return this.http.get<MaintenanceLogListItem[]>(`${this.base}/${assetId}/maintenance/logs`);
  }

  createMaintenanceJob(scheduleId: number): Observable<{ jobId: number }> {
    return this.http.post<{ jobId: number }>(`${this.base}/maintenance/${scheduleId}/create-job`, {});
  }
}
