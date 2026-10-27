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
import { CapabilityService } from '../../shared/services/capability.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { LoadingService } from '../../shared/services/loading.service';
import { PurchaseOrderService } from '../purchase-orders/services/purchase-order.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { ShipmentService } from '../shipments/services/shipment.service';
import { AndonService } from '../andon/services/andon.service';

interface AndonInternals {
  andonEnabled: () => boolean;
  openAndonCount: () => number;
  showAndonBoard: () => boolean;
  andonCanAct: () => boolean;
  phase: { set(value: string): void };
  loadData(): void;
  toggleAndonBoard(): void;
  closeAndonBoard(): void;
}

describe('ShopFloorDisplayComponent — andon board', () => {
  let andonOn = true;
  const auth = { clearAuth: vi.fn(), isAuthenticated: vi.fn(() => true), scanLogin: vi.fn(), login: vi.fn(), user: () => null };
  const andon = { getOpenAlerts: vi.fn(() => of([{ id: 1 }, { id: 2 }])) };
  const shopFloor = {
    getOverview: vi.fn(() => of(null)),
    getClockStatus: vi.fn(() => of([])),
    getAvailableJobs: vi.fn(() => of([])),
  };

  function create(): AndonInternals {
    return TestBed.createComponent(ShopFloorDisplayComponent).componentInstance as unknown as AndonInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    andonOn = true;
    localStorage.removeItem('forge-kiosk-device-token');
    TestBed.configureTestingModule({
      imports: [ShopFloorDisplayComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code !== 'CAP-EXT-ANDON' || andonOn } },
        { provide: AndonService, useValue: andon },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
        { provide: KioskSessionService, useValue: { isTrainingMode: () => false } },
        { provide: ScannerService, useValue: { setContext: vi.fn(), restart: vi.fn(), stop: vi.fn(), clearLastScan: vi.fn(), lastScan: () => null } },
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: EventsService, useValue: { getUpcomingEvents: vi.fn(() => of([])) } },
        { provide: ClockEventTypeService, useValue: { load: vi.fn(), isActive: () => false } },
        { provide: LoadingService, useValue: {} },
        { provide: PurchaseOrderService, useValue: {} },
        { provide: InventoryService, useValue: {} },
        { provide: ShipmentService, useValue: {} },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn(), closeAll: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    TestBed.overrideComponent(ShopFloorDisplayComponent, { set: { template: '', imports: [] } });
  });

  it('counts the open alerts through the kiosk terminal read on each refresh', () => {
    const c = create();

    c.loadData();

    expect(andon.getOpenAlerts).toHaveBeenCalledWith(true);
    expect(c.openAndonCount()).toBe(2);
  });

  it('neither reads nor offers the board when andon is off', () => {
    andonOn = false;
    const c = create();

    c.loadData();

    expect(c.andonEnabled()).toBe(false);
    expect(andon.getOpenAlerts).not.toHaveBeenCalled();
    expect(c.openAndonCount()).toBe(0);
  });

  it('lets only a signed-in worker act on the board', () => {
    const c = create();

    c.phase.set('main');
    expect(c.andonCanAct()).toBe(false);
    c.phase.set('actions');
    expect(c.andonCanAct()).toBe(true);
    auth.isAuthenticated.mockReturnValue(false);
    c.phase.set('job-select');
    expect(c.andonCanAct()).toBe(false);
  });

  it('opens and closes the board panel', () => {
    const c = create();

    c.toggleAndonBoard();
    expect(c.showAndonBoard()).toBe(true);
    c.closeAndonBoard();
    expect(c.showAndonBoard()).toBe(false);
  });
});
