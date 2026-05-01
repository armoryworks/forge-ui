import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { VendorPart, VendorPartPriceTier } from '../models/vendor-part.model';

export interface UpsertVendorPartPriceTierRequest {
  minQuantity: number;
  unitPrice: number;
  currency: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
}

/**
 * Pillar 3 — Thin HTTP wrapper around the VendorPart API surface. Powers
 * the Part-detail Sources tab (list-by-part) and the Vendor-detail Catalog
 * tab (list-by-vendor).
 */
@Injectable({ providedIn: 'root' })
export class VendorPartsService {
  private readonly http = inject(HttpClient);

  listForPart(partId: number): Observable<VendorPart[]> {
    return this.http.get<VendorPart[]>(`${environment.apiUrl}/parts/${partId}/vendor-parts`);
  }

  listForVendor(vendorId: number): Observable<VendorPart[]> {
    return this.http.get<VendorPart[]>(`${environment.apiUrl}/vendors/${vendorId}/vendor-parts`);
  }

  get(id: number): Observable<VendorPart> {
    return this.http.get<VendorPart>(`${environment.apiUrl}/vendor-parts/${id}`);
  }

  create(body: Partial<VendorPart> & { vendorId: number; partId: number }): Observable<VendorPart> {
    return this.http.post<VendorPart>(`${environment.apiUrl}/vendor-parts`, body);
  }

  update(id: number, body: Partial<VendorPart>): Observable<VendorPart> {
    return this.http.put<VendorPart>(`${environment.apiUrl}/vendor-parts/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/vendor-parts/${id}`);
  }

  addPriceTier(vendorPartId: number, body: UpsertVendorPartPriceTierRequest): Observable<VendorPartPriceTier> {
    return this.http.post<VendorPartPriceTier>(
      `${environment.apiUrl}/vendor-parts/${vendorPartId}/price-tiers`,
      body,
    );
  }

  deletePriceTier(vendorPartId: number, tierId: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/vendor-parts/${vendorPartId}/price-tiers/${tierId}`,
    );
  }

  /**
   * Read-only price-tier history for a VendorPart — current + closed rows,
   * ordered EffectiveFrom DESC, then MinQuantity ASC. Powers the tier
   * history dialog opened from the Vendor catalog row.
   */
  getPriceTierHistory(vendorPartId: number): Observable<VendorPartPriceTier[]> {
    return this.http.get<VendorPartPriceTier[]>(
      `${environment.apiUrl}/vendor-parts/${vendorPartId}/price-tiers/history`,
    );
  }
}
