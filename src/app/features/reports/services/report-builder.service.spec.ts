import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ReportBuilderService } from './report-builder.service';
import { environment } from '../../../../environments/environment';

describe('ReportBuilderService', () => {
  let service: ReportBuilderService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;
  const base = `${apiUrl}/report-builder`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportBuilderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getSavedReport', () => {
    it('should GET saved report by id', () => {
      service.getSavedReport(3).subscribe();
      const req = httpMock.expectOne(`${base}/saved/3`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 3 });
    });
  });

  describe('createReport', () => {
    it('should POST new report', () => {
      const body = { name: 'Test Report', entitySource: 'jobs', columns: ['id', 'title'] } as any;
      service.createReport(body).subscribe();
      const req = httpMock.expectOne(`${base}/saved`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 1 });
      // createReport triggers loadSavedReports side effect
      const sideEffect = httpMock.expectOne(`${base}/saved`);
      sideEffect.flush([]);
    });
  });

  describe('deleteReport', () => {
    it('should DELETE report', () => {
      service.deleteReport(5).subscribe();
      const req = httpMock.expectOne(`${base}/saved/5`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      // deleteReport triggers loadSavedReports side effect
      const sideEffect = httpMock.expectOne(`${base}/saved`);
      sideEffect.flush([]);
    });
  });

  describe('runReport', () => {
    it('should POST run report', () => {
      const params = { entitySource: 'jobs', columns: ['id', 'title'], filters: [] };
      service.runReport(params).subscribe();
      const req = httpMock.expectOne(`${base}/run`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.entitySource).toBe('jobs');
      req.flush({ columns: [], rows: [] });
    });
  });
});
