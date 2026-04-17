import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { LotService } from './lot.service';
import { environment } from '../../../../environments/environment';

describe('LotService', () => {
  let service: LotService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LotService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getLots', () => {
    it('should GET lots list without params', () => {
      service.getLots().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/lots`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET lots with search param', () => {
      service.getLots('ABC').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/lots?search=ABC`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET lots with partId param', () => {
      service.getLots(undefined, 5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/lots?partId=5`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should GET lots with jobId param', () => {
      service.getLots(undefined, undefined, 10).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/lots?jobId=10`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('trace', () => {
    it('should GET lot trace by lot number', () => {
      service.trace('LOT-001').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/lots/LOT-001/trace`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('should encode lot number in URL', () => {
      service.trace('LOT 001').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/lots/LOT%20001/trace`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('create', () => {
    it('should POST new lot', () => {
      const body = { partId: 1, quantity: 100 };
      service.create(body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/lots`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });
});
