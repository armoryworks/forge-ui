import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ScanContext } from '../../../../shared/models/scan-action.model';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { ScannerService } from '../../../../shared/services/scanner.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
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

interface OverlayInternals {
  triggerScan: (value: string) => void;
  quickActions: () => { id: string; label: string }[];
  disabledReasonLabel: (reason: string | null) => string;
  error: () => string | null;
  startShip: () => void;
  onActionClick: (id: string) => void;
}

function translateStub(key: string, params?: Record<string, unknown>): string {
  return params ? `${key} ${JSON.stringify(params)}` : `es:${key}`;
}

function setup(getContext: ScanActionService['getContext']) {
  const info = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ScannerService, useValue: { lastScan: signal(null), clearLastScan: vi.fn() } },
      { provide: ScanActionService, useValue: { getContext } },
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
});
