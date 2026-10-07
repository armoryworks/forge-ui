import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

import { CapabilityService } from '../../shared/services/capability.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { PurchaseOrderService } from '../purchase-orders/services/purchase-order.service';
import { InventoryService } from './services/inventory.service';
import { ReplenishmentService } from './services/replenishment.service';
import { InventoryComponent } from './inventory.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface InventoryInternals {
  inspectionEnabled(): boolean;
  activeTab(): string;
}

const emptyService = () => new Proxy({}, { get: () => () => of([]) });

function setup(tab: string, capability: { loaded: boolean; enabled: boolean }) {
  const descriptor = signal<object | null>(capability.loaded ? {} : null);
  const enabled = signal(capability.enabled);
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };
  const route = {
    paramMap: new BehaviorSubject(convertToParamMap({ tab })),
    queryParamMap: of(convertToParamMap({})),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: InventoryService, useValue: emptyService() },
      { provide: ReplenishmentService, useValue: emptyService() },
      { provide: PurchaseOrderService, useValue: emptyService() },
      { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: ScannerService, useValue: { setContext: vi.fn(), lastScan: signal(null), clearLastScan: vi.fn() } },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: route },
      {
        provide: CapabilityService,
        useValue: {
          descriptor,
          isEnabled: (code: string) => code === 'CAP-QC-INSPECTION' && enabled(),
        },
      },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new InventoryComponent());
  TestBed.flushEffects();
  return { internals: component as unknown as InventoryInternals, router };
}

function redirectsToStock(router: { navigate: ReturnType<typeof vi.fn> }): boolean {
  return router.navigate.mock.calls.some(([commands, extras]) =>
    JSON.stringify(commands) === JSON.stringify(['..', 'stock'])
    && (extras as { replaceUrl?: boolean } | undefined)?.replaceUrl === true);
}

describe('InventoryComponent inspection tab', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows the inspection tab and stays on it when CAP-QC-INSPECTION is on', () => {
    const { internals, router } = setup('inspection', { loaded: true, enabled: true });

    expect(internals.inspectionEnabled()).toBe(true);
    expect(internals.activeTab()).toBe('inspection');
    expect(redirectsToStock(router)).toBe(false);
  });

  it('hides the inspection tab and redirects the URL to stock when CAP-QC-INSPECTION is off', () => {
    const { internals, router } = setup('inspection', { loaded: true, enabled: false });

    expect(internals.inspectionEnabled()).toBe(false);
    expect(internals.activeTab()).toBe('stock');
    expect(redirectsToStock(router)).toBe(true);
  });

  it('waits for the capability snapshot before redirecting', () => {
    const { internals, router } = setup('inspection', { loaded: false, enabled: false });

    expect(internals.activeTab()).toBe('stock');
    expect(redirectsToStock(router)).toBe(false);
  });

  it('leaves other tabs alone when CAP-QC-INSPECTION is off', () => {
    const { internals, router } = setup('movements', { loaded: true, enabled: false });

    expect(internals.activeTab()).toBe('movements');
    expect(redirectsToStock(router)).toBe(false);
  });
});
