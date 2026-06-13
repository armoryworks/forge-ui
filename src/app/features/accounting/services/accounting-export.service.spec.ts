import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AccountingExportService } from './accounting-export.service';
import { environment } from '../../../../environments/environment';

describe('AccountingExportService', () => {
  let service: AccountingExportService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/accounting`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountingExportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('downloads a CSV export as a blob with the date range', () => {
    service.downloadCsv('trial-balance', 1, '2026-06-01', '2026-06-30').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/exports/trial-balance.csv`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('bookId')).toBe('1');
    expect(req.request.params.get('fromDate')).toBe('2026-06-01');
    expect(req.request.params.get('toDate')).toBe('2026-06-30');
    req.flush(new Blob(['a,b\r\n']));
  });

  it('loads the QBO mappings for the book', () => {
    service.getQboMappings(1).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/qbo-export/mappings`);
    expect(req.request.params.get('bookId')).toBe('1');
    req.flush([]);
  });

  it('upserts a mapping via PUT on the GL account', () => {
    service.upsertQboMapping(100, '79', 'QB Checking').subscribe();
    const req = httpMock.expectOne(`${base}/qbo-export/mappings/100`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ qboAccountId: '79', qboAccountName: 'QB Checking' });
    req.flush({});
  });

  it('removes a mapping via DELETE', () => {
    service.deleteQboMapping(100).subscribe();
    const req = httpMock.expectOne(`${base}/qbo-export/mappings/100`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('pushes the journal summary with the period as query params', () => {
    service.pushToQbo(1, '2026-06-01', '2026-06-30').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/qbo-export/push`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('fromDate')).toBe('2026-06-01');
    expect(req.request.params.get('toDate')).toBe('2026-06-30');
    req.flush({ qboDocId: 'QBO-1', fromDate: '2026-06-01', toDate: '2026-06-30', totalDebit: 100, lineCount: 2 });
  });
});
