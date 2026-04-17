import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EdiService } from './edi.service';

describe('EdiService', () => {
  let service: EdiService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api/v1/edi';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EdiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── Trading Partners ──────────────────────────────────────

  describe('getTradingPartners', () => {
    it('should GET trading partners list', () => {
      service.getTradingPartners().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/trading-partners`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should pass isActive query param when provided', () => {
      service.getTradingPartners(true).subscribe();
      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/trading-partners`);
      expect(req.request.params.get('isActive')).toBe('true');
      req.flush([]);
    });
  });

  describe('getTradingPartner', () => {
    it('should GET trading partner by id', () => {
      service.getTradingPartner(5).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/trading-partners/5`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 5 });
    });
  });

  describe('createTradingPartner', () => {
    it('should POST new trading partner', () => {
      const body = { name: 'Partner A' } as any;
      service.createTradingPartner(body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/trading-partners`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('updateTradingPartner', () => {
    it('should PUT trading partner', () => {
      const body = { name: 'Updated' } as any;
      service.updateTradingPartner(3, body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/trading-partners/3`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 3 });
    });
  });

  describe('deleteTradingPartner', () => {
    it('should DELETE trading partner', () => {
      service.deleteTradingPartner(2).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/trading-partners/2`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('testConnection', () => {
    it('should POST test connection for partner', () => {
      service.testConnection(7).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/trading-partners/7/test`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, message: 'OK' });
    });
  });

  // ── Transactions ──────────────────────────────────────────

  describe('getTransactions', () => {
    it('should GET transactions without filters', () => {
      service.getTransactions().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/transactions`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    });

    it('should pass filter params', () => {
      service.getTransactions({ direction: 'Inbound' as any, page: 2, pageSize: 50 }).subscribe();
      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/transactions`);
      expect(req.request.params.get('direction')).toBe('Inbound');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('50');
      req.flush({ data: [], page: 2, pageSize: 50, totalCount: 0, totalPages: 0 });
    });
  });

  describe('getTransaction', () => {
    it('should GET transaction by id', () => {
      service.getTransaction(10).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/transactions/10`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 10 });
    });
  });

  describe('receiveDocument', () => {
    it('should POST receive with payload and partner id', () => {
      service.receiveDocument('ISA*00*...', 4).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/receive`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ rawPayload: 'ISA*00*...', tradingPartnerId: 4 });
      req.flush({ id: 1 });
    });
  });

  describe('sendOutbound', () => {
    it('should POST send outbound', () => {
      service.sendOutbound('invoice', 42, 3).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/send/invoice/42`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ tradingPartnerId: 3 });
      req.flush({ id: 1 });
    });
  });

  describe('retryTransaction', () => {
    it('should POST retry for transaction', () => {
      service.retryTransaction(8).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/transactions/8/retry`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  // ── Mappings ──────────────────────────────────────────────

  describe('getMappings', () => {
    it('should GET mappings for trading partner', () => {
      service.getMappings(5).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/trading-partners/5/mappings`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createMapping', () => {
    it('should POST new mapping for trading partner', () => {
      const body = { ediField: 'BEG01' } as any;
      service.createMapping(5, body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/trading-partners/5/mappings`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('updateMapping', () => {
    it('should PUT mapping by id', () => {
      const body = { ediField: 'BEG02' } as any;
      service.updateMapping(9, body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/mappings/9`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 9 });
    });
  });

  describe('deleteMapping', () => {
    it('should DELETE mapping by id', () => {
      service.deleteMapping(9).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/mappings/9`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
