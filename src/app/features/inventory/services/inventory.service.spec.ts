import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { InventoryService } from './inventory.service';
import { Reservation } from '../models/reservation.model';
import { CreateReservationRequest } from '../models/create-reservation-request.model';
import { CycleCount } from '../models/cycle-count.model';
import { TransferStockRequest } from '../models/transfer-stock-request.model';
import { AdjustStockRequest } from '../models/adjust-stock-request.model';
import { environment } from '../../../../environments/environment';

describe('InventoryService', () => {
  let service: InventoryService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/inventory`;

  const mockReservation: Reservation = {
    id: 1,
    partId: 10,
    partNumber: 'PN-001',
    partDescription: 'Steel Bracket',
    binContentId: 5,
    locationPath: 'Warehouse A / Aisle 1 / Bin 3',
    jobId: 42,
    jobTitle: 'Widget Build',
    jobNumber: 'JOB-042',
    salesOrderLineId: null,
    quantity: 4,
    notes: null,
    createdAt: new Date('2026-03-10T08:00:00Z'),
  };

  const mockCycleCount: CycleCount = {
    id: 1,
    locationId: 7,
    locationName: 'Bin A1',
    countedById: 1,
    countedByName: 'Alice Kim',
    countedAt: new Date('2026-03-01T08:00:00Z'),
    status: 'Open',
    notes: 'Quarterly count',
    createdAt: new Date('2026-03-01T00:00:00Z'),
    lines: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(InventoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── Reservations ─────────────────────────────────────────────────────────

  describe('getReservations', () => {
    it('should GET reservations without filters', () => {
      let result: Reservation[] = [];
      service.getReservations().subscribe((res) => { result = res; });

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/reservations`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([mockReservation]);

      expect(result.length).toBe(1);
      expect(result[0].partNumber).toBe('PN-001');
    });

    it('should include partId query param when provided', () => {
      service.getReservations(10).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/reservations`);
      expect(req.request.params.get('partId')).toBe('10');
      req.flush([]);
    });

    it('should include jobId query param when provided', () => {
      service.getReservations(undefined, 42).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/reservations`);
      expect(req.request.params.get('jobId')).toBe('42');
      req.flush([]);
    });

    it('should include both partId and jobId when both are provided', () => {
      service.getReservations(10, 42).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/reservations`);
      expect(req.request.params.get('partId')).toBe('10');
      expect(req.request.params.get('jobId')).toBe('42');
      req.flush([]);
    });
  });

  describe('createReservation', () => {
    it('should POST a new reservation and return it', () => {
      const request: CreateReservationRequest = {
        partId: 10,
        binContentId: 5,
        jobId: 42,
        quantity: 4,
        notes: 'Needed for assembly',
      };
      let result: Reservation | null = null;

      service.createReservation(request).subscribe((res) => { result = res; });

      const req = httpMock.expectOne(`${baseUrl}/reservations`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockReservation);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.quantity).toBe(4);
    });
  });

  describe('releaseReservation', () => {
    it('should DELETE the reservation by id', () => {
      let completed = false;
      service.releaseReservation(1).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/reservations/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── Cycle Counts ─────────────────────────────────────────────────────────

  describe('getCycleCounts', () => {
    it('should GET cycle counts without filters', () => {
      let result: CycleCount[] = [];
      service.getCycleCounts().subscribe((counts) => { result = counts; });

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/cycle-counts`);
      expect(req.request.method).toBe('GET');
      req.flush([mockCycleCount]);

      expect(result.length).toBe(1);
      expect(result[0].status).toBe('Open');
    });

    it('should include locationId query param when provided', () => {
      service.getCycleCounts(7).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/cycle-counts`);
      expect(req.request.params.get('locationId')).toBe('7');
      req.flush([]);
    });

    it('should include status query param when provided', () => {
      service.getCycleCounts(undefined, 'Open').subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/cycle-counts`);
      expect(req.request.params.get('status')).toBe('Open');
      req.flush([]);
    });
  });

  describe('createCycleCount', () => {
    it('should POST a new cycle count and return it', () => {
      let result: CycleCount | null = null;
      service.createCycleCount(7, 'Spot check').subscribe((count) => { result = count; });

      const req = httpMock.expectOne(`${baseUrl}/cycle-counts`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ locationId: 7, notes: 'Spot check' });
      req.flush(mockCycleCount);

      expect(result).not.toBeNull();
      expect(result!.locationId).toBe(7);
    });

    it('should POST without notes when omitted', () => {
      service.createCycleCount(7).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/cycle-counts`);
      expect(req.request.body).toEqual({ locationId: 7, notes: undefined });
      req.flush(mockCycleCount);
    });
  });

  describe('updateCycleCount', () => {
    it('should PUT the update to the correct cycle count id', () => {
      const update = { status: 'Completed', notes: 'All counted' };
      let completed = false;
      service.updateCycleCount(1, update).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/cycle-counts/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(update);
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── Stock Operations ──────────────────────────────────────────────────────

  describe('transferStock', () => {
    it('should POST a transfer request', () => {
      const request: TransferStockRequest = { sourceBinContentId: 5, destinationLocationId: 8, quantity: 2, notes: 'Relocation' };
      let completed = false;
      service.transferStock(request).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/transfer`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  describe('adjustStock', () => {
    it('should POST an adjust request', () => {
      const request: AdjustStockRequest = { binContentId: 5, newQuantity: 10, reason: 'Count', notes: 'Physical count' };
      let completed = false;
      service.adjustStock(request).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/adjust`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── Receiving ─────────────────────────────────────────────────────────────

  describe('getReceivingHistory', () => {
    it('should GET receiving history with take defaulting to 50', () => {
      service.getReceivingHistory().subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/receiving-history`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('take')).toBe('50');
      req.flush([]);
    });

    it('should include purchaseOrderId when provided', () => {
      service.getReceivingHistory(7).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/receiving-history`);
      expect(req.request.params.get('purchaseOrderId')).toBe('7');
      req.flush([]);
    });

    it('should include partId when provided', () => {
      service.getReceivingHistory(undefined, 10).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/receiving-history`);
      expect(req.request.params.get('partId')).toBe('10');
      req.flush([]);
    });
  });

  // ── Locations ─────────────────────────────────────────────────────────────

  describe('getLocationTree', () => {
    it('should GET the full location tree', () => {
      service.getLocationTree().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/locations`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getBinLocations', () => {
    it('should GET the flat bin locations list', () => {
      service.getBinLocations().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/locations/bins`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });
});
