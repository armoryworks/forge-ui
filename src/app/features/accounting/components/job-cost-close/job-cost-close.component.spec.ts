import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { JobCostCloseCandidate } from '../../models/job-cost-close.model';
import { JobCostCloseComponent } from './job-cost-close.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  ngOnInit(): void;
  columns: { field: string }[];
  candidates(): JobCostCloseCandidate[];
  closingId(): number | null;
  close(row: JobCostCloseCandidate): void;
};

const base = `${environment.apiUrl}/accounting/jobs`;
const ROWS: JobCostCloseCandidate[] = [
  { jobId: 11, jobNumber: 'J-0011', title: 'Brackets', completedDate: '2026-09-30T00:00:00Z', wipBalance: 50, isComplete: true },
  { jobId: 12, jobNumber: 'J-0012', title: 'Housings', completedDate: '2026-10-01T00:00:00Z', wipBalance: 80, isComplete: true },
  { jobId: 13, jobNumber: 'J-0013', title: 'Covers', completedDate: null, wipBalance: 20, isComplete: false },
];

describe('JobCostCloseComponent', () => {
  let http: HttpTestingController;
  let snackbar: { success: ReturnType<typeof vi.fn>; errorFrom: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    snackbar = { success: vi.fn(), errorFrom: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists a zero-WIP job whose receipts posted a variance, with a receipt variance column', () => {
    const c = TestBed.runInInjectionContext(() => new JobCostCloseComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne(`${base}/production-cost-close-candidates`).flush([
      { jobId: 14, jobNumber: 'J-0014', title: 'Spacers', completedDate: null, wipBalance: 0, isComplete: false, receiptVariance: 12.5 },
    ]);

    expect(c.columns.map(col => col.field)).toContain('receiptVariance');
    expect(c.candidates()[0].receiptVariance).toBe(12.5);
  });

  it('closes a job, reports its variance and reloads the worklist', () => {
    const c = TestBed.runInInjectionContext(() => new JobCostCloseComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne(`${base}/production-cost-close-candidates`).flush(ROWS);
    expect(c.candidates()).toHaveLength(3);

    c.close(ROWS[0]);
    expect(c.closingId()).toBe(11);
    const req = http.expectOne(`${base}/11/close-production-cost`);
    expect(req.request.method).toBe('POST');
    req.flush({ jobId: 11, laborAbsorbed: 30, overheadAbsorbed: 10, productionVariance: 90, posted: true });
    http.expectOne(`${base}/production-cost-close-candidates`).flush([ROWS[1], ROWS[2]]);

    expect(snackbar.success).toHaveBeenCalled();
    expect(c.closingId()).toBeNull();
    expect(c.candidates().map((r) => r.jobId)).toEqual([12, 13]);
  });

  it('does not close a job that is still open', () => {
    const c = TestBed.runInInjectionContext(() => new JobCostCloseComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne(`${base}/production-cost-close-candidates`).flush(ROWS);

    c.close(ROWS[2]);

    expect(c.closingId()).toBeNull();
    http.expectNone(`${base}/13/close-production-cost`);
  });

  it('closes one job at a time', () => {
    const c = TestBed.runInInjectionContext(() => new JobCostCloseComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne(`${base}/production-cost-close-candidates`).flush(ROWS);

    c.close(ROWS[0]);
    c.close(ROWS[1]);

    http.expectOne(`${base}/11/close-production-cost`).flush({ jobId: 11, laborAbsorbed: 0, overheadAbsorbed: 0, productionVariance: 0, posted: false });
    http.expectNone(`${base}/12/close-production-cost`);
    http.expectOne(`${base}/production-cost-close-candidates`).flush([]);
  });
});
