import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CustomerTaxDocumentService } from './customer-tax-document.service';
import { environment } from '../../../../environments/environment';
import { CustomerTaxDocument } from '../models/customer-tax-document.model';
import { CreateCustomerTaxDocumentRequest } from '../models/create-customer-tax-document-request.model';

describe('CustomerTaxDocumentService', () => {
  let service: CustomerTaxDocumentService;
  let httpMock: HttpTestingController;

  const customersBase = `${environment.apiUrl}/customers`;
  const documentsBase = `${environment.apiUrl}/customer-tax-documents`;

  const mockDocument: CustomerTaxDocument = {
    id: 5,
    fileAttachmentId: 10,
    fileName: 'resale-cert.pdf',
    stateCode: 'CA',
    certificateType: 'Resale',
    certificateNumber: 'CERT-123',
    status: 'Pending',
    verifiedAt: null,
    verifiedByName: null,
    expirationDate: '2027-01-01T00:00:00Z',
    rejectionReason: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CustomerTaxDocumentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getTaxDocuments', () => {
    it('should GET the tax document list for the customer', () => {
      let result: CustomerTaxDocument[] = [];
      service.getTaxDocuments(1).subscribe((items) => { result = items; });

      const req = httpMock.expectOne(`${customersBase}/1/tax-documents`);
      expect(req.request.method).toBe('GET');
      req.flush([mockDocument]);

      expect(result.length).toBe(1);
      expect(result[0].fileName).toBe('resale-cert.pdf');
    });
  });

  describe('createTaxDocument', () => {
    it('should POST the metadata linking an uploaded file', () => {
      const request: CreateCustomerTaxDocumentRequest = {
        fileAttachmentId: 10,
        stateCode: 'CA',
        certificateType: 'Resale',
        certificateNumber: 'CERT-123',
        expirationDate: '2027-01-01T00:00:00Z',
      };
      let result: CustomerTaxDocument | null = null;

      service.createTaxDocument(1, request).subscribe((d) => { result = d; });

      const req = httpMock.expectOne(`${customersBase}/1/tax-documents`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockDocument);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(5);
    });
  });

  describe('verifyTaxDocument', () => {
    it('should POST to the verify endpoint', () => {
      let completed = false;
      service.verifyTaxDocument(5).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${documentsBase}/5/verify`);
      expect(req.request.method).toBe('POST');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  describe('rejectTaxDocument', () => {
    it('should POST the rejection reason', () => {
      let completed = false;
      service.rejectTaxDocument(5, 'Illegible scan').subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${documentsBase}/5/reject`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ reason: 'Illegible scan' });
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  describe('deleteTaxDocument', () => {
    it('should DELETE the specified document', () => {
      let completed = false;
      service.deleteTaxDocument(5).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${documentsBase}/5`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });
});
