import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { InventoryService } from '../../services/inventory.service';
import { AtpResult } from '../../models/atp.model';
import { AtpCheckComponent } from './atp-check.component';

interface CheckInternals {
  visible(): boolean;
  canCheck(): boolean;
  check(): void;
  verdict(): string | null;
}

function result(earliest: string | null): AtpResult {
  return {
    partId: 10, partNumber: 'P-10', requestedQuantity: 40, onHand: 10, allocatedToOrders: 0, scheduledReceipts: 50,
    availableToPromise: 60, earliestAvailableDate: earliest, canFulfill: earliest !== null,
  };
}

function setup(inputs: { partId: number | null; quantity: number | null; requestedDate: string | null; salesOrderLineId: number | null },
  atp: AtpResult, caps: string[] = ['CAP-INV-CORE', 'CAP-PLAN-ATP'], roles: string[] = ['Manager']) {
  const getAtp = vi.fn(() => of(atp));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: InventoryService, useValue: { getAtp } },
      { provide: CapabilityService, useValue: { isEnabled: (code: string) => caps.includes(code) } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new AtpCheckComponent());
  mockSignalInputs(component, inputs);
  TestBed.tick();
  return { check: component as unknown as CheckInternals, getAtp };
}

describe('AtpCheckComponent', () => {
  it('checks the line quantity, leaving the line itself out, and reports on time', () => {
    const { check, getAtp } = setup({ partId: 10, quantity: 40, requestedDate: '2026-11-20T00:00:00Z', salesOrderLineId: 70 }, result('2026-11-02'));

    check.check();

    expect(getAtp).toHaveBeenCalledWith(10, 40, 70);
    expect(check.verdict()).toBe('onTime');
  });

  it('reports late when the earliest date is after the requested date', () => {
    const { check } = setup({ partId: 10, quantity: 40, requestedDate: '2026-11-01T00:00:00Z', salesOrderLineId: null }, result('2026-11-09'));

    check.check();

    expect(check.verdict()).toBe('late');
  });

  it('reports short when nothing covers the quantity within the horizon', () => {
    const { check } = setup({ partId: 10, quantity: 400, requestedDate: null, salesOrderLineId: null }, result(null));

    check.check();

    expect(check.verdict()).toBe('short');
  });

  it('cannot check without a part, and hides without the capability or role', () => {
    expect(setup({ partId: null, quantity: 5, requestedDate: null, salesOrderLineId: null }, result(null)).check.canCheck()).toBe(false);
    expect(setup({ partId: 10, quantity: 5, requestedDate: null, salesOrderLineId: null }, result(null), ['CAP-INV-CORE']).check.visible()).toBe(false);
    expect(setup({ partId: 10, quantity: 5, requestedDate: null, salesOrderLineId: null }, result(null), undefined, ['PM']).check.visible()).toBe(false);
  });
});
