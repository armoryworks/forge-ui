import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PayRun } from '../models/pay-run.model';
import { PayRunJournalLine } from '../models/pay-run-journal-line.model';
import { PayrollRegisterImportResult } from '../models/payroll-register-import-result.model';
import { PayrollRegisterPreview } from '../models/payroll-register-preview.model';

/** Pay runs (CAP-PAYROLL-RUN) and the payroll register import (CAP-ACCT-FULLGL). */
@Injectable({ providedIn: 'root' })
export class PayRunService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting`;

  list(bookId: number): Observable<PayRun[]> {
    return this.http.get<PayRun[]>(`${this.base}/pay-runs`, { params: new HttpParams().set('bookId', bookId) });
  }

  journalPreview(payRunId: number): Observable<PayRunJournalLine[]> {
    return this.http.get<PayRunJournalLine[]>(`${this.base}/pay-runs/${payRunId}/journal-preview`);
  }

  post(payRunId: number): Observable<PayRun> {
    return this.http.post<PayRun>(`${this.base}/pay-runs/${payRunId}/post`, {});
  }

  previewRegister(file: File): Observable<PayrollRegisterPreview> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<PayrollRegisterPreview>(`${this.base}/payroll/runs/import/preview`, form);
  }

  importRegister(bookId: number, payDate: string, periodStart: string, periodEnd: string, file: File): Observable<PayrollRegisterImportResult> {
    const form = new FormData();
    form.append('bookId', String(bookId));
    form.append('payDate', payDate);
    form.append('periodStart', periodStart);
    form.append('periodEnd', periodEnd);
    form.append('file', file, file.name);
    return this.http.post<PayrollRegisterImportResult>(`${this.base}/payroll/runs/import`, form);
  }
}
