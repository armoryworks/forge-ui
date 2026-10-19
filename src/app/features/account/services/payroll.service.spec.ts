import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PayrollService } from './payroll.service';
import { environment } from '../../../../environments/environment';

describe('PayrollService', () => {
  let service: PayrollService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/payroll`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PayrollService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('loadMyPayStubs', () => {
    it('should GET pay stubs and update signal', () => {
      const mockStubs = [{ id: 1, grossPay: 2000 }];
      service.loadMyPayStubs();
      const req = httpMock.expectOne(`${base}/pay-stubs/me`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStubs);
      expect(service.payStubs()).toEqual(mockStubs as any);
    });
  });

  describe('loadMyTaxDocuments', () => {
    it('should GET tax documents and update signal', () => {
      const mockDocs = [{ id: 1, documentType: 'W2' }];
      service.loadMyTaxDocuments();
      const req = httpMock.expectOne(`${base}/tax-documents/me`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDocs);
      expect(service.taxDocuments()).toEqual(mockDocs as any);
    });
  });

  describe('downloadPayStubPdf', () => {
    it('should GET the PDF as a blob through HttpClient so the bearer token is sent', () => {
      const blob = new Blob(['%PDF'], { type: 'application/pdf' });
      let received: Blob | undefined;
      service.downloadPayStubPdf(5).subscribe(b => (received = b));
      const req = httpMock.expectOne(`${base}/pay-stubs/5/pdf`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(blob);
      expect(received).toBe(blob);
    });
  });

  describe('downloadTaxDocumentPdf', () => {
    it('should GET the PDF as a blob through HttpClient so the bearer token is sent', () => {
      service.downloadTaxDocumentPdf(8).subscribe();
      const req = httpMock.expectOne(`${base}/tax-documents/8/pdf`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['%PDF']));
    });
  });

  describe('getUserPayStubs', () => {
    it('should GET pay stubs for a specific user', () => {
      service.getUserPayStubs(42).subscribe();
      const req = httpMock.expectOne(`${base}/pay-stubs/users/42`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getUserTaxDocuments', () => {
    it('should GET tax documents for a specific user', () => {
      service.getUserTaxDocuments(42).subscribe();
      const req = httpMock.expectOne(`${base}/tax-documents/users/42`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('uploadPayStub', () => {
    it('should POST pay stub for user', () => {
      const request = {
        payPeriodStart: '2026-01-01T00:00:00Z',
        payPeriodEnd: '2026-01-15T00:00:00Z',
        payDate: '2026-01-20T00:00:00Z',
        grossPay: 3000,
        netPay: 2200,
        fileAttachmentId: 10,
      };
      service.uploadPayStub(5, request).subscribe();
      const req = httpMock.expectOne(`${base}/pay-stubs/users/5`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ id: 1 });
    });
  });

  describe('uploadTaxDocument', () => {
    it('should POST tax document for user', () => {
      const request = { documentType: 'W2', taxYear: 2025, fileAttachmentId: 20 };
      service.uploadTaxDocument(5, request).subscribe();
      const req = httpMock.expectOne(`${base}/tax-documents/users/5`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ id: 1 });
    });
  });

  describe('deletePayStub', () => {
    it('should DELETE pay stub', () => {
      service.deletePayStub(3).subscribe();
      const req = httpMock.expectOne(`${base}/pay-stubs/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('deleteTaxDocument', () => {
    it('should DELETE tax document', () => {
      service.deleteTaxDocument(7).subscribe();
      const req = httpMock.expectOne(`${base}/tax-documents/7`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('syncPayroll', () => {
    it('should POST payroll sync', () => {
      service.syncPayroll().subscribe();
      const req = httpMock.expectOne(`${base}/sync`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });
});
