import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { InvoiceService } from './invoice.service';
import { environment } from '../../../../environments/environment';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/invoices`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvoiceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getInvoices', () => {
    it('should GET invoices without filters', () => {
      service.getInvoices().subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should pass customerId filter', () => {
      service.getInvoices(5).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('customerId')).toBe('5');
      req.flush([]);
    });

    it('should pass status filter', () => {
      service.getInvoices(undefined, 'Sent').subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('status')).toBe('Sent');
      req.flush([]);
    });

    it('should pass both filters', () => {
      service.getInvoices(3, 'Draft').subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('customerId')).toBe('3');
      expect(req.request.params.get('status')).toBe('Draft');
      req.flush([]);
    });
  });

  describe('getInvoiceById', () => {
    it('should GET invoice detail', () => {
      service.getInvoiceById(10).subscribe();
      const req = httpMock.expectOne(`${base}/10`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 10 });
    });
  });

  describe('createInvoice', () => {
    it('should POST new invoice', () => {
      const body = { customerId: 1, lines: [] } as any;
      service.createInvoice(body).subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('sendInvoice', () => {
    it('should POST send action', () => {
      service.sendInvoice(7).subscribe();
      const req = httpMock.expectOne(`${base}/7/send`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('voidInvoice', () => {
    it('should POST void action', () => {
      service.voidInvoice(8).subscribe();
      const req = httpMock.expectOne(`${base}/8/void`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('deleteInvoice', () => {
    it('should DELETE invoice', () => {
      service.deleteInvoice(9).subscribe();
      const req = httpMock.expectOne(`${base}/9`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getUninvoicedJobs', () => {
    it('should GET uninvoiced jobs', () => {
      service.getUninvoicedJobs().subscribe();
      const req = httpMock.expectOne(`${base}/uninvoiced-jobs`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createInvoiceFromJob', () => {
    it('should POST invoice creation from job', () => {
      service.createInvoiceFromJob(42).subscribe();
      const req = httpMock.expectOne(`${base}/from-job/42`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 1 });
    });
  });

  describe('getQueueSettings', () => {
    it('should GET queue settings', () => {
      service.getQueueSettings().subscribe();
      const req = httpMock.expectOne(`${base}/queue-settings`);
      expect(req.request.method).toBe('GET');
      req.flush({ mode: 'auto', assignedUserId: null });
    });
  });

  describe('updateQueueSettings', () => {
    it('should PUT queue settings', () => {
      service.updateQueueSettings('manual', 5).subscribe();
      const req = httpMock.expectOne(`${base}/queue-settings`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ mode: 'manual', assignedUserId: 5 });
      req.flush(null);
    });
  });
});
