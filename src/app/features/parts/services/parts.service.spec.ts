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

  // ── getParts ──────────────────────────────────────────────────────────────

  describe('getParts', () => {
    it('should GET parts without filters', () => {
      let result: unknown[] = [];
      service.getParts().subscribe((items) => { result = items; });

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([{ id: 1, partNumber: 'P-001' }]);

      expect(result.length).toBe(1);
    });

    it('should include status and type query params when provided', () => {
      service.getParts('Active', 'Part', 'widget').subscribe();

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.params.get('status')).toBe('Active');
      expect(req.request.params.get('type')).toBe('Part');
      expect(req.request.params.get('search')).toBe('widget');
      req.flush([]);
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

  // ── createBOMEntry ────────────────────────────────────────────────────────

  describe('createBOMEntry', () => {
    it('should POST a new BOM entry for the part', () => {
      const request = { childPartId: 5, quantity: 3 } as any;
      const mockResponse = { id: 1, partNumber: 'P-001', bomEntries: [] };
      let result: unknown = null;

      service.createBOMEntry(1, request).subscribe((p) => { result = p; });

      const req = httpMock.expectOne(`${baseUrl}/1/bom`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).not.toBeNull();
    });
  });
});
