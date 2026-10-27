import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CloudStorageProvider,
  CloudStorageProviderType,
  CloudStorageTestResult,
  FolderMapEntry,
  SaveCloudStorageProviderRequest,
} from '../models/cloud-storage.model';

@Injectable({ providedIn: 'root' })
export class CloudStorageService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/cloud-storage`;

  providerTypes(): Observable<CloudStorageProviderType[]> {
    return this.http.get<CloudStorageProviderType[]>(`${this.base}/provider-types`);
  }

  providers(): Observable<CloudStorageProvider[]> {
    return this.http.get<CloudStorageProvider[]>(`${this.base}/providers`);
  }

  create(request: SaveCloudStorageProviderRequest): Observable<CloudStorageProvider> {
    return this.http.post<CloudStorageProvider>(`${this.base}/providers`, request);
  }

  update(id: number, request: SaveCloudStorageProviderRequest): Observable<CloudStorageProvider> {
    return this.http.put<CloudStorageProvider>(`${this.base}/providers/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/providers/${id}`);
  }

  test(id: number): Observable<CloudStorageTestResult> {
    return this.http.post<CloudStorageTestResult>(`${this.base}/providers/${id}/test`, {});
  }

  folderMap(): Observable<FolderMapEntry[]> {
    return this.http.get<FolderMapEntry[]>(`${this.base}/folder-map`);
  }

  saveFolderMap(entries: FolderMapEntry[]): Observable<FolderMapEntry[]> {
    return this.http.put<FolderMapEntry[]>(`${this.base}/folder-map`, entries);
  }
}
