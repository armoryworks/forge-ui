import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';
import { PortalService } from './portal.service';

const identity = {
  contactId: 1, customerId: 2, customerName: '', contactFirstName: 'Pat', contactLastName: 'Buyer', contactEmail: null,
};

function storeSession(expiresAt: Date): void {
  localStorage.setItem('portal-token', 'session-token');
  localStorage.setItem('portal-token-expires', expiresAt.toISOString());
  localStorage.setItem('portal-identity', JSON.stringify(identity));
}

describe('PortalService', () => {
  const navigate = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('reports a live session as authenticated', () => {
    storeSession(new Date(Date.now() + 60_000));

    expect(TestBed.inject(PortalService).isAuthenticated()).toBe(true);
  });

  it('reads an expired session inside a computed without writing a signal', () => {
    storeSession(new Date(Date.now() - 60_000));
    const portal = TestBed.inject(PortalService);

    const authenticated = computed(() => portal.isAuthenticated());

    expect(() => authenticated()).not.toThrow();
    expect(authenticated()).toBe(false);
    expect(portal.hasLapsedSession()).toBe(true);
    expect(localStorage.getItem('portal-token')).toBe('session-token');
  });

  it('ends a lapsed session by clearing it and sending the customer to sign in', () => {
    storeSession(new Date(Date.now() - 60_000));
    const portal = TestBed.inject(PortalService);

    portal.endSession();

    expect(portal.identity()).toBeNull();
    expect(localStorage.getItem('portal-token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/portal/login'], { queryParams: { reason: 'session_expired' } });
  });

  it('does not treat a signed-out visitor as a lapsed session', () => {
    expect(TestBed.inject(PortalService).hasLapsedSession()).toBe(false);
  });

  it('requests a sign-in link without the global error toast', () => {
    TestBed.inject(PortalService).requestMagicLink('pat@customer.test').subscribe();

    const req = TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/portal/auth/request-link'));
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req.flush({ devLink: null });
  });

  it('reads the full count of a capped list from the total-count header', () => {
    let result: { items: unknown[]; totalCount: number } | undefined;
    TestBed.inject(PortalService).getSalesOrders().subscribe(list => (result = list));

    TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/portal/me/sales-orders'))
      .flush([{ id: 1 }, { id: 2 }], { headers: { 'X-Total-Count': '250' } });

    expect(result?.items.length).toBe(2);
    expect(result?.totalCount).toBe(250);
  });

  it('falls back to the row count when the total-count header is missing', () => {
    let result: { items: unknown[]; totalCount: number } | undefined;
    TestBed.inject(PortalService).getQuotes().subscribe(list => (result = list));

    TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/portal/me/quotes')).flush([{ id: 1 }]);

    expect(result?.totalCount).toBe(1);
  });

  it('flags an invoice list owned by an external accounting provider', () => {
    let result: { items: unknown[]; externalAccounting: boolean } | undefined;
    TestBed.inject(PortalService).getInvoices().subscribe(list => (result = list));

    TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/portal/me/invoices'))
      .flush([], { headers: { 'X-Total-Count': '0', 'X-External-Accounting': 'true' } });

    expect(result?.items.length).toBe(0);
    expect(result?.externalAccounting).toBe(true);
  });

  it('does not flag an ordinary list as externally owned', () => {
    let result: { externalAccounting: boolean } | undefined;
    TestBed.inject(PortalService).getInvoices().subscribe(list => (result = list));

    TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/portal/me/invoices')).flush([]);

    expect(result?.externalAccounting).toBe(false);
  });
});
