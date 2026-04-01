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
}
