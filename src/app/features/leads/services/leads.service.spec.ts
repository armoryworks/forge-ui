import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { LeadsService } from './leads.service';
import { environment } from '../../../../environments/environment';

describe('LeadsService', () => {
  let service: LeadsService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/leads`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(LeadsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getLeads ──────────────────────────────────────────────────────────────

  describe('getLeads', () => {
    it('should GET leads without filters', () => {
      let result: unknown[] = [];
      service.getLeads().subscribe((items) => { result = items; });

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([{ id: 1, companyName: 'Acme Corp', status: 'New' }]);

      expect(result.length).toBe(1);
    });

    it('should include status and search query params when provided', () => {
      service.getLeads('Qualified' as any, 'acme').subscribe();

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.params.get('status')).toBe('Qualified');
      expect(req.request.params.get('search')).toBe('acme');
      req.flush([]);
    });
  });

  // ── getLeadById ───────────────────────────────────────────────────────────

  describe('getLeadById', () => {
    it('should GET lead by id', () => {
      const mockLead = { id: 1, companyName: 'Acme Corp', status: 'New' };
      let result: unknown = null;

      service.getLeadById(1).subscribe((lead) => { result = lead; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockLead);

      expect(result).toEqual(mockLead);
    });
  });

  // ── createLead ────────────────────────────────────────────────────────────

  describe('createLead', () => {
    it('should POST a new lead and return it', () => {
      const request = { companyName: 'New Co', contactName: 'John', source: 'Web' } as any;
      const mockResponse = { id: 2, companyName: 'New Co', status: 'New' };
      let result: unknown = null;

      service.createLead(request).subscribe((lead) => { result = lead; });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── updateLead ────────────────────────────────────────────────────────────

  describe('updateLead', () => {
    it('should PATCH the lead with updated fields', () => {
      const request = { companyName: 'Updated Co' } as any;
      const mockResponse = { id: 1, companyName: 'Updated Co', status: 'New' };
      let result: unknown = null;

      service.updateLead(1, request).subscribe((lead) => { result = lead; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── convertLead ───────────────────────────────────────────────────────────

  describe('convertLead', () => {
    it('should POST the request body to convert endpoint', () => {
      const mockResult = { customerId: 10, jobId: 20 };
      let result: unknown = null;

      service.convertLead(1, { createJob: true }).subscribe((r) => { result = r; });

      const req = httpMock.expectOne(`${baseUrl}/1/convert`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ createJob: true });
      req.flush(mockResult);

      expect(result).toEqual(mockResult);
    });

    it('should send the full richer payload when populated by the stepper', () => {
      service.convertLead(1, {
        createJob: false,
        creditLimit: 50000,
        isTaxExempt: true,
        taxExemptionId: 'EX-1',
        defaultCurrency: 'USD',
        billingAddress: {
          street: '100 Main', city: 'Boston', state: 'MA', postal: '02108', country: 'US',
        },
      }).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/1/convert`);
      expect(req.request.body.creditLimit).toBe(50000);
      expect(req.request.body.isTaxExempt).toBe(true);
      expect(req.request.body.billingAddress.street).toBe('100 Main');
      req.flush({});
    });
  });

  // ── documents ────────────────────────────────────────────────────────────────────

  describe('documents', () => {
    it('should GET the lead file list from the shared files API', () => {
      service.getDocuments(4).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/4/files`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should DELETE a file by id', () => {
      service.deleteFile(9).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/files/9`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should build the download URL for a file', () => {
      expect(service.downloadFileUrl(9)).toBe(`${environment.apiUrl}/files/9/download`);
    });
  });

  // ── deleteLead ────────────────────────────────────────────────────────────

  describe('deleteLead', () => {
    it('should DELETE the specified lead', () => {
      let completed = false;
      service.deleteLead(1).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });
});
