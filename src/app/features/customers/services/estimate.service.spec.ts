import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EstimateService } from './estimate.service';
import { environment } from '../../../../environments/environment';

describe('EstimateService', () => {
  let service: EstimateService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EstimateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getEstimates', () => {
    it('should GET estimates list without params', () => {
      service.getEstimates().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/estimates`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET estimates with customerId param', () => {
      service.getEstimates(5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/estimates?customerId=5`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET estimates with status param', () => {
      service.getEstimates(undefined, 'Draft' as any).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/estimates?status=Draft`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET estimates with both params', () => {
      service.getEstimates(3, 'Sent' as any).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/estimates?customerId=3&status=Sent`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getEstimate', () => {
    it('should GET estimate by id', () => {
      service.getEstimate(7).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/estimates/7`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 7 });
    });
  });

  describe('createEstimate', () => {
    it('should POST new estimate', () => {
      const body = { customerId: 1, title: 'Test', estimatedAmount: 500 } as any;
      service.createEstimate(body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/estimates`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('updateEstimate', () => {
    it('should PUT estimate update', () => {
      const body = { title: 'Updated' } as any;
      service.updateEstimate(4, body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/estimates/4`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush(null);
    });
  });

  describe('deleteEstimate', () => {
    it('should DELETE estimate', () => {
      service.deleteEstimate(9).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/estimates/9`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('convertToQuote', () => {
    it('should POST convert to quote', () => {
      service.convertToQuote(6).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/estimates/6/convert`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ id: 10, quoteNumber: 'Q-0010' });
    });
  });
});
