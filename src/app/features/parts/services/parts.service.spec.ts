import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PartsService } from './parts.service';
import { environment } from '../../../../environments/environment';

describe('PartsService', () => {
  let service: PartsService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/parts`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PartsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getPartsPaged', () => {
    it('should send status, search, paging and sort params when provided', () => {
      service.getPartsPaged({ status: 'Active', q: 'widget', page: 3, pageSize: 25, sort: 'partNumber', order: 'asc' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('status')).toBe('Active');
      expect(req.request.params.get('q')).toBe('widget');
      expect(req.request.params.get('page')).toBe('3');
      expect(req.request.params.get('pageSize')).toBe('25');
      expect(req.request.params.get('sort')).toBe('partNumber');
      expect(req.request.params.get('order')).toBe('asc');
      expect(req.request.params.has('purchasable')).toBe(false);
      req.flush({ items: [], totalCount: 0, page: 3, pageSize: 25 });
    });

    it('should send the purchasable filter, including false', () => {
      service.getPartsPaged({ purchasable: true }).subscribe();
      httpMock.expectOne((r) => r.url === baseUrl && r.params.get('purchasable') === 'true')
        .flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });

      service.getPartsPaged({ purchasable: false }).subscribe();
      httpMock.expectOne((r) => r.url === baseUrl && r.params.get('purchasable') === 'false')
        .flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    });
  });

  // ── getPartById ───────────────────────────────────────────────────────────

  describe('getPartById', () => {
    it('should GET part detail by id', () => {
      const mockPart = { id: 1, partNumber: 'P-001', description: 'Widget' };
      let result: unknown = null;

      service.getPartById(1).subscribe((p) => { result = p; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockPart);

      expect(result).toEqual(mockPart);
    });
  });

  // ── createPart ────────────────────────────────────────────────────────────

  describe('createPart', () => {
    it('should POST a new part and return the detail', () => {
      const request = { partNumber: 'P-002', description: 'Gadget', type: 'Manufactured' } as any;
      const mockResponse = { id: 2, partNumber: 'P-002', description: 'Gadget' };
      let result: unknown = null;

      service.createPart(request).subscribe((p) => { result = p; });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('clonePart', () => {
    it('should POST the clone options to the source part and return the new detail', () => {
      const request = { name: 'Valve body', copyBom: true, copyRouting: true, copyVendorSources: false };
      const mockResponse = { id: 9, partNumber: 'ASM-00009', name: 'Valve body' };
      let result: unknown = null;

      service.clonePart(4, request).subscribe((p) => { result = p; });

      const req = httpMock.expectOne(`${baseUrl}/4/clone`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── updatePart ────────────────────────────────────────────────────────────

  describe('updatePart', () => {
    it('should PATCH the part with updated fields', () => {
      const request = { description: 'Updated Gadget' } as any;
      const mockResponse = { id: 2, partNumber: 'P-002', description: 'Updated Gadget' };
      let result: unknown = null;

      service.updatePart(2, request).subscribe((p) => { result = p; });

      const req = httpMock.expectOne(`${baseUrl}/2`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── deletePart ────────────────────────────────────────────────────────────

  describe('deletePart', () => {
    it('should DELETE the specified part', () => {
      let completed = false;
      service.deletePart(2).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/2`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── getRevisions ──────────────────────────────────────────────────────────

  describe('getRevisions', () => {
    it('should GET revisions for a part', () => {
      const mockRevisions = [{ id: 1, revisionCode: 'A', description: 'Initial' }];
      let result: unknown[] = [];

      service.getRevisions(1).subscribe((revs) => { result = revs; });

      const req = httpMock.expectOne(`${baseUrl}/1/revisions`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRevisions);

      expect(result.length).toBe(1);
    });
  });

  // ── createBOMLine ────────────────────────────────────────────────────────

  describe('createBOMLine', () => {
    it('should POST a new BOM line for the part', () => {
      const request = { childPartId: 5, quantity: 3 } as any;
      const mockResponse = { id: 1, partNumber: 'P-001', bomLines: [] };
      let result: unknown = null;

      service.createBOMLine(1, request).subscribe((p) => { result = p; });

      const req = httpMock.expectOne(`${baseUrl}/1/bom`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).not.toBeNull();
    });
  });
});
