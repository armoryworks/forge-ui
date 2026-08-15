import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ECommerceConnectionService } from './ecommerce-connection.service';
import { environment } from '../../../../environments/environment';

describe('ECommerceConnectionService', () => {
  let service: ECommerceConnectionService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/admin/ecommerce`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ECommerceConnectionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches platform options with their support flags', () => {
    service.getPlatforms().subscribe((platforms) => {
      expect(platforms[0].isSupported).toBe(true);
      expect(platforms[1].unavailableReason).toContain('developer account');
    });

    const req = httpMock.expectOne(`${base}/platforms`);
    expect(req.request.method).toBe('GET');
    req.flush([
      { platform: 'Shopify', name: 'Shopify', isSupported: true, isMarketplace: false, unavailableReason: null },
      {
        platform: 'Ebay', name: 'Ebay', isSupported: false, isMarketplace: true,
        unavailableReason: 'No connector for Ebay is built yet. Connecting it needs a developer account…',
      },
    ]);
  });

  it('sends credentials on create', () => {
    service.createConnection({
      name: 'Main store',
      platform: 'Shopify',
      credentials: 'shpat_secret',
      storeUrl: 'my-store.myshopify.com',
      autoImportOrders: true,
      syncInventory: true,
    }).subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.credentials).toBe('shpat_secret');
    req.flush({ id: 1 });
  });

  it('sends a null credential on update to mean "leave the stored secret alone"', () => {
    // The API never returns the secret, so there is nothing to round-trip —
    // blank has to mean unchanged rather than clear.
    service.updateConnection(1, {
      name: 'Main store',
      platform: 'Shopify',
      credentials: null,
      storeUrl: null,
      isActive: true,
      autoImportOrders: true,
      syncInventory: false,
    }).subscribe();

    const req = httpMock.expectOne(`${base}/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.credentials).toBeNull();
    req.flush({ id: 1 });
  });

  it('tests a connection', () => {
    service.testConnection(3).subscribe((result) => {
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('401 Unauthorized');
    });

    const req = httpMock.expectOne(`${base}/3/test`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: false, errorMessage: '401 Unauthorized' });
  });
});
