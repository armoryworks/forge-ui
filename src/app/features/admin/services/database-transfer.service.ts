import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DatabaseTransferSummary } from '../database/models/database-transfer-summary.model';
import { DatabaseImportReport } from '../database/models/database-import-report.model';

/**
 * Admin database dump / clean-rebuild import (server: /api/v1/admin/database, Admin-only).
 * The dump downloads as a zip whose layout matches forge-db's CLI dumps, so archives are
 * interchangeable between the UI and `forge-db dump`/`import`.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseTransferService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/database`;

  getSummary(): Observable<DatabaseTransferSummary> {
    return this.http.get<DatabaseTransferSummary>(`${this.base}/summary`);
  }

  /** The full data dump as a zip blob (can take a while on a big database). */
  downloadDump(): Observable<Blob> {
    return this.http.get(`${this.base}/dump`, { responseType: 'blob' });
  }

  importDump(
    file: File,
    options: { excludePatterns: string; purgeSoftDeleted: boolean; allowFkOrphans: boolean },
  ): Observable<DatabaseImportReport> {
    const form = new FormData();
    form.append('file', file);
    form.append('excludePatterns', options.excludePatterns);
    form.append('purgeSoftDeleted', String(options.purgeSoftDeleted));
    form.append('allowFkOrphans', String(options.allowFkOrphans));
    return this.http.post<DatabaseImportReport>(`${this.base}/import`, form);
  }
}
