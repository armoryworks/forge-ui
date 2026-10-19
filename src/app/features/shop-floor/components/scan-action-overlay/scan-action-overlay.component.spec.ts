import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { ScanContext } from '../../../../shared/models/scan-action.model';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { ScannerService } from '../../../../shared/services/scanner.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanIdentification } from '../../models/scan-identification.model';
import { ShopFloorService } from '../../services/shop-floor.service';
import { ScanActionOverlayComponent } from './scan-action-overlay.component';

const CONTEXT: ScanContext = {
  partId: 5,
  partNumber: 'P-5',
  description: null,
  currentStock: 0,
  currentLocationName: null,
  currentLocationId: null,
  availableActions: [
    { action: 'Move', enabled: false, disabledReason: 'No stock available to move', context: null },
    { action: 'Job', enabled: true, disabledReason: null, context: null },
    { action: 'Ship', enabled: false, disabledReason: 'Something the terminal has no wording for', context: null },
  ],
};

const STOCKED: ScanContext = {
  partId: 7,
  partNumber: 'RM-100',
  description: 'Bar stock',
  currentStock: 40,
  currentLocationName: 'A1',
  currentLocationId: 3,
  availableActions: [
    {
      action: 'Ship', enabled: true, disabledReason: null,
      context: { openShipmentLines: [{ shipmentLineId: 11, shipmentId: 4, shipmentNumber: 'SH-0001', salesOrderNumber: 'SO-0003', requiredQuantity: 6, requiresScanToShip: false }] },
    },
    { action: 'Inspect', enabled: true, disabledReason: null, context: { qcTemplateId: 12 } },
  ],
};

interface OverlayInternals {
  triggerScan: (value: string) => void;
  phase: () => string;
  jobContext: () => { jobId: number; jobNumber: string; currentStage: string } | null;
  openShipmentLines: () => { shipmentId: number }[];
  qcTemplateId: () => number | null;
  contextLoaded: { subscribe: (fn: (ctx: ScanContext) => void) => unknown };
  quickActions: () => { id: string; label: string }[];
  disabledReasonLabel: (reason: string | null) => string;
  error: () => string | null;
  startShip: () => void;
  onActionClick: (id: string) => void;
}

function translateStub(key: string, params?: Record<string, unknown>): string {
  return params ? `${key} ${JSON.stringify(params)}` : `es:${key}`;
}

function setup(
  getContext: ScanActionService['getContext'],
  identifyScan: ShopFloorService['identifyScan'] = vi.fn(() => of<ScanIdentification>({ scanType: 'unknown' })),
) {
  const info = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ScannerService, useValue: { lastScan: signal(null), clearLastScan: vi.fn() } },
      { provide: ScanActionService, useValue: { getContext } },
      { provide: ShopFloorService, useValue: { identifyScan } },
      { provide: SnackbarService, useValue: { info, success: vi.fn() } },
      { provide: TranslateService, useValue: { instant: translateStub } },
    ],
  });
  const overlay = TestBed.runInInjectionContext(() => new ScanActionOverlayComponent()) as unknown as OverlayInternals;
  return { overlay, info };
}

describe('ScanActionOverlayComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('labels the quick actions from the catalog, calling the job action a work order', () => {
    const { overlay } = setup(vi.fn(() => of(CONTEXT)));
    overlay.triggerScan('P-5');

    expect(overlay.quickActions().map(a => a.label)).toEqual([
      'es:kioskFlows.actions.move',
      'es:kioskFlows.actions.job',
      'es:kioskFlows.actions.ship',
    ]);
  });

  it('translates the known server reasons and passes unknown ones through', () => {
    const { overlay } = setup(vi.fn(() => of(CONTEXT)));

    expect(overlay.disabledReasonLabel('No stock available to move')).toBe('es:kioskFlows.disabledReasons.noStockToMove');
    expect(overlay.disabledReasonLabel('No active jobs require this part')).toBe('es:kioskFlows.disabledReasons.noActiveWorkOrders');
    expect(overlay.disabledReasonLabel('Something the terminal has no wording for')).toBe('Something the terminal has no wording for');
    expect(overlay.disabledReasonLabel(null)).toBe('');
  });

  it('shows a translated error when the scanned part is not found', () => {
    const { overlay } = setup(vi.fn(() => throwError(() => new Error('404'))));
    overlay.triggerScan('NOPE');

    expect(overlay.error()).toBe('kioskFlows.overlay.partNotFound {"identifier":"NOPE"}');
  });

  it('uses translated toasts when an action cannot start', () => {
    const { overlay, info } = setup(vi.fn(() => of(CONTEXT)));
    overlay.triggerScan('P-5');

    overlay.startShip();
    overlay.onActionClick('Teleport');

    expect(info).toHaveBeenNthCalledWith(1, 'es:kioskFlows.overlay.noShipmentLines');
    expect(info).toHaveBeenNthCalledWith(2, 'kioskFlows.overlay.notImplemented {"action":"Teleport"}');
  });

  it('reads the ship lines and the QC template from the typed action contexts', () => {
    const { overlay } = setup(vi.fn(() => of(STOCKED)));
    overlay.triggerScan('RM-100');

    expect(overlay.openShipmentLines().map(l => l.shipmentId)).toEqual([4]);
    expect(overlay.qcTemplateId()).toBe(12);
  });

  it('tells the page which part was looked up', () => {
    const { overlay } = setup(vi.fn(() => of(STOCKED)));
    const loaded: ScanContext[] = [];
    overlay.contextLoaded.subscribe(ctx => loaded.push(ctx));

    overlay.triggerScan('RM-100');

    expect(loaded.map(c => c.partNumber)).toEqual(['RM-100']);
  });

  it('opens the work order flow when the code is a job rather than a part', () => {
    const identify = vi.fn(() => of<ScanIdentification>({
      scanType: 'job', entityId: 21, entityNumber: 'J-21', entityTitle: 'Bracket run', stageName: 'In Production',
    }));
    const { overlay } = setup(vi.fn(() => throwError(() => new Error('404'))), identify);

    overlay.triggerScan('J-21');

    expect(identify).toHaveBeenCalledWith('J-21');
    expect(overlay.phase()).toBe('job');
    expect(overlay.jobContext()).toMatchObject({ jobId: 21, jobNumber: 'J-21', currentStage: 'In Production' });
    expect(overlay.error()).toBeNull();
  });

  it('opens a work order without asking for a part context first', () => {
    const getContext = vi.fn(() => of(CONTEXT));
    const identify = vi.fn(() => of<ScanIdentification>({ scanType: 'job', entityId: 21, entityNumber: 'J-21' }));
    const { overlay } = setup(getContext, identify);

    overlay.triggerScan('J-21');

    expect(overlay.phase()).toBe('job');
    expect(getContext).not.toHaveBeenCalled();
  });

  it('still looks up a typed part number the barcode table does not know', () => {
    const getContext = vi.fn(() => of(STOCKED));
    const { overlay } = setup(getContext);

    overlay.triggerScan('RM-100');

    expect(getContext).toHaveBeenCalledWith('RM-100');
    expect(overlay.phase()).toBe('actions');
  });

  it('falls back to the part lookup when the scan cannot be identified', () => {
    const getContext = vi.fn(() => of(STOCKED));
    const { overlay } = setup(getContext, vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))));

    overlay.triggerScan('RM-100');

    expect(getContext).toHaveBeenCalledWith('RM-100');
  });

  it('says the session has ended instead of not found when the scan is refused for sign-in', () => {
    const getContext = vi.fn(() => of(STOCKED));
    const { overlay } = setup(getContext, vi.fn(() => throwError(() => new HttpErrorResponse({ status: 401 }))));

    overlay.triggerScan('RM-100');

    expect(getContext).not.toHaveBeenCalled();
    expect(overlay.error()).toContain('signInNeeded');
  });

  it('does not open a closed work order for work', () => {
    const getContext = vi.fn(() => of(CONTEXT));
    const identify = vi.fn(() => of<ScanIdentification>({ scanType: 'job', entityId: 21, entityNumber: 'J-21', isClosed: true }));
    const { overlay } = setup(getContext, identify);

    overlay.triggerScan('J-21');

    expect(overlay.phase()).not.toBe('job');
    expect(overlay.error()).toContain('closedJobScanned');
  });
});
