import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';
import { ExchangeRateLookupService } from './exchange-rate-lookup.service';

describe('ExchangeRateLookupService', () => {
  let service: ExchangeRateLookupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExchangeRateLookupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('asks for the pair on the document date and is silent on failure', () => {
    let rate: number | undefined;
    service.lookup(2, new Date(2026, 9, 26), 1).subscribe(r => (rate = r.rate));

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/system/exchange-rate`);
    expect(req.request.params.get('from')).toBe('2');
    expect(req.request.params.get('to')).toBe('1');
    expect(req.request.params.get('date')).toBe('2026-10-26');
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req.flush({ rate: 0.73, effectiveDate: '2026-10-20', source: 'direct' });

    expect(rate).toBe(0.73);
  });

  it('leaves the target and date to the server when not given', () => {
    service.lookup(3, null).subscribe();

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/system/exchange-rate`);
    expect(req.request.params.has('to')).toBe(false);
    expect(req.request.params.has('date')).toBe(false);
    req.flush({ rate: 1.1, effectiveDate: null, source: 'direct' });
  });
});
