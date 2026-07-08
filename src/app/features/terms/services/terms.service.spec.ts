import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TermsService } from './terms.service';
import { environment } from '../../../../environments/environment';
import { CreateTermsDocumentRequest } from '../models/create-terms-document-request.model';
import { UpdateTermsDocumentRequest } from '../models/update-terms-document-request.model';

describe('TermsService', () => {
  let service: TermsService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/terms`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TermsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('list', () => {
    it('should GET the terms list with no params when no filters given', () => {
      service.list().subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });

    it('should pass scope + customerId + isActive filters', () => {
      service.list({ scope: 'Customer', customerId: 42, isActive: true }).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('scope')).toBe('Customer');
      expect(req.request.params.get('customerId')).toBe('42');
      expect(req.request.params.get('isActive')).toBe('true');
      req.flush([]);
    });

    it('should pass partId filter for part scope', () => {
      service.list({ scope: 'Part', partId: 7 }).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('scope')).toBe('Part');
      expect(req.request.params.get('partId')).toBe('7');
      req.flush([]);
    });
  });

  describe('create', () => {
    it('should POST a new terms document', () => {
      const body: CreateTermsDocumentRequest = {
        scope: 'Company',
        title: 'Standard Terms',
        bodyMarkdown: '# Terms',
        effectiveFrom: '2026-01-01T00:00:00Z',
        isActive: true,
        sortOrder: 0,
      };
      service.create(body).subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('update', () => {
    it('should PUT an existing terms document by id', () => {
      const body: UpdateTermsDocumentRequest = {
        scope: 'Company',
        title: 'Updated',
        bodyMarkdown: '# Updated',
        effectiveFrom: '2026-01-01T00:00:00Z',
        isActive: true,
        sortOrder: 1,
      };
      service.update(9, body).subscribe();
      const req = httpMock.expectOne(`${base}/9`);
      expect(req.request.method).toBe('PUT');
      req.flush({ id: 9 });
    });
  });

  describe('delete', () => {
    it('should DELETE a terms document by id', () => {
      service.delete(5).subscribe();
      const req = httpMock.expectOne(`${base}/5`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
