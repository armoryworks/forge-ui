import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';
import { SEEDED_PAYMENT_TERMS } from '../models/payment-terms.fixture';
import { PaymentTermsService } from './payment-terms.service';

describe('PaymentTermsService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()] });
    http = TestBed.inject(HttpTestingController);
  });

  it('loads the list once and offers only active terms after a None choice', () => {
    const service = TestBed.inject(PaymentTermsService);
    service.ensureLoaded();
    service.ensureLoaded();
    const inactive = { ...SEEDED_PAYMENT_TERMS[1], isActive: false };
    http.expectOne(r => r.url === `${environment.apiUrl}/payment-terms`)
      .flush([SEEDED_PAYMENT_TERMS[0], inactive, SEEDED_PAYMENT_TERMS[8]]);

    expect(service.options().map(o => o.value)).toEqual([null, 1, 9]);
    expect(service.forLegacy('DueOnReceipt')?.id).toBe(1);
    expect(service.find(9)?.discountPercent).toBe(2);
    http.verify();
  });

  it('refreshes the shared list after a save', () => {
    const service = TestBed.inject(PaymentTermsService);
    service.create({ code: '3/15Net45', name: '3/15 Net 45', netDays: 45, discountPercent: 3, discountDays: 15, isActive: true, sortOrder: 200 })
      .subscribe();
    const post = http.expectOne(`${environment.apiUrl}/payment-terms`);
    expect(post.request.method).toBe('POST');
    post.flush({ ...SEEDED_PAYMENT_TERMS[8], id: 11 });

    http.expectOne(r => r.method === 'GET' && r.url === `${environment.apiUrl}/payment-terms`).flush(SEEDED_PAYMENT_TERMS);
    expect(service.terms()).toHaveLength(SEEDED_PAYMENT_TERMS.length);
  });
});
