import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { QuoteService } from './quote.service';
import { environment } from '../../../../environments/environment';

describe('QuoteService', () => {
  let service: QuoteService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(QuoteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getQuotes', () => {
    it('should GET quotes list', () => {
      service.getQuotes().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/quotes`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should pass customerId filter', () => {
      service.getQuotes(7).subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/quotes`);
      expect(req.request.params.get('customerId')).toBe('7');
      req.flush([]);
    });
  });

  describe('getQuoteById', () => {
    it('should GET quote detail', () => {
      service.getQuoteById(2).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/quotes/2`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 2 });
    });
  });

  describe('createQuote', () => {
    it('should POST new quote', () => {
      const body = { customerId: 1, lines: [] } as any;
      service.createQuote(body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/quotes`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 1 });
    });
  });

  describe('sendQuote', () => {
    it('should POST send action', () => {
      service.sendQuote(3).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/quotes/3/send`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('previewQuoteTerms', () => {
    it('should GET the compiled terms preview', () => {
      service.previewQuoteTerms(3).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/quotes/3/terms/preview`);
      expect(req.request.method).toBe('GET');
      req.flush({ sections: [] });
    });
  });

  describe('sendQuoteEmail', () => {
    it('should POST the send-email request', () => {
      service.sendQuoteEmail(3, { recipientEmail: 'buyer@acme.com', message: 'Hi' }).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/quotes/3/send-email`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ recipientEmail: 'buyer@acme.com', message: 'Hi' });
      req.flush(null);
    });
  });

  describe('duplicateQuote', () => {
    it('should POST to the duplicate endpoint and return the copy', () => {
      let result: { id: number; status: string } | undefined;
      service.duplicateQuote(4).subscribe(q => (result = q));
      const req = httpMock.expectOne(`${apiUrl}/quotes/4/duplicate`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 9, status: 'Draft' });
      expect(result).toEqual({ id: 9, status: 'Draft' });
    });
  });

  describe('getQuotePdf', () => {
    it('should GET the quote PDF as a blob', () => {
      let result: Blob | undefined;
      service.getQuotePdf(4).subscribe(b => (result = b));
      const req = httpMock.expectOne(`${apiUrl}/quotes/4/pdf`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('getRecipientEmail', () => {
    const contact = (id: number, email: string | null, isPrimary = false) =>
      ({ id, firstName: 'A', lastName: 'B', email, phone: null, role: null, isPrimary });

    it('should prefer the primary contact email', () => {
      let result: string | undefined;
      service.getRecipientEmail(9).subscribe(e => (result = e));
      httpMock.expectOne(`${apiUrl}/customers/9`).flush({
        id: 9,
        contacts: [contact(1, 'first@acme.test'), contact(2, 'buyer@acme.test', true)],
      });
      expect(result).toBe('buyer@acme.test');
    });

    it('should fall back to the first contact with an email', () => {
      let result: string | undefined;
      service.getRecipientEmail(9).subscribe(e => (result = e));
      httpMock.expectOne(`${apiUrl}/customers/9`).flush({
        id: 9,
        contacts: [contact(1, null, true), contact(2, ' '), contact(3, 'second@acme.test')],
      });
      expect(result).toBe('second@acme.test');
    });

    it('should resolve undefined when no contact has an email', () => {
      let result: string | undefined = 'unset';
      service.getRecipientEmail(9).subscribe(e => (result = e));
      httpMock.expectOne(`${apiUrl}/customers/9`).flush({ id: 9, contacts: [contact(1, null)] });
      expect(result).toBeUndefined();
    });
  });

  describe('convertToOrder', () => {
    it('should POST convert action', () => {
      service.convertToOrder(4).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/quotes/4/convert`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 99 });
    });
  });

  describe('deleteQuote', () => {
    it('should DELETE quote', () => {
      service.deleteQuote(5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/quotes/5`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('documents', () => {
    it('should GET the quote file list from the shared files API', () => {
      service.getDocuments(6).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/quotes/6/files`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should DELETE a file by id', () => {
      service.deleteFile(9).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/files/9`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should build the download URL for a file', () => {
      expect(service.downloadFileUrl(9)).toBe(`${apiUrl}/files/9/download`);
    });
  });
});
