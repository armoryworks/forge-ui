import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CustomerTaxDocument } from '../models/customer-tax-document.model';
import { CreateCustomerTaxDocumentRequest } from '../models/create-customer-tax-document-request.model';

/**
 * S1 — CRUD + verification workflow against CustomerTaxDocumentsController
 * (`/api/v1/customers/{customerId}/tax-documents` +
 * `/api/v1/customer-tax-documents/{id}`). Backs the Tax Documents section of
 * the customer detail Documents tab; a Verified, unexpired document is what
 * unlocks editing a quote's tax rate (see CustomerService.getTaxEditability).
 */
@Injectable({ providedIn: 'root' })
export class CustomerTaxDocumentService {
  private readonly http = inject(HttpClient);
  private readonly customersBase = `${environment.apiUrl}/customers`;
  private readonly documentsBase = `${environment.apiUrl}/customer-tax-documents`;

  getTaxDocuments(customerId: number): Observable<CustomerTaxDocument[]> {
    return this.http.get<CustomerTaxDocument[]>(`${this.customersBase}/${customerId}/tax-documents`);
  }

  createTaxDocument(customerId: number, request: CreateCustomerTaxDocumentRequest): Observable<CustomerTaxDocument> {
    return this.http.post<CustomerTaxDocument>(`${this.customersBase}/${customerId}/tax-documents`, request);
  }

  verifyTaxDocument(id: number): Observable<void> {
    return this.http.post<void>(`${this.documentsBase}/${id}/verify`, {});
  }

  rejectTaxDocument(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.documentsBase}/${id}/reject`, { reason });
  }

  deleteTaxDocument(id: number): Observable<void> {
    return this.http.delete<void>(`${this.documentsBase}/${id}`);
  }
}
