import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { JournalPartyOption } from '../models/journal-party-option.model';
import { JournalPartyType, JournalTemplate } from '../models/journal-template.model';
import { JournalTemplateInput } from '../models/journal-template-input.model';

/**
 * Recurring and standard journal templates (`/api/v1/accounting/journal-templates`). Reads follow the ledger
 * view; writes need CAP-ACCT-FULLGL. Posting from a template goes through the journal-entry editor, so
 * maker-checker and period rules apply on the normal path.
 */
@Injectable({ providedIn: 'root' })
export class JournalTemplateService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting/journal-templates`;

  list(bookId: number): Observable<JournalTemplate[]> {
    return this.http.get<JournalTemplate[]>(this.base, { params: new HttpParams().set('bookId', bookId) });
  }

  get(id: number): Observable<JournalTemplate> {
    return this.http.get<JournalTemplate>(`${this.base}/${id}`);
  }

  create(input: JournalTemplateInput): Observable<JournalTemplate> {
    return this.http.post<JournalTemplate>(this.base, input);
  }

  update(id: number, input: JournalTemplateInput): Observable<JournalTemplate> {
    return this.http.put<JournalTemplate>(`${this.base}/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  searchParties(partyType: JournalPartyType, search: string | null, id?: number | null): Observable<JournalPartyOption[]> {
    let params = new HttpParams().set('partyType', partyType);
    if (search) params = params.set('search', search);
    if (id) params = params.set('id', id);
    return this.http.get<JournalPartyOption[]>(`${this.base}/parties`, { params });
  }
}
