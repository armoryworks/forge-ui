import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CustomerListItem } from '../models/customer-list-item.model';
import { CustomerDetail } from '../models/customer-detail.model';
import { CustomerSummary } from '../models/customer-summary.model';
import { Contact } from '../models/contact.model';
import { CreateCustomerRequest } from '../models/create-customer-request.model';
import { UpdateCustomerRequest } from '../models/update-customer-request.model';
import { CreateContactRequest } from '../models/create-contact-request.model';
import { UpdateContactRequest } from '../models/update-contact-request.model';
import { ContactInteraction, ContactInteractionRequest } from '../models/contact-interaction.model';
import { CreditStatus } from '../models/credit-status.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/customers`;

  getCustomers(search?: string, isActive?: boolean): Observable<CustomerListItem[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (isActive !== undefined) params = params.set('isActive', String(isActive));
    return this.http.get<CustomerListItem[]>(this.base, { params });
  }

  getCustomerById(id: number): Observable<CustomerDetail> {
    return this.http.get<CustomerDetail>(`${this.base}/${id}`);
  }

  createCustomer(request: CreateCustomerRequest): Observable<CustomerListItem> {
    return this.http.post<CustomerListItem>(this.base, request);
  }

  updateCustomer(id: number, request: UpdateCustomerRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, request);
  }

  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  createContact(customerId: number, request: CreateContactRequest): Observable<Contact> {
    return this.http.post<Contact>(`${this.base}/${customerId}/contacts`, request);
  }

  updateContact(customerId: number, contactId: number, request: UpdateContactRequest): Observable<Contact> {
    return this.http.put<Contact>(`${this.base}/${customerId}/contacts/${contactId}`, request);
  }

  deleteContact(customerId: number, contactId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${customerId}/contacts/${contactId}`);
  }

  getCustomerSummary(id: number): Observable<CustomerSummary> {
    return this.http.get<CustomerSummary>(`${this.base}/${id}/summary`);
  }

  // ─── Credit Management ───

  getCreditStatus(customerId: number): Observable<CreditStatus> {
    return this.http.get<CreditStatus>(`${this.base}/${customerId}/credit-status`);
  }

  placeCreditHold(customerId: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${customerId}/credit-hold`, { reason });
  }

  releaseCreditHold(customerId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${customerId}/credit-release`, {});
  }

  getCreditRiskReport(): Observable<CreditStatus[]> {
    return this.http.get<CreditStatus[]>(`${this.base}/credit-risk-report`);
  }

  // ─── Contact Interactions ───

  getInteractions(customerId: number, contactId?: number): Observable<ContactInteraction[]> {
    let params = new HttpParams();
    if (contactId) params = params.set('contactId', contactId);
    return this.http.get<ContactInteraction[]>(`${this.base}/${customerId}/interactions`, { params });
  }

  createInteraction(customerId: number, request: ContactInteractionRequest): Observable<ContactInteraction> {
    return this.http.post<ContactInteraction>(`${this.base}/${customerId}/interactions`, request);
  }

  updateInteraction(customerId: number, interactionId: number, request: ContactInteractionRequest): Observable<ContactInteraction> {
    return this.http.patch<ContactInteraction>(`${this.base}/${customerId}/interactions/${interactionId}`, request);
  }

  deleteInteraction(customerId: number, interactionId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${customerId}/interactions/${interactionId}`);
  }
}
