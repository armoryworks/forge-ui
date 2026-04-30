import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PlanningService } from './planning.service';
import { environment } from '../../../../environments/environment';
import { CapabilityService } from '../../../shared/services/capability.service';

describe('PlanningService', () => {
  let service: PlanningService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/planning-cycles`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlanningService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getCycles', () => {
    it('should GET planning cycles list', () => {
      service.getCycles().subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getCurrentCycle', () => {
    it('should GET current cycle', () => {
      service.getCurrentCycle().subscribe();
      const req = httpMock.expectOne(`${base}/current`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 1 });
    });
  });

  describe('getCycle', () => {
    it('should GET cycle by id', () => {
      service.getCycle(5).subscribe();
      const req = httpMock.expectOne(`${base}/5`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 5 });
    });
  });

  describe('createCycle', () => {
    it('should POST new cycle', () => {
      const body = { name: 'Sprint 1', startDate: '2026-01-01T00:00:00Z' } as any;
      service.createCycle(body).subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('updateCycle', () => {
    it('should PUT cycle update', () => {
      const body = { name: 'Sprint 1 Updated' } as any;
      service.updateCycle(3, body).subscribe();
      const req = httpMock.expectOne(`${base}/3`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 3 });
    });
  });

  describe('activateCycle', () => {
    it('should POST activate action', () => {
      service.activateCycle(2).subscribe();
      const req = httpMock.expectOne(`${base}/2/activate`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('completeCycle', () => {
    it('should POST complete with rollover flag', () => {
      service.completeCycle(4, true).subscribe();
      const req = httpMock.expectOne(`${base}/4/complete`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ rolloverIncomplete: true });
      req.flush({ newCycleId: 5 });
    });

    it('should POST complete without rollover', () => {
      service.completeCycle(4, false).subscribe();
      const req = httpMock.expectOne(`${base}/4/complete`);
      expect(req.request.body).toEqual({ rolloverIncomplete: false });
      req.flush({ newCycleId: 5 });
    });
  });

  describe('commitJob', () => {
    it('should POST job to cycle entries', () => {
      service.commitJob(1, 42).subscribe();
      const req = httpMock.expectOne(`${base}/1/entries`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ jobId: 42 });
      req.flush(null);
    });
  });

  describe('removeEntry', () => {
    it('should DELETE entry from cycle', () => {
      service.removeEntry(1, 42).subscribe();
      const req = httpMock.expectOne(`${base}/1/entries/42`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('reorderEntries', () => {
    it('should PUT entry reorder', () => {
      const items = [
        { jobId: 1, sortOrder: 0 },
        { jobId: 2, sortOrder: 1 },
      ];
      service.reorderEntries(3, items).subscribe();
      const req = httpMock.expectOne(`${base}/3/entries/order`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ items });
      req.flush(null);
    });
  });

  describe('completeEntry', () => {
    it('should POST entry completion', () => {
      service.completeEntry(2, 10).subscribe();
      const req = httpMock.expectOne(`${base}/2/entries/10/complete`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('layer-3 descriptor pre-check (Phase 4 Phase-D)', () => {
    it('getCurrentCycle does NOT fire HTTP when CAP-PLAN-MRP is known-disabled', () => {
      const capability = TestBed.inject(CapabilityService);
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(false);

      let result: unknown = 'unset';
      service.getCurrentCycle().subscribe((r) => { result = r; });

      httpMock.expectNone(`${base}/current`);
      expect(result).toBeNull();
      expect(service.capabilityDisabled()).toBe(true);
    });

    it('getCycles does NOT fire HTTP when CAP-PLAN-MRP is known-disabled', () => {
      const capability = TestBed.inject(CapabilityService);
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(false);

      let result: unknown = 'unset';
      service.getCycles().subscribe((r) => { result = r; });

      httpMock.expectNone(base);
      expect(result).toEqual([]);
      expect(service.capabilityDisabled()).toBe(true);
    });

    it('getCurrentCycle fires HTTP normally when capability is enabled', () => {
      const capability = TestBed.inject(CapabilityService);
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(true);

      service.getCurrentCycle().subscribe();
      const req = httpMock.expectOne(`${base}/current`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 1 });

      expect(service.capabilityDisabled()).toBe(false);
    });

    it('getCurrentCycle fires HTTP when capability is unknown (boot race)', () => {
      const capability = TestBed.inject(CapabilityService);
      vi.spyOn(capability, 'isKnown').mockReturnValue(false);

      service.getCurrentCycle().subscribe();
      const req = httpMock.expectOne(`${base}/current`);
      req.flush(null);
    });
  });
});
