import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { JobCostService } from './job-cost.service';

describe('JobCostService', () => {
  let service: JobCostService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(JobCostService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getCostSummary', () => {
    it('should GET cost summary for a job', () => {
      service.getCostSummary(42).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/jobs/42/cost-summary`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getMaterialIssues', () => {
    it('should GET material issues with default pagination', () => {
      service.getMaterialIssues(10).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/jobs/10/material-issues?page=1&pageSize=25`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET material issues with custom pagination', () => {
      service.getMaterialIssues(10, 2, 50).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/jobs/10/material-issues?page=2&pageSize=50`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('issueMaterial', () => {
    it('should POST material issue', () => {
      const body = { partId: 5, quantity: 10 } as any;
      service.issueMaterial(42, body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/jobs/42/material-issues`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({});
    });
  });

  describe('returnMaterial', () => {
    it('should POST material return', () => {
      service.returnMaterial(42, 7).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/jobs/42/material-issues/7/return`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({});
    });
  });

  describe('recalculateCosts', () => {
    it('should POST recalculate costs', () => {
      service.recalculateCosts(42).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/jobs/42/recalculate-costs`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(null);
    });
  });

  describe('getProfitabilityReport', () => {
    it('should GET profitability report without filters', () => {
      service.getProfitabilityReport().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/reports/job-profitability`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET profitability report with filters', () => {
      service.getProfitabilityReport({ dateFrom: '2026-01-01', customerId: 3 }).subscribe();
      const req = httpMock.expectOne(
        `${baseUrl}/reports/job-profitability?dateFrom=2026-01-01&customerId=3`,
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getLaborRates', () => {
    it('should GET labor rates for a user', () => {
      service.getLaborRates(5).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/admin/labor-rates/5`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createLaborRate', () => {
    it('should POST new labor rate', () => {
      const body = { userId: 5, rate: 45.0, effectiveDate: '2026-01-01' } as any;
      service.createLaborRate(body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/admin/labor-rates`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('getOperationTimeSummary', () => {
    it('should GET operation time summary for a job', () => {
      service.getOperationTimeSummary(42).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/jobs/42/operation-time-summary`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });
});
