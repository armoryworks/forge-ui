import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../../environments/environment';
import { QcInspection } from '../../quality/models/qc-inspection.model';
import { KioskInspectionLookup } from '../models/kiosk-inspection-lookup.model';
import { KioskInspectionTarget } from '../models/kiosk-inspection-target.model';
import { KioskInspectionService } from './kiosk-inspection.service';

const LINKED: KioskInspectionTarget = { jobId: 31, jobNumber: 'J-1031', lotNumber: 'LOT-7', lotQuantity: 40 };

function inspection(overrides: Partial<QcInspection> = {}): QcInspection {
  return {
    id: 11,
    jobId: 31,
    jobNumber: 'J-1031',
    partId: 5,
    partNumber: 'P-5',
    productionRunId: null,
    templateId: 4,
    templateName: 'Final',
    inspectorId: 7,
    inspectorName: 'Pat Inspector',
    lotNumber: 'LOT-7',
    status: 'InProgress',
    notes: null,
    completedAt: null,
    results: [],
    createdAt: new Date('2026-09-01'),
    ...overrides,
  };
}

function lot(overrides: Record<string, unknown> = {}) {
  return {
    id: 3, lotNumber: 'LOT-7', partId: 5, partNumber: 'P-5', partDescription: null,
    jobId: 31, jobNumber: 'J-1031', productionRunId: null, purchaseOrderLineId: null,
    quantity: 40, expirationDate: null, supplierLotNumber: null, notes: null, createdAt: '2026-09-01',
    ...overrides,
  };
}

describe('KioskInspectionService', () => {
  let service: KioskInspectionService;
  let httpMock: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(KioskInspectionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('findTarget', () => {
    it('links a scanned lot with its work order', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, ' lot-7 ').subscribe(r => found = r);

      const lots = httpMock.expectOne(r => r.url === `${api}/lots`);
      expect(lots.request.params.get('search')).toBe('lot-7');
      lots.flush([lot({ lotNumber: 'LOT-70' }), lot()]);

      expect(found).toEqual({ status: 'found', target: LINKED });
    });

    it('refuses a lot of another part', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'LOT-9').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush([lot({ lotNumber: 'LOT-9', partId: 8, partNumber: 'P-8' })]);

      expect(found).toEqual({ status: 'otherPart', partNumber: 'P-8' });
    });

    it('links a scanned work order and its only lot of this part', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'J-1031').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.get('search') === 'J-1031').flush([]);
      const jobs = httpMock.expectOne(r => r.url === `${api}/jobs`);
      expect(jobs.request.params.get('q')).toBe('J-1031');
      jobs.flush({ items: [{ id: 30, jobNumber: 'J-10311' }, { id: 31, jobNumber: 'J-1031' }], totalCount: 2, page: 1, pageSize: 25 });
      httpMock.expectOne(`${api}/jobs/31`).flush({ id: 31, jobNumber: 'J-1031', partId: 5, partNumber: 'P-5' });
      const jobLots = httpMock.expectOne(r => r.url === `${api}/lots` && r.params.get('jobId') === '31');
      expect(jobLots.request.params.get('partId')).toBe('5');
      jobLots.flush([lot()]);

      expect(found).toEqual({ status: 'found', target: LINKED });
    });

    it('leaves the lot open when the work order has several', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'J-1031').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.has('search')).flush([]);
      httpMock.expectOne(r => r.url === `${api}/jobs`).flush({ items: [{ id: 31, jobNumber: 'J-1031' }], totalCount: 1, page: 1, pageSize: 25 });
      httpMock.expectOne(`${api}/jobs/31`).flush({ id: 31, jobNumber: 'J-1031', partId: 5, partNumber: 'P-5' });
      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.has('jobId')).flush([lot(), lot({ id: 4, lotNumber: 'LOT-8' })]);

      expect(found).toEqual({ status: 'found', target: { jobId: 31, jobNumber: 'J-1031', lotNumber: null, lotQuantity: null } });
    });

    it('refuses a work order that makes another part', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'J-2000').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush([]);
      httpMock.expectOne(r => r.url === `${api}/jobs`).flush({ items: [{ id: 40, jobNumber: 'J-2000' }], totalCount: 1, page: 1, pageSize: 25 });
      httpMock.expectOne(`${api}/jobs/40`).flush({ id: 40, jobNumber: 'J-2000', partId: 8, partNumber: 'P-8' });

      expect(found).toEqual({ status: 'otherPart', partNumber: 'P-8' });
    });

    it('still finds a work order when the lot lookup is unavailable', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'J-1031').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush(null, { status: 403, statusText: 'Forbidden' });
      httpMock.expectOne(r => r.url === `${api}/jobs`).flush({ items: [{ id: 31, jobNumber: 'J-1031' }], totalCount: 1, page: 1, pageSize: 25 });
      httpMock.expectOne(`${api}/jobs/31`).flush({ id: 31, jobNumber: 'J-1031', partId: null, partNumber: null });
      httpMock.expectOne(r => r.url === `${api}/lots`).flush(null, { status: 403, statusText: 'Forbidden' });

      expect(found).toEqual({ status: 'found', target: { jobId: 31, jobNumber: 'J-1031', lotNumber: null, lotQuantity: null } });
    });

    it('reports nothing found', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'NOPE-1').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush([]);
      httpMock.expectOne(r => r.url === `${api}/jobs`).flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });

      expect(found).toEqual({ status: 'notFound' });
    });
  });

  describe('openInspection', () => {
    it('creates the inspection with the work order, part, lot and template', () => {
      let opened: QcInspection | undefined;
      service.openInspection(5, 4, LINKED).subscribe(r => opened = r);

      const open = httpMock.expectOne(r => r.url === `${api}/quality/inspections` && r.method === 'GET');
      expect(open.request.params.get('status')).toBe('InProgress');
      expect(open.request.params.get('jobId')).toBe('31');
      expect(open.request.params.get('lotNumber')).toBe('LOT-7');
      open.flush([inspection({ templateId: 9 })]);

      const create = httpMock.expectOne(r => r.url === `${api}/quality/inspections` && r.method === 'POST');
      expect(create.request.body).toEqual({ partId: 5, jobId: 31, templateId: 4, lotNumber: 'LOT-7' });
      create.flush(inspection({ id: 12 }));

      expect(opened?.id).toBe(12);
    });

    it('resumes the open inspection for the same work order, lot and template', () => {
      let opened: QcInspection | undefined;
      service.openInspection(5, 4, LINKED).subscribe(r => opened = r);

      httpMock.expectOne(r => r.url === `${api}/quality/inspections` && r.method === 'GET').flush([inspection()]);

      expect(opened?.id).toBe(11);
    });

    it('uses the part template when the scan context names none', () => {
      service.openInspection(5, null, LINKED).subscribe();

      httpMock.expectOne(`${api}/quality/templates`).flush([
        { id: 2, partId: 5, isActive: false, items: [] },
        { id: 6, partId: 8, isActive: true, items: [] },
        { id: 4, partId: 5, isActive: true, items: [] },
      ]);
      httpMock.expectOne(r => r.method === 'GET' && r.url === `${api}/quality/inspections`).flush([]);
      const create = httpMock.expectOne(r => r.method === 'POST');
      expect(create.request.body.templateId).toBe(4);
      create.flush(inspection());
    });

    it('creates an unlinked inspection without looking for one to resume', () => {
      service.openInspection(5, 4, { jobId: null, jobNumber: null, lotNumber: null, lotQuantity: null }).subscribe();

      const create = httpMock.expectOne(r => r.method === 'POST' && r.url === `${api}/quality/inspections`);
      expect(create.request.body).toEqual({ partId: 5, jobId: undefined, templateId: 4, lotNumber: undefined });
      create.flush(inspection({ jobId: null, lotNumber: null }));
    });
  });

  it('completes the inspection through the quality endpoint', () => {
    service.completeInspection(11, { status: 'Failed' }).subscribe();

    const req = httpMock.expectOne(`${api}/quality/inspections/11`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: 'Failed' });
    req.flush(inspection({ status: 'Failed' }));
  });

  it('raises an internal in-process NCR linked to the inspection, work order and lot', () => {
    service.raiseNcr(inspection(), 5, 'Visual did not pass', 40).subscribe();

    const req = httpMock.expectOne(r => r.url.endsWith('/api/v1/quality/ncrs'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      type: 'Internal',
      partId: 5,
      jobId: 31,
      lotNumber: 'LOT-7',
      qcInspectionId: 11,
      detectedAtStage: 'InProcess',
      description: 'Visual did not pass',
      affectedQuantity: 40,
    });
    req.flush({ id: 9, ncrNumber: 'NCR-0009' });
  });
});
