import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DatabaseTransferService } from './database-transfer.service';
import { DatabaseTransferSummary } from '../database/models/database-transfer-summary.model';
import { DatabaseImportReport } from '../database/models/database-import-report.model';
import { environment } from '../../../../environments/environment';

describe('DatabaseTransferService', () => {
  let service: DatabaseTransferService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/admin/database`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(DatabaseTransferService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs the transfer summary', () => {
    const mock: DatabaseTransferSummary = {
      databaseName: 'forge',
      tableCount: 2,
      estimatedRows: 42,
      totalBytes: 8192,
      tables: [
        { schema: 'public', name: 'parts', estimatedRows: 40, sizeBytes: 8000 },
        { schema: 'public', name: 'jobs', estimatedRows: 2, sizeBytes: 192 },
      ],
    };
    let result: DatabaseTransferSummary | undefined;

    service.getSummary().subscribe((summary) => { result = summary; });
    const req = httpMock.expectOne(`${base}/summary`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);

    expect(result?.tableCount).toBe(2);
    expect(result?.tables[0].name).toBe('parts');
  });

  it('requests the dump as a blob', () => {
    let result: Blob | undefined;

    service.downloadDump().subscribe((blob) => { result = blob; });
    const req = httpMock.expectOne(`${base}/dump`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['zip-bytes'], { type: 'application/zip' }));

    expect(result?.size).toBeGreaterThan(0);
  });

  it('POSTs the archive plus options as multipart form data', () => {
    const file = new File(['zip-bytes'], 'forge-dump.zip', { type: 'application/zip' });
    const mock: DatabaseImportReport = {
      success: true,
      loaded: [{ qualified: 'public.parts', rows: 40, droppedColumns: [] }],
      excluded: ['public.audit_events'],
      missingInTarget: [],
      softDeletedPurged: 3,
      fkOrphans: [],
    };
    let result: DatabaseImportReport | undefined;

    service.importDump(file, {
      excludePatterns: 'audit_*',
      purgeSoftDeleted: true,
      allowFkOrphans: false,
    }).subscribe((report) => { result = report; });

    const req = httpMock.expectOne(`${base}/import`);
    expect(req.request.method).toBe('POST');

    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('excludePatterns')).toBe('audit_*');
    // Booleans cross the multipart boundary as strings the server model-binds.
    expect(body.get('purgeSoftDeleted')).toBe('true');
    expect(body.get('allowFkOrphans')).toBe('false');

    req.flush(mock);
    expect(result?.success).toBe(true);
    expect(result?.softDeletedPurged).toBe(3);
  });
});
