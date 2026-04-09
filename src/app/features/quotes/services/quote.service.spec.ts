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
});
