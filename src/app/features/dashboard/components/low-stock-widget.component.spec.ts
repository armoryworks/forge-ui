import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../../environments/environment';
import { LowStockWidgetComponent } from './low-stock-widget.component';

interface WidgetInternals {
  ngOnInit(): void;
  hasStockLevels: { (): boolean | null };
  partCount: { (): number };
}

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const component = TestBed.runInInjectionContext(() => new LowStockWidgetComponent()) as unknown as WidgetInternals;
  const httpMock = TestBed.inject(HttpTestingController);
  component.ngOnInit();
  httpMock.expectOne(`${environment.apiUrl}/inventory/low-stock`).flush([]);
  return { component, httpMock };
}

describe('LowStockWidgetComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('knows no stock levels are set when no part has a minimum or reorder point', () => {
    const { component, httpMock } = setup();
    expect(component.hasStockLevels()).toBeNull();

    httpMock.expectOne(`${environment.apiUrl}/inventory/parts?status=Active`).flush([
      { partId: 1, onHand: 5, minStockThreshold: null, reorderPoint: null },
      { partId: 2, onHand: 0, minStockThreshold: null, reorderPoint: null },
    ]);

    expect(component.partCount()).toBe(2);
    expect(component.hasStockLevels()).toBe(false);
  });

  it('counts only Active parts so the snapshot matches the Parts list default', () => {
    const { component, httpMock } = setup();

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/inventory/parts`);
    expect(req.request.params.get('status')).toBe('Active');
    req.flush([
      { partId: 1, onHand: 5, minStockThreshold: null, reorderPoint: null },
      { partId: 2, onHand: 3, minStockThreshold: null, reorderPoint: null },
    ]);

    expect(component.partCount()).toBe(2);
  });

  it('treats a reorder point alone as a stock level', () => {
    const { component, httpMock } = setup();

    httpMock.expectOne(`${environment.apiUrl}/inventory/parts?status=Active`).flush([
      { partId: 1, onHand: 5, minStockThreshold: null, reorderPoint: 3 },
    ]);

    expect(component.hasStockLevels()).toBe(true);
  });
});
