import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../shared/services/auth.service';
import { QcInspection } from '../../quality/models/qc-inspection.model';
import { KioskInspectionLookup } from '../models/kiosk-inspection-lookup.model';
import { KioskInspectionTarget } from '../models/kiosk-inspection-target.model';
import { KioskInspectionService } from './kiosk-inspection.service';

const LINKED: KioskInspectionTarget = { jobId: 31, jobNumber: 'J-1031', lotNumber: 'LOT-7', lotQuantity: 40 };
const UNLINKED: KioskInspectionTarget = { jobId: null, jobNumber: null, lotNumber: null, lotQuantity: null };

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
  const user = signal<{ id: number } | null>({ id: 7 });

  beforeEach(() => {
    user.set({ id: 7 });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user } },
      ],
    });
    service = TestBed.inject(KioskInspectionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const unknownScan = (value: string) =>
    httpMock.expectOne(r => r.url === `${api}/display/shop-floor/identify-scan` && r.body?.scanValue === value).flush({ scanType: 'unknown' });

  describe('findTarget', () => {
    it('links a scanned lot with its work order', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, ' LOT-7 ').subscribe(r => found = r);

      const lots = httpMock.expectOne(r => r.url === `${api}/lots`);
      expect(lots.request.params.get('search')).toBe('LOT-7');
      lots.flush([lot({ lotNumber: 'LOT-70' }), lot()]);

      expect(found).toEqual({ status: 'found', target: LINKED });
    });

    it('finds an upper-case lot from a lower-case scan', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'lot-7').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.get('search') === 'lot-7').flush([]);
      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.get('search') === 'LOT-7').flush([lot()]);

      expect(found).toEqual({ status: 'found', target: LINKED });
    });

    it('refuses a lot of another part', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'LOT-9').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush([lot({ lotNumber: 'LOT-9', partId: 8, partNumber: 'P-8' })]);

      expect(found).toEqual({ status: 'otherPart', partNumber: 'P-8' });
    });

    it('resolves a work order barcode on the server', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'WO-BARCODE-31').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush([]);
      httpMock.expectOne(`${api}/display/shop-floor/identify-scan`).flush({ scanType: 'job', entityId: 31, entityNumber: 'J-1031' });
      httpMock.expectOne(`${api}/jobs/31`).flush({ id: 31, jobNumber: 'J-1031', partId: 5, partNumber: 'P-5' });
      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.get('jobId') === '31').flush([lot()]);

      expect(found).toEqual({ status: 'found', target: LINKED });
    });

    it('links a scanned work order and its only lot of this part', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'J-1031').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.get('search') === 'J-1031').flush([]);
      unknownScan('J-1031');
      const jobs = httpMock.expectOne(r => r.url === `${api}/jobs`);
      expect(jobs.request.params.get('q')).toBe('J-1031');
      expect(jobs.request.params.get('pageSize')).toBe('200');
      expect(jobs.request.params.has('isArchived')).toBe(false);
      jobs.flush({ items: [{ id: 30, jobNumber: 'J-10311' }, { id: 31, jobNumber: 'J-1031' }], totalCount: 2, page: 1, pageSize: 200 });
      httpMock.expectOne(`${api}/jobs/31`).flush({ id: 31, jobNumber: 'J-1031', partId: 5, partNumber: 'P-5' });
      const jobLots = httpMock.expectOne(r => r.url === `${api}/lots` && r.params.get('jobId') === '31');
      expect(jobLots.request.params.get('partId')).toBe('5');
      jobLots.flush([lot()]);

      expect(found).toEqual({ status: 'found', target: LINKED });
    });

    it('finds an exact work order past the first page of partial matches', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, '1031').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush([]);
      unknownScan('1031');
      const partial = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, jobNumber: `${i}1031` }));
      httpMock.expectOne(r => r.url === `${api}/jobs`).flush({
        items: [...partial, { id: 31, jobNumber: '1031' }], totalCount: 31, page: 1, pageSize: 200,
      });
      httpMock.expectOne(`${api}/jobs/31`).flush({ id: 31, jobNumber: '1031', partId: 5, partNumber: 'P-5' });
      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.has('jobId')).flush([]);

      expect(found).toEqual({ status: 'found', target: { jobId: 31, jobNumber: '1031', lotNumber: null, lotQuantity: null } });
    });

    it('finds an archived work order', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'J-0900').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush([]);
      unknownScan('J-0900');
      httpMock.expectOne(r => r.url === `${api}/jobs` && !r.params.has('isArchived')).flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
      httpMock.expectOne(r => r.url === `${api}/jobs` && r.params.get('isArchived') === 'true')
        .flush({ items: [{ id: 9, jobNumber: 'J-0900' }], totalCount: 1, page: 1, pageSize: 200 });
      httpMock.expectOne(`${api}/jobs/9`).flush({ id: 9, jobNumber: 'J-0900', partId: 5, partNumber: 'P-5' });
      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.has('jobId')).flush([]);

      expect(found).toEqual({ status: 'found', target: { jobId: 9, jobNumber: 'J-0900', lotNumber: null, lotQuantity: null } });
    });

    it('leaves the lot open when the work order has several', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'J-1031').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.has('search')).flush([]);
      unknownScan('J-1031');
      httpMock.expectOne(r => r.url === `${api}/jobs`).flush({ items: [{ id: 31, jobNumber: 'J-1031' }], totalCount: 1, page: 1, pageSize: 200 });
      httpMock.expectOne(`${api}/jobs/31`).flush({ id: 31, jobNumber: 'J-1031', partId: 5, partNumber: 'P-5' });
      httpMock.expectOne(r => r.url === `${api}/lots` && r.params.has('jobId')).flush([lot(), lot({ id: 4, lotNumber: 'LOT-8' })]);

      expect(found).toEqual({ status: 'found', target: { jobId: 31, jobNumber: 'J-1031', lotNumber: null, lotQuantity: null } });
    });

    it('refuses a work order that makes another part', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'J-2000').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush([]);
      unknownScan('J-2000');
      httpMock.expectOne(r => r.url === `${api}/jobs`).flush({ items: [{ id: 40, jobNumber: 'J-2000' }], totalCount: 1, page: 1, pageSize: 200 });
      httpMock.expectOne(`${api}/jobs/40`).flush({ id: 40, jobNumber: 'J-2000', partId: 8, partNumber: 'P-8' });

      expect(found).toEqual({ status: 'otherPart', partNumber: 'P-8' });
    });

    it('still finds a work order when the lot and identify lookups are unavailable', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'J-1031').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush(null, { status: 403, statusText: 'Forbidden' });
      httpMock.expectOne(`${api}/display/shop-floor/identify-scan`).flush(null, { status: 403, statusText: 'Forbidden' });
      httpMock.expectOne(r => r.url === `${api}/jobs`).flush({ items: [{ id: 31, jobNumber: 'J-1031' }], totalCount: 1, page: 1, pageSize: 200 });
      httpMock.expectOne(`${api}/jobs/31`).flush({ id: 31, jobNumber: 'J-1031', partId: null, partNumber: null });
      httpMock.expectOne(r => r.url === `${api}/lots`).flush(null, { status: 403, statusText: 'Forbidden' });

      expect(found).toEqual({ status: 'found', target: { jobId: 31, jobNumber: 'J-1031', lotNumber: null, lotQuantity: null } });
    });

    it('reports nothing found', () => {
      let found: KioskInspectionLookup | undefined;
      service.findTarget(5, 'NOPE-1').subscribe(r => found = r);

      httpMock.expectOne(r => r.url === `${api}/lots`).flush([]);
      unknownScan('NOPE-1');
      httpMock.expectOne(r => r.url === `${api}/jobs` && !r.params.has('isArchived')).flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
      httpMock.expectOne(r => r.url === `${api}/jobs` && r.params.has('isArchived')).flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });

      expect(found).toEqual({ status: 'notFound' });
    });
  });

  it('lists the active templates of the part by name', () => {
    let names: string[] | undefined;
    service.findTemplates(5).subscribe(t => names = t.map(x => x.name));

    httpMock.expectOne(`${api}/quality/templates`).flush([
      { id: 2, name: 'Old', partId: 5, isActive: false, items: [] },
      { id: 6, name: 'Other part', partId: 8, isActive: true, items: [] },
      { id: 4, name: 'Final', partId: 5, isActive: true, items: [] },
      { id: 3, name: 'First article', partId: 5, isActive: true, items: [] },
    ]);

    expect(names).toEqual(['Final', 'First article']);
  });

  describe('openInspection', () => {
    const findOpen = () => httpMock.expectOne(r => r.url === `${api}/quality/inspections` && r.method === 'GET');
    const create = () => httpMock.expectOne(r => r.url === `${api}/quality/inspections` && r.method === 'POST');

    it('creates the inspection with the work order, part, lot and template', () => {
      let opened: QcInspection | undefined;
      service.openInspection(5, 4, LINKED).subscribe(r => opened = r);

      const open = findOpen();
      expect(open.request.params.get('status')).toBe('InProgress');
      expect(open.request.params.get('jobId')).toBe('31');
      expect(open.request.params.get('lotNumber')).toBe('LOT-7');
      open.flush([inspection({ templateId: 9 })]);

      const post = create();
      expect(post.request.body).toEqual({ partId: 5, jobId: 31, templateId: 4, lotNumber: 'LOT-7' });
      post.flush(inspection({ id: 12 }));

      expect(opened?.id).toBe(12);
    });

    it('resumes my open inspection for the same work order, lot and template', () => {
      let opened: QcInspection | undefined;
      service.openInspection(5, 4, LINKED).subscribe(r => opened = r);

      findOpen().flush([inspection()]);

      expect(opened?.id).toBe(11);
    });

    it('does not take over an inspection another inspector started', () => {
      let opened: QcInspection | undefined;
      service.openInspection(5, 4, LINKED).subscribe(r => opened = r);

      findOpen().flush([inspection({ inspectorId: 8, inspectorName: 'Sam Other' })]);
      create().flush(inspection({ id: 12 }));

      expect(opened?.id).toBe(12);
    });

    it('creates one unlinked inspection across skip, cancel and skip again', () => {
      const unlinked = inspection({ id: 12, jobId: null, jobNumber: null, lotNumber: null });
      let first: QcInspection | undefined;
      let second: QcInspection | undefined;

      service.openInspection(5, 4, UNLINKED).subscribe(r => first = r);
      const open = findOpen();
      expect(open.request.params.keys()).toEqual(['status']);
      open.flush([inspection()]);
      const post = create();
      expect(post.request.body).toEqual({ partId: 5, jobId: undefined, templateId: 4, lotNumber: undefined });
      post.flush(unlinked);

      service.openInspection(5, 4, UNLINKED).subscribe(r => second = r);
      findOpen().flush([unlinked, inspection()]);
      httpMock.expectNone(r => r.method === 'POST');

      expect(first?.id).toBe(12);
      expect(second?.id).toBe(12);
    });

    it('does not resume an unlinked inspection of another part', () => {
      service.openInspection(5, 4, UNLINKED).subscribe();

      findOpen().flush([inspection({ id: 12, jobId: null, lotNumber: null, partId: 8 })]);
      create().flush(inspection({ id: 13, jobId: null, lotNumber: null }));
    });

    it('creates without looking for one to resume when nobody is signed in', () => {
      user.set(null);
      service.openInspection(5, null, UNLINKED).subscribe();

      expect(create().request.body).toEqual({ partId: 5, jobId: undefined, templateId: undefined, lotNumber: undefined });
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
