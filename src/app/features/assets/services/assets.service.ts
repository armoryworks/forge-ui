import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AssetItem, CreateAssetRequest, UpdateAssetRequest, AssetType, AssetStatus } from '../models/assets.model';

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
}
