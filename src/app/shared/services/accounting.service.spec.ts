import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { AccountingProviderInfo } from '../../features/admin/models/accounting-provider.model';
import { AccountingEmployee } from '../../features/admin/models/accounting-employee.model';
import { AccountingItem } from '../../features/admin/models/accounting-item.model';
import { AccountingSyncStatus } from '../../features/admin/models/accounting-sync-status.model';
import { AccountingMode, AccountingService } from './accounting.service';

const BASE = environment.apiUrl;

const mockMode: AccountingMode = {
  isConfigured: true,
  providerName: 'QuickBooks Online',
  providerId: 'quickbooks',
};

const defaultMode: AccountingMode = {
  isConfigured: false,
  providerName: null,
  providerId: null,
};

const mockProviders: AccountingProviderInfo[] = [
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync with QuickBooks',
    icon: 'receipt',
    requiresOAuth: true,
    isConfigured: true,
  },
];

describe('AccountingService', () => {
  let service: AccountingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── Initial computed signal state ─────────────────────────────────────────

  it('isStandalone() returns true and isConfigured() returns false by default', () => {
    expect(service.isStandalone()).toBe(true);
    expect(service.isConfigured()).toBe(false);
  });

  it('providerName() and providerId() return null by default', () => {
    expect(service.providerName()).toBeNull();
    expect(service.providerId()).toBeNull();
  });

  // ── load() ────────────────────────────────────────────────────────────────

  it('load() GETs the accounting mode and sets signals', () => {
    service.load();

    const req = httpMock.expectOne(`${BASE}/admin/accounting-mode`);
    expect(req.request.method).toBe('GET');
    req.flush(mockMode);

    expect(service.isConfigured()).toBe(true);
    expect(service.isStandalone()).toBe(false);
    expect(service.providerName()).toBe('QuickBooks Online');
    expect(service.providerId()).toBe('quickbooks');
  });

  it('load() resets mode to default on HTTP error', () => {
    // Start with a configured state
    service.load();
    const firstReq = httpMock.expectOne(`${BASE}/admin/accounting-mode`);
    firstReq.flush(mockMode);

    // Now trigger an error
    service.load();
    const errorReq = httpMock.expectOne(`${BASE}/admin/accounting-mode`);
    errorReq.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    expect(service.isConfigured()).toBe(false);
    expect(service.providerName()).toBeNull();
    expect(service.providerId()).toBeNull();
  });

  // ── loadProviders() ──────────────────────────────────────────────────────

  it('loadProviders() GETs providers and sets the providers signal', () => {
    service.loadProviders();

    const req = httpMock.expectOne(`${BASE}/accounting/providers`);
    expect(req.request.method).toBe('GET');
    req.flush(mockProviders);

    expect(service.providers()).toEqual(mockProviders);
  });

  it('loadProviders() sets providers to an empty array when API returns []', () => {
    service.loadProviders();
    const req = httpMock.expectOne(`${BASE}/accounting/providers`);
    req.flush([]);
    expect(service.providers()).toHaveLength(0);
  });

  // ── setActiveProvider() ──────────────────────────────────────────────────

  it('setActiveProvider() PUTs to the correct URL with providerId in body', () => {
    service.setActiveProvider('quickbooks');

    const putReq = httpMock.expectOne(`${BASE}/admin/accounting-mode`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ providerId: 'quickbooks' });
    putReq.flush(null);

    // After success it calls load() and loadProviders()
    httpMock.expectOne(`${BASE}/admin/accounting-mode`).flush(mockMode);
    httpMock.expectOne(`${BASE}/accounting/providers`).flush(mockProviders);
  });

  it('setActiveProvider() sets loading to true during the request', () => {
    service.setActiveProvider('quickbooks');
    expect(service.loading()).toBe(true);

    httpMock.expectOne(`${BASE}/admin/accounting-mode`).flush(null);
    // Satisfy follow-up calls
    httpMock.expectOne(`${BASE}/admin/accounting-mode`).flush(defaultMode);
    httpMock.expectOne(`${BASE}/accounting/providers`).flush([]);

    expect(service.loading()).toBe(false);
  });

  it('setActiveProvider() resets loading to false on error', () => {
    service.setActiveProvider('quickbooks');

    const req = httpMock.expectOne(`${BASE}/admin/accounting-mode`);
    req.flush('Error', { status: 500, statusText: 'Internal Server Error' });

    expect(service.loading()).toBe(false);
  });

  it('setActiveProvider() accepts null to clear the active provider', () => {
    service.setActiveProvider(null);

    const req = httpMock.expectOne(`${BASE}/admin/accounting-mode`);
    expect(req.request.body).toEqual({ providerId: null });
    req.flush(null);

    httpMock.expectOne(`${BASE}/admin/accounting-mode`).flush(defaultMode);
    httpMock.expectOne(`${BASE}/accounting/providers`).flush([]);
  });

  // ── loadEmployees() ──────────────────────────────────────────────────────

  it('loadEmployees() GETs employees and sets the employees signal', () => {
    const mockEmployees: AccountingEmployee[] = [
      { externalId: 'EMP-1', displayName: 'Hartman, Daniel J', email: 'dan@example.com', phone: null, active: true },
    ];

    service.loadEmployees();

    const req = httpMock.expectOne(`${BASE}/accounting/employees`);
    expect(req.request.method).toBe('GET');
    req.flush(mockEmployees);

    expect(service.employees()).toEqual(mockEmployees);
  });

  // ── loadItems() ──────────────────────────────────────────────────────────

  it('loadItems() GETs items and sets the items signal', () => {
    const mockItems: AccountingItem[] = [
      { externalId: 'ITEM-1', name: 'Widget', description: null, type: 'Service', unitPrice: 10.0, purchaseCost: null, sku: null, active: true },
    ];

    service.loadItems();

    const req = httpMock.expectOne(`${BASE}/accounting/items`);
    expect(req.request.method).toBe('GET');
    req.flush(mockItems);

    expect(service.items()).toEqual(mockItems);
  });

  // ── loadSyncStatus() ─────────────────────────────────────────────────────

  it('loadSyncStatus() GETs sync status and sets the syncStatus signal', () => {
    const mockStatus: AccountingSyncStatus = {
      connected: true,
      lastSyncAt: new Date('2025-01-01T12:00:00Z'),
      queueDepth: 0,
      failedCount: 0,
    };

    service.loadSyncStatus();

    const req = httpMock.expectOne(`${BASE}/accounting/sync-status`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStatus);

    expect(service.syncStatus()?.connected).toBe(true);
    expect(service.syncStatus()?.queueDepth).toBe(0);
  });

  // ── testConnection() ─────────────────────────────────────────────────────

  it('testConnection() sets loading to true during the request', () => {
    service.testConnection();
    expect(service.loading()).toBe(true);

    httpMock.expectOne(`${BASE}/accounting/test`).flush({ success: true });
    expect(service.loading()).toBe(false);
  });

  it('testConnection() POSTs to the correct URL', () => {
    service.testConnection();

    const req = httpMock.expectOne(`${BASE}/accounting/test`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true });
  });

  it('testConnection() resets loading to false on error', () => {
    service.testConnection();

    httpMock.expectOne(`${BASE}/accounting/test`).flush('Error', { status: 503, statusText: 'Unavailable' });
    expect(service.loading()).toBe(false);
  });

  // ── disconnect() ─────────────────────────────────────────────────────────

  it('disconnect() POSTs to the correct URL', () => {
    service.disconnect();

    const req = httpMock.expectOne(`${BASE}/accounting/disconnect`);
    expect(req.request.method).toBe('POST');
    req.flush(null);

    httpMock.expectOne(`${BASE}/accounting/providers`).flush([]);
  });

  it('disconnect() resets mode to default and calls loadProviders() on success', () => {
    // Start in a configured state
    service.load();
    httpMock.expectOne(`${BASE}/admin/accounting-mode`).flush(mockMode);
    expect(service.isConfigured()).toBe(true);

    service.disconnect();
    httpMock.expectOne(`${BASE}/accounting/disconnect`).flush(null);

    // mode should be reset immediately
    expect(service.isConfigured()).toBe(false);
    expect(service.providerName()).toBeNull();

    // loadProviders() is called after reset
    httpMock.expectOne(`${BASE}/accounting/providers`).flush([]);
    expect(service.providers()).toHaveLength(0);
  });

  it('disconnect() resets loading to false on error', () => {
    service.disconnect();
    expect(service.loading()).toBe(true);

    httpMock.expectOne(`${BASE}/accounting/disconnect`).flush('Error', { status: 500, statusText: 'Internal Server Error' });
    expect(service.loading()).toBe(false);
  });

  // ── isStandalone / isConfigured computed ──────────────────────────────────

  it('isStandalone() is false and isConfigured() is true after loading a configured mode', () => {
    service.load();
    httpMock.expectOne(`${BASE}/admin/accounting-mode`).flush(mockMode);

    expect(service.isConfigured()).toBe(true);
    expect(service.isStandalone()).toBe(false);
  });

  it('isStandalone() is true and isConfigured() is false after loading an unconfigured mode', () => {
    service.load();
    httpMock.expectOne(`${BASE}/admin/accounting-mode`).flush(defaultMode);

    expect(service.isConfigured()).toBe(false);
    expect(service.isStandalone()).toBe(true);
  });
});
