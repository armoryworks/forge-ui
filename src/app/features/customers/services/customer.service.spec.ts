import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CustomerService } from './customer.service';
import { environment } from '../../../../environments/environment';

describe('CustomerService', () => {
  let service: CustomerService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/customers`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CustomerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getCustomers ──────────────────────────────────────────────────────────

  describe('getCustomers', () => {
    it('should GET customers without filters', () => {
      let result: unknown[] = [];
      service.getCustomers().subscribe((items) => { result = items; });

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([{ id: 1, name: 'Acme Corp' }]);

      expect(result.length).toBe(1);
    });

    it('should include search and isActive query params when provided', () => {
      service.getCustomers('acme', true).subscribe();

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.params.get('search')).toBe('acme');
      expect(req.request.params.get('isActive')).toBe('true');
      req.flush([]);
    });
  });

  // ── getCustomerById ───────────────────────────────────────────────────────

  describe('getCustomerById', () => {
    it('should GET customer detail by id', () => {
      const mockCustomer = { id: 1, name: 'Acme Corp', email: 'info@acme.com' };
      let result: unknown = null;

      service.getCustomerById(1).subscribe((c) => { result = c; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockCustomer);

      expect(result).toEqual(mockCustomer);
    });
  });

  // ── createCustomer ────────────────────────────────────────────────────────

  describe('createCustomer', () => {
    it('should POST a new customer and return the list item', () => {
      const request = { name: 'New Corp', email: 'new@corp.com' } as any;
      const mockResponse = { id: 2, name: 'New Corp' };
      let result: unknown = null;

      service.createCustomer(request).subscribe((c) => { result = c; });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── updateCustomer ────────────────────────────────────────────────────────

  describe('updateCustomer', () => {
    it('should PUT updated customer fields', () => {
      const request = { name: 'Updated Corp' } as any;
      let completed = false;

      service.updateCustomer(1, request).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── deleteCustomer ────────────────────────────────────────────────────────

  describe('deleteCustomer', () => {
    it('should DELETE the specified customer', () => {
      let completed = false;
      service.deleteCustomer(1).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── createContact ─────────────────────────────────────────────────────────

  describe('createContact', () => {
    it('should POST a new contact for the customer', () => {
      const request = { firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com' } as any;
      const mockResponse = { id: 1, firstName: 'Jane', lastName: 'Doe' };
      let result: unknown = null;

      service.createContact(1, request).subscribe((c) => { result = c; });

      const req = httpMock.expectOne(`${baseUrl}/1/contacts`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── deleteContact ─────────────────────────────────────────────────────────

  describe('deleteContact', () => {
    it('should DELETE the specified contact', () => {
      let completed = false;
      service.deleteContact(1, 5).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1/contacts/5`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });
});
