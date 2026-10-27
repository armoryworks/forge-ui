import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { FormControl, FormGroup } from '@angular/forms';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
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
  onTabKeydown(event: KeyboardEvent): void;
  approveLabelKey(s: ReorderSuggestion): string;
  approveSuggestion(s: ReorderSuggestion): void;
  approveBulk(): void;
  selectedSuggestionIds: { set(ids: Set<number>): void };
  createdRecords(): { type: string; id: number; label: string }[];
  assigneeControl: FormControl<number | null>;
  assigneeOptions(): { value: unknown; label: string }[];
  partBinOptions(): { value: unknown; label: string }[];
  adjustBinOptions(): { value: unknown; label: string }[];
  transferForm: FormGroup<{ partId: FormControl<number | null>; sourceBinContentId: FormControl<number | null> }>;
  adjustForm: FormGroup<{ partId: FormControl<number | null>; binContentId: FormControl<number | null> }>;
  showNoBinsHint(partId: number | null, options: { value: unknown; label: string }[]): boolean;
  canEditStock: boolean;
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
  roles: string[] = ['Manager'],
  extraCapabilities: string[] = [],
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
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      {
        provide: CapabilityService,
        useValue: {
          descriptor,
          isEnabled: (code: string) => (code === 'CAP-QC-INSPECTION' && enabled()) || extraCapabilities.includes(code),
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

describe('InventoryComponent stock writes', () => {
  it('lets the roles the stock endpoints admit receive, move and reserve', () => {
    for (const role of ['Admin', 'Manager', 'OfficeManager', 'Engineer', 'ProductionWorker']) {
      expect(setup('stock', { loaded: true, enabled: false }, {}, [role]).internals.canEditStock).toBe(true);
    }
  });

  it('keeps the Production Planner read-only', () => {
    expect(setup('stock', { loaded: true, enabled: false }, {}, ['Production Planner']).internals.canEditStock).toBe(false);
  });
});

describe('InventoryComponent replenishment', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders stock for a role the replenishment API refuses, leaving the refusal to the tab guard, without calling it', () => {
    const getBurnRates = vi.fn(() => of([]));
    const getSuggestions = vi.fn(() => of([]));
    const getSettings = vi.fn(() => of({ assigneeUserId: null }));
    const { internals, router } = setup('replenishment', { loaded: true, enabled: false },
      { replenishment: { getBurnRates, getSuggestions, getSettings } }, ['Engineer']);

    expect(internals.activeTab()).toBe('stock');
    expect(redirectsToStock(router)).toBe(false);
    expect(getBurnRates).not.toHaveBeenCalled();
    expect(getSuggestions).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it('keeps a manager on the replenishment tab', () => {
    const { internals, router } = setup('replenishment', { loaded: true, enabled: false });

    expect(internals.activeTab()).toBe('replenishment');
    expect(redirectsToStock(router)).toBe(false);
  });

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

  it('reports work orders and purchase orders separately after a bulk approve, labelled by number', () => {
    const approveBulk = vi.fn(() => of({
      approvedCount: 3,
      skippedCount: 0,
      createdPoIds: [12],
      createdJobIds: [58, 59],
      createdPoNumbers: ['PO-00012'],
      createdJobNumbers: ['J-0058', 'J-0059'],
    }));
    const { internals, snackbar } = setup('replenishment', { loaded: true, enabled: false }, { replenishment: { approveBulk } });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      replenishmentUi: { workOrderLink: 'Work order {{number}}', poNumberLink: 'Purchase order {{number}}' },
    });
    translate.use('en');

    internals.selectedSuggestionIds.set(new Set([1, 2, 3]));
    internals.approveBulk();

    expect(approveBulk).toHaveBeenCalledWith([1, 2, 3]);
    expect(internals.createdRecords().map(r => `${r.type}:${r.id}`)).toEqual(['job:58', 'job:59', 'purchase-order:12']);
    expect(internals.createdRecords().map(r => r.label)).toEqual([
      'Work order J-0058', 'Work order J-0059', 'Purchase order PO-00012',
    ]);
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

  it('puts the saved recipient back when saving a new pick fails', () => {
    const { internals, snackbar } = setup('replenishment', { loaded: true, enabled: false }, {
      replenishment: {
        getSettings: () => of({ assigneeUserId: 4 }),
        getAssigneeCandidates: () => of([{ id: 4, name: 'Avery Manager' }, { id: 9, name: 'Sam Admin' }]),
        updateSettings: () => throwError(() => new Error('rejected')),
      },
    });

    internals.assigneeControl.setValue(9);

    expect(internals.assigneeControl.value).toBe(4);
    expect(snackbar.success).not.toHaveBeenCalled();
  });
});

describe('InventoryComponent stock dialogs', () => {
  beforeEach(() => vi.restoreAllMocks());

  const bins: PartBinLocation[] = [
    { binContentId: 31, locationPath: 'Main / A1', quantity: 10, reservedQuantity: 4, availableQuantity: 6, lotNumber: 'HEAT-A', status: 'Stored' },
    { binContentId: 32, locationPath: 'Main / B2', quantity: 3, reservedQuantity: 0, availableQuantity: 3, lotNumber: null, status: 'Stored' },
    { binContentId: 33, locationPath: 'QC / Q1', quantity: 2, reservedQuantity: 0, availableQuantity: 2, lotNumber: null, status: 'QcHold' },
  ];

  it('shows a non-stored status on transfer bins and on-hand quantities on adjust bins', () => {
    const getPartBins = vi.fn(() => of(bins));
    const { internals } = setup('stockOps', { loaded: true, enabled: false }, { inventory: { getPartBins } });

    internals.transferForm.controls.partId.setValue(10);

    expect(internals.partBinOptions()).toEqual([
      { value: 31, label: 'replenishmentUi.binOptionWithLot' },
      { value: 32, label: 'replenishmentUi.binOption' },
      { value: 33, label: 'replenishmentUi.binOption · inventory.statuses.qcHold' },
    ]);
    expect(internals.adjustBinOptions().map(o => o.label)).toEqual([
      'replenishmentUi.binOptionOnHandWithLot',
      'replenishmentUi.binOptionOnHand',
      'replenishmentUi.binOptionOnHand · inventory.statuses.qcHold',
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
    expect(internals.showNoBinsHint(11, internals.partBinOptions())).toBe(true);
  });

  it('does not call the API when the adjust part is cleared', () => {
    const getPartBins = vi.fn(() => of(bins));
    const { internals } = setup('stockOps', { loaded: true, enabled: false }, { inventory: { getPartBins } });

    internals.adjustForm.controls.partId.setValue(null);

    expect(getPartBins).not.toHaveBeenCalled();
    expect(internals.showNoBinsHint(null, internals.adjustBinOptions())).toBe(false);
  });
});

describe('InventoryComponent capability-gated tabs', () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each([
    ['transfers', 'CAP-INV-MULTILOC'],
    ['abc', 'CAP-PLAN-ABC'],
    ['replenishmentCards', 'CAP-EXT-KANBAN-REPLENISHMENT'],
    ['reservations', 'CAP-INV-RESERVE'],
  ])('opens the %s tab while %s is on', (tab, capability) => {
    const { internals, router } = setup(tab, { loaded: true, enabled: false }, {}, ['Manager'], [capability]);

    expect(internals.activeTab()).toBe(tab);
    expect(redirectsToStock(router)).toBe(false);
  });

  it.each(['transfers', 'abc', 'replenishmentCards', 'reservations'])('sends the %s tab back to stock while its capability is off', (tab) => {
    const { internals, router } = setup(tab, { loaded: true, enabled: false });

    expect(internals.activeTab()).toBe('stock');
    expect(redirectsToStock(router)).toBe(true);
  });
});

describe('inventory tab routes', () => {
  it('shows the forbidden page for replenishment to a role that may not open it', async () => {
    const { INVENTORY_ROUTES } = await import('./inventory.routes');
    const { RedirectCommand, convertToParamMap, Router } = await import('@angular/router');
    const { AuthService } = await import('../../shared/services/auth.service');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { hasAnyRole: (r: string[]) => r.includes('OfficeManager') } }] });
    const guard = INVENTORY_ROUTES.find(r => r.path === ':tab')!.canActivate![0] as (...a: unknown[]) => unknown;
    const result = TestBed.runInInjectionContext(() =>
      guard({ paramMap: convertToParamMap({ tab: 'replenishment' }) }, { url: '/inventory/replenishment' }));
    expect(result).toBeInstanceOf(RedirectCommand);
    expect(TestBed.inject(Router).serializeUrl((result as InstanceType<typeof RedirectCommand>).redirectTo)).toBe('/forbidden');
  });
});

interface InventoryFixInternals {
  searchControl: FormControl<string | null>;
  partSummaries: { set(rows: { onHand: number }[]): void };
  inStockCount(): number;
  canAdjustStock: boolean;
  transferForm: FormGroup<{
    partId: FormControl<number | null>;
    sourceBinContentId: FormControl<number | null>;
    quantity: FormControl<number | null>;
  }>;
  selectedCycleCount: { set(cc: unknown): void; (): { lines: { id: number; actualQuantity: number; variance: number }[] } | null };
  invalidCycleCountLineIds(): ReadonlySet<number>;
  updateCycleCountLine(lineId: number, raw: string): void;
  approveCycleCount(): void;
  suggestionBurnRate(s: ReorderSuggestion): number | null;
  suggestionQcHold(s: ReorderSuggestion): number | null;
}

describe('InventoryComponent stock search, counts and permissions', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('reloads stock with the typed term after the user stops typing', () => {
    vi.useFakeTimers();
    try {
      const getPartInventory = vi.fn(() => of([]));
      const { internals } = setup('stock', { loaded: true, enabled: false }, { inventory: { getPartInventory } });
      const fix = internals as unknown as InventoryFixInternals;
      getPartInventory.mockClear();

      fix.searchControl.setValue('brk');
      fix.searchControl.setValue('bracket');
      expect(getPartInventory).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(getPartInventory).toHaveBeenCalledTimes(1);
      expect(getPartInventory).toHaveBeenCalledWith('bracket');
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts the parts that actually have stock', () => {
    const { internals } = setup('stock', { loaded: true, enabled: false });
    const fix = internals as unknown as InventoryFixInternals;

    fix.partSummaries.set([{ onHand: 5 }, { onHand: 0 }, { onHand: 0 }, { onHand: 2.5 }]);

    expect(fix.inStockCount()).toBe(2);
  });

  it('offers stock adjustment to Admin and Manager only, matching the API', () => {
    expect((setup('stockOps', { loaded: true, enabled: false }, {}, ['Manager']).internals as unknown as InventoryFixInternals).canAdjustStock).toBe(true);
    expect((setup('stockOps', { loaded: true, enabled: false }, {}, ['Admin']).internals as unknown as InventoryFixInternals).canAdjustStock).toBe(true);
    expect((setup('stockOps', { loaded: true, enabled: false }, {}, ['OfficeManager']).internals as unknown as InventoryFixInternals).canAdjustStock).toBe(false);
    expect((setup('stockOps', { loaded: true, enabled: false }, {}, ['Engineer']).internals as unknown as InventoryFixInternals).canAdjustStock).toBe(false);
  });

  it('caps the transfer quantity at what the chosen bin has available', () => {
    const bins: PartBinLocation[] = [
      { binContentId: 31, locationPath: 'Main / A1', quantity: 10, reservedQuantity: 4, availableQuantity: 6, lotNumber: null, status: 'Stored' },
    ];
    const { internals } = setup('stockOps', { loaded: true, enabled: false }, { inventory: { getPartBins: () => of(bins) } });
    const form = (internals as unknown as InventoryFixInternals).transferForm;

    form.controls.partId.setValue(10);
    form.controls.sourceBinContentId.setValue(31);
    TestBed.flushEffects();
    form.controls.quantity.setValue(7);

    expect(form.controls.quantity.errors).toEqual({ max: { max: 6, actual: 7 } });
    form.controls.quantity.setValue(6);
    expect(form.controls.quantity.valid).toBe(true);
  });

  it('accepts a fractional transfer quantity but not zero', () => {
    const bins: PartBinLocation[] = [
      { binContentId: 31, locationPath: 'Main / A1', quantity: 2.5, reservedQuantity: 0, availableQuantity: 2.5, lotNumber: null, status: 'Stored' },
    ];
    const { internals } = setup('stockOps', { loaded: true, enabled: false }, { inventory: { getPartBins: () => of(bins) } });
    const form = (internals as unknown as InventoryFixInternals).transferForm;

    form.controls.partId.setValue(10);
    form.controls.sourceBinContentId.setValue(31);
    TestBed.flushEffects();
    form.controls.quantity.setValue(0.5);
    expect(form.controls.quantity.valid).toBe(true);
    form.controls.quantity.setValue(0);
    expect(form.controls.quantity.hasError('min')).toBe(true);
  });
});

describe('InventoryComponent cycle count lines', () => {
  beforeEach(() => vi.restoreAllMocks());

  const count = {
    id: 5, locationId: 1, locationName: 'A1', countedById: 1, countedByName: 'Avery Stone',
    countedAt: '2026-10-01T00:00:00Z', status: 'Pending', notes: null,
    lines: [{ id: 1, entityType: 'part', entityId: 10, entityName: 'P-10', expectedQuantity: 8, actualQuantity: 8, variance: 0, notes: null }],
  };

  it('refuses a negative or blank actual and blocks approval until it is fixed', () => {
    const updateCycleCount = vi.fn(() => of(undefined));
    const { internals } = setup('cycleCounts', { loaded: true, enabled: false }, { inventory: { updateCycleCount } });
    const fix = internals as unknown as InventoryFixInternals;
    fix.selectedCycleCount.set(count);

    fix.updateCycleCountLine(1, '-2');
    expect(fix.invalidCycleCountLineIds().has(1)).toBe(true);
    expect(fix.selectedCycleCount()!.lines[0].actualQuantity).toBe(8);
    fix.approveCycleCount();
    expect(updateCycleCount).not.toHaveBeenCalled();

    fix.updateCycleCountLine(1, '');
    expect(fix.invalidCycleCountLineIds().has(1)).toBe(true);

    fix.updateCycleCountLine(1, '6');
    expect(fix.invalidCycleCountLineIds().size).toBe(0);
    expect(fix.selectedCycleCount()!.lines[0]).toMatchObject({ actualQuantity: 6, variance: -2 });
    fix.approveCycleCount();
    expect(updateCycleCount).toHaveBeenCalledWith(5, expect.objectContaining({
      status: 'Approved',
      lines: [{ id: 1, actualQuantity: 6, notes: undefined }],
    }));
  });

  it('accepts a fractional count for stock kept in decimal units', () => {
    const { internals } = setup('cycleCounts', { loaded: true, enabled: false });
    const fix = internals as unknown as InventoryFixInternals;
    fix.selectedCycleCount.set(count);

    fix.updateCycleCountLine(1, '7.25');

    expect(fix.invalidCycleCountLineIds().size).toBe(0);
    expect(fix.selectedCycleCount()!.lines[0]).toMatchObject({ actualQuantity: 7.25, variance: -0.75 });
  });

  it('accepts a count of zero', () => {
    const { internals } = setup('cycleCounts', { loaded: true, enabled: false });
    const fix = internals as unknown as InventoryFixInternals;
    fix.selectedCycleCount.set(count);

    fix.updateCycleCountLine(1, '0');

    expect(fix.invalidCycleCountLineIds().size).toBe(0);
    expect(fix.selectedCycleCount()!.lines[0].actualQuantity).toBe(0);
  });

  it('shows no burn rate for a suggestion without consumption history', () => {
    const { internals } = setup('replenishment', { loaded: true, enabled: false });
    const fix = internals as unknown as InventoryFixInternals;

    expect(fix.suggestionBurnRate(suggestion({ burnRateDailyAvg: 0 }))).toBeNull();
    expect(fix.suggestionBurnRate(suggestion({ burnRateDailyAvg: 2.5 }))).toBe(2.5);
  });

  it('says how much stock QC is holding back on a suggestion', () => {
    const { internals } = setup('replenishment', { loaded: true, enabled: false });
    const fix = internals as unknown as InventoryFixInternals;

    expect(fix.suggestionQcHold(suggestion({ qcHoldQuantity: 330 }))).toBe(330);
    expect(fix.suggestionQcHold(suggestion({ qcHoldQuantity: 0 }))).toBeNull();
    expect(fix.suggestionQcHold(suggestion())).toBeNull();
  });
});
