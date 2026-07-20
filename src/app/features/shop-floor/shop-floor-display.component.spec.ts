import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
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
 * SECURITY-CRITICAL. The shop-floor kiosk is a shared terminal that wipes any
 * inherited session on entry. The training tour uses a SEPARATE `preview` child
 * route (static `data.preview = true`), so:
 *   - the real kiosk route always clears on entry — there is no runtime input
 *     (URL param, in-memory flag, storage) that can make it skip, and
 *   - the preview is inert: mock data only, no clearAuth / scanLogin / login.
 * If any of these flip, the kiosk has regressed into a session-lingering or
 * identity-switch hazard.
 */
describe('ShopFloorDisplayComponent — kiosk vs inert training preview', () => {
  const auth = {
    clearAuth: vi.fn(),
    isAuthenticated: vi.fn(() => true),
    scanLogin: vi.fn(() => of({})),
    login: vi.fn(() => of({})),
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
  const kiosk = { isTrainingMode: () => false };
  const routeMock = { snapshot: { data: {} as Record<string, unknown> } };
  const noop = {};

  function create(preview: boolean): ShopFloorDisplayComponent {
    routeMock.snapshot.data = preview ? { preview: true } : {};
    const fixture = TestBed.createComponent(ShopFloorDisplayComponent);
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('forge-kiosk-device-token');

    TestBed.configureTestingModule({
      imports: [ShopFloorDisplayComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: routeMock },
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
    // Strip the heavy kiosk template so no child components need mocking.
    TestBed.overrideComponent(ShopFloorDisplayComponent, { set: { template: '', imports: [] } });
  });

  it('the REAL kiosk route unconditionally clears the inherited session on entry', () => {
    const c = create(false); // route data has no `preview`
    c.ngOnInit();
    expect(auth.clearAuth).toHaveBeenCalled();
  });

  it('the preview route NEVER touches auth (no clearAuth) so the trainee stays signed in', () => {
    const c = create(true);
    c.ngOnInit();
    expect(auth.clearAuth).not.toHaveBeenCalled();
  });

  it('the preview route hits no backend — renders local mock data instead', () => {
    const c = create(true);
    c.ngOnInit();
    expect(shopFloor.getClockStatus).not.toHaveBeenCalled();
    expect(shopFloor.getOverview).not.toHaveBeenCalled();
    // Representative cards exist for the tour to highlight.
    expect((c as unknown as { workers: () => unknown[] }).workers().length).toBeGreaterThan(0);
  });

  it('SECURITY: tapping a card in preview performs no real sign-in (no identity switch)', () => {
    const c = create(true);
    c.ngOnInit();
    const worker = (c as unknown as { workers: () => { userId: number }[] }).workers()[0];
    (c as unknown as { selectWorker: (w: unknown) => void }).selectWorker(worker);
    // And a defensive direct PIN submit is also a no-op.
    (c as unknown as { onPinSubmit: () => void }).onPinSubmit();
    expect(auth.scanLogin).not.toHaveBeenCalled();
    expect(auth.login).not.toHaveBeenCalled();
  });
});
