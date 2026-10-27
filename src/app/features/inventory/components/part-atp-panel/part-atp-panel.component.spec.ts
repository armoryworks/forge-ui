import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { InventoryService } from '../../services/inventory.service';
import { AtpResult } from '../../models/atp.model';
import { PartAtpPanelComponent } from './part-atp-panel.component';

interface PanelInternals {
  visible(): boolean;
  result(): AtpResult | null;
  reserved(): number;
  timeline(): unknown[];
  quantityControl: { setValue(v: number): void };
  check(): void;
}

const ATP: AtpResult = {
  partId: 10, partNumber: 'P-10', requestedQuantity: 1, onHand: 100, allocatedToOrders: 30, scheduledReceipts: 20,
  availableToPromise: 90, earliestAvailableDate: '2026-10-26', canFulfill: true,
};

function setup(caps: string[] = ['CAP-INV-CORE', 'CAP-PLAN-ATP'], roles: string[] = ['Engineer']) {
  const inventory = {
    getAtp: vi.fn(() => of(ATP)),
    getAtpTimeline: vi.fn(() => of([{ date: '2026-10-26', cumulativeSupply: 100, cumulativeDemand: 30, netAvailable: 70 }])),
    getPartBins: vi.fn(() => of([{ binContentId: 1, locationPath: 'A1', quantity: 100, reservedQuantity: 12, availableQuantity: 88, lotNumber: null, status: 'Stored' }])),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: InventoryService, useValue: inventory },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: CapabilityService, useValue: { isEnabled: (code: string) => caps.includes(code) } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new PartAtpPanelComponent());
  mockSignalInputs(component, { partId: 10 });
  TestBed.tick();
  return { panel: component as unknown as PanelInternals, inventory };
}

describe('PartAtpPanelComponent', () => {
  it('loads ATP, the weekly timeline and the reserved quantity for the part', () => {
    const { panel, inventory } = setup();

    expect(panel.visible()).toBe(true);
    expect(inventory.getAtp).toHaveBeenCalledWith(10, 1);
    expect(panel.result()?.availableToPromise).toBe(90);
    expect(panel.reserved()).toBe(12);
    expect(panel.timeline().length).toBe(1);
  });

  it('checks a different quantity', () => {
    const { panel, inventory } = setup();
    panel.quantityControl.setValue(250);

    panel.check();

    expect(inventory.getAtp).toHaveBeenLastCalledWith(10, 250);
  });

  it('stays hidden and loads nothing when ATP is off or the role cannot read inventory', () => {
    const off = setup(['CAP-INV-CORE']);
    expect(off.panel.visible()).toBe(false);
    expect(off.inventory.getAtp).not.toHaveBeenCalled();

    const pm = setup(undefined, ['PM']);
    expect(pm.panel.visible()).toBe(false);
    expect(pm.inventory.getAtp).not.toHaveBeenCalled();
  });
});
