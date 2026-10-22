import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { ScanContext } from '../../../shared/models/scan-action.model';
import { AuthService } from '../../../shared/services/auth.service';
import { ScannerService } from '../../../shared/services/scanner.service';
import { InventoryScanComponent } from './inventory-scan.component';

interface ScanPageInternals {
  ngOnInit: () => void;
  ngOnDestroy: () => void;
  onActivity: () => void;
  onManualScan: (value: string) => void;
  onContextLoaded: (ctx: ScanContext) => void;
  recentScans: () => ScanContext[];
  scanCount: () => number;
}

function part(partId: number, partNumber: string): ScanContext {
  return {
    partId, partNumber, description: null, currentStock: 1,
    currentLocationName: null, currentLocationId: null, availableActions: [],
  };
}

describe('InventoryScanComponent', () => {
  const scanner = { setContext: vi.fn(), restart: vi.fn(), stop: vi.fn(), submit: vi.fn() };
  const auth = { clearAuth: vi.fn() };
  const router = { navigate: vi.fn() };

  function create(): ScanPageInternals {
    return TestBed.runInInjectionContext(() => new InventoryScanComponent()) as unknown as ScanPageInternals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    scanner.submit.mockReset();
    auth.clearAuth.mockReset();
    router.navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: ScannerService, useValue: scanner },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: MatDialog, useValue: { open: vi.fn(), closeAll: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('sends a typed part number down the same path as a wedge scan so the action overlay opens', () => {
    create().onManualScan('RM-100');

    expect(scanner.submit).toHaveBeenCalledWith('RM-100');
  });

  it('records each looked-up part once, newest first', () => {
    const page = create();

    page.onContextLoaded(part(1, 'RM-100'));
    page.onContextLoaded(part(2, 'FG-200'));
    page.onContextLoaded(part(1, 'RM-100'));

    expect(page.recentScans().map(s => s.partNumber)).toEqual(['RM-100', 'FG-200']);
    expect(page.scanCount()).toBe(3);
  });

  describe('idle sign-out', () => {
    afterEach(() => {
      vi.useRealTimers();
      localStorage.removeItem('forge-kiosk-terminal');
    });

    it('signs out and returns to the kiosk after a minute idle on a paired terminal', () => {
      vi.useFakeTimers();
      localStorage.setItem('forge-kiosk-terminal', JSON.stringify({ id: 1 }));
      const page = create();
      page.ngOnInit();

      vi.advanceTimersByTime(45_000);
      page.onActivity();
      vi.advanceTimersByTime(45_000);
      expect(auth.clearAuth).not.toHaveBeenCalled();

      vi.advanceTimersByTime(15_000);
      expect(auth.clearAuth).toHaveBeenCalledOnce();
      expect(router.navigate).toHaveBeenCalledWith(['/display/shop-floor']);
    });

    it('keeps a personal session signed in', () => {
      vi.useFakeTimers();
      const page = create();
      page.ngOnInit();

      vi.advanceTimersByTime(10 * 60_000);

      expect(auth.clearAuth).not.toHaveBeenCalled();
      page.ngOnDestroy();
    });
  });
});
