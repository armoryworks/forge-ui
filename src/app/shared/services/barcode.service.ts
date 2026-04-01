import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface BarcodeInfo {
  id: number;
  value: string;
  entityType: string;
  isActive: boolean;
  createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class BarcodeService {
  private readonly http = inject(HttpClient);

  getEntityBarcodes(entityType: string, entityId: number): Observable<BarcodeInfo[]> {
    return this.http.get<BarcodeInfo[]>(
      `${environment.apiUrl}/barcodes`,
      { params: { entityType, entityId: entityId.toString() } },
    );
  }

  regenerateBarcode(entityType: string, entityId: number, naturalIdentifier: string): Observable<BarcodeInfo> {
    return this.http.post<BarcodeInfo>(
      `${environment.apiUrl}/barcodes/regenerate`,
      { entityType, entityId, naturalIdentifier },
    );
  }
}
