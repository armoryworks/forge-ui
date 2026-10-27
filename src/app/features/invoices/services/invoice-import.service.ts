import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DataImportResult } from '../../../shared/models/data-import-result.model';
import { InvoiceImportRow } from '../models/invoice-import-row.model';

/** CSV import of historical invoices: a dry-run validate, then an all-or-nothing commit. Nothing posts to the GL. */
@Injectable({ providedIn: 'root' })
export class InvoiceImportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/imports/invoices`;

  validate(rows: InvoiceImportRow[]): Observable<DataImportResult> {
    return this.http.post<DataImportResult>(`${this.base}/validate`, { rows });
  }

  commit(rows: InvoiceImportRow[]): Observable<DataImportResult> {
    return this.http.post<DataImportResult>(`${this.base}/commit`, { rows });
  }
}
