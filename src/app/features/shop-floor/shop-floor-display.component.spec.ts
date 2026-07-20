import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ShopFloorDisplayComponent } from './shop-floor-display.component';
import { KioskSessionService } from '../../shared/services/kiosk-session.service';
import { ShopFloorService } from './services/shop-floor.service';
import { ClockEventTypeService } from '../../shared/services/clock-event-type.service';
import { EventsService } from '../events/services/events.service';
import { AuthService } from '../../shared/services/auth.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { LoadingService } from '../../shared/services/loading.service';
import { PurchaseOrderService } from '../purchase-orders/services/purchase-order.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { ShipmentService } from '../shipments/services/shipment.service';

/**
 * SECURITY-CRITICAL: the shop-floor kiosk is a shared terminal, so it wipes any
 * inherited session on entry. These tests pin the ONE exception — a training
 * preview — and prove the exception can only PRESERVE an already-authenticated
 * user's session, never GRANT one, and that it cannot switch identity. If any of
 * these flip, the kiosk has become a session-lingering back door.
 */
describe('ShopFloorDisplayComponent — training-preview session handling', () => {
  const auth = {
    clearAuth: vi.fn(),
    isAuthenticated: vi.fn(() => true),
    scanLogin: vi.fn(() => of({})),
    login: vi.fn(() => of({})),
  };
  const kiosk = {
    isTrainingMode: vi.fn(() => false),
    enableTrainingMode: vi.fn(),
    disableTrainingMode: vi.fn(),
  };
  const scanner = {
    setContext: vi.fn(), restart: vi.fn(), stop: vi.fn(), clearLastScan: vi.fn(),
    lastScan: () => null,
  };
  const shopFloor = {
    getOverview: vi.fn(() => of(null)),
    getClockStatus: vi.fn(() => of([])),
  };
  const events = { getUpcomingEvents: vi.fn(() => of([])) };
  const clockTypes = {
    load: vi.fn(), isWorking: () => false, isOnBreakOrLunch: () => false,
    isClockedOut: () => false, isActive: () => false,
  };
  const noop = {};

  function create(): ShopFloorDisplayComponent {
    const fixture = TestBed.createComponent(ShopFloorDisplayComponent);
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated.mockReturnValue(true);
    kiosk.isTrainingMode.mockReturnValue(false);
    // No paired-kiosk token so the pairing gate is what training mode must lift.
    localStorage.removeItem('forge-kiosk-device-token');

    TestBed.configureTestingModule({
      imports: [ShopFloorDisplayComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: KioskSessionService, useValue: kiosk },
        { provide: ScannerService, useValue: scanner },
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: EventsService, useValue: events },
        { provide: ClockEventTypeService, useValue: clockTypes },
        { provide: LoadingService, useValue: noop },
        { provide: PurchaseOrderService, useValue: noop },
        { provide: InventoryService, useValue: noop },
        { provide: ShipmentService, useValue: noop },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    // Strip the heavy kiosk template so no child components need mocking; the
    // component's TypeScript (ngOnInit guards, etc.) is unchanged.
    TestBed.overrideComponent(ShopFloorDisplayComponent, { set: { template: '', imports: [] } });
  });

  it('clears the inherited session on entry when NOT a training preview', () => {
    kiosk.isTrainingMode.mockReturnValue(false);
    const c = create();
    c.ngOnInit();
    expect(auth.clearAuth).toHaveBeenCalled();
  });

  it('PRESERVES the session when a training preview is launched by an authenticated user', () => {
    kiosk.isTrainingMode.mockReturnValue(true);
    auth.isAuthenticated.mockReturnValue(true);
    const c = create();
    c.ngOnInit();
    expect(auth.clearAuth).not.toHaveBeenCalled();
  });

  it('SECURITY: still clears when the training flag is set but no session exists (never grants one)', () => {
    kiosk.isTrainingMode.mockReturnValue(true);
    auth.isAuthenticated.mockReturnValue(false); // nothing legitimate to preserve
    const c = create();
    c.ngOnInit();
    expect(auth.clearAuth).toHaveBeenCalled();
  });

  it('SECURITY: never performs a real sign-in during a training preview (no identity switch)', () => {
    kiosk.isTrainingMode.mockReturnValue(true);
    auth.isAuthenticated.mockReturnValue(true);
    const c = create();
    c.ngOnInit();

    // Simulate a scan+PIN attempt mid-tour.
    (c as unknown as { scannedValue: { set: (v: string) => void } }).scannedValue.set('BADGE-123');
    (c as unknown as { pinControl: { setValue: (v: string) => void } }).pinControl.setValue('1234');
    (c as unknown as { onPinSubmit: () => void }).onPinSubmit();

    expect(auth.scanLogin).not.toHaveBeenCalled();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('ends training mode when the kiosk is left (cannot outlive the visit)', () => {
    kiosk.isTrainingMode.mockReturnValue(true);
    auth.isAuthenticated.mockReturnValue(true);
    const c = create();
    c.ngOnInit();
    c.ngOnDestroy();
    expect(kiosk.disableTrainingMode).toHaveBeenCalled();
  });
});
