import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PurchaseOrderDetail } from '../../models/purchase-order-detail.model';
import { PurchaseOrderLine } from '../../models/purchase-order-line.model';
import { PoFulfilmentInfoComponent } from './po-fulfilment-info.component';

interface InfoInternals {
  isDropShip: Signal<boolean>;
  linkedLines: Signal<PurchaseOrderLine[]>;
  canConfirm: Signal<boolean>;
}

function po(overrides: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail {
  return {
    id: 4, poNumber: 'PO-4', status: 'Submitted', fulfilmentType: 'DropShip',
    lines: [
      { id: 40, salesOrderLineId: 11, salesOrderId: 7, salesOrderNumber: 'SO-7', salesOrderLineNumber: 1, remainingQuantity: 5 },
      { id: 41, salesOrderLineId: null, remainingQuantity: 1 },
    ] as PurchaseOrderLine[],
    ...overrides,
  } as PurchaseOrderDetail;
}

function create(detail: PurchaseOrderDetail, caps: string[], roles: string[]): InfoInternals {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CapabilityService, useValue: { isEnabled: (c: string) => caps.includes(c) } },
      { provide: AuthService, useValue: { hasAnyRole: (list: string[]) => list.some(r => roles.includes(r)) } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new PoFulfilmentInfoComponent());
  mockSignalInputs(component, { po: detail });
  return component as unknown as InfoInternals;
}

describe('PoFulfilmentInfoComponent', () => {
  it('lists the sales order lines a drop-ship buys for and offers confirm delivery to procurement', () => {
    const info = create(po(), ['CAP-P2P-DROPSHIP'], ['Procurement']);
    expect(info.isDropShip()).toBe(true);
    expect(info.linkedLines().map(l => l.id)).toEqual([40]);
    expect(info.canConfirm()).toBe(true);
  });

  it('hides confirm delivery on a draft PO, a back-to-back PO, with drop-ship off, or for a role the API refuses', () => {
    expect(create(po({ status: 'Draft' }), ['CAP-P2P-DROPSHIP'], ['Admin']).canConfirm()).toBe(false);
    expect(create(po({ fulfilmentType: 'BackToBack' }), ['CAP-P2P-DROPSHIP'], ['Admin']).canConfirm()).toBe(false);
    expect(create(po(), [], ['Admin']).canConfirm()).toBe(false);
    expect(create(po(), ['CAP-P2P-DROPSHIP'], ['Controller']).canConfirm()).toBe(false);
  });
});
