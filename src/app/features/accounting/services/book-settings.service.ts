import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { BookSettings } from '../models/book-settings.model';

/** Book settings (`accounting/books/{id}/settings`): read under CAP-ACCT-GL-VIEW, saved under CAP-ACCT-FULLGL. */
@Injectable({ providedIn: 'root' })
export class BookSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting/books`;

  get(bookId: number): Observable<BookSettings> {
    return this.http.get<BookSettings>(`${this.base}/${bookId}/settings`);
  }

  update(bookId: number, makerCheckerThreshold: number | null, reportingTimeZone: string | null): Observable<BookSettings> {
    return this.http.put<BookSettings>(`${this.base}/${bookId}/settings`, { makerCheckerThreshold, reportingTimeZone });
  }
}
