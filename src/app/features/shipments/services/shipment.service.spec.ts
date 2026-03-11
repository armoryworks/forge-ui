import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ShipmentService } from './shipment.service';
import { ShipmentListItem } from '../models/shipment-list-item.model';
import { ShipmentDetail } from '../models/shipment-detail.model';
import { ShippingRate } from '../models/shipping-rate.model';
import { ShippingLabel } from '../models/shipping-label.model';
import { ShipmentTracking } from '../models/shipment-tracking.model';
import { ShipmentPackage } from '../models/shipment-package.model';
import { environment } from '../../../../environments/environment';

describe('ShipmentService', () => {
  let service: ShipmentService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/shipments`;

  const mockShipmentListItem: ShipmentListItem = {
    id: 1,
    shipmentNumber: 'SHIP-001',
    status: 'Pending',
    carrier: 'FedEx',
    trackingNumber: null,
    shippedDate: null,
    salesOrderId: 10,
    salesOrderNumber: 'SO-010',
    customerName: 'Acme Corp',
    createdAt: '2026-03-10T08:00:00Z',
  };

  const mockShipmentDetail: ShipmentDetail = {
    id: 1,
    shipmentNumber: 'SHIP-001',
    status: 'Pending',
    carrier: 'FedEx',
    trackingNumber: null,
    shippedDate: null,
    deliveredDate: null,
    shippingCost: null,
    weight: null,
    notes: null,
    shippingAddressId: null,
    invoiceId: null,
    salesOrderId: 10,
    salesOrderNumber: 'SO-010',
    customerName: 'Acme Corp',
    lines: [],
    createdAt: '2026-03-10T08:00:00Z',
    updatedAt: '2026-03-10T08:00:00Z',
  };

  const mockRates: ShippingRate[] = [
    { carrierId: 'fedex', carrierName: 'FedEx', serviceName: 'Ground', price: 9.99, estimatedDays: 5 },
    { carrierId: 'ups', carrierName: 'UPS', serviceName: 'Next Day Air', price: 39.99, estimatedDays: 1 },
    { carrierId: 'usps', carrierName: 'USPS', serviceName: 'Priority Mail', price: 7.49, estimatedDays: 3 },
  ];

  const mockLabel: ShippingLabel = {
    trackingNumber: '1Z999AA10123456784',
    labelUrl: 'https://storage/labels/SHIP-001.pdf',
    carrierName: 'UPS',
  };

  const mockTracking: ShipmentTracking = {
    trackingNumber: '1Z999AA10123456784',
    status: 'In Transit',
    estimatedDelivery: '2026-03-15T18:00:00Z',
    events: [
      { description: 'Package picked up', timestamp: '2026-03-10T14:00:00Z', location: 'Detroit, MI' },
    ],
  };

  const mockPackage: ShipmentPackage = {
    id: 1,
    shipmentId: 1,
    trackingNumber: null,
    carrier: null,
    weight: 2.5,
    length: 12,
    width: 8,
    height: 6,
    status: 'Pending',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ShipmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── List + Detail ─────────────────────────────────────────────────────────

  describe('getShipments', () => {
    it('should GET shipments without filters', () => {
      let result: ShipmentListItem[] = [];
      service.getShipments().subscribe((items) => { result = items; });

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([mockShipmentListItem]);

      expect(result.length).toBe(1);
      expect(result[0].shipmentNumber).toBe('SHIP-001');
    });

    it('should include salesOrderId query param when provided', () => {
      service.getShipments(10).subscribe();

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.params.get('salesOrderId')).toBe('10');
      req.flush([]);
    });

    it('should include status query param when provided', () => {
      service.getShipments(undefined, 'Shipped').subscribe();

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.params.get('status')).toBe('Shipped');
      req.flush([]);
    });

    it('should include both salesOrderId and status when both are provided', () => {
      service.getShipments(10, 'Pending').subscribe();

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.params.get('salesOrderId')).toBe('10');
      expect(req.request.params.get('status')).toBe('Pending');
      req.flush([]);
    });
  });

  describe('getShipmentById', () => {
    it('should GET the shipment detail by id', () => {
      let result: ShipmentDetail | null = null;
      service.getShipmentById(1).subscribe((detail) => { result = detail; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockShipmentDetail);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.shipmentNumber).toBe('SHIP-001');
    });
  });

  describe('createShipment', () => {
    it('should POST a new shipment and return the detail', () => {
      const request = { salesOrderId: 10, carrier: 'FedEx', shipToAddressId: 5 };
      let result: ShipmentDetail | null = null;

      service.createShipment(request as any).subscribe((detail) => { result = detail; });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockShipmentDetail);

      expect(result).not.toBeNull();
      expect(result!.salesOrderId).toBe(10);
    });
  });

  describe('updateShipment', () => {
    it('should PUT the update fields to the shipment endpoint', () => {
      const update = { carrier: 'UPS', trackingNumber: '1Z999AA10123456784', shippingCost: 39.99 };
      let completed = false;

      service.updateShipment(1, update).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(update);
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  describe('shipShipment', () => {
    it('should POST to the ship action endpoint', () => {
      let completed = false;
      service.shipShipment(1).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1/ship`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  describe('deliverShipment', () => {
    it('should POST to the deliver action endpoint', () => {
      let completed = false;
      service.deliverShipment(1).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1/deliver`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── Shipping Rates ────────────────────────────────────────────────────────

  describe('getRates (getShippingRates)', () => {
    it('should GET available shipping rates for the given shipment', () => {
      let result: ShippingRate[] = [];
      service.getRates(1).subscribe((rates) => { result = rates; });

      const req = httpMock.expectOne(`${baseUrl}/1/rates`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRates);

      expect(result.length).toBe(3);
      expect(result[0].carrierId).toBe('fedex');
      expect(result[1].estimatedDays).toBe(1);
    });

    it('should return an empty array when no rates are available', () => {
      let result: ShippingRate[] = [];
      service.getRates(1).subscribe((rates) => { result = rates; });

      const req = httpMock.expectOne(`${baseUrl}/1/rates`);
      req.flush([]);

      expect(result).toEqual([]);
    });
  });

  // ── Shipping Label ────────────────────────────────────────────────────────

  describe('createLabel (createShippingLabel)', () => {
    it('should POST carrier and service name and return the label', () => {
      let result: ShippingLabel | null = null;

      service.createLabel(1, 'ups', 'Next Day Air').subscribe((label) => { result = label; });

      const req = httpMock.expectOne(`${baseUrl}/1/label`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ carrierId: 'ups', serviceName: 'Next Day Air' });
      req.flush(mockLabel);

      expect(result).not.toBeNull();
      expect(result!.trackingNumber).toBe('1Z999AA10123456784');
      expect(result!.carrierName).toBe('UPS');
      expect(result!.labelUrl).toContain('SHIP-001');
    });
  });

  // ── Tracking ─────────────────────────────────────────────────────────────

  describe('getTracking (getShipmentTracking)', () => {
    it('should GET tracking info for the given shipment', () => {
      let result: ShipmentTracking | null = null;
      service.getTracking(1).subscribe((tracking) => { result = tracking; });

      const req = httpMock.expectOne(`${baseUrl}/1/tracking`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTracking);

      expect(result).not.toBeNull();
      expect(result!.trackingNumber).toBe('1Z999AA10123456784');
      expect(result!.status).toBe('In Transit');
      expect(result!.events.length).toBe(1);
      expect(result!.events[0].location).toBe('Detroit, MI');
    });

    it('should handle a shipment with no tracking events yet', () => {
      let result: ShipmentTracking | null = null;
      service.getTracking(2).subscribe((tracking) => { result = tracking; });

      const req = httpMock.expectOne(`${baseUrl}/2/tracking`);
      req.flush({ trackingNumber: 'PENDING', status: 'Label Created', estimatedDelivery: null, events: [] });

      expect(result!.events).toEqual([]);
      expect(result!.estimatedDelivery).toBeNull();
    });
  });

  // ── Packages ─────────────────────────────────────────────────────────────

  describe('getPackages', () => {
    it('should GET all packages for the given shipment', () => {
      let result: ShipmentPackage[] = [];
      service.getPackages(1).subscribe((packages) => { result = packages; });

      const req = httpMock.expectOne(`${baseUrl}/1/packages`);
      expect(req.request.method).toBe('GET');
      req.flush([mockPackage]);

      expect(result.length).toBe(1);
      expect(result[0].weight).toBe(2.5);
    });
  });

  describe('addPackage', () => {
    it('should POST a new package and return it', () => {
      const request = { weight: 2.5, length: 12, width: 8, height: 6 };
      let result: ShipmentPackage | null = null;

      service.addPackage(1, request as any).subscribe((pkg) => { result = pkg; });

      const req = httpMock.expectOne(`${baseUrl}/1/packages`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockPackage);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
    });
  });

  describe('updatePackage', () => {
    it('should PATCH the package with updated fields', () => {
      const update = { status: 'Packed', weight: 3.0 };
      let result: ShipmentPackage | null = null;

      service.updatePackage(1, 1, update).subscribe((pkg) => { result = pkg; });

      const req = httpMock.expectOne(`${baseUrl}/1/packages/1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(update);
      req.flush({ ...mockPackage, status: 'Packed', weight: 3.0 });

      expect(result!.status).toBe('Packed');
    });
  });

  describe('removePackage', () => {
    it('should DELETE the specified package', () => {
      let completed = false;
      service.removePackage(1, 1).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1/packages/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });
});
