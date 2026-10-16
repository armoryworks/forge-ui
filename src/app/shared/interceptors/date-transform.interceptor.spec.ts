import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { dateTransformInterceptor } from './date-transform.interceptor';

describe('dateTransformInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([dateTransformInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('turns ISO date-time strings in JSON bodies into Dates', () => {
    let body: { at: unknown } | undefined;
    http.get<{ at: unknown }>('/api/v1/x').subscribe((b) => (body = b));
    mock.expectOne('/api/v1/x').flush({ at: '2026-04-06T12:00:00Z' });
    expect(body?.at).toBeInstanceOf(Date);
  });

  it('hands a blob body through untouched', () => {
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    let body: Blob | undefined;
    http.get('/api/v1/invoices/1/pdf', { responseType: 'blob' }).subscribe((b) => (body = b));
    mock.expectOne('/api/v1/invoices/1/pdf').flush(pdf);
    expect(body).toBe(pdf);
  });
});
