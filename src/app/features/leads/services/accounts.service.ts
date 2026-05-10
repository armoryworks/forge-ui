import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  Account,
  AccountContact,
  CreateAccountRequest,
  UpdateAccountRequest,
  UpsertAccountContactRequest,
} from '../models/account.model';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounts`;

  list(): Observable<Account[]> {
    return this.http.get<Account[]>(this.base);
  }

  getById(id: number): Observable<Account> {
    return this.http.get<Account>(`${this.base}/${id}`);
  }

  create(request: CreateAccountRequest): Observable<Account> {
    return this.http.post<Account>(this.base, request);
  }

  update(id: number, request: UpdateAccountRequest): Observable<Account> {
    return this.http.put<Account>(`${this.base}/${id}`, request);
  }

  listContacts(id: number): Observable<AccountContact[]> {
    return this.http.get<AccountContact[]>(`${this.base}/${id}/contacts`);
  }

  createContact(id: number, request: UpsertAccountContactRequest): Observable<AccountContact> {
    return this.http.post<AccountContact>(`${this.base}/${id}/contacts`, request);
  }

  updateContact(id: number, contactId: number, request: UpsertAccountContactRequest): Observable<AccountContact> {
    return this.http.put<AccountContact>(`${this.base}/${id}/contacts/${contactId}`, request);
  }

  deleteContact(id: number, contactId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/contacts/${contactId}`);
  }
}
