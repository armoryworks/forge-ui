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
  /** 'System' = the auto-assigned code (one per entity, not removable); 'Manual' = a user-added alternate. */
  source: string;
  /** 'Internal' = self-generated; 'Gs1' = a licensed GTIN. */
  identityType: string;
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

  /** Add a manual alternate barcode (manufacturer UPC, vendor SKU, legacy label) on top of the auto code. */
  addManualBarcode(entityType: string, entityId: number, value: string): Observable<BarcodeInfo> {
    return this.http.post<BarcodeInfo>(
      `${environment.apiUrl}/barcodes`,
      { entityType, entityId, value },
    );
  }

  /** Remove a manually-added alternate barcode (the auto-assigned code cannot be removed). */
  removeManualBarcode(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/barcodes/${id}`);
  }
}
