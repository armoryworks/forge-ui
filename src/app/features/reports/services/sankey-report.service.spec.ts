import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SankeyReportService } from './sankey-report.service';
import { environment } from '../../../../environments/environment';

describe('SankeyReportService', () => {
  let service: SankeyReportService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/reports/sankey`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SankeyReportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  describe('getJobStageFlow', () => {
    it('should GET /reports/sankey/job-stage-flow with no params', () => {
      const mockFlow = [{ source: 'Open', target: 'In Production', value: 12 }];
      service.getJobStageFlow().subscribe(res => {
        expect(res).toEqual(mockFlow);
      });
      const req = httpMock.expectOne(`${base}/job-stage-flow`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockFlow);
    });
  });

  describe('getQuoteToCash', () => {
    it('should GET /reports/sankey/quote-to-cash with start and end date params', () => {
      const mockFlow = [{ source: 'Quote', target: 'Sales Order', value: 5 }];
      service.getQuoteToCash('2026-01-01', '2026-03-31').subscribe(res => {
        expect(res).toEqual(mockFlow);
      });
      const req = httpMock.expectOne(r => r.url === `${base}/quote-to-cash`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('start')).toBe('2026-01-01');
      expect(req.request.params.get('end')).toBe('2026-03-31');
      req.flush(mockFlow);
    });

    it('should GET /reports/sankey/quote-to-cash with no params when dates are omitted', () => {
      service.getQuoteToCash().subscribe();
      const req = httpMock.expectOne(`${base}/quote-to-cash`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush([]);
    });
  });

  describe('getExpenseFlow', () => {
    it('should GET /reports/sankey/expense-flow with start and end date params', () => {
      service.getExpenseFlow('2026-01-01', '2026-06-30').subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/expense-flow`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('start')).toBe('2026-01-01');
      expect(req.request.params.get('end')).toBe('2026-06-30');
      req.flush([]);
    });

    it('should GET /reports/sankey/expense-flow with no params when dates are omitted', () => {
      service.getExpenseFlow().subscribe();
      const req = httpMock.expectOne(`${base}/expense-flow`);
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush([]);
    });
  });

  describe('getTrainingCompletion', () => {
    it('should GET /reports/sankey/training-completion with no params', () => {
      const mockFlow = [{ source: 'Enrolled', target: 'Completed', value: 30 }];
      service.getTrainingCompletion().subscribe(res => {
        expect(res).toEqual(mockFlow);
      });
      const req = httpMock.expectOne(`${base}/training-completion`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush(mockFlow);
    });
  });

  describe('getMaterialToProduct', () => {
    it('should GET /reports/sankey/material-to-product with no params', () => {
      service.getMaterialToProduct().subscribe();
      const req = httpMock.expectOne(`${base}/material-to-product`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toHaveLength(0);
      req.flush([]);
    });
  });
});
