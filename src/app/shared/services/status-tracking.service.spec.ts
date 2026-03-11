import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StatusTrackingService } from './status-tracking.service';
import { StatusEntry } from '../models/status-entry.model';
import { ActiveStatus } from '../models/active-status.model';
import { environment } from '../../../environments/environment';

describe('StatusTrackingService', () => {
  let service: StatusTrackingService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/status-tracking`;

  const mockWorkflowEntry: StatusEntry = {
    id: 1,
    entityType: 'job',
    entityId: 42,
    statusCode: 'in_production',
    statusLabel: 'In Production',
    category: 'workflow',
    startedAt: '2026-03-10T10:00:00Z',
    endedAt: null,
    notes: null,
    setById: 7,
    setByName: 'Alice Kim',
    createdAt: '2026-03-10T10:00:00Z',
  };

  const mockHoldEntry: StatusEntry = {
    id: 2,
    entityType: 'job',
    entityId: 42,
    statusCode: 'quality_hold',
    statusLabel: 'Quality Hold',
    category: 'hold',
    startedAt: '2026-03-10T12:00:00Z',
    endedAt: null,
    notes: 'Pending QC review',
    setById: 7,
    setByName: 'Alice Kim',
    createdAt: '2026-03-10T12:00:00Z',
  };

  const mockActiveStatus: ActiveStatus = {
    workflowStatus: mockWorkflowEntry,
    activeHolds: [mockHoldEntry],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(StatusTrackingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getHistory', () => {
    it('should GET the history for the given entity type and id', () => {
      const result: StatusEntry[] = [];
      service.getHistory('job', 42).subscribe((entries) => {
        result.push(...entries);
      });

      const req = httpMock.expectOne(`${baseUrl}/job/42/history`);
      expect(req.request.method).toBe('GET');
      req.flush([mockWorkflowEntry, mockHoldEntry]);

      expect(result.length).toBe(2);
      expect(result[0].id).toBe(1);
      expect(result[1].category).toBe('hold');
    });

    it('should return an empty array when history is empty', () => {
      let result: StatusEntry[] = [];
      service.getHistory('part', 99).subscribe((entries) => {
        result = entries;
      });

      const req = httpMock.expectOne(`${baseUrl}/part/99/history`);
      req.flush([]);

      expect(result).toEqual([]);
    });
  });

  describe('getActiveStatus', () => {
    it('should GET the active status for the given entity type and id', () => {
      let result: ActiveStatus | null = null;
      service.getActiveStatus('job', 42).subscribe((status) => {
        result = status;
      });

      const req = httpMock.expectOne(`${baseUrl}/job/42/active`);
      expect(req.request.method).toBe('GET');
      req.flush(mockActiveStatus);

      expect(result).not.toBeNull();
      expect(result!.workflowStatus?.statusCode).toBe('in_production');
      expect(result!.activeHolds.length).toBe(1);
      expect(result!.activeHolds[0].statusCode).toBe('quality_hold');
    });

    it('should handle a null workflow status (no active workflow)', () => {
      let result: ActiveStatus | null = null;
      service.getActiveStatus('job', 5).subscribe((status) => {
        result = status;
      });

      const req = httpMock.expectOne(`${baseUrl}/job/5/active`);
      req.flush({ workflowStatus: null, activeHolds: [] });

      expect(result!.workflowStatus).toBeNull();
      expect(result!.activeHolds).toEqual([]);
    });
  });

  describe('setWorkflowStatus', () => {
    it('should POST the new workflow status and return the created entry', () => {
      const request = { statusCode: 'qc_review', notes: 'Moving to review' };
      let result: StatusEntry | null = null;

      service.setWorkflowStatus('job', 42, request).subscribe((entry) => {
        result = entry;
      });

      const req = httpMock.expectOne(`${baseUrl}/job/42/workflow`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);

      req.flush({ ...mockWorkflowEntry, statusCode: 'qc_review', statusLabel: 'QC / Review' });

      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe('qc_review');
    });

    it('should include notes in the request body', () => {
      const request = { statusCode: 'shipped', notes: 'Shipped via FedEx' };
      service.setWorkflowStatus('job', 42, request).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/job/42/workflow`);
      expect(req.request.body.notes).toBe('Shipped via FedEx');
      req.flush(mockWorkflowEntry);
    });
  });

  describe('addHold', () => {
    it('should POST a new hold and return the created hold entry', () => {
      const request = { statusCode: 'quality_hold', notes: 'Defect detected' };
      let result: StatusEntry | null = null;

      service.addHold('job', 42, request).subscribe((entry) => {
        result = entry;
      });

      const req = httpMock.expectOne(`${baseUrl}/job/42/holds`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockHoldEntry);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('hold');
      expect(result!.statusCode).toBe('quality_hold');
    });
  });

  describe('releaseHold', () => {
    it('should POST to the release endpoint with notes', () => {
      const request = { notes: 'QC passed' };
      let result: StatusEntry | null = null;

      service.releaseHold(2, request).subscribe((entry) => {
        result = entry;
      });

      const req = httpMock.expectOne(`${baseUrl}/holds/2/release`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ ...mockHoldEntry, endedAt: '2026-03-11T09:00:00Z' });

      expect(result).not.toBeNull();
      expect(result!.endedAt).toBe('2026-03-11T09:00:00Z');
    });

    it('should POST an empty body when no release request is provided', () => {
      service.releaseHold(3).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/holds/3/release`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ ...mockHoldEntry, id: 3, endedAt: '2026-03-11T09:00:00Z' });
    });
  });
});
