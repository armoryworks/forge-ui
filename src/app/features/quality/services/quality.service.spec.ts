import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { QualityService } from './quality.service';
import { environment } from '../../../../environments/environment';

describe('QualityService', () => {
  let service: QualityService;
  let httpMock: HttpTestingController;
  const qualityBase = `${environment.apiUrl}/quality`;
  const lotsBase = `${environment.apiUrl}/lots`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(QualityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ─── Templates ───

  describe('getTemplates', () => {
    it('should GET QC templates', () => {
      service.getTemplates().subscribe();
      const req = httpMock.expectOne(`${qualityBase}/templates`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createTemplate', () => {
    it('should POST new template', () => {
      const data = {
        name: 'Dimensional Check',
        description: 'Verify dimensions',
        partId: 5,
        items: [
          { description: 'Check length', specification: '10mm +/- 0.1', sortOrder: 0, isRequired: true },
        ],
      };
      service.createTemplate(data).subscribe();
      const req = httpMock.expectOne(`${qualityBase}/templates`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(data);
      req.flush({ id: 1 });
    });
  });

  // ─── Inspections ───

  describe('getInspections', () => {
    it('should GET inspections without filters', () => {
      service.getInspections().subscribe();
      const req = httpMock.expectOne(`${qualityBase}/inspections`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should pass jobId filter', () => {
      service.getInspections({ jobId: 10 }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${qualityBase}/inspections`);
      expect(req.request.params.get('jobId')).toBe('10');
      req.flush([]);
    });

    it('should pass status filter', () => {
      service.getInspections({ status: 'Pending' }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${qualityBase}/inspections`);
      expect(req.request.params.get('status')).toBe('Pending');
      req.flush([]);
    });

    it('should pass lotNumber filter', () => {
      service.getInspections({ lotNumber: 'LOT-001' }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${qualityBase}/inspections`);
      expect(req.request.params.get('lotNumber')).toBe('LOT-001');
      req.flush([]);
    });
  });

  describe('createInspection', () => {
    it('should POST new inspection', () => {
      const data = { jobId: 5, templateId: 2, lotNumber: 'LOT-001', notes: 'Initial' };
      service.createInspection(data).subscribe();
      const req = httpMock.expectOne(`${qualityBase}/inspections`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(data);
      req.flush({ id: 1 });
    });
  });

  describe('updateInspection', () => {
    it('should PUT inspection update', () => {
      const data = {
        status: 'Passed',
        notes: 'All good',
        results: [
          { checklistItemId: 1, description: 'Length', passed: true, measuredValue: '10.05mm' },
        ],
      };
      service.updateInspection(3, data).subscribe();
      const req = httpMock.expectOne(`${qualityBase}/inspections/3`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(data);
      req.flush({ id: 3 });
    });
  });

  // ─── Lots ───

  describe('getLotRecords', () => {
    it('should GET lot records without filters', () => {
      service.getLotRecords().subscribe();
      const req = httpMock.expectOne(lotsBase);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should pass partId filter', () => {
      service.getLotRecords({ partId: 7 }).subscribe();
      const req = httpMock.expectOne(r => r.url === lotsBase);
      expect(req.request.params.get('partId')).toBe('7');
      req.flush([]);
    });

    it('should pass jobId filter', () => {
      service.getLotRecords({ jobId: 15 }).subscribe();
      const req = httpMock.expectOne(r => r.url === lotsBase);
      expect(req.request.params.get('jobId')).toBe('15');
      req.flush([]);
    });

    it('should pass search filter', () => {
      service.getLotRecords({ search: 'LOT-' }).subscribe();
      const req = httpMock.expectOne(r => r.url === lotsBase);
      expect(req.request.params.get('search')).toBe('LOT-');
      req.flush([]);
    });
  });

  describe('createLotRecord', () => {
    it('should POST new lot record', () => {
      const data = {
        partId: 3,
        quantity: 100,
        lotNumber: 'LOT-002',
        notes: 'Batch from supplier',
      };
      service.createLotRecord(data).subscribe();
      const req = httpMock.expectOne(lotsBase);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(data);
      req.flush({ id: 1 });
    });
  });

  describe('getLotTraceability', () => {
    it('should GET lot traceability', () => {
      service.getLotTraceability('LOT-001').subscribe();
      const req = httpMock.expectOne(`${lotsBase}/LOT-001/trace`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('should encode special characters in lot number', () => {
      service.getLotTraceability('LOT/001 A').subscribe();
      const req = httpMock.expectOne(`${lotsBase}/${encodeURIComponent('LOT/001 A')}/trace`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });
});
