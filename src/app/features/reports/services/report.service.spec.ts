import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ReportService } from './report.service';
import { environment } from '../../../../environments/environment';

describe('ReportService', () => {
  let service: ReportService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getJobsByStage', () => {
    it('should GET jobs by stage', () => {
      service.getJobsByStage().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/reports/jobs-by-stage`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should pass trackTypeId param', () => {
      service.getJobsByStage(3).subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/reports/jobs-by-stage`);
      expect(req.request.params.get('trackTypeId')).toBe('3');
      req.flush([]);
    });
  });

  describe('getOverdueJobs', () => {
    it('should GET overdue jobs', () => {
      service.getOverdueJobs().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/reports/overdue-jobs`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getExpenseSummary', () => {
    it('should GET with date range', () => {
      service.getExpenseSummary('2026-01-01', '2026-03-31').subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/reports/expense-summary`);
      expect(req.request.params.get('start')).toBe('2026-01-01');
      expect(req.request.params.get('end')).toBe('2026-03-31');
      req.flush([]);
    });
  });

  describe('getLeadPipeline', () => {
    it('should GET lead pipeline', () => {
      service.getLeadPipeline().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/reports/lead-pipeline`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getRevenue', () => {
    it('should GET revenue with groupBy', () => {
      service.getRevenue('2026-01-01', '2026-03-31', 'customer').subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/reports/revenue`);
      expect(req.request.params.get('groupBy')).toBe('customer');
      req.flush([]);
    });
  });

  describe('getArAging', () => {
    it('should GET AR aging', () => {
      service.getArAging().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/reports/ar-aging`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getInventoryLevels', () => {
    it('should GET inventory levels', () => {
      service.getInventoryLevels().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/reports/inventory-levels`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getTeamWorkload', () => {
    it('should GET team workload', () => {
      service.getTeamWorkload().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/reports/team-workload`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });
});
