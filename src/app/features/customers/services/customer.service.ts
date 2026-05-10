import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { PagedResponse, PagedQuery } from '../../../shared/models/paged-response.model';
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
import { FlatContactRow } from '../models/flat-contact.model';

/** Phase 3 F7-partial / WU-17 — paged customer list query parameters. */
export interface CustomerListPagedQuery extends PagedQuery {
  isActive?: boolean | null;
  defaultCurrency?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/customers`;

  /**
   * Phase 3 F7-partial / WU-17 — backward-compat shim that calls the paged
   * endpoint and unwraps the envelope. Existing callers that just want the
   * flat array continue to work; new callers should use {@link getCustomersPaged}
   * instead so they can read `totalCount` for proper server-side pagination.
   *
   * Default page size is 200 (the server cap) to preserve the previous
   * "everything in one round trip" UX while the data-table handles client-
   * side filtering / sort / pagination. Lists larger than 200 will need a
   * follow-up to switch the table to true server-side paging.
   */
  getCustomers(search?: string, isActive?: boolean): Observable<CustomerListItem[]> {
    return this.getCustomersPaged({
      q: search,
      isActive,
      pageSize: 200,
    }).pipe(map(p => p.items));
  }

  /**
   * Phase 3 F7-partial / WU-17 — paged customer list. Returns the standard
   * envelope ({ items, totalCount, page, pageSize }) so the caller can wire
   * up real server-side pagination, sort, and filtering.
   */
  getCustomersPaged(query: CustomerListPagedQuery = {}): Observable<PagedResponse<CustomerListItem>> {
    let params = new HttpParams();
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.pageSize != null) params = params.set('pageSize', String(query.pageSize));
    if (query.sort) params = params.set('sort', query.sort);
    if (query.order) params = params.set('order', query.order);
    if (query.q) params = params.set('q', query.q);
    if (query.isActive !== undefined && query.isActive !== null) params = params.set('isActive', String(query.isActive));
    if (query.defaultCurrency) params = params.set('defaultCurrency', query.defaultCurrency);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    return this.http.get<PagedResponse<CustomerListItem>>(this.base, { params });
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

  // Phase 1r — flat cross-customer contact listing.
  getAllContactsFlat(): Observable<FlatContactRow[]> {
    return this.http.get<FlatContactRow[]>(`${this.base}/all-contacts`);
  }
}
