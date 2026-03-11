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
    it('should POST to convert endpoint with createJob param', () => {
      const mockResult = { customerId: 10, jobId: 20 };
      let result: unknown = null;

      service.convertLead(1, true).subscribe((r) => { result = r; });

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/1/convert`);
      expect(req.request.method).toBe('POST');
      expect(req.request.params.get('createJob')).toBe('true');
      expect(req.request.body).toBeNull();
      req.flush(mockResult);

      expect(result).toEqual(mockResult);
    });

    it('should not include createJob param when false', () => {
      service.convertLead(1, false).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/1/convert`);
      expect(req.request.params.has('createJob')).toBe(false);
      req.flush({});
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
