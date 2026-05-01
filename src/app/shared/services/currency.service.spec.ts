import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CurrencyService } from './currency.service';
import { environment } from '../../../environments/environment';

describe('CurrencyService', () => {
  let service: CurrencyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CurrencyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('defaults to USD before load() resolves', () => {
    expect(service.baseCurrency()).toBe('USD');
  });

  it('populates the signal from the API response', () => {
    service.load().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/system/currency-base`);
    expect(req.request.method).toBe('GET');
    req.flush({ baseCurrency: 'EUR' });

    expect(service.baseCurrency()).toBe('EUR');
  });

  it('falls back to USD on HTTP error', () => {
    let emitted: string | null = null;
    service.load().subscribe(v => { emitted = v; });

    const req = httpMock.expectOne(`${environment.apiUrl}/system/currency-base`);
    req.error(new ProgressEvent('error'));

    expect(emitted).toBe('USD');
    expect(service.baseCurrency()).toBe('USD');
  });
});
