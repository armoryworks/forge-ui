import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { FormControl, FormGroup } from '@angular/forms';
import { BehaviorSubject, Observable, of } from 'rxjs';

import { CapabilityService } from '../../shared/services/capability.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { PurchaseOrderService } from '../purchase-orders/services/purchase-order.service';
import { InventoryService } from './services/inventory.service';
import { ReplenishmentService } from './services/replenishment.service';
import { InventoryComponent } from './inventory.component';
import { ReorderSuggestion } from './models/reorder-suggestion.model';
import { PartBinLocation } from './models/part-bin-location.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface InventoryInternals {
  inspectionEnabled(): boolean;
  activeTab(): string;
  approveLabelKey(s: ReorderSuggestion): string;
  approveSuggestion(s: ReorderSuggestion): void;
  approveBulk(): void;
  selectedSuggestionIds: { set(ids: Set<number>): void };
  createdRecords(): { type: string; id: number; label: string }[];
  assigneeControl: FormControl<number | null>;
  assigneeOptions(): { value: unknown; label: string }[];
  partBinOptions(): { value: unknown; label: string }[];
  reservationForm: FormGroup<{ partId: FormControl<number | null>; binContentId: FormControl<number | null> }>;
  transferForm: FormGroup<{ partId: FormControl<number | null>; sourceBinContentId: FormControl<number | null> }>;
  adjustForm: FormGroup<{ partId: FormControl<number | null>; binContentId: FormControl<number | null> }>;
  showNoBinsHint(partId: number | null): boolean;
}

type Overrides = Record<string, (...args: never[]) => unknown>;

const emptyService = (overrides: Overrides = {}) =>
  new Proxy(overrides, { get: (target, key: string) => target[key] ?? (() => of([])) });

function suggestion(overrides: Partial<ReorderSuggestion> = {}): ReorderSuggestion {
  return {
    id: 1, partId: 10, partNumber: 'P-10', partDescription: 'Bracket', vendorId: null, vendorName: null,
    currentStock: 0, availableStock: 0, burnRateDailyAvg: 1, burnRateWindowDays: 30, daysOfStockRemaining: 0,
    projectedStockoutDate: null, incomingPoQuantity: 0, earliestPoArrival: null, suggestedQuantity: 5,
    supplyType: 'Buy', leadTimeDays: 7, status: 'Pending', approvedByName: null, approvedAt: null,
    resultingPurchaseOrderId: null, resultingJobId: null, resultingJobNumber: null, dismissReason: null,
    dismissedByName: null, dismissedAt: null, notes: null, createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function setup(
  tab: string,
  capability: { loaded: boolean; enabled: boolean },
  services: { inventory?: Overrides; replenishment?: Overrides } = {},
) {
  const descriptor = signal<object | null>(capability.loaded ? {} : null);
  const enabled = signal(capability.enabled);
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };
  const snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const route = {
    paramMap: new BehaviorSubject(convertToParamMap({ tab })),
    queryParamMap: of(convertToParamMap({})),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: InventoryService, useValue: emptyService(services.inventory) },
      { provide: ReplenishmentService, useValue: emptyService(services.replenishment) },
      { provide: PurchaseOrderService, useValue: emptyService() },
      { provide: SnackbarService, useValue: snackbar },
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
  return { internals: component as unknown as InventoryInternals, router, snackbar };
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

describe('InventoryComponent replenishment', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('labels the approve button by supply type', () => {
    const { internals } = setup('replenishment', { loaded: true, enabled: false });

    expect(internals.approveLabelKey(suggestion({ supplyType: 'Make' }))).toBe('replenishmentUi.createWorkOrder');
    expect(internals.approveLabelKey(suggestion({ supplyType: 'Buy' }))).toBe('replenishmentUi.createPo');
  });

  it('links the new work order after approving a Make suggestion', () => {
    const approveSuggestion = vi.fn(() => of(suggestion({ supplyType: 'Make', status: 'Approved', resultingJobId: 58, resultingJobNumber: 'J-58' })));
    const { internals, snackbar } = setup('replenishment', { loaded: true, enabled: false }, { replenishment: { approveSuggestion } });

    internals.approveSuggestion(suggestion({ supplyType: 'Make' }));

    expect(approveSuggestion).toHaveBeenCalledWith(1);
    expect(internals.createdRecords()).toEqual([{ type: 'job', id: 58, label: 'replenishmentUi.workOrderLink' }]);
    expect(snackbar.success).toHaveBeenCalledWith('replenishmentUi.workOrderCreated');
  });

  it('links the new purchase order after approving a Buy suggestion', () => {
    const approveSuggestion = vi.fn(() => of(suggestion({ status: 'Approved', resultingPurchaseOrderId: 12 })));
    const { internals, snackbar } = setup('replenishment', { loaded: true, enabled: false }, { replenishment: { approveSuggestion } });

    internals.approveSuggestion(suggestion());

    expect(internals.createdRecords()).toEqual([{ type: 'purchase-order', id: 12, label: 'replenishmentUi.poLink' }]);
    expect(snackbar.success).toHaveBeenCalledWith('replenishmentUi.poCreated');
  });

  it('reports work orders and purchase orders separately after a bulk approve', () => {
    const approveBulk = vi.fn(() => of({ approvedCount: 3, skippedCount: 0, createdPoIds: [12], createdJobIds: [58, 59] }));
    const { internals, snackbar } = setup('replenishment', { loaded: true, enabled: false }, { replenishment: { approveBulk } });

    internals.selectedSuggestionIds.set(new Set([1, 2, 3]));
    internals.approveBulk();

    expect(approveBulk).toHaveBeenCalledWith([1, 2, 3]);
    expect(internals.createdRecords().map(r => `${r.type}:${r.id}`)).toEqual(['job:58', 'job:59', 'purchase-order:12']);
    expect(snackbar.success).toHaveBeenCalledWith('replenishmentUi.bulkApproved');
  });

  it('loads the saved recipient without re-saving it, then saves a new pick', () => {
    const updateSettings = vi.fn((settings: { assigneeUserId: number | null }) => of(settings));
    const { internals, snackbar } = setup('replenishment', { loaded: true, enabled: false }, {
      replenishment: {
        getSettings: () => of({ assigneeUserId: 4 }),
        getAssigneeCandidates: () => of([{ id: 4, name: 'Avery Manager' }, { id: 9, name: 'Sam Admin' }]),
        updateSettings,
      },
    });

    expect(internals.assigneeControl.value).toBe(4);
    expect(internals.assigneeOptions().map(o => o.value)).toEqual([null, 4, 9]);
    expect(updateSettings).not.toHaveBeenCalled();

    internals.assigneeControl.setValue(9);
    expect(updateSettings).toHaveBeenCalledWith({ assigneeUserId: 9 });

    internals.assigneeControl.setValue(null);
    expect(updateSettings).toHaveBeenLastCalledWith({ assigneeUserId: null });
    expect(snackbar.success).toHaveBeenCalledWith('replenishmentUi.assigneeSaved');
  });
});

describe('InventoryComponent stock dialogs', () => {
  beforeEach(() => vi.restoreAllMocks());

  const bins: PartBinLocation[] = [
    { binContentId: 31, locationPath: 'Main / A1', quantity: 10, reservedQuantity: 4, availableQuantity: 6, lotNumber: 'HEAT-A', status: 'Stored' },
    { binContentId: 32, locationPath: 'Main / B2', quantity: 3, reservedQuantity: 0, availableQuantity: 3, lotNumber: null, status: 'Stored' },
  ];

  it('loads the picked part\'s bins into the reserve bin select', () => {
    const getPartBins = vi.fn(() => of(bins));
    const { internals } = setup('reservations', { loaded: true, enabled: false }, { inventory: { getPartBins } });

    expect(internals.partBinOptions()).toEqual([]);
    internals.reservationForm.controls.partId.setValue(10);

    expect(getPartBins).toHaveBeenCalledWith(10);
    expect(internals.partBinOptions()).toEqual([
      { value: 31, label: 'replenishmentUi.binOptionWithLot' },
      { value: 32, label: 'replenishmentUi.binOption' },
    ]);
  });

  it('clears the chosen bin when the transfer part changes', () => {
    const getPartBins = vi.fn((partId: number) => of(partId === 10 ? bins : []));
    const { internals } = setup('stockOps', { loaded: true, enabled: false }, { inventory: { getPartBins } });

    internals.transferForm.controls.partId.setValue(10);
    internals.transferForm.controls.sourceBinContentId.setValue(31);
    internals.transferForm.controls.partId.setValue(11);

    expect(getPartBins).toHaveBeenLastCalledWith(11);
    expect(internals.transferForm.controls.sourceBinContentId.value).toBeNull();
    expect(internals.partBinOptions()).toEqual([]);
    expect(internals.showNoBinsHint(11)).toBe(true);
  });

  it('does not call the API when the adjust part is cleared', () => {
    const getPartBins = vi.fn(() => of(bins));
    const { internals } = setup('stockOps', { loaded: true, enabled: false }, { inventory: { getPartBins } });

    internals.adjustForm.controls.partId.setValue(null);

    expect(getPartBins).not.toHaveBeenCalled();
    expect(internals.showNoBinsHint(null)).toBe(false);
  });
});
