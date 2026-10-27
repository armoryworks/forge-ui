import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DataImportResult } from '../../../shared/models/data-import-result.model';
import { JobImportRow } from '../models/job-import-row.model';

/** CSV job import: a dry-run validate, then an all-or-nothing commit. */
@Injectable({ providedIn: 'root' })
export class JobImportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/imports/jobs`;

  validate(rows: JobImportRow[]): Observable<DataImportResult> {
    return this.http.post<DataImportResult>(`${this.base}/validate`, { rows });
  }

  commit(rows: JobImportRow[]): Observable<DataImportResult> {
    return this.http.post<DataImportResult>(`${this.base}/commit`, { rows });
  }
}
