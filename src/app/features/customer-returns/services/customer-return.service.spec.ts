import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CustomerReturnService } from './customer-return.service';
import { environment } from '../../../../environments/environment';

describe('CustomerReturnService', () => {
  let service: CustomerReturnService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CustomerReturnService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getReturns', () => {
    it('should GET returns list without params', () => {
      service.getReturns().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET returns with customerId param', () => {
      service.getReturns(8).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns?customerId=8`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET returns with status param', () => {
      service.getReturns(undefined, 'Open').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns?status=Open`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET returns with both params', () => {
      service.getReturns(2, 'Resolved').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns?customerId=2&status=Resolved`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getById', () => {
    it('should GET return by id', () => {
      service.getById(5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns/5`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 5 });
    });
  });

  describe('create', () => {
    it('should POST new customer return', () => {
      const body = { customerId: 1, originalJobId: 10, reason: 'Defect', returnDate: '2026-04-16T00:00:00Z' };
      service.create(body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('update', () => {
    it('should PUT return update', () => {
      const body = { reason: 'Wrong spec', notes: 'Customer contacted' };
      service.update(3, body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns/3`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 3 });
    });
  });

  describe('resolve', () => {
    it('should POST resolve with inspection notes', () => {
      service.resolve(4, 'Inspected and approved').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns/4/resolve`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ inspectionNotes: 'Inspected and approved' });
      req.flush({ id: 4 });
    });

    it('should POST resolve without inspection notes', () => {
      service.resolve(4).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns/4/resolve`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ inspectionNotes: undefined });
      req.flush({ id: 4 });
    });
  });

  describe('close', () => {
    it('should POST close return', () => {
      service.close(6).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/customer-returns/6/close`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ id: 6 });
    });
  });
});
