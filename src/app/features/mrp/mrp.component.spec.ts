import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SnackbarService } from '../../shared/services/snackbar.service';
import { LayoutService } from '../../shared/services/layout.service';
import { MrpComponent } from './mrp.component';
import { MrpService } from './services/mrp.service';

interface MrpApi {
  orderStatusControl: FormControl<string | null>;
  exceptionFilterControl: FormControl<string | null>;
  visiblePlannedOrders(): { id: number }[];
  visibleExceptions(): { id: number }[];
  unresolvedExceptionCount(): number;
  plannedOrderCount(): number;
  openForecast(forecast: unknown): void;
  onOrderSelectionChange(rows: unknown[]): void;
  releasableSelection(): { id: number }[];
  releaseSelected(): void;
  releaseResultRows(): { plannedOrderId: number; partNumber: string; labelKey: string; createdId: number | null; route: string | null }[];
}

function setup(tab: string, dialogResult: unknown = undefined, canOpen: (url: string) => boolean = () => true) {
  const mrp = {
    getRuns: vi.fn(() => of([])),
    getPlannedOrders: vi.fn(() => of([
      { id: 1, status: 'Planned' }, { id: 2, status: 'Firmed' }, { id: 3, status: 'Planned' },
    ])),
    getExceptions: vi.fn(() => of([
      { id: 10, isResolved: false }, { id: 11, isResolved: true },
    ])),
    getMasterSchedules: vi.fn(() => of([])),
    getForecasts: vi.fn(() => of([])),
    approveForecast: vi.fn(() => of(undefined)),
    bulkReleasePlannedOrders: vi.fn(() => of([
      { plannedOrderId: 1, orderType: 'Purchase', createdPurchaseOrderId: 40, createdJobId: null },
      { plannedOrderId: 2, orderType: 'Manufacture', createdPurchaseOrderId: null, createdJobId: 70 },
    ])),
  };
  const open = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tab })), queryParamMap: of(convertToParamMap({})) } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: MrpService, useValue: mrp },
      { provide: SnackbarService, useValue: { success: vi.fn(), warn: vi.fn() } },
      { provide: MatDialog, useValue: { open } },
      { provide: LayoutService, useValue: { canOpen: vi.fn(canOpen) } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new MrpComponent()) as unknown as MrpApi;
  TestBed.flushEffects();
  return { page, mrp, open };
}

describe('MrpComponent · filters', () => {
  it('filters planned orders by the chosen status', () => {
    const { page } = setup('planned-orders');

    expect(page.visiblePlannedOrders().map(o => o.id)).toEqual([1, 2, 3]);
    page.orderStatusControl.setValue('Firmed');

    expect(page.visiblePlannedOrders().map(o => o.id)).toEqual([2]);
    expect(page.plannedOrderCount()).toBe(2);
  });

  it('shows resolved exceptions only when the filter asks for all', () => {
    const { page, mrp } = setup('exceptions');

    expect(mrp.getExceptions).toHaveBeenCalledWith();
    expect(page.visibleExceptions().map(e => e.id)).toEqual([10]);
    page.exceptionFilterControl.setValue(null);

    expect(page.visibleExceptions().map(e => e.id)).toEqual([10, 11]);
    expect(page.unresolvedExceptionCount()).toBe(1);
  });
});

describe('MrpComponent · forecast detail', () => {
  const forecast = { id: 5, name: 'Q4', status: 'Draft' };

  it('approves through the confirm when the detail asks to approve', () => {
    const { page, mrp, open } = setup('forecasts', 'approve');

    page.openForecast(forecast);

    expect(open).toHaveBeenCalledTimes(2);
    expect(mrp.approveForecast).toHaveBeenCalledWith(5);
  });

  it('reloads forecasts after the detail changed one', () => {
    const { page, mrp } = setup('forecasts', 'changed');
    mrp.getForecasts.mockClear();

    page.openForecast(forecast);

    expect(mrp.getForecasts).toHaveBeenCalledTimes(1);
  });
});

describe('MrpComponent · bulk release', () => {
  const orders = [
    { id: 1, status: 'Planned', orderType: 'Purchase', partNumber: 'P-1' },
    { id: 2, status: 'Firmed', orderType: 'Manufacture', partNumber: 'P-2' },
    { id: 3, status: 'Released', orderType: 'Purchase', partNumber: 'P-3' },
  ];

  it('releases only the selected orders that are still open, after a confirm that counts each type', () => {
    const { page, mrp, open } = setup('planned-orders', true);
    page.onOrderSelectionChange(orders);

    expect(page.releasableSelection().map(o => o.id)).toEqual([1, 2]);
    page.releaseSelected();

    const confirm = (open.mock.calls[0] as unknown[])[1] as { data: { details: string[] } };
    expect(confirm.data.details).toEqual(['mrp.bulkRelease.purchaseOrders', 'mrp.bulkRelease.jobs', 'mrp.bulkRelease.skipped']);
    expect(mrp.bulkReleasePlannedOrders).toHaveBeenCalledWith([1, 2]);
  });

  it('does nothing when the confirm is dismissed', () => {
    const { page, mrp } = setup('planned-orders', false);
    page.onOrderSelectionChange(orders);

    page.releaseSelected();

    expect(mrp.bulkReleasePlannedOrders).not.toHaveBeenCalled();
  });

  it('does not open the confirm when nothing releasable is selected', () => {
    const { page, open } = setup('planned-orders', true);
    page.onOrderSelectionChange([orders[2]]);

    page.releaseSelected();

    expect(open).not.toHaveBeenCalled();
  });

  it('lists what the release created, linking only the screens the user may open', () => {
    const { page } = setup('planned-orders', true, (url) => url === '/kanban');
    page.onOrderSelectionChange(orders);

    page.releaseSelected();

    const rows = page.releaseResultRows();
    expect(rows.map(r => [r.plannedOrderId, r.labelKey, r.createdId, r.route])).toEqual([
      [1, 'mrp.bulkRelease.createdPurchaseOrder', 40, null],
      [2, 'mrp.bulkRelease.createdJob', 70, '/kanban'],
    ]);
    expect(page.releasableSelection().length).toBe(0);
  });
});
