import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SalesOrderLine } from '../../models/sales-order-line.model';
import { SalesOrderLinePurchase } from '../../models/sales-order-line-purchase.model';
import { SoLinePurchasingComponent } from './so-line-purchasing.component';

interface StripInternals {
  canDropShip: Signal<boolean>;
  canBackToBack: Signal<boolean>;
  canBuy: Signal<boolean>;
  openQuantity: Signal<number>;
  canConfirmDelivery(p: SalesOrderLinePurchase): boolean;
  readyToShip(p: SalesOrderLinePurchase): boolean;
}

function line(overrides: Partial<SalesOrderLine> = {}): SalesOrderLine {
  return {
    id: 11, partId: 3, partNumber: 'P-100', description: 'Bracket', quantity: 10, unitPrice: 5, lineTotal: 50,
    lineNumber: 1, shippedQuantity: 0, remainingQuantity: 10, isFullyShipped: false, notes: null, jobs: [], needsJob: false,
    ...overrides,
  };
}

function purchase(overrides: Partial<SalesOrderLinePurchase> = {}): SalesOrderLinePurchase {
  return {
    purchaseOrderId: 4, poNumber: 'PO-4', purchaseOrderLineId: 40, fulfilmentType: 'DropShip', status: 'Submitted',
    vendorName: 'Vendor', orderedQuantity: 6, receivedQuantity: 0, remainingQuantity: 6, expectedDeliveryDate: null,
    ...overrides,
  };
}

function create(options: { caps?: string[]; roles?: string[]; line?: SalesOrderLine; status?: string } = {}): StripInternals {
  const caps = new Set(options.caps ?? ['CAP-P2P-DROPSHIP', 'CAP-P2P-BACKTOBACK']);
  const roles = new Set(options.roles ?? ['OfficeManager']);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CapabilityService, useValue: { isEnabled: (code: string) => caps.has(code) } },
      { provide: AuthService, useValue: { hasAnyRole: (list: string[]) => list.some(r => roles.has(r)) } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new SoLinePurchasingComponent());
  mockSignalInputs(component, { salesOrderId: 7, line: options.line ?? line(), orderStatus: options.status ?? 'Confirmed' });
  return component as unknown as StripInternals;
}

describe('SoLinePurchasingComponent', () => {
  it('offers drop-ship and back-to-back for an open line of a confirmed order', () => {
    const strip = create();
    expect(strip.canDropShip()).toBe(true);
    expect(strip.canBackToBack()).toBe(true);
    expect(strip.canBuy()).toBe(true);
    expect(strip.openQuantity()).toBe(10);
  });

  it('hides each action while its capability is off or the role is not admitted', () => {
    expect(create({ caps: ['CAP-P2P-BACKTOBACK'] }).canDropShip()).toBe(false);
    expect(create({ caps: [] }).canBackToBack()).toBe(false);
    const pm = create({ roles: ['PM'] });
    expect(pm.canDropShip()).toBe(false);
    expect(pm.canBackToBack()).toBe(false);
  });

  it('counts what live POs already cover and what shipped from stock', () => {
    const strip = create({
      line: line({
        shippedQuantity: 3,
        purchases: [purchase({ orderedQuantity: 4, receivedQuantity: 2, remainingQuantity: 2 }), purchase({ purchaseOrderLineId: 41, status: 'Cancelled', orderedQuantity: 5 })],
      }),
    });
    expect(strip.openQuantity()).toBe(5);
  });

  it('frees what a short-closed PO line no longer buys', () => {
    const strip = create({ line: line({ purchases: [purchase({ orderedQuantity: 6, receivedQuantity: 0, remainingQuantity: 2 })] }) });
    expect(strip.openQuantity()).toBe(8);
  });

  it('offers nothing to buy on a draft order or a fully covered line', () => {
    expect(create({ status: 'Draft' }).canBuy()).toBe(false);
    expect(create({ line: line({ purchases: [purchase({ orderedQuantity: 10, remainingQuantity: 10 })] }) }).canBuy()).toBe(false);
  });

  it('confirms delivery only on a sent drop-ship PO with quantity left, and marks a received back-to-back ready', () => {
    const strip = create();
    expect(strip.canConfirmDelivery(purchase())).toBe(true);
    expect(strip.canConfirmDelivery(purchase({ status: 'Draft' }))).toBe(false);
    expect(strip.canConfirmDelivery(purchase({ remainingQuantity: 0 }))).toBe(false);
    expect(strip.canConfirmDelivery(purchase({ fulfilmentType: 'BackToBack' }))).toBe(false);
    expect(strip.readyToShip(purchase({ fulfilmentType: 'BackToBack', receivedQuantity: 6, remainingQuantity: 0 }))).toBe(true);
  });
});
