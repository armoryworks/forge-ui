import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { RetailOrderService } from './retail-order.service';
import { environment } from '../../../../environments/environment';
import { CreateRetailOrderRequest } from '../models/create-retail-order-request.model';

describe('RetailOrderService', () => {
  let service: RetailOrderService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/retail-orders`;

  const request: CreateRetailOrderRequest = {
    channelId: 4,
    buyer: {
      externalBuyerId: null,
      displayName: 'Sam Okafor',
      contactEmail: null,
      phone: null,
      marketingConsent: false,
    },
    shipTo: {
      name: 'Sam Okafor',
      company: null,
      line1: '9 Bridge St',
      line2: null,
      city: 'Boise',
      state: 'ID',
      postalCode: '83702',
      country: 'US',
      phone: null,
      isValidated: false,
    },
    lines: [
      { partId: null, externalSku: null, description: 'Bracket', quantity: 2, unitPrice: 18.5, notes: null },
    ],
    externalOrderNumber: null,
    externalOrderId: null,
    taxRate: 0.06,
    taxCollectedBy: null,
    orderDate: null,
    notes: null,
    shippingAmount: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(RetailOrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts a retail order to the shared retail-orders endpoint', () => {
    service.createOrder(request).subscribe((order) => {
      expect(order.orderNumber).toBe('SO-00042');
    });

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ id: 42, orderNumber: 'SO-00042' });
  });

  it('sends a null externalBuyerId for a walk-in so the server mints a distinct buyer', () => {
    service.createOrder(request).subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.body.buyer.externalBuyerId).toBeNull();
    req.flush({ id: 42, orderNumber: 'SO-00042' });
  });

  it('marks a hand-keyed address as not validated', () => {
    // An importer's address arrives pre-validated by the platform; a typed one
    // has been through nothing, and claiming otherwise would skip a real check.
    service.createOrder(request).subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.body.shipTo.isValidated).toBe(false);
    req.flush({ id: 42, orderNumber: 'SO-00042' });
  });
});
