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

  // Phase 3 F7-broad / WU-22 — getInvoices() now goes through the paged
  // endpoint and unwraps the envelope.
  describe('getOpenInvoices', () => {
    it('asks the server for the customer\'s open invoices, oldest due first', () => {
      let result: unknown[] = [];
      service.getOpenInvoices(5).subscribe(items => { result = items; });
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('customerId')).toBe('5');
      expect(req.request.params.get('openOnly')).toBe('true');
      expect(req.request.params.get('sort')).toBe('dueDate');
      expect(req.request.params.get('order')).toBe('asc');
      req.flush({ items: [{ id: 1 }], totalCount: 1, page: 1, pageSize: 200 });
      expect(result).toHaveLength(1);
    });
  });

  describe('getInvoices', () => {
    const empty = { items: [], totalCount: 0, page: 1, pageSize: 200 };

    it('should not send openOnly', () => {
      service.getInvoices(5).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.has('openOnly')).toBe(false);
      req.flush(empty);
    });

    it('should GET invoices without filters', () => {
      service.getInvoices().subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('pageSize')).toBe('200');
      req.flush(empty);
    });

    it('should pass customerId filter', () => {
      service.getInvoices(5).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('customerId')).toBe('5');
      req.flush(empty);
    });

    it('should pass status filter', () => {
      service.getInvoices(undefined, 'Sent').subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('status')).toBe('Sent');
      req.flush(empty);
    });

    it('should pass both filters', () => {
      service.getInvoices(3, 'Draft').subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('customerId')).toBe('3');
      expect(req.request.params.get('status')).toBe('Draft');
      req.flush(empty);
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

  describe('getInvoiceSources', () => {
    it('should GET the customer\'s invoice sources', () => {
      service.getInvoiceSources(7).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/sources`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('customerId')).toBe('7');
      req.flush({ salesOrders: [], shipments: [] });
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

  describe('getInvoicePdf', () => {
    it('GETs the invoice PDF as a blob', () => {
      let received: Blob | undefined;
      service.getInvoicePdf(12).subscribe((b) => (received = b));
      const req = httpMock.expectOne(`${base}/12/pdf`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
      expect(received).toBeInstanceOf(Blob);
    });
  });
  describe('concurrency and email', () => {
    it('sends If-Match with the version on rename and delete', () => {
      service.renameInvoiceNumber(7, 'INV-0100', 4).subscribe();
      const rename = httpMock.expectOne(`${base}/7/number`);
      expect(rename.request.method).toBe('PATCH');
      expect(rename.request.headers.get('If-Match')).toBe('"4"');
      rename.flush(null);

      service.deleteInvoice(7, 4).subscribe();
      const del = httpMock.expectOne(`${base}/7`);
      expect(del.request.method).toBe('DELETE');
      expect(del.request.headers.get('If-Match')).toBe('"4"');
      del.flush(null);
    });

    it('sends no If-Match when no version is known', () => {
      service.deleteInvoice(7).subscribe();
      const del = httpMock.expectOne(`${base}/7`);
      expect(del.request.headers.has('If-Match')).toBe(false);
      del.flush(null);
    });

    it('reads the default recipient and posts the email', () => {
      service.getEmailRecipient(7).subscribe();
      httpMock.expectOne(`${base}/7/email-recipient`).flush({ email: 'ap@buyer.test', source: 'customer', contactName: null });

      service.emailInvoice(7, { recipientEmail: 'ap@buyer.test' }).subscribe();
      const post = httpMock.expectOne(`${base}/7/email`);
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({ recipientEmail: 'ap@buyer.test' });
      post.flush(null);
    });
  });
});
