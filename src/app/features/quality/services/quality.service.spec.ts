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

  describe('updateTemplate', () => {
    it('should PUT the template with item ids so the server can update, add and remove', () => {
      const data = {
        name: 'Dimensional Check',
        partId: 5,
        items: [
          { id: 3, description: 'Check length', specification: '10mm +/- 0.1', sortOrder: 0, isRequired: true },
          { description: 'Check finish', sortOrder: 1, isRequired: false },
        ],
      };
      service.updateTemplate(4, data).subscribe();
      const req = httpMock.expectOne(`${qualityBase}/templates/4`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(data);
      req.flush({ id: 4 });
    });
  });

  describe('deleteTemplate', () => {
    it('should DELETE the template', () => {
      service.deleteTemplate(4).subscribe();
      const req = httpMock.expectOne(`${qualityBase}/templates/4`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
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

    it('should pass the search text and leave out empty filters', () => {
      service.getInspections({ search: 'J-3600', status: '' }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${qualityBase}/inspections`);
      expect(req.request.params.get('search')).toBe('J-3600');
      expect(req.request.params.has('status')).toBe(false);
      req.flush([]);
    });
  });

  describe('getInspection', () => {
    it('should GET one inspection by id', () => {
      service.getInspection(12).subscribe();
      const req = httpMock.expectOne(`${qualityBase}/inspections/12`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 12 });
    });
  });

  describe('createInspection', () => {
    it('should POST new inspection', () => {
      const data = { jobId: 5, partId: 8, templateId: 2, lotNumber: 'LOT-001', notes: 'Initial' };
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
});
