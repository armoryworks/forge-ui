import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CertificateOfAnalysis } from '../models/certificate-of-analysis.model';
import { GenerateCoaRequest } from '../models/generate-coa-request.model';
import { ShipmentCertificates } from '../models/shipment-certificates.model';

@Injectable({ providedIn: 'root' })
export class CoaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/certificates-of-analysis`;

  list(filter: { lotId?: number; shipmentId?: number; customerId?: number }): Observable<CertificateOfAnalysis[]> {
    let params = new HttpParams();
    if (filter.lotId != null) params = params.set('lotId', filter.lotId);
    if (filter.shipmentId != null) params = params.set('shipmentId', filter.shipmentId);
    if (filter.customerId != null) params = params.set('customerId', filter.customerId);
    return this.http.get<CertificateOfAnalysis[]>(this.base, { params });
  }

  generate(request: GenerateCoaRequest): Observable<CertificateOfAnalysis> {
    return this.http.post<CertificateOfAnalysis>(this.base, request);
  }

  void(id: number): Observable<CertificateOfAnalysis> {
    return this.http.post<CertificateOfAnalysis>(`${this.base}/${id}/void`, {});
  }

  attachToShipment(shipmentId: number, lotId?: number | null): Observable<ShipmentCertificates> {
    return this.http.post<ShipmentCertificates>(
      `${environment.apiUrl}/shipments/${shipmentId}/certificates-of-analysis`, { lotId: lotId ?? null });
  }

  pdfUrl(id: number, language?: string | null): string {
    return language ? `${this.base}/${id}/pdf?language=${encodeURIComponent(language)}` : `${this.base}/${id}/pdf`;
  }
}
